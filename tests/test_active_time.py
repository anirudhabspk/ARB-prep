import unittest
from scripts.refresh_score_snapshot import active_time_share


def message(sequence, role, seconds, content):
    from datetime import datetime, timezone
    return {'sequence_number': sequence, 'role': role, 'content': content,
            'timestamp': datetime.fromtimestamp(seconds, timezone.utc).isoformat()}


def feedback(sequence, seconds, phase, grading):
    return message(sequence, 'user', seconds,
                   f'- phase: {phase}\n- total autoresearch budget: 86400.0 seconds\n'
                   f'- wall-clock time remaining before this phase: {86400-seconds}.0 seconds\n'
                   f'- previous validation grading: {grading}.0 seconds')


class ActiveTimeTest(unittest.TestCase):
    def test_later_empty_cycles_change_neither_numerator_nor_denominator(self):
        messages = [feedback(1, 0, 1, 0), message(2, 'assistant', 100, 'work'),
                    feedback(3, 300, 2, 200), message(4, 'assistant', 1000, 'submit')]
        before = active_time_share(messages)
        messages += [feedback(5, 2000, 3, 1000), message(6, 'assistant', 2100, ''),
                     feedback(7, 2500, 4, 400)]
        self.assertEqual(active_time_share(messages), before)
        self.assertEqual(before['active_elapsed_seconds'], 1000)
        self.assertEqual(before['outside_grading_seconds'], 800)
        self.assertEqual(before['percent'], 80)

    def test_tool_only_model_response_counts_as_activity(self):
        response = message(2, 'assistant', 100, '')
        response['content_json'] = {'tool_calls': [{'function_name': 'exec'}]}
        result = active_time_share([feedback(1, 0, 1, 0), response])
        self.assertEqual(result['active_elapsed_seconds'], 100)
        self.assertEqual(result['percent'], 100)

    def test_missing_grading_inside_window_is_not_treated_as_zero(self):
        result = active_time_share([feedback(1, 0, 1, 0), feedback(2, 500, 3, 100),
                                    message(3, 'assistant', 600, 'work')])
        self.assertIsNone(result['percent'])


if __name__ == '__main__':
    unittest.main()
