import json
import tempfile
import unittest
from pathlib import Path

from analysis.general_analysis.build import build


class GeneralAnalysisTest(unittest.TestCase):
    def test_build_uses_selected_site_evaluation_ids(self):
        payload = {
            "snapshot": {"fetchedAt": "2026-09-08T00:00:00Z", "sourceCommit": "abc123"},
            "models": [
                {"name": "Model One", "codename": "one"},
                {"name": "Model Two", "codename": "two"},
            ],
            "tasks": [
                {"name": "Task A", "models": [
                    self.run_data("one", "eval-one"), self.run_data("two", "eval-two")
                ]}
            ],
        }
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "site-data.js"
            source.write_text("window.ARB_DATA = " + json.dumps(payload) + ";\n")
            output = root / "assets"
            page = root / "review.html"
            summary = build(source, output, page)
            self.assertEqual(summary["evaluation_ids"], ["eval-one", "eval-two"])
            self.assertEqual(json.loads((output / "source.json").read_text())["evaluation_ids"], ["eval-one", "eval-two"])
            self.assertIn("same evaluation IDs as the benchmark pages", page.read_text())
            self.assertTrue((output / "budget.svg").exists())

    @staticmethod
    def run_data(model, evaluation_id):
        return {
            "model": model,
            "evaluationId": evaluation_id,
            "hours": 24,
            "submissions": 2,
            "workHours": 1,
            "points": [
                {"seconds": 3600, "bestValidation": 0.4, "testAtBest": 0.3},
                {"seconds": 7200, "bestValidation": 0.6, "testAtBest": 0.5},
            ],
        }


if __name__ == "__main__":
    unittest.main()
