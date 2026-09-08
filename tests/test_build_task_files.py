import ast
import hashlib
import json
import os
import subprocess
import tempfile
import unittest
from collections import Counter
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

    def write_task_file(self, relative, data, slug=build_task_files.TASK_SLUG):
        path = self.task_files_root / slug / relative
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

        files = build_task_files.build(
            self.task_files_root,
            self.manifest_path,
            task_slugs=(build_task_files.TASK_SLUG,),
        )[build_task_files.TASK_SLUG]
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
            build_task_files.build(
                self.task_files_root,
                self.manifest_path,
                task_slugs=(build_task_files.TASK_SLUG,),
            )
        self.assertFalse(self.manifest_path.exists())

    def test_build_excludes_binary_files_but_still_checks_excluded_entries(self):
        self.write_task_file("instruction.md", b"task\n")
        self.write_task_file("data.npy", b"binary array")

        files = build_task_files.build(
            self.task_files_root,
            self.manifest_path,
            task_slugs=(build_task_files.TASK_SLUG,),
        )[build_task_files.TASK_SLUG]

        self.assertEqual([item["path"] for item in files], ["instruction.md"])

        binary_link = self.task_files_root / build_task_files.TASK_SLUG / "excluded.npy"
        os.symlink(self.root / "outside", binary_link)
        with self.assertRaisesRegex(build_task_files.BuildError, "symlink"):
            build_task_files.build(
                self.task_files_root,
                self.manifest_path,
                task_slugs=(build_task_files.TASK_SLUG,),
            )

    def test_sync_lists_binary_files_as_unavailable_without_copying_them(self):
        source_files = {
            "instruction.md": b"task\n",
            "tests/check.py": b"print('ok')\n",
            "data/panel.npz": b"binary npz",
            "data/rows.npy": b"binary npy",
            "weights/model.safetensors": b"binary weights",
            "data/archive.gz": b"compressed",
        }
        repo, commit = self.make_source_repo(source_files)

        with mock.patch.object(build_task_files, "SOURCE_COMMIT", commit):
            files = build_task_files.sync(
                repo,
                commit,
                self.task_files_root,
                self.manifest_path,
                task_slugs=(build_task_files.TASK_SLUG,),
            )[build_task_files.TASK_SLUG]

        by_path = {item["path"]: item for item in files}
        self.assertEqual(set(by_path), set(source_files))
        self.assertEqual(by_path["instruction.md"]["viewer"], "text")
        self.assertEqual(by_path["tests/check.py"]["viewer"], "text")
        for path in ("data/panel.npz", "data/rows.npy", "weights/model.safetensors", "data/archive.gz"):
            self.assertEqual(by_path[path]["viewer"], "unavailable")
            self.assertNotIn("sha256", by_path[path])
            self.assertFalse((self.task_files_root / build_task_files.TASK_SLUG / path).exists())

        copied = {
            path.relative_to(self.task_files_root / build_task_files.TASK_SLUG).as_posix()
            for path in (self.task_files_root / build_task_files.TASK_SLUG).rglob("*")
            if path.is_file()
        }
        self.assertEqual(copied, {"instruction.md", "tests/check.py"})

        rebuilt = build_task_files.build(
            self.task_files_root,
            self.manifest_path,
            source_commit=commit,
            task_slugs=(build_task_files.TASK_SLUG,),
        )[build_task_files.TASK_SLUG]
        self.assertEqual(rebuilt, files)

    def test_sync_rejects_invalid_utf8_readable_file_before_replacing_destination(self):
        repo, commit = self.make_source_repo({"instruction.md": b"\xff\xfe"})
        self.write_task_file("keep.txt", b"existing\n")

        with mock.patch.object(build_task_files, "SOURCE_COMMIT", commit):
            with self.assertRaisesRegex(build_task_files.BuildError, "UTF-8"):
                build_task_files.sync(
                    repo,
                    commit,
                    self.task_files_root,
                    self.manifest_path,
                    task_slugs=(build_task_files.TASK_SLUG,),
                )

        destination = self.task_files_root / build_task_files.TASK_SLUG
        self.assertEqual((destination / "keep.txt").read_bytes(), b"existing\n")

    def test_relative_path_validation_rejects_absolute_and_parent_paths(self):
        for path in ("/absolute", "C:\\absolute", "../outside", "dir/../outside", "dir//file", "..\\outside", "dir/file..json"):
            with self.subTest(path=path):
                with self.assertRaises(build_task_files.BuildError):
                    build_task_files.validate_relative_path(path)

    def test_load_task_slugs_uses_catalog_order_and_rejects_duplicates(self):
        catalog_path = self.root / "task-catalog.js"
        catalog_path.write_text(
            'window.ARB_TASK_CATALOG = [{"slug":"task-b"},{"slug":"task-a"}];\n',
            encoding="utf-8",
        )
        self.assertEqual(build_task_files.load_task_slugs(catalog_path), ("task-b", "task-a"))

        catalog_path.write_text(
            'window.ARB_TASK_CATALOG = [{"slug":"task-a"},{"slug":"task-a"}];\n',
            encoding="utf-8",
        )
        with self.assertRaisesRegex(build_task_files.BuildError, "duplicate"):
            build_task_files.load_task_slugs(catalog_path)

    def test_repository_catalog_contains_29_safe_unique_slugs(self):
        slugs = build_task_files.load_task_slugs()

        self.assertEqual(len(slugs), 29)
        self.assertEqual(len(set(slugs)), 29)
        self.assertTrue(all(build_task_files.validate_task_slug(slug) == slug for slug in slugs))
        self.assertTrue((build_task_files.ROOT / ".nojekyll").is_file())

    def test_build_writes_multiple_task_bundles(self):
        self.write_task_file("README.md", b"task a\n", slug="task-a")
        self.write_task_file("instruction.md", b"task b\n", slug="task-b")

        files_by_task = build_task_files.build(
            self.task_files_root,
            self.manifest_path,
            task_slugs=("task-b", "task-a"),
        )
        manifest = self.read_manifest()

        self.assertEqual(tuple(files_by_task), ("task-b", "task-a"))
        self.assertEqual(tuple(manifest["tasks"]), ("task-b", "task-a"))
        self.assertEqual(manifest["tasks"]["task-b"]["defaultFile"], "instruction.md")
        self.assertEqual(manifest["tasks"]["task-a"]["defaultFile"], "README.md")

    def test_sync_copies_readable_files_for_multiple_tasks(self):
        repo = self.root / "source"
        repo.mkdir()
        self.git(repo, "init", "-q")
        self.git(repo, "config", "user.email", "tests@example.com")
        self.git(repo, "config", "user.name", "Test User")
        source_files = {
            "task-a/instruction.md": b"task a\n",
            "task-a/data.npy": b"binary array",
            "task-b/Dockerfile": b"FROM scratch\n",
            "task-b/rows.csv": b"x,y\n1,2\n",
            "task-b/archive.gz": b"compressed",
        }
        for relative, data in source_files.items():
            path = repo / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        self.git(repo, "add", "task-a", "task-b")
        self.git(repo, "commit", "-qm", "fixture")
        commit = self.git(repo, "rev-parse", "HEAD")
        self.write_task_file("old.txt", b"stale\n", slug="stale-task")

        with mock.patch.object(build_task_files, "SOURCE_COMMIT", commit):
            files_by_task = build_task_files.sync(
                repo,
                commit,
                self.task_files_root,
                self.manifest_path,
                task_slugs=("task-a", "task-b"),
            )

        self.assertEqual(
            {item["path"] for item in files_by_task["task-a"]},
            {"instruction.md", "data.npy"},
        )
        self.assertEqual(
            {item["path"] for item in files_by_task["task-b"]},
            {"Dockerfile", "rows.csv", "archive.gz"},
        )
        self.assertEqual(
            next(item for item in files_by_task["task-a"] if item["path"] == "data.npy")["viewer"],
            "unavailable",
        )
        self.assertEqual(
            {path.name for path in self.task_files_root.iterdir()},
            {"task-a", "task-b"},
        )

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
            files = build_task_files.sync(
                repo,
                commit,
                self.task_files_root,
                self.manifest_path,
                task_slugs=(build_task_files.TASK_SLUG,),
            )[build_task_files.TASK_SLUG]

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
                    build_task_files.sync(
                        repo,
                        source_ref,
                        self.task_files_root,
                        self.manifest_path,
                        task_slugs=(build_task_files.TASK_SLUG,),
                    )

    def test_sync_rejects_an_unapproved_exact_commit(self):
        repo, commit = self.make_source_repo({"instruction.md": b"task\n"})

        with self.assertRaisesRegex(build_task_files.BuildError, "approved source commit"):
            build_task_files.sync(
                repo,
                commit,
                self.task_files_root,
                self.manifest_path,
                task_slugs=(build_task_files.TASK_SLUG,),
            )

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
                build_task_files.sync(
                    repo,
                    commit,
                    self.task_files_root,
                    self.manifest_path,
                    task_slugs=(build_task_files.TASK_SLUG,),
                )

        destination = self.task_files_root / build_task_files.TASK_SLUG
        self.assertEqual((destination / "keep.txt").read_bytes(), b"existing\n")
        self.assertEqual([path.name for path in destination.iterdir()], ["keep.txt"])

    def test_published_bundle_matches_reviewed_release_shape(self):
        slugs = build_task_files.load_task_slugs()
        files_by_task = build_task_files._scan_task_trees(build_task_files.TASK_FILES_ROOT, slugs)
        files = [item for task_files in files_by_task.values() for item in task_files]

        self.assertEqual(tuple(files_by_task), slugs)
        self.assertEqual({path.name for path in build_task_files.TASK_FILES_ROOT.iterdir()}, set(slugs))
        self.assertEqual(len(files), 678)
        self.assertEqual(sum(item["size"] for item in files), 3_763_974)
        self.assertEqual(sum(item["path"].endswith(".py") for item in files), 225)
        self.assertEqual(sum(Path(item["path"]).name == "Dockerfile" for item in files), 58)
        self.assertTrue(all(build_task_files.is_publishable_path(item["path"]) for item in files))
        self.assertTrue(all(item["viewer"] == build_task_files.TEXT_VIEWER for item in files))

        python_files = build_task_files.TASK_FILES_ROOT.rglob("*.py")
        self.assertTrue(
            all(ast.get_docstring(ast.parse(path.read_text(encoding="utf-8")), clean=False) is None for path in python_files)
        )

        manifest_text = build_task_files.MANIFEST_PATH.read_text(encoding="utf-8")
        manifest = json.loads(manifest_text.removeprefix("window.ARB_TASK_FILES = ").removesuffix(";\n"))
        self.assertEqual(manifest["sourceCommit"], build_task_files.SOURCE_COMMIT)
        self.assertEqual(tuple(manifest["tasks"]), slugs)
        manifest_files = [item for slug in slugs for item in manifest["tasks"][slug]["files"]]
        self.assertEqual(len(manifest_files), 1_058)
        self.assertEqual(sum(item["viewer"] == build_task_files.TEXT_VIEWER for item in manifest_files), 678)
        self.assertEqual(sum(item["viewer"] == build_task_files.UNAVAILABLE_VIEWER for item in manifest_files), 380)
        self.assertEqual(
            Counter(
                Path(item["path"]).suffix
                for item in manifest_files
                if item["viewer"] == build_task_files.UNAVAILABLE_VIEWER
            ),
            {".npz": 206, ".npy": 145, ".safetensors": 23, ".gz": 6},
        )
        for slug in slugs:
            viewable = [
                item for item in manifest["tasks"][slug]["files"]
                if item["viewer"] == build_task_files.TEXT_VIEWER
            ]
            self.assertEqual(viewable, files_by_task[slug])

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
                    build_task_files.sync(
                        repo,
                        commit,
                        self.task_files_root,
                        self.manifest_path,
                        task_slugs=(build_task_files.TASK_SLUG,),
                    )

        destination = self.task_files_root / build_task_files.TASK_SLUG
        self.assertEqual((destination / "keep.txt").read_bytes(), b"existing\n")
        self.assertEqual([path.name for path in destination.iterdir()], ["keep.txt"])

    def test_sync_rolls_back_the_whole_root_if_post_install_verification_fails(self):
        repo = self.root / "source"
        repo.mkdir()
        self.git(repo, "init", "-q")
        self.git(repo, "config", "user.email", "tests@example.com")
        self.git(repo, "config", "user.name", "Test User")
        for relative, data in {
            "task-a/instruction.md": b"new task a\n",
            "task-b/instruction.md": b"new task b\n",
        }.items():
            path = repo / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        self.git(repo, "add", "task-a", "task-b")
        self.git(repo, "commit", "-qm", "fixture")
        commit = self.git(repo, "rev-parse", "HEAD")
        self.write_task_file("keep.txt", b"old task a\n", slug="task-a")
        self.write_task_file("keep.txt", b"old stale task\n", slug="stale-task")

        real_scan = build_task_files._scan_task_trees

        def reject_installed_tree(task_files_root, task_slugs):
            real_scan(task_files_root, task_slugs)
            raise build_task_files.BuildError("forced post-install failure")

        with mock.patch.object(build_task_files, "SOURCE_COMMIT", commit):
            with mock.patch.object(build_task_files, "_scan_task_trees", reject_installed_tree):
                with self.assertRaisesRegex(build_task_files.BuildError, "forced post-install failure"):
                    build_task_files.sync(
                        repo,
                        commit,
                        self.task_files_root,
                        self.manifest_path,
                        task_slugs=("task-a", "task-b"),
                    )

        self.assertEqual(
            {
                path.relative_to(self.task_files_root).as_posix(): path.read_bytes()
                for path in self.task_files_root.rglob("*")
                if path.is_file()
            },
            {
                "task-a/keep.txt": b"old task a\n",
                "stale-task/keep.txt": b"old stale task\n",
            },
        )
        self.assertFalse(self.manifest_path.exists())


if __name__ == "__main__":
    unittest.main()
