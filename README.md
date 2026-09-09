# AutoResearchExam

This repository contains the AutoResearchExam website.

Open `blog.html` to read the blog and browse the tasks. Each task has a result page at `tasks.html#slug`.

Task descriptions live in `task-readmes.md`. Run `python3 build_task_catalog.py` after you edit that file. Use `python3 build_task_catalog.py --assemble` only when you need to copy the source task READMEs again. Pass `--tasks-repo PATH` when the task repository is not next to this repository.

See [`evaluation-replacements.md`](evaluation-replacements.md) for the replacement history and the excluded FasterGCG runs.

`build_site_data.py` accepts explicit `display_end_seconds`, `truncate_at_seconds`, and `valid_through_iteration` fields in each run. These fields make display and cutoff decisions explicit. Run `python -m unittest discover -s tests` after changing this policy.

The `api_cost_usd` field must come from the API usage ledger, except evaluation `002958c6-cb2f-46e3-8536-ba8d421083af`, which uses an approved $145 estimate because its ledger is empty. Do not replace other missing API costs with rollout or evaluation costs. The scheduled refresh publishes a current evaluation only after it completes. It keeps the prior published result while a replacement runs. It also accepts exact evaluation IDs that are listed as approved flat extensions or accepted model failures when Horizon recorded a full validation and hidden test checkpoint. Approval never transfers to a replacement evaluation ID. Both axes use the same selected runs per model. Subscription traffic uses its ledger shadow price, which is the equivalent API price, instead of its zero subscription charge.

## Refresh score comparisons

The blog uses Meta MLE's remaining-gap reward formulas and the original final-panel baseline anchors for each task. It recovers the raw metric from each validation or hidden-test observation, then applies that same final-panel mapping before calculating AUARC. The source split is used only to invert legacy observations that lack a native raw metric. Elo compares normalized test AUARC within each task. The effort plots use the same model score means as the main results.

The 2 a.m. September 8 refresh uses `--include-current-runs`. It selects one latest evaluation per model and task across 29 tasks. It publishes completed replacements and keeps prior results while replacements run. Failed and known crashed runs are excluded unless their exact evaluation ID is an approved flat extension or accepted model failure with a fully graded checkpoint. Every published run holds its validation-selected score flat through hour 24 when its observations end early. The CPU LLM decode GPT-5.6 Sol evaluation uses an approved $145 API cost estimate because its Horizon ledger is empty. The default offline builder retains the separate terminal result policy for reproducing earlier snapshots. The approved Astra sparse autoencoder exception carries iteration 22's test measurement into the missing iteration 23 measurement.

The later September 8 refresh marks 21 replacement evaluations complete. Those runs used 23 hours for research and reserved 1 hour for infrastructure. The September 9 refresh adds 15 completed reruns that used the full 24 hour research window. FasterGCG remains on its prior published results. Every task plot and average uses a 24 hour window.

Submissions count through the last phase with recorded model activity. The time plot averages each run's percentage of active elapsed time spent outside grading. The window starts with the research budget and ends at the last nonempty model response or tool call. Both numerator and denominator exclude the later empty-response tail. Only grading completed before that last response is subtracted. Historical hour estimates remain in the data for reproducibility but are no longer the time plot's x-axis.

Use `autoresearch-evaluations/curve-tools/snapshot_evaluations.py` in the Preview Tasks repository to download status, score, timing, message, and API cost data. The tool can download only changed evaluations and pin an excluded task to the prior site data. Then run `scripts/refresh_score_snapshot.py --include-current-runs`; `--help` lists the offline snapshot inputs. Run `node scripts/build_score_summary.cjs` to update the summary and embedded effort chart. Run `node scripts/compare_score_snapshots.cjs` to record score and ranking changes. Finish with `node tests/test_score_consistency.cjs` and `python3 -m unittest discover -s tests`.

Scoring references checked for this refresh:

- Meta MLE `common/skills/open-ended-build/references/reward_maps.md` at commit `12aad4e80a8230f7a1c7da256bece32d1b095005`.
- Preview Tasks `autoresearch-evaluations/curve-tools/build_curves.py` and `score_maps.json` at commit `d0d1eeaf5cf263354845b2b7220a8457caf2ea4a`.

The newer pipeline-wide baseline reward of 0.1 and the separate three-anchor sigmoid are not applied retrospectively. The retained task baselines agree with the formula described in Experimental setup.

## General analysis plot review

Run `python3 analysis/general_analysis/build.py` after refreshing `site-data.js`. It rebuilds the candidate general analysis plots and `general-analysis-review.html` from the same selected evaluation IDs as the benchmark pages. See [`analysis/general_analysis/README.md`](analysis/general_analysis/README.md) for the source and freshness limits.

## Publishing task files

The public task file browser lists all files for the 29 catalog tasks from commit `8f9db7e09ac21446f08d3751e08414562efeb32f` in `bespokelabsai/AutoResearchBench-Preview-Tasks`.

Get explicit public release approval before copying task files. The published copy includes hidden workloads and grader code. Binary arrays, checkpoints, and compressed assets are listed in the browser as unavailable, but their payloads are not copied. A different source commit requires a fresh file review, public release approval, and secret and personal information scan.

Sync from the committed tree, not the source repository working tree:

```sh
python build_task_files.py --sync --source-repo /path/to/AutoResearchBench-Preview-Tasks --source-ref 8f9db7e09ac21446f08d3751e08414562efeb32f
```

Rebuild the metadata manifest after changing the tracked copy:

```sh
python build_task_files.py
```
