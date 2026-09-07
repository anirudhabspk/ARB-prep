# AutoResearchBench

This repository contains the AutoResearchBench preview.

Open `blog.html` to read the blog and browse the tasks. Each task has a result page at `tasks.html#slug`.

Task descriptions live in `task-readmes.md`. Run `python3 build_task_catalog.py` after you edit that file. Use `python3 build_task_catalog.py --assemble` only when you need to copy the source task READMEs again. Pass `--tasks-repo PATH` when the task repository is not next to this repository.

See [`evaluation-replacements.md`](evaluation-replacements.md) for evaluations that must be replaced after their reruns finish.

`build_site_data.py` accepts explicit `display_end_seconds`, `truncate_at_seconds`, and `valid_through_iteration` fields in each run. These fields make display and cutoff decisions explicit. Run `python -m unittest discover -s tests` after changing this policy.

The `api_cost_usd` field must come from the API usage ledger. Do not replace missing API costs with rollout or evaluation costs.
