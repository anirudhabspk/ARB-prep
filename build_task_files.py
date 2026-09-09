#!/usr/bin/env python3

import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import tempfile
from pathlib import Path, PurePosixPath


ROOT = Path(__file__).resolve().parent
TASK_FILES_ROOT = ROOT / "task-files"
MANIFEST_PATH = ROOT / "task-files-manifest.js"
TASK_CATALOG_PATH = ROOT / "task-catalog.js"
TASK_SLUG = "cpu-llm-decode-throughput"
SOURCE_REPOSITORY = "bespokelabsai/AutoResearchExam"
SOURCE_COMMIT = "5141c07f7b9b45fa3c8b1bfa66caf86c8238862a"
EXACT_COMMIT_RE = re.compile(r"[0-9a-fA-F]{40}")
TASK_SLUG_RE = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9._-]*")
PUBLISHABLE_FILENAMES = {"Dockerfile"}
PUBLISHABLE_SUFFIXES = {".csv", ".json", ".jsonl", ".md", ".py", ".sh", ".toml", ".txt"}
TEXT_VIEWER = "text"
UNAVAILABLE_VIEWER = "unavailable"
HINT_PATH = "hints/hint.md"
LEGACY_HINT_DIRECTORIES = ("hint", "hint-brief", "val-hints-brief")


class BuildError(Exception):
    pass


def language_for(path):
    name = PurePosixPath(path).name.lower()
    suffix = PurePosixPath(path).suffix.lower()
    if name == "dockerfile":
        return "dockerfile"
    return {
        ".py": "python",
        ".sh": "shell",
        ".md": "markdown",
        ".toml": "toml",
        ".json": "json",
        ".jsonl": "json",
    }.get(suffix, "text")


def file_type_for(path):
    suffix = PurePosixPath(path).suffix.lower()
    return suffix.removeprefix(".") or "binary"


def is_publishable_path(path):
    parsed = PurePosixPath(path)
    return parsed.name in PUBLISHABLE_FILENAMES or parsed.suffix.lower() in PUBLISHABLE_SUFFIXES


def validate_task_slug(slug):
    if not isinstance(slug, str) or not TASK_SLUG_RE.fullmatch(slug) or ".." in slug:
        raise BuildError(f"unsafe task slug: {slug!r}")
    return slug


def load_task_slugs(catalog_path=TASK_CATALOG_PATH):
    catalog_path = Path(catalog_path)
    try:
        assignment = catalog_path.read_text(encoding="utf-8")
        name, separator, payload = assignment.partition("=")
        if not separator or name.strip() != "window.ARB_TASK_CATALOG":
            raise ValueError("unexpected assignment")
        entries = json.loads(payload.strip().removesuffix(";"))
        slugs = tuple(validate_task_slug(entry["slug"]) for entry in entries)
    except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise BuildError(f"invalid task catalog: {catalog_path}") from error
    if not slugs:
        raise BuildError("task catalog is empty")
    if len(slugs) != len(set(slugs)):
        raise BuildError("task catalog contains duplicate slugs")
    return slugs


def _task_slugs(task_slugs):
    slugs = load_task_slugs() if task_slugs is None else tuple(validate_task_slug(slug) for slug in task_slugs)
    if not slugs:
        raise BuildError("no task slugs requested")
    if len(slugs) != len(set(slugs)):
        raise BuildError("duplicate task slugs requested")
    return slugs


def validate_relative_path(path):
    if not path or ".." in path or path.startswith(("/", "\\")) or re.match(r"^[A-Za-z]:[\\/]", path):
        raise BuildError(f"unsafe path: {path!r}")
    if "\\" in path:
        raise BuildError(f"unsupported path separator: {path!r}")
    parts = path.split("/")
    if any(part in ("", ".", "..") for part in parts):
        raise BuildError(f"unsafe path: {path!r}")
    if PurePosixPath(path).is_absolute():
        raise BuildError(f"unsafe path: {path!r}")
    return path


def _bytewise_path_key(path):
    return path.encode("utf-8")


