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
TASK_SLUG = "2406-07553-cpu-llm-decode-throughput"
SOURCE_REPOSITORY = "bespokelabsai/AutoResearchBench-Preview-Tasks"
SOURCE_COMMIT = "d955d799fdd09e023f5be947c2b2864227ed0409"
EXACT_COMMIT_RE = re.compile(r"[0-9a-fA-F]{40}")


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
    }.get(suffix, "text")


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
                    data = (Path(directory) / entry.name).read_bytes()
                    files.append(
                        {
                            "path": relative,
                            "size": len(data),
                            "sha256": hashlib.sha256(data).hexdigest(),
                            "language": language_for(relative),
                        }
                    )
                else:
                    raise BuildError(f"non-regular file is not allowed: {relative}")

    visit(task_root)
    files.sort(key=lambda item: _bytewise_path_key(item["path"]))
    if not files:
        raise BuildError(f"task files directory is empty: {task_root}")
    return files


def manifest_data(files, source_commit=SOURCE_COMMIT):
    paths = {item["path"] for item in files}
    default_file = "instruction.md" if "instruction.md" in paths else files[0]["path"]
    return {
        "sourceRepository": SOURCE_REPOSITORY,
        "sourceCommit": source_commit,
        "tasks": {
            TASK_SLUG: {
                "defaultFile": default_file,
                "files": files,
            }
        },
    }


def write_manifest(files, manifest_path=MANIFEST_PATH, source_commit=SOURCE_COMMIT):
    manifest_path = Path(manifest_path)
    payload = json.dumps(manifest_data(files, source_commit), ensure_ascii=False, indent=2)
    manifest_path.write_text(f"window.ARB_TASK_FILES = {payload};\n", encoding="utf-8")


def build(task_files_root=TASK_FILES_ROOT, manifest_path=MANIFEST_PATH, source_commit=SOURCE_COMMIT):
    files = scan_task_tree(Path(task_files_root) / TASK_SLUG)
    write_manifest(files, manifest_path, source_commit)
    return files


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


def list_source_blobs(source_repo, commit):
    output = _run_git(source_repo, "ls-tree", "-rz", "--full-tree", commit, "--", TASK_SLUG)
    blobs = []
    prefix = TASK_SLUG + "/"
    for raw_record in output.split(b"\0"):
        if not raw_record:
            continue
        header, separator, raw_path = raw_record.partition(b"\t")
        if not separator:
            raise BuildError("unexpected git ls-tree output")
        try:
            mode, object_type, object_id = header.decode("ascii").split(" ")
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
        blobs.append((relative, object_id))

    blobs.sort(key=lambda item: _bytewise_path_key(item[0]))
    paths = [path for path, _ in blobs]
    if not paths:
        raise BuildError(f"task not found at commit {commit}: {TASK_SLUG}")
    if len(paths) != len(set(paths)):
        raise BuildError("source tree contains duplicate paths")
    return blobs


def read_source_blobs(source_repo, blobs):
    result = []
    for path, object_id in blobs:
        data = _run_git(source_repo, "cat-file", "blob", object_id)
        result.append((path, data))
    return result


def _expected_metadata(source_files):
    return [
        {
            "path": path,
            "size": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
            "language": language_for(path),
        }
        for path, data in source_files
    ]


def _write_staged_tree(staging_root, source_files):
    for relative, data in source_files:
        destination = staging_root.joinpath(*PurePosixPath(relative).parts)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)


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
        actual = scan_task_tree(destination)
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
):
    source_repo = Path(source_repo)
    if not source_repo.is_dir():
        raise BuildError(f"source repository not found: {source_repo}")
    if EXACT_COMMIT_RE.fullmatch(source_ref) and source_ref.lower() != SOURCE_COMMIT:
        raise BuildError(f"--source-ref must match the approved source commit {SOURCE_COMMIT}")
    commit = resolve_exact_commit(source_repo, source_ref)
    blobs = list_source_blobs(source_repo, commit)
    source_files = read_source_blobs(source_repo, blobs)
    expected = _expected_metadata(source_files)

    task_files_root = Path(task_files_root)
    task_files_root.mkdir(parents=True, exist_ok=True)
    temp_root = Path(tempfile.mkdtemp(prefix=".task-files-sync-", dir=task_files_root))
    staging_root = temp_root / "staged"
    staging_root.mkdir()
    try:
        _write_staged_tree(staging_root, source_files)
        staged = scan_task_tree(staging_root)
        if staged != expected:
            raise BuildError("staged task files differ from the source commit")
        _install_staged_tree(staging_root, task_files_root / TASK_SLUG, expected)
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
