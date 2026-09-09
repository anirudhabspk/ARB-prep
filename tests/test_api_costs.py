import gzip
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from scripts.refresh_score_snapshot import (
    ACCEPTED_TERMINAL_RESULT_IDS,
    APPROVED_FLAT_EXTENSION_IDS,
    COMPLETED_23H_RERUN_IDS,
    api_ledger_cost,
    api_ledger_output_tokens,
    apply_published_window,
    curve,
    eligible_terminal_result,
    eligible_current_result,
    eligible_selected_result,
    retain_previous_run,
    validate_selected_evaluation,
)


class ApiLedgerCostTest(unittest.TestCase):
    def test_repeated_completed_refresh_is_idempotent_for_astra_repair(self):
        model_names = [
            'Claude Fable 5.1', 'Claude Opus 5', 'GPT-5.6 Sol', 'Kimi K3',
            'Qwen3.8 Max', 'Gemini 3.8 Flash', 'Muse Spark 1.3', 'Grok 4.6',
            'GPT-6 Astra',
        ]
        model_codes = [f'model-{index}' for index in range(len(model_names))]
        astra_id = '60a7e9e2-c234-4091-a258-242d0574dc30'
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            snapshot = root / 'snapshot'
            (snapshot / 'evaluations').mkdir(parents=True)
            tasks = []
            evaluations = []
            expected_ids = []
            counter = 0
            for task_index in range(29):
                slug = f'task-{task_index}'
                runs = []
                for model_index, (model_name, model_code) in enumerate(zip(model_names, model_codes)):
                    counter += 1
                    evaluation_id = astra_id if task_index == 0 and model_index == 8 else f'{counter:08x}-0000-0000-0000-{counter:012x}'
                    expected_ids.append(evaluation_id)
                    runs.append({
                        'model': model_code, 'evaluationId': evaluation_id,
                        'sourceFile': f'autoresearch-evaluations/{slug}.md',
                        'sourceStatus': 'Completed', 'status': 'completed',
                        'hours': 24, 'extension': False, 'provisional': False,
                        'apiCost': 1.0, 'apiCostFetchedAt': '2026-09-09T00:00:00Z',
                        'outputTokens': 10, 'submissions': 1, 'workHours': 1,
                        'activeTimePercent': 50, 'activeElapsedHours': 1,
                        'points': [{'seconds': 10, 'bestValidation': .5, 'testAtBest': .4}],
                    })
                    evaluations.append({
                        'task_slug': slug, 'model': model_name,
                        'evaluation_id': evaluation_id,
                        'manifest_status': 'Flat extension (rollout error)' if evaluation_id == astra_id else 'Completed',
                        'source_path': f'autoresearch-evaluations/{slug}.md',
                    })
                tasks.append({'name': f'Task {task_index}', 'models': runs})
            site = {
                'models': [
                    {'name': name, 'codename': code}
                    for name, code in zip(model_names, model_codes)
                ],
                'tasks': tasks,
                'snapshot': {'completedRerunCount': 36},
            }
            (snapshot / 'manifest.json').write_text(json.dumps({
                'source_commit': 'test', 'evaluations': evaluations,
            }))
            (snapshot / 'download_progress.jsonl').write_text(
                json.dumps({'fetched_at': '2026-09-09T01:00:00Z'}) + '\n'
            )
            payload = {
                'status': {'job_status': 'completed', 'rollout_statuses': []},
                'results': {'rollouts': [{'attempts': [{
                    'is_final_attempt': True, 'status': 'completed',
                    'iterations': [
                        {'iteration': 22, 'public_score': .5, 'private_score': .4,
                         'public_elapsed_seconds': 10, 'private_elapsed_seconds': 10,
                         'artifact_uploaded': True},
                        {'iteration': 23, 'public_score': .6, 'private_score': None,
                         'public_elapsed_seconds': 20, 'private_elapsed_seconds': 20,
                         'artifact_uploaded': True},
                    ],
                }]}]},
                'rollouts': [{'rollout': {'total_output_tokens': 10}, 'messages': []}],
                'api_ledger_fetched_at': '2026-09-09T01:00:00Z',
            }
            with gzip.open(snapshot / 'evaluations' / f'{astra_id}.json.gz', 'wt') as stream:
                json.dump(payload, stream)
            previous = root / 'previous.js'
            first = root / 'first.js'
            second = root / 'second.js'
            previous.write_text('window.ARB_DATA = ' + json.dumps(site) + ';\n')
            script = Path(__file__).resolve().parents[1] / 'scripts' / 'refresh_score_snapshot.py'

            for source, output in ((previous, first), (first, second)):
                subprocess.run([
                    sys.executable, str(script), '--snapshot', str(snapshot),
                    '--previous', str(source), '--output', str(output),
                    '--include-current-runs',
                ], check=True, capture_output=True, text=True)

            def read_site(path):
                return json.loads(path.read_text().split('=', 1)[1].rstrip(';\n'))

            first_site = read_site(first)
            second_site = read_site(second)
            self.assertEqual(first_site['snapshot']['completedRerunCount'], 36)
            self.assertEqual(second_site['snapshot']['completedRerunCount'], 36)
            counter_keys = (
                'completedRerunCount', 'eligibleRuns', 'includedRuns',
                'runningRerunCount', 'invalidRerunCount',
            )
            self.assertEqual(
                {key: first_site['snapshot'][key] for key in counter_keys},
                {key: second_site['snapshot'][key] for key in counter_keys},
            )
            self.assertEqual(
                [run['evaluationId'] for task in first_site['tasks'] for run in task['models']],
                expected_ids,
            )
            self.assertEqual(
                [run['evaluationId'] for task in second_site['tasks'] for run in task['models']],
                expected_ids,
            )

    def test_partial_snapshot_reuses_only_the_same_evaluation(self):
        previous = {'evaluationId': 'same', 'points': [{'testAtBest': 0.4}]}

        retained = retain_previous_run('same', previous)

        self.assertEqual(retained, previous)
        self.assertIsNot(retained, previous)
        with self.assertRaises(FileNotFoundError):
            retain_previous_run('changed', previous)

    def test_completed_rerun_cohort_has_21_evaluations(self):
        self.assertEqual(len(COMPLETED_23H_RERUN_IDS), 21)

    def test_short_published_results_are_flattened_to_24_hours(self):
        short = {'hours': 13.2, 'points': [{'seconds': 100, 'testAtBest': 0.5}],
                 'extension': False}
        completed_rerun = {'hours': 23, 'displayHours': 24,
                           'points': [{'seconds': 100, 'testAtBest': 0.5}],
                           'extension': False}
        unavailable = {'hours': 0, 'points': [], 'extension': False}

        apply_published_window(short)
        apply_published_window(completed_rerun)
        apply_published_window(unavailable)

        self.assertEqual(short['hours'], 24)
        self.assertTrue(short['extension'])
        self.assertEqual(completed_rerun['hours'], 24)
        self.assertTrue(completed_rerun['extension'])
        self.assertEqual(unavailable['hours'], 0)

    def test_current_policy_accepts_only_completed_clean_runs(self):
        source = {'manifest_status': 'Rerun submitted'}
        attempt = {'status': 'running'}
        self.assertFalse(eligible_current_result(source, 'running', attempt, []))
        self.assertTrue(eligible_current_result(source, 'completed',
                                                {'status': 'completed'}, []))
        self.assertFalse(eligible_current_result(source, 'failed', attempt, []))
        self.assertFalse(eligible_current_result({'manifest_status': 'Crashed'},
                                                 'completed', {'status': 'completed'}, []))
        self.assertFalse(eligible_current_result(source, 'completed',
                                                 {'status': 'completed'}, [{'status': 'errored'}]))

    def test_current_policy_keeps_only_explicitly_approved_terminal_results(self):
        iteration = {'public_score': 0.5, 'private_score': 0.4,
                     'artifact_uploaded': True}
        attempt = {'status': 'incomplete', 'iterations': [iteration]}
        source = {'manifest_status': 'Flat extension (failed)'}
        extension_id = '9c006e63-3989-4de2-8867-b3c4016757ec'
        accepted_failure_id = '64f07bb3-0573-4287-abcd-bb615ef31cdd'

        self.assertIn(extension_id, APPROVED_FLAT_EXTENSION_IDS)
        self.assertIn(accepted_failure_id, ACCEPTED_TERMINAL_RESULT_IDS)
        self.assertTrue(eligible_selected_result(
            extension_id, source, 'failed', attempt, [{'status': 'errored'}], True))
        self.assertTrue(eligible_selected_result(
            accepted_failure_id, source, 'completed', attempt, [], True))
        self.assertFalse(eligible_selected_result(
            'unapproved', source, 'failed', attempt, [{'status': 'errored'}], True))
        self.assertFalse(eligible_selected_result(
            extension_id, source, 'running', attempt, [], True))

    def ledger(self, **fields):
        return {'selector': {'kind': 'evaluation_id', 'id': 'selected'},
                'workload_ids': ['workload'], 'requests': 10, **fields}

    def test_api_and_subscription_routes_are_priced_once(self):
        ledger = self.ledger(cost_usd=3, shadow_cost_usd=8, by_route=[
            {'route_channel': 'api', 'cost_usd': 3, 'shadow_cost_usd': 3},
            {'route_channel': 'subscription', 'cost_usd': 0, 'shadow_cost_usd': 5}])
        self.assertEqual(api_ledger_cost(ledger, 'selected'), 8)

    def test_empty_ledger_is_missing_not_free(self):
        self.assertIsNone(api_ledger_cost(self.ledger(requests=0, cost_usd=0), 'selected'))

    def test_another_evaluation_is_rejected(self):
        with self.assertRaises(ValueError):
            api_ledger_cost(self.ledger(cost_usd=10), 'superseded')

    def test_unknown_price_is_not_silently_zero(self):
        with self.assertRaises(ValueError):
            api_ledger_cost(self.ledger(cost_usd=None), 'selected')

    def test_output_tokens_come_from_the_api_ledger(self):
        self.assertEqual(
            api_ledger_output_tokens(self.ledger(output_tokens=1234), 'selected'),
            1234,
        )

    def test_empty_ledger_has_no_output_token_count(self):
        self.assertIsNone(
            api_ledger_output_tokens(
                self.ledger(requests=0, output_tokens=0),
                'selected',
            )
        )

    def test_output_tokens_for_another_evaluation_are_rejected(self):
        with self.assertRaises(ValueError):
            api_ledger_output_tokens(self.ledger(output_tokens=1234), 'superseded')

    def test_invalid_output_tokens_are_rejected(self):
        with self.assertRaises(ValueError):
            api_ledger_output_tokens(self.ledger(output_tokens=None), 'selected')

    def test_running_index_row_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'evaluation index'):
            validate_selected_evaluation('Rerun submitted', 'completed')

    def test_running_horizon_evaluation_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Horizon'):
            validate_selected_evaluation('Preempted after iteration 18', 'running')

    def test_stopped_evaluation_is_accepted(self):
        validate_selected_evaluation('Preempted after iteration 18', 'completed')

    def test_cancelled_result_keeps_uploaded_hidden_test_checkpoint(self):
        iterations = [{'public_score': 0.5, 'private_score': 0.4,
                       'artifact_uploaded': True}]

        self.assertTrue(eligible_terminal_result('cancelled', iterations))
        self.assertTrue(eligible_terminal_result('failed', iterations))
        self.assertFalse(eligible_terminal_result('running', iterations))
        self.assertFalse(eligible_terminal_result('queued', iterations))
        self.assertFalse(eligible_terminal_result('unknown', iterations))

    def test_public_only_tail_does_not_erase_last_hidden_test_score(self):
        points = curve([
            {'iteration': 1, 'public_score': 0.4, 'private_score': 0.3,
             'public_elapsed_seconds': 10, 'private_elapsed_seconds': 10},
            {'iteration': 2, 'public_score': 0.5, 'private_score': None,
             'public_elapsed_seconds': 20, 'private_elapsed_seconds': 0},
        ], 20)

        self.assertEqual(points[-1]['bestValidation'], 0.4)
        self.assertEqual(points[-1]['testAtBest'], 0.3)


if __name__ == '__main__':
    unittest.main()
