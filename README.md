# AutoResearchBench

This repository contains the AutoResearchBench website.

Open `blog.html` to read the blog and browse the tasks. Each task has a result page at `tasks.html#slug`.

Task descriptions live in `task-readmes.md`. Run `python3 build_task_catalog.py` after you edit that file. Use `python3 build_task_catalog.py --assemble` only when you need to copy the source task READMEs again. Pass `--tasks-repo PATH` when the task repository is not next to this repository.

See [`evaluation-replacements.md`](evaluation-replacements.md) for evaluations that must be replaced after their reruns finish.

`build_site_data.py` accepts explicit `display_end_seconds`, `truncate_at_seconds`, and `valid_through_iteration` fields in each run. These fields make display and cutoff decisions explicit. Run `python -m unittest discover -s tests` after changing this policy.

The `api_cost_usd` field must come from the API usage ledger. Do not replace missing API costs with rollout or evaluation costs. The current snapshot keeps stopped or cancelled evaluations while their replacements run. Both axes use the same selected runs per model. Subscription traffic uses its ledger shadow price, which is the equivalent API price, instead of its zero subscription charge.

## Refresh score comparisons

The blog uses Meta MLE's remaining-gap reward formulas and the original baseline anchors for each task. It normalizes each observation before calculating AUARC. Elo compares normalized test AUARC within each task. The effort plots use the same model score means as the main results.

The September 8 refresh uses one selected evaluation per model and task across 29 tasks. It keeps the last stopped or cancelled evaluation when a rerun is still marked as submitted. No running rerun is included. The approved Astra sparse autoencoder exception carries iteration 22's test measurement into the missing iteration 23 measurement.

Submissions count through the last phase with recorded model activity. The time plot averages each run's percentage of active elapsed time spent outside grading. The window starts with the research budget and ends at the last nonempty model response or tool call. Both numerator and denominator exclude the later empty-response tail. Only grading completed before that last response is subtracted. Historical hour estimates remain in the data for reproducibility but are no longer the time plot's x-axis.

After downloading a fresh score snapshot, run `scripts/fetch_api_costs.py --snapshot PATH` with the Horizon SDK environment to attach API ledger records for every selected evaluation. Then `scripts/refresh_score_snapshot.py --help` lists the offline snapshot inputs. After rebuilding `site-data.js`, run `node scripts/build_score_summary.cjs` to update the summary and embedded effort charts. Both use the scoring functions in `results.js`. Run `node tests/test_score_consistency.cjs` and `python3 -m unittest discover -s tests` before review.

Scoring references checked for this refresh:

- Meta MLE `common/skills/open-ended-build/references/reward_maps.md` at commit `12aad4e80a8230f7a1c7da256bece32d1b095005`.
- Preview Tasks `autoresearch-evaluations/curve-tools/build_curves.py` and `score_maps.json` at commit `d0d1eeaf5cf263354845b2b7220a8457caf2ea4a`.

The newer pipeline-wide baseline reward of 0.1 and the separate three-anchor sigmoid are not applied retrospectively. The retained task baselines agree with the formula described in Experimental setup.

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
