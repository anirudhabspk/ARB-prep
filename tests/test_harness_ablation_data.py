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
    def test_cpu_llm_claude_code_includes_accepted_cutoff_score(self):
        data = harness_data()
        task = next(
            item for item in data["tasks"]
            if item["name"] == "CPU LLM decode throughput"
        )
        series = task["series"]["claude_opus"]

        self.assertEqual(data["hours"][-1], 12)
        self.assertEqual(series["validation"][-1], 0.372487643543)
        self.assertEqual(series["test"][-1], 0.365065136847)
        self.assertEqual(series["raw_validation"][-1], 11.0911)
        self.assertEqual(series["raw_test"][-1], 10.7744)

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


if __name__ == "__main__":
    unittest.main()
