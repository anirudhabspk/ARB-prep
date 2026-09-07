# Analysis todo

Add continuous results for tasks with hard score cutoffs. Keep the official scores unchanged. Regrade every stored checkpoint on the hidden test and save the raw metric, distance from the cutoff, and failure reason. Use these results when interpreting validation to test gaps because a small cutoff miss can produce a score of zero.

## Harness baseline replacements

Checked live on 2026-09-07. Keep the existing baselines until the replacement run has at least 12 hours of recorded research time. Then rebuild its first 12 hours in `harness-ablation-data.js` and recompute all aggregate scores and completed-evaluation averages over the same five complete tasks. Include CPU decode only if every combination has a valid result within 12 hours.

- [x] Shortest CI: replace `fb502080-1a2e-4c5e-92a3-05e1681a56c2` with `9cce644b-508d-49bf-998c-6fa67fdb44e9`. Adopted first 12 hours; latest grade at 12.20 hours.
- [ ] HiCARD: replace `8fb52cfe-bfad-4213-af41-fdb4241edf4e` with `c3d3ee62-2656-410a-be30-811076c68570`. Latest graded checkpoint at 11.60 hours; run still active.
- [x] Waterbirds: replace `1b671667-6354-47cb-bed3-884ccb540edb` with `27a6ab97-84b1-436b-b5be-702cdd9bbebd`. Adopted first 12 hours; latest grade at 12.25 hours.

- [ ] Resolve the Claude Code CPU decode gap between its final assistant message and grade. Restore agent/verifier columns only after the full timing breakdown is verified.
