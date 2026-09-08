import unittest
from scripts.refresh_score_snapshot import api_ledger_cost


class ApiLedgerCostTest(unittest.TestCase):
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


if __name__ == '__main__':
    unittest.main()
