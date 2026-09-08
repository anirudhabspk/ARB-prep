import json
import unittest
from pathlib import Path
from build_harness_data import build, series, event_points
ROOT = Path(__file__).resolve().parents[1]

class HarnessAblationDataTest(unittest.TestCase):
    def test_grading_boundary_and_validation_selection(self):
        rows = [dict(iteration=1,public_elapsed_seconds=3601,public_score=.4,
                     private_elapsed_seconds=3600,private_score=.7),
                dict(iteration=2,public_elapsed_seconds=7200,public_score=.5,
                     private_elapsed_seconds=7201,private_score=.2),
                dict(iteration=3,public_elapsed_seconds=10800,public_score=.3,
                     private_elapsed_seconds=10800,private_score=.9),
                dict(iteration=4,public_elapsed_seconds=43201,public_score=1,
                     private_elapsed_seconds=43201,private_score=1)]
        s=series(rows)
        self.assertIsNone(s['validation'][1])
        self.assertEqual(s['validation'][2],.5)
        self.assertIsNone(s['test'][2])
        self.assertEqual(s['test'][3],.2)
        self.assertEqual(s['selected_iterations'][12],2)

    def test_exact_events_keep_timing_selection_and_cutoff(self):
        rows = [dict(iteration=1, public_elapsed_seconds=900, public_score=.4,
                     private_elapsed_seconds=899, private_score=.7, public_raw_score=4),
                dict(iteration=2, public_elapsed_seconds=1800, public_score=.5,
                     private_elapsed_seconds=1801, private_score=.2, public_raw_score=5),
                dict(iteration=3, public_elapsed_seconds=1900, public_score=.5,
                     private_elapsed_seconds=1900, private_score=.9),
                dict(iteration=4, public_elapsed_seconds=43201, public_score=1,
                     private_elapsed_seconds=43201, private_score=1)]
        points = {p['seconds']: p for p in event_points(rows)}
        self.assertIsNone(points[0]['validation'])
        self.assertEqual(points[900]['raw_validation'], 4)
        self.assertIsNone(points[1800]['test'])
        self.assertEqual(points[1801]['test'], .2)
        self.assertEqual(points[1900]['test'], .2)
        self.assertEqual(points[43200]['validation'], .5)
        self.assertNotIn(43201, points)

    def test_zero_is_preserved_and_missing_is_not_zero(self):
        self.assertEqual(series([])['validation'],[None]*13)
        self.assertEqual(series([dict(iteration=1,public_elapsed_seconds=1,
                         public_score=0,private_elapsed_seconds=1,private_score=0)])['test'][1],0)

    def test_generated_artifact_matches_pinned_records(self):
        source=json.loads((ROOT/'analysis/harness/source.json').read_text())
        data=json.loads((ROOT/'harness-ablation-data.js').read_text().split('=',1)[1].rstrip(';\n'))
        self.assertEqual(data,build(source))
        self.assertEqual(len(source['tasks']),6)
        cpu=data['tasks'][0]['series']
        self.assertEqual(cpu['claude_opus']['validation'],[None]*13)
        self.assertEqual(cpu['codex_sol']['validation'][4],.366227375249)
        self.assertEqual(len(data['aggregate_tasks']),5)
        self.assertNotIn('CPU LLM decode throughput',data['aggregate_tasks'])
        self.assertAlmostEqual(data['aggregate']['standard_opus']['test'],.5552488643032)
        self.assertAlmostEqual(data['aggregate']['codex_sol']['completed_evaluations'],186.6)


if __name__=='__main__': unittest.main()
