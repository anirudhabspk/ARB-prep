import hashlib
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import build_task_files


class BuildTaskFilesTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.task_files_root = self.root / "task-files"
        self.manifest_path = self.root / "task-files-manifest.js"

    def tearDown(self):
        self.temp_dir.cleanup()

    def write_task_file(self, relative, data):
        path = self.task_files_root / build_task_files.TASK_SLUG / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def read_manifest(self):
        text = self.manifest_path.read_text(encoding="utf-8")
        prefix = "window.ARB_TASK_FILES = "
        self.assertTrue(text.startswith(prefix))
        self.assertTrue(text.endswith(";\n"))
        return json.loads(text[len(prefix) : -2])

    def git(self, repo, *args):
        return subprocess.run(
            ["git", "-C", str(repo), *args],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        ).stdout.decode().strip()

    def make_source_repo(self, files):
        repo = self.root / "source"
        repo.mkdir()
        self.git(repo, "init", "-q")
        self.git(repo, "config", "user.email", "tests@example.com")
        self.git(repo, "config", "user.name", "Test User")
        for relative, data in files.items():
            path = repo / build_task_files.TASK_SLUG / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        self.git(repo, "add", build_task_files.TASK_SLUG)
        self.git(repo, "commit", "-qm", "fixture")
        return repo, self.git(repo, "rev-parse", "HEAD")

    def test_build_writes_sorted_metadata_without_file_contents(self):
        self.write_task_file("z-last.txt", b"not embedded\n")
        self.write_task_file("instruction.md", b"# Task\n")
        self.write_task_file("environment/Dockerfile", b"FROM scratch\n")
        self.write_task_file("tests/run.py", b"print('ok')\n")
        self.write_task_file("tests/test.sh", b"#!/bin/sh\n")
        self.write_task_file("task.toml", b"version = 1\n")
        self.write_task_file("data/workload.json", b"{}\n")

        files = build_task_files.build(self.task_files_root, self.manifest_path)
        manifest = self.read_manifest()

        paths = [item["path"] for item in files]
        self.assertEqual(paths, sorted(paths, key=lambda path: path.encode("utf-8")))
        self.assertEqual(manifest["sourceRepository"], build_task_files.SOURCE_REPOSITORY)
        self.assertEqual(manifest["sourceCommit"], build_task_files.SOURCE_COMMIT)
        task = manifest["tasks"][build_task_files.TASK_SLUG]
        self.assertEqual(task["defaultFile"], "instruction.md")
        languages = {item["path"]: item["language"] for item in task["files"]}
        self.assertEqual(languages["environment/Dockerfile"], "dockerfile")
        self.assertEqual(languages["tests/run.py"], "python")
        self.assertEqual(languages["tests/test.sh"], "shell")
        self.assertEqual(languages["instruction.md"], "markdown")
        self.assertEqual(languages["task.toml"], "toml")
        self.assertEqual(languages["data/workload.json"], "json")
        self.assertNotIn("not embedded", self.manifest_path.read_text(encoding="utf-8"))
        markdown = next(item for item in task["files"] if item["path"] == "instruction.md")
        self.assertEqual(markdown["size"], len(b"# Task\n"))
        self.assertEqual(markdown["sha256"], hashlib.sha256(b"# Task\n").hexdigest())

    def test_build_rejects_symlinks(self):
        self.write_task_file("instruction.md", b"task\n")
        link = self.task_files_root / build_task_files.TASK_SLUG / "escape"
        os.symlink(self.root / "outside", link)

        with self.assertRaisesRegex(build_task_files.BuildError, "symlink"):
            build_task_files.build(self.task_files_root, self.manifest_path)
        self.assertFalse(self.manifest_path.exists())

    def test_relative_path_validation_rejects_absolute_and_parent_paths(self):
        for path in ("/absolute", "C:\\absolute", "../outside", "dir/../outside", "dir//file", "..\\outside", "dir/file..json"):
            with self.subTest(path=path):
                with self.assertRaises(build_task_files.BuildError):
                    build_task_files.validate_relative_path(path)

    def test_sync_reads_exact_commit_and_ignores_dirty_worktree(self):
        committed = {
            "instruction.md": b"committed instructions\n",
            "environment/app/run.py": b"print('committed')\n",
            "tests/test.sh": b"#!/bin/sh\nexit 0\n",
        }
        repo, commit = self.make_source_repo(committed)
        instruction = repo / build_task_files.TASK_SLUG / "instruction.md"
        instruction.write_bytes(b"dirty instructions\n")
        (repo / build_task_files.TASK_SLUG / "untracked.txt").write_bytes(b"private\n")
        self.write_task_file("old.txt", b"remove me\n")

        with mock.patch.object(build_task_files, "SOURCE_COMMIT", commit):
            files = build_task_files.sync(repo, commit, self.task_files_root, self.manifest_path)

        destination = self.task_files_root / build_task_files.TASK_SLUG
        actual_paths = sorted(
            path.relative_to(destination).as_posix() for path in destination.rglob("*") if path.is_file()
        )
        self.assertEqual(actual_paths, sorted(committed))
        for relative, expected in committed.items():
            self.assertEqual((destination / relative).read_bytes(), expected)
        self.assertEqual([item["path"] for item in files], sorted(committed))
        self.assertEqual(self.read_manifest()["sourceCommit"], commit)

    def test_sync_rejects_a_branch_or_abbreviated_commit(self):
        repo, commit = self.make_source_repo({"instruction.md": b"task\n"})
        for source_ref in ("HEAD", commit[:12]):
            with self.subTest(source_ref=source_ref):
                with self.assertRaisesRegex(build_task_files.BuildError, "full 40-character"):
                    build_task_files.sync(repo, source_ref, self.task_files_root, self.manifest_path)

    def test_sync_rejects_an_unapproved_exact_commit(self):
        repo, commit = self.make_source_repo({"instruction.md": b"task\n"})

        with self.assertRaisesRegex(build_task_files.BuildError, "approved source commit"):
            build_task_files.sync(repo, commit, self.task_files_root, self.manifest_path)

    def test_sync_rejects_committed_symlinks_without_replacing_destination(self):
        repo = self.root / "source"
        repo.mkdir()
        self.git(repo, "init", "-q")
        self.git(repo, "config", "user.email", "tests@example.com")
        self.git(repo, "config", "user.name", "Test User")
        task_root = repo / build_task_files.TASK_SLUG
        task_root.mkdir()
        os.symlink("../outside", task_root / "link")
        self.git(repo, "add", build_task_files.TASK_SLUG)
        self.git(repo, "commit", "-qm", "symlink fixture")
        commit = self.git(repo, "rev-parse", "HEAD")
        self.write_task_file("keep.txt", b"existing\n")

        with mock.patch.object(build_task_files, "SOURCE_COMMIT", commit):
            with self.assertRaisesRegex(build_task_files.BuildError, "symlink"):
                build_task_files.sync(repo, commit, self.task_files_root, self.manifest_path)

        destination = self.task_files_root / build_task_files.TASK_SLUG
        self.assertEqual((destination / "keep.txt").read_bytes(), b"existing\n")
        self.assertEqual([path.name for path in destination.iterdir()], ["keep.txt"])

    def test_published_bundle_matches_reviewed_release_shape(self):
        task_root = build_task_files.TASK_FILES_ROOT / build_task_files.TASK_SLUG
        files = build_task_files.scan_task_tree(task_root)
        paths = {item["path"] for item in files}

        self.assertEqual(len(files), 34)
        self.assertEqual(sum(item["size"] for item in files), 642_824)
        self.assertEqual(
            {path for path in paths if Path(path).name == "Dockerfile"},
            {"environment/Dockerfile", "tests/Dockerfile"},
        )
        self.assertEqual(sum(path.endswith(".py") for path in paths), 10)
        self.assertEqual(sum(path.endswith(".sh") for path in paths), 2)
        self.assertEqual(sum(path.endswith(".json") for path in paths), 12)

        manifest_text = build_task_files.MANIFEST_PATH.read_text(encoding="utf-8")
        manifest = json.loads(manifest_text.removeprefix("window.ARB_TASK_FILES = ").removesuffix(";\n"))
        self.assertEqual(manifest["sourceCommit"], build_task_files.SOURCE_COMMIT)
        self.assertEqual(manifest["tasks"][build_task_files.TASK_SLUG]["files"], files)

    def test_sync_detects_a_staged_path_mismatch_before_replacement(self):
        repo, commit = self.make_source_repo({"instruction.md": b"task\n"})
        self.write_task_file("keep.txt", b"existing\n")
        real_write = build_task_files._write_staged_tree

        def write_with_extra_file(staging_root, source_files):
            real_write(staging_root, source_files)
            (staging_root / "extra.txt").write_bytes(b"unexpected\n")

        with mock.patch.object(build_task_files, "SOURCE_COMMIT", commit):
            with mock.patch.object(build_task_files, "_write_staged_tree", write_with_extra_file):
                with self.assertRaisesRegex(build_task_files.BuildError, "staged task files differ"):
                    build_task_files.sync(repo, commit, self.task_files_root, self.manifest_path)

        destination = self.task_files_root / build_task_files.TASK_SLUG
        self.assertEqual((destination / "keep.txt").read_bytes(), b"existing\n")
        self.assertEqual([path.name for path in destination.iterdir()], ["keep.txt"])


if __name__ == "__main__":
    unittest.main()
