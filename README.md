# AutoResearchBench

This repository contains the AutoResearchBench preview.

Open `blog.html` to read the blog and browse the tasks. Each task has a result page at `tasks.html#slug`.

Task descriptions live in `task-readmes.md`. Run `python3 build_task_catalog.py` after you edit that file. Use `python3 build_task_catalog.py --assemble` only when you need to copy the source task READMEs again. Pass `--tasks-repo PATH` when the task repository is not next to this repository.
