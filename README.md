# AutoResearchBench

This repository contains the AutoResearchBench preview.

Open `blog.html` to read the blog and browse the tasks. Each task has a result page at `tasks.html#slug`.

Task descriptions live in `task-readmes.md`. Run `python3 build_task_catalog.py` after you edit that file. Use `python3 build_task_catalog.py --assemble` only when you need to copy the source task READMEs again. Pass `--tasks-repo PATH` when the task repository is not next to this repository.

See [`evaluation-replacements.md`](evaluation-replacements.md) for evaluations that must be replaced after their reruns finish.

`build_site_data.py` accepts explicit `display_end_seconds`, `truncate_at_seconds`, and `valid_through_iteration` fields in each run. These fields make display and cutoff decisions explicit. Run `python -m unittest discover -s tests` after changing this policy.

The `api_cost_usd` field must come from the API usage ledger. Do not replace missing API costs with rollout or evaluation costs.

## Publishing task files

The public task file browser publishes readable files for all 29 catalog tasks from commit `f0cfffb69c854c4b2b05f97a2b22dd38525fb55e` in `bespokelabsai/AutoResearchBench-Preview-Tasks`.

Get explicit public release approval before copying task files. The published copy includes hidden workloads and grader code. Binary arrays, checkpoints, and compressed assets are excluded because the source viewer cannot render them. A different source commit requires a fresh file review, public release approval, and secret and personal information scan.

Sync from the committed tree, not the source repository working tree:

```sh
python build_task_files.py --sync --source-repo /path/to/AutoResearchBench-Preview-Tasks --source-ref f0cfffb69c854c4b2b05f97a2b22dd38525fb55e
```

Rebuild the metadata manifest after changing the tracked copy:

```sh
python build_task_files.py
```
