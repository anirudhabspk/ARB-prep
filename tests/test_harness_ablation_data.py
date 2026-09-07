import json
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def harness_data():
    source = (ROOT / "harness-ablation-data.js").read_text()
    prefix = "window.ARB_HARNESS_ABLATIONS="
    return json.loads(source.removeprefix(prefix).removesuffix(";\n"))


class HarnessAblationDataTest(unittest.TestCase):
    def test_cpu_llm_claude_code_uses_submission_time(self):
        data = harness_data()
        task = next(
            item for item in data["tasks"]
            if item["name"] == "CPU LLM decode throughput"
        )
        series = task["series"]["claude_opus"]

        self.assertEqual(data["hours"][-1], 12)
        self.assertEqual(series["validation"], [0] + [0.372487643543] * 12)
        self.assertEqual(series["test"], [0] + [0.365065136847] * 12)
        self.assertEqual(series["raw_validation"], [None] + [11.0911] * 12)
        self.assertEqual(series["raw_test"], [None] + [10.7744] * 12)

        script = """
global.window = {};
eval(require("fs").readFileSync("difficulty-reward-maps.js", "utf8"));
const map = window.ARB_DIFFICULTY_REWARD_MAPS["CPU LLM decode throughput"];
process.stdout.write(JSON.stringify([
  map.score(11.0911, "intermediate"),
  map.score(10.7744, "final"),
]));
"""
        difficulty_validation, difficulty_test = json.loads(
            subprocess.run(
                ["node", "-e", script],
                cwd=ROOT,
                check=True,
                capture_output=True,
                text=True,
            ).stdout
        )
        self.assertAlmostEqual(
            difficulty_validation, series["validation"][-1],
            places=12,
        )
        self.assertAlmostEqual(
            difficulty_test, series["test"][-1],
            places=12,
        )

    def test_native_harness_scores_use_submission_hour(self):
        tasks = {item["name"]: item for item in harness_data()["tasks"]}
        expected = {
            ("CPU LLM decode throughput", "codex_sol", 4):
                (0.368170668252, 0.369817209921, 10.906, 10.9763),
            ("CPU LLM decode throughput", "codex_sol", 6):
                (0.398964096944, 0.400496529933, 12.2845, 12.3568),
            ("CPU LLM decode throughput", "codex_sol", 11):
                (0.427451350204, 0.405916373993, 13.6918, 12.6155),
            ("Shortest valid CI L2 ECE", "codex_sol", 8):
                (0.49482727062, 0, 0.009863049943360071, 0.5021179988366643),
            ("Shortest valid CI L2 ECE", "codex_sol", 10):
                (0.496327897342, 0, 0.009757096140914906, 0.5021179988366643),
            ("Budgeted Covtype dual market", "codex_sol", 1):
                (0.446927165796, 0.475604771673, 0.4772753311851057, 0.5181954887218045),
            ("CausalRivers held out station graph AUROC", "codex_sol", 8):
                (0.627137853942, 0.631061273475, None, None),
            ("CausalRivers held out station graph AUROC", "codex_sol", 9):
                (0.631391679252, 0.627569741076, None, None),
            ("Waterbirds group robust coreset selection", "codex_sol", 4):
                (0.583698510079, 0.572841726619, 72.32, 71.74),
            ("Waterbirds group robust coreset selection", "codex_sol", 7):
                (0.59505541347, 0.588922544353, 72.96, 72.61),
            ("HiCARD latent encoder", "claude_opus", 5):
                (0.576220158723, 0.570742128471, 35.63317992586359, 34.91044822201235),
        }

        for (task_name, series_name, hour), values in expected.items():
            with self.subTest(task=task_name, series=series_name, hour=hour):
                series = tasks[task_name]["series"][series_name]
                actual = (
                    series["validation"][hour],
                    series["test"][hour],
                    series["raw_validation"][hour],
                    series["raw_test"][hour],
                )
                self.assertEqual(actual, values)

    def test_harness_explanatory_note_is_removed(self):
        blog = (ROOT / "blog.html").read_text()

        self.assertNotIn('class="plot-note harness-source"', blog)


if __name__ == "__main__":
    unittest.main()