def validate_hint_layout(paths, task_slug):
    paths = set(paths)
    legacy_paths = sorted(
        path for path in paths if PurePosixPath(path).parts[0] in LEGACY_HINT_DIRECTORIES
    )
    if legacy_paths:
        raise BuildError(f"legacy hint path in {task_slug}: {legacy_paths[0]}")
    if HINT_PATH not in paths:
        raise BuildError(f"task is missing {HINT_PATH}: {task_slug}")


def scan_task_tree(task_root):
    task_root = Path(task_root)
    if not task_root.is_dir() or task_root.is_symlink():
        raise BuildError(f"task files directory not found: {task_root}")

    files = []

    def visit(directory, prefix=""):
        with os.scandir(directory) as entries:
            for entry in entries:
                relative = f"{prefix}/{entry.name}" if prefix else entry.name
                validate_relative_path(relative)
                mode = entry.stat(follow_symlinks=False).st_mode
                if stat.S_ISLNK(mode):
                    raise BuildError(f"symlink is not allowed: {relative}")
                if stat.S_ISDIR(mode):
                    visit(Path(directory) / entry.name, relative)
                elif stat.S_ISREG(mode):
                    if not is_publishable_path(relative):
                        continue
                    data = (Path(directory) / entry.name).read_bytes()
                    try:
                        data.decode("utf-8")
                    except UnicodeDecodeError as error:
                        raise BuildError(f"readable file is not valid UTF-8: {relative}") from error
                    files.append(
                        {
                            "path": relative,
                            "size": len(data),
                            "sha256": hashlib.sha256(data).hexdigest(),
                            "language": language_for(relative),
                            "viewer": TEXT_VIEWER,
                        }
                    )
                else:
                    raise BuildError(f"non-regular file is not allowed: {relative}")

    visit(task_root)
    files.sort(key=lambda item: _bytewise_path_key(item["path"]))
    if not files:
        raise BuildError(f"task files directory is empty: {task_root}")
    return files


def manifest_data(files_by_task, source_commit=SOURCE_COMMIT):
    tasks = {}
    for slug, files in files_by_task.items():
        paths = {item["path"] for item in files}
        viewable_paths = [item["path"] for item in files if item.get("viewer", TEXT_VIEWER) == TEXT_VIEWER]
        if not viewable_paths:
            raise BuildError(f"task has no viewable files: {slug}")
        default_file = "instruction.md" if "instruction.md" in paths else viewable_paths[0]
        tasks[slug] = {"defaultFile": default_file, "files": files}
    return {
        "sourceRepository": SOURCE_REPOSITORY,
        "sourceCommit": source_commit,
        "tasks": tasks,
    }


def write_manifest(files_by_task, manifest_path=MANIFEST_PATH, source_commit=SOURCE_COMMIT):
    manifest_path = Path(manifest_path)
    payload = json.dumps(manifest_data(files_by_task, source_commit), ensure_ascii=False, indent=2)
    manifest_path.write_text(f"window.ARB_TASK_FILES = {payload};\n", encoding="utf-8")


def build(
    task_files_root=TASK_FILES_ROOT,
    manifest_path=MANIFEST_PATH,
    source_commit=SOURCE_COMMIT,
    task_slugs=None,
):
    slugs = _task_slugs(task_slugs)
    unavailable = load_unavailable_files(manifest_path)
    files_by_task = {}
    for slug in slugs:
        files = scan_task_tree(Path(task_files_root) / slug)
        files.extend(unavailable.get(slug, ()))
        files.sort(key=lambda item: _bytewise_path_key(item["path"]))
        if len({item["path"] for item in files}) != len(files):
            raise BuildError(f"manifest contains duplicate paths for task: {slug}")
        validate_hint_layout((item["path"] for item in files), slug)
        files_by_task[slug] = files
    write_manifest(files_by_task, manifest_path, source_commit)
    return files_by_task


