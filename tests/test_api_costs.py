import unittest
from scripts.refresh_score_snapshot import (
    ACCEPTED_TERMINAL_RESULT_IDS,
    APPROVED_FLAT_EXTENSION_IDS,
    COMPLETED_23H_RERUN_IDS,
    api_ledger_cost,
    api_ledger_output_tokens,
    curve,
    eligible_terminal_result,
    eligible_current_result,
    eligible_selected_result,
    validate_selected_evaluation,
)


class ApiLedgerCostTest(unittest.TestCase):
    def test_completed_rerun_cohort_has_21_evaluations(self):
        self.assertEqual(len(COMPLETED_23H_RERUN_IDS), 21)

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
