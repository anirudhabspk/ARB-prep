import unittest
from datetime import datetime, timezone

from build_site_data import run_curve, run_stats, selected_iterations


class EvaluationPolicyTest(unittest.TestCase):
    def test_crash_cutoff_removes_late_grades(self):
        run = {
            "truncate_at_seconds": 100,
            "iterations": [
                {"iteration": 1, "public_elapsed_seconds": 90},
                {"iteration": 2, "public_elapsed_seconds": 110},
            ],
        }

        self.assertEqual([item["iteration"] for item in selected_iterations(run)], [1])

    def test_display_horizon_clamps_accepted_late_grade(self):
        run = {
            "display_end_seconds": 86400,
            "iterations": [
                {
                    "iteration": 1,
                    "public_score": 0.5,
                    "private_score": 0.4,
                    "public_elapsed_seconds": 87000,
                }
            ],
        }

        curve = run_curve(run, datetime.now(timezone.utc), 86400)

        self.assertEqual(curve["end"], 86400)
        self.assertEqual(curve["points"][0]["seconds"], 86400)

    def test_elapsed_time_never_moves_backward(self):
        run = {
            "display_end_seconds": 86400,
            "iterations": [
                {"iteration": 1, "public_score": 0.4, "private_score": 0.3, "public_elapsed_seconds": 100},
                {"iteration": 2, "public_score": 0.5, "private_score": 0.4, "public_elapsed_seconds": 0},
            ],
        }

        curve = run_curve(run, datetime.now(timezone.utc), 86400)

        self.assertEqual([point["seconds"] for point in curve["points"]], [100, 100])

    def test_iteration_cutoff_removes_regrades(self):
        run = {
            "valid_through_iteration": 1,
            "iterations": [
                {"iteration": 1, "public_elapsed_seconds": 90},
                {"iteration": 2, "public_elapsed_seconds": 100},
            ],
        }

        self.assertEqual([item["iteration"] for item in selected_iterations(run)], [1])

    def test_stats_use_only_api_ledger_cost(self):
        run = {
            "attempt_status": "completed",
            "api_cost_usd": 12.5,
            "cost_usd": 99,
            "display_end_seconds": 100,
            "iterations": [
                {
                    "iteration": 1,
                    "public_score": 0.5,
                    "private_score": 0.4,
                    "public_elapsed_seconds": 50,
                }
            ],
        }

        stats = run_stats(run, datetime.now(timezone.utc), 100)

        self.assertEqual(stats["cost"], 12.5)


if __name__ == "__main__":
    unittest.main()