def load_unavailable_files(manifest_path):
    manifest_path = Path(manifest_path)
    if not manifest_path.exists():
        return {}
    try:
        assignment = manifest_path.read_text(encoding="utf-8")
        name, separator, payload = assignment.partition("=")
        if not separator or name.strip() != "window.ARB_TASK_FILES":
            raise ValueError("unexpected assignment")
        manifest = json.loads(payload.strip().removesuffix(";"))
        result = {}
        for slug, task in manifest.get("tasks", {}).items():
            validate_task_slug(slug)
            unavailable = []
            for item in task.get("files", ()):
                if item.get("viewer") != UNAVAILABLE_VIEWER:
                    continue
                path = validate_relative_path(item["path"])
                size = item["size"]
                if not isinstance(size, int) or isinstance(size, bool) or size < 0:
                    raise ValueError("invalid size")
                unavailable.append(
                    {
                        "path": path,
                        "size": size,
                        "language": file_type_for(path),
                        "viewer": UNAVAILABLE_VIEWER,
                    }
                )
            result[slug] = unavailable
        return result
    except (BuildError, KeyError, OSError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise BuildError(f"invalid task files manifest: {manifest_path}") from error


def _run_git(source_repo, *args):
    try:
        return subprocess.run(
            ["git", "-C", str(source_repo), *args],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        ).stdout
    except (OSError, subprocess.CalledProcessError) as error:
        detail = ""
        if isinstance(error, subprocess.CalledProcessError):
            detail = error.stderr.decode("utf-8", errors="replace").strip()
        raise BuildError(detail or f"git command failed: {' '.join(args)}") from error


def resolve_exact_commit(source_repo, source_ref):
    if not EXACT_COMMIT_RE.fullmatch(source_ref):
        raise BuildError("--source-ref must be a full 40-character commit ID")
    resolved = _run_git(source_repo, "rev-parse", "--verify", f"{source_ref}^{{commit}}")
    commit = resolved.decode("ascii").strip().lower()
    if commit != source_ref.lower():
        raise BuildError("--source-ref did not resolve to the exact requested commit")
    return commit


def list_source_blobs(source_repo, commit, task_slug):
    task_slug = validate_task_slug(task_slug)
    output = _run_git(source_repo, "ls-tree", "-rlz", "--full-tree", commit, "--", task_slug)
    blobs = []
    prefix = task_slug + "/"
    for raw_record in output.split(b"\0"):
        if not raw_record:
            continue
        header, separator, raw_path = raw_record.partition(b"\t")
        if not separator:
            raise BuildError("unexpected git ls-tree output")
        try:
            mode, object_type, object_id, raw_size = header.decode("ascii").split()
            size = int(raw_size)
            full_path = raw_path.decode("utf-8")
        except (UnicodeDecodeError, ValueError) as error:
            raise BuildError("source tree contains an unsupported filename") from error
        if not full_path.startswith(prefix):
            raise BuildError(f"source path is outside the task: {full_path!r}")
        relative = validate_relative_path(full_path[len(prefix) :])
        if mode == "120000":
            raise BuildError(f"symlink is not allowed: {relative}")
        if object_type != "blob" or mode not in ("100644", "100755"):
            raise BuildError(f"unsupported git entry {mode} {object_type}: {relative}")
        viewer = TEXT_VIEWER if is_publishable_path(relative) else UNAVAILABLE_VIEWER
        blobs.append((relative, object_id, size, viewer))

    blobs.sort(key=lambda item: _bytewise_path_key(item[0]))
    paths = [path for path, *_ in blobs]
    if not paths:
        raise BuildError(f"task has no files at commit {commit}: {task_slug}")
    if len(paths) != len(set(paths)):
        raise BuildError("source tree contains duplicate paths")
    return blobs


def read_source_blobs(source_repo, blobs):
    result = []
    for path, object_id, _size, viewer in blobs:
        if viewer != TEXT_VIEWER:
            continue
        data = _run_git(source_repo, "cat-file", "blob", object_id)
        try:
            data.decode("utf-8")
        except UnicodeDecodeError as error:
            raise BuildError(f"readable file is not valid UTF-8: {path}") from error
        result.append((path, data))
    return result


def _expected_metadata(source_files):
    return [
        {
            "path": path,
            "size": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
            "language": language_for(path),
            "viewer": TEXT_VIEWER,
        }
        for path, data in source_files
    ]


def _source_metadata(blobs, source_files):
    readable = {item["path"]: item for item in _expected_metadata(source_files)}
    return [
        readable[path]
        if viewer == TEXT_VIEWER
        else {
            "path": path,
            "size": size,
            "language": file_type_for(path),
            "viewer": UNAVAILABLE_VIEWER,
        }
        for path, _object_id, size, viewer in blobs
    ]


def _write_staged_tree(staging_root, source_files):
    for relative, data in source_files:
        destination = staging_root.joinpath(*PurePosixPath(relative).parts)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)


