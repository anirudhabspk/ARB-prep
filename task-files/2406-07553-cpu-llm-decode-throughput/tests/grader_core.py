"""The reward map. Verifier-only: no copy of this file exists in the agent image.

The graded metric is S, the generated-token throughput of the submitted engine divided
by the throughput of the reference engine measured in the same grading run on the same
workloads.

Map: rational_squash, with both anchors read off the task.

  m0      = 1.0   the strongest trivial submission is the shipped reference engine
                  itself, which reproduces its own outputs and measures S = 1.0 by
                  construction. Every trivial or degenerate submission lands at or
                  below it (a degenerate one fails the agreement gate and gets S = 0).
  baseline_score = 18.0  the speedup the source work reports for its serving engine.

The metric is a ratio that improves multiplicatively, which is the log_rational row of
the selection rule; the span from m0 to the attainable ceiling measured at this reduced
scale is about one order of magnitude, not the several decades log compression exists
for, so rational_squash is used.
"""

from __future__ import annotations

M0 = 1.0
BASELINE_SCORE = 18.0


def graded_reward(speedup, valid):
    """Map the measured speedup to a reward in [0, 1]; 0 for anything not valid."""
    if not valid:
        return 0.0
    x_ref = BASELINE_SCORE - M0
    assert x_ref > 0, "malformed task: the baseline score does not beat the trivial baseline"
    u = max(0.0, float(speedup) - M0) / x_ref
    return u / (1.0 + u)
