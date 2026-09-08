# Harness comparison notes

Every curve uses Horizon's grading-completion timestamps. At each hour, the highest validation score available by then selects the solution. Its hidden test score is shown only when that grade is also available. Ties keep the earlier solution. Missing grades are blank; recorded zero scores remain zero.

The table counts evaluations whose validation grading finished within 43,200 seconds. This matches the plots' time limit. It replaces the previous submission counts. Agent/verifier percentages were removed because the available records do not establish a complete breakdown.

Claude Code on CPU decode has no grade inside the window. Its last assistant message was about 49 minutes after the first message, but its only grade arrived at 12.34 hours. The cause of that gap remains unresolved. Neither a zero score nor 11 hours of verifier time can be inferred from it.

All three Sol baselines now use replacement runs with more than 12 hours of recorded results. Exact replacement IDs are in [TODO.md](../../TODO.md).

One run per harness and model supports a descriptive comparison, not a reliable estimate of an average harness advantage.

## Sources

Pinned index commit: `e0e520e4b5d183720f1ae9e57424873a1f59a5ec`. The selected iteration records are in [source.json](source.json). Rebuild with `python3 build_harness_data.py` from the repository root.

### CPU LLM decode throughput

- standard_opus, v8: [evaluation](https://horizon.bespokelabs.ai/evaluations/4015d5cf-c5c2-4b92-af7c-b35f5ca3e3f1).
- standard_sol, v8: [evaluation](https://horizon.bespokelabs.ai/evaluations/002958c6-cb2f-46e3-8536-ba8d421083af).
- codex_sol, v8: [evaluation](https://horizon.bespokelabs.ai/evaluations/967fb4cf-f9ae-40ca-9476-0c7e5075697d).
- claude_opus, v8: [evaluation](https://horizon.bespokelabs.ai/evaluations/3e6ce694-3926-4a39-9cfd-355733663c18).

### Shortest valid CI L2 ECE

- standard_opus, v10: [evaluation](https://horizon.bespokelabs.ai/evaluations/2082b3fe-ac32-4952-850f-aa643aa3226d).
- standard_sol, v10: [evaluation](https://horizon.bespokelabs.ai/evaluations/9cce644b-508d-49bf-998c-6fa67fdb44e9).
- codex_sol, v10: [evaluation](https://horizon.bespokelabs.ai/evaluations/7a73f8a2-8a0b-4537-a9ed-400e0f2b99b3).
- claude_opus, v10: [evaluation](https://horizon.bespokelabs.ai/evaluations/92cddea6-7803-4492-aff8-88bfe708b9cc).

### HiCARD latent encoder

- standard_opus, v9: [evaluation](https://horizon.bespokelabs.ai/evaluations/bc033aef-3253-4ab1-b0ec-c23e04113753).
- standard_sol, v9: [evaluation](https://horizon.bespokelabs.ai/evaluations/c3d3ee62-2656-410a-be30-811076c68570).
- codex_sol, v9: [evaluation](https://horizon.bespokelabs.ai/evaluations/79e80e6d-7754-4a2d-9312-ec6ba4700beb).
- claude_opus, v9: [evaluation](https://horizon.bespokelabs.ai/evaluations/5bc3c570-c905-4f5a-9f18-5cfb33a97eb8).

### Budgeted Covtype dual market

- standard_opus, v18: [evaluation](https://horizon.bespokelabs.ai/evaluations/141d827b-df90-4311-9a32-510738589856).
- standard_sol, v18: [evaluation](https://horizon.bespokelabs.ai/evaluations/a9dc3f9a-b35d-4c8a-86b7-78db70bc10ef).
- codex_sol, v18: [evaluation](https://horizon.bespokelabs.ai/evaluations/f1bd7743-4ba6-4d6f-84c0-7fb8a2c97bcf).
- claude_opus, v18: [evaluation](https://horizon.bespokelabs.ai/evaluations/b7e8fd13-6656-4367-a3a6-deef2b1c3438).

### CausalRivers held out station graph AUROC

- standard_opus, v8: [evaluation](https://horizon.bespokelabs.ai/evaluations/18c36610-cc0a-442c-a64a-63b0e50894b3).
- standard_sol, v8: [evaluation](https://horizon.bespokelabs.ai/evaluations/6d152e55-d12e-49c4-be07-78a692f15ebb).
- codex_sol, v8: [evaluation](https://horizon.bespokelabs.ai/evaluations/5b88c008-dd09-45a8-a13f-6cb4bcd18dc4).
- claude_opus, v8: [evaluation](https://horizon.bespokelabs.ai/evaluations/5402dce4-4d71-4f15-8b8f-92f975936e11).

### Waterbirds group robust coreset selection

- standard_opus, v9: [evaluation](https://horizon.bespokelabs.ai/evaluations/c406b882-f939-40a6-bba8-cc838ba04270).
- standard_sol, v9: [evaluation](https://horizon.bespokelabs.ai/evaluations/27a6ab97-84b1-436b-b5be-702cdd9bbebd).
- codex_sol, v9: [evaluation](https://horizon.bespokelabs.ai/evaluations/9a09a24e-31e0-456d-8256-331c42ca8ac1).
- claude_opus, v9: [evaluation](https://horizon.bespokelabs.ai/evaluations/7bc25993-2f45-4457-ba2d-89573f04c6fd).


## Descriptive findings

The final hidden test model order agrees on four of five fully observed tasks. Waterbirds reverses the order. CPU decode is excluded from this count because Claude Code has no grade inside the window.

Codex with Sol has higher hidden test scores than Terminus with Sol on three tasks, lower scores on two, and ties on one (including CPU decode in these counts). Claude Code with Opus has higher scores on two tasks, lower scores on three, and no in-window grade on CPU decode. Both native harnesses improve CausalRivers and Waterbirds and score lower on HiCARD. Results come from one run per combination. No claim of a reliable general harness advantage is supported.

See [findings.json](findings.json) for the exact scores. Recompute with `python3 analysis/harness/summarize.py`. Update the aggregate table and the blog's harness-findings paragraph whenever baselines change.

The September 7 update refreshed the three Sol replacement results and adopted Shortest CI and Waterbirds. Other source records retain the earlier review snapshot. The September 8 update adopted HiCARD after its results exceeded 12 hours. Worker logs for the CPU delay remain unavailable through Horizon. Direct Cloud Logging access requires renewing the existing gcloud login; no authentication settings were changed.

Full transcript refresh requests stalled for some runs. [freshness.json](freshness.json) records each cached transcript timestamp. The blog conclusions use freshly checked score records, not unverified behavior inferred from stale transcripts.

## Aggregate table

The headline table averages validation and hidden test reported rewards at 12 hours over the same five tasks for all four combinations. CPU decode is excluded from every row because Claude Code has no grade inside the window. Completed-evaluation counts use those same five tasks. Scores are arithmetic means of the reported normalized rewards, not raw task metrics. Each task has equal weight. The task selector shows those same five tasks and opens on HiCARD. CPU decode records remain in the source data for review.

The aggregate hidden test ranking is Opus above Sol with both harnesses. This does not describe the validation ranking, which changes. The aggregate table replaces the earlier task-specific conclusions in the blog. Preserve the concise presentation in future updates; do not restore the removed setup and per-task prose.

## Submission count and overfitting

Across the five common tasks, mean validation minus hidden test reward is 0.1076 for Codex/Sol versus 0.1141 for Terminus/Sol. Shortest CI accounts for most of both gaps: without it, those means are 0.0103 and 0.0178 respectively. Claude Code/Opus has mean gap -0.0039, versus -0.0116 for Terminus/Opus. Its hidden test mean therefore does not fall below validation. These descriptive gaps do not establish a causal effect of additional submissions. A zero hidden reward on a thresholded task should not automatically be called overfitting.

## Announced budgets

The plots compare the first 12 hours. The original 12 Terminus runs were told they had 24 hours. All 12 native harness runs were told they had 12 hours. The replacement runs use the same first-12-hour comparison; their prompt budgets were not rechecked in this score-only update. This may affect how agents pace their work, so the comparison does not isolate harness choice from the announced budget.

## AUARC table

The AUARC table uses all three replacement runs and the same difficulty maps and timeAuc function as the main results. Each selected checkpoint is mapped from its raw metric to its task reward before integration. We integrate step curves at actual grading timestamps over 43,200 seconds, with zero before the first grade, then average the same five tasks equally. The table is not an average over submissions or hourly samples. The individual curves now use those same event timestamps.

Run `node analysis/harness/verify-auarc.cjs` from the repository root to independently replay all 40 task, model, and split areas from the pinned source intervals. The current data has no missing selected test grade after the first available result.