def _scan_task_trees(task_files_root, task_slugs):
    return {slug: scan_task_tree(Path(task_files_root) / slug) for slug in task_slugs}


def _install_staged_tree(staging_root, destination, expected):
    destination = Path(destination)
    if destination.is_symlink():
        raise BuildError(f"destination may not be a symlink: {destination}")
    backup = staging_root.parent / "previous"
    had_previous = destination.exists()
    if had_previous:
        os.replace(destination, backup)
    try:
        os.replace(staging_root, destination)
        actual = _scan_task_trees(destination, expected)
        if actual != expected:
            raise BuildError("installed task files differ from the source commit")
    except Exception:
        if destination.exists():
            shutil.rmtree(destination)
        if had_previous and backup.exists():
            os.replace(backup, destination)
        raise


def sync(
    source_repo,
    source_ref,
    task_files_root=TASK_FILES_ROOT,
    manifest_path=MANIFEST_PATH,
    task_slugs=None,
):
    source_repo = Path(source_repo)
    if not source_repo.is_dir():
        raise BuildError(f"source repository not found: {source_repo}")
    if EXACT_COMMIT_RE.fullmatch(source_ref) and source_ref.lower() != SOURCE_COMMIT:
        raise BuildError(f"--source-ref must match the approved source commit {SOURCE_COMMIT}")
    commit = resolve_exact_commit(source_repo, source_ref)
    slugs = _task_slugs(task_slugs)
    source_blobs_by_task = {slug: list_source_blobs(source_repo, commit, slug) for slug in slugs}
    for slug, blobs in source_blobs_by_task.items():
        validate_hint_layout((path for path, *_ in blobs), slug)
    source_files_by_task = {
        slug: read_source_blobs(source_repo, source_blobs_by_task[slug]) for slug in slugs
    }
    expected_readable = {slug: _expected_metadata(files) for slug, files in source_files_by_task.items()}
    expected = {
        slug: _source_metadata(source_blobs_by_task[slug], source_files_by_task[slug]) for slug in slugs
    }

    task_files_root = Path(task_files_root)
    task_files_root.parent.mkdir(parents=True, exist_ok=True)
    temp_root = Path(tempfile.mkdtemp(prefix=".task-files-sync-", dir=task_files_root.parent))
    staging_root = temp_root / "staged"
    staging_root.mkdir()
    try:
        for slug, source_files in source_files_by_task.items():
            task_staging_root = staging_root / slug
            task_staging_root.mkdir()
            _write_staged_tree(task_staging_root, source_files)
            if scan_task_tree(task_staging_root) != expected_readable[slug]:
                raise BuildError("staged task files differ from the source commit")
        _install_staged_tree(staging_root, task_files_root, expected_readable)
        write_manifest(expected, manifest_path, commit)
    finally:
        shutil.rmtree(temp_root, ignore_errors=True)
    return expected


def main():
    parser = argparse.ArgumentParser(description="Build the published task-files manifest")
    parser.add_argument("--sync", action="store_true", help="copy files from an exact source commit before building")
    parser.add_argument("--source-repo", type=Path, help="path to the source task repository")
    parser.add_argument("--source-ref", help="full 40-character source commit ID")
    args = parser.parse_args()

    try:
        if args.sync:
            if args.source_repo is None or args.source_ref is None:
                parser.error("--sync requires --source-repo and --source-ref")
            sync(args.source_repo, args.source_ref)
        else:
            if args.source_repo is not None or args.source_ref is not None:
                parser.error("--source-repo and --source-ref require --sync")
            build()
    except BuildError as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
