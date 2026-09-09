"""Build display curves from a selected, immutable Horizon download.

No network calls. Terminal runs retain their fully graded checkpoints, including
cancelled or failed runs selected by the evaluation index. Running replacements
are rejected by default. --include-current-runs applies the scheduled current-run
policy instead. Run with --help for inputs. The audit belongs in the local
snapshot directory.
"""
import argparse
import copy
import gzip
import json
import math
import re
import statistics
from datetime import datetime
from pathlib import Path


# The legacy Horizon ledger for this completed evaluation is empty. This is an
# API-equivalent estimate from its recorded output tokens and inferred input and
# cache-read tokens. Do not apply it to any other run.
ESTIMATED_API_COSTS = {
    '002958c6-cb2f-46e3-8536-ba8d421083af': 145.0,
}

COMPLETED_23H_RERUN_IDS = {
    'b3ed0348-fc72-4b03-a390-9506cd2edfc8',
    '1650728f-9c5d-46a8-a241-484009952cb6',
    '59625718-742c-48bd-96ea-969655b894e9',
    'e8376f9e-83cd-4e4d-ba14-1bc40bfcebc8',
    'c3c2c500-e49b-459f-96e2-a49a85950b73',
    'a6aaecf5-d6e0-4631-a56f-082b308a35f1',
    '2bfe36a9-33b4-4b57-a4eb-ed3414fbf1fa',
    '63f6954e-3389-44be-af14-e61ebd9382be',
    '27a6ab97-84b1-436b-b5be-702cdd9bbebd',
    '205eaceb-be69-4e06-9ba0-8f7954181b8c',
    '2c24ad2c-d041-4354-b675-6c025c06b0b4',
    'e54e7868-bc6c-4c89-9d47-f4b07dadf56c',
    '2d2185fd-b131-4b32-a56d-d86bdc1facfb',
    '2a5a5ded-9f1f-4fe3-9829-a5bbdd48557e',
    'c3d3ee62-2656-410a-be30-811076c68570',
    '8df3cc46-2397-4f4c-b7a4-5fd34fb7c844',
    '942c3b95-5c23-4dae-b6ab-a8b0fa6a5ff1',
    'edffdc2e-f8be-4ded-a184-899e910d6685',
    '9cce644b-508d-49bf-998c-6fa67fdb44e9',
    'a83021eb-ba2b-4640-afab-79427fb4a398',
    '00e0ed45-5c6a-45c4-bd70-fa711c76bd51',
}
APPROVED_FLAT_EXTENSION_IDS = {
    '60a7e9e2-c234-4091-a258-242d0574dc30',
    '2bad3f7e-20cf-427f-a058-fb01b7f8a8cb',
    '31790a2a-550e-418a-88c0-50461bda0b27',
    '9e771f47-2d65-4d04-9450-d8fa0da0853f',
    '29fce83b-6ca7-4144-b2fc-7ab366be0932',
    '67011ff8-0d36-4ad4-af24-43f54887b021',
    '0fa8c3df-0ae4-4e12-9442-108479b886d5',
    '1651b5ec-a39d-4c1c-aa20-f1e84c3b88eb',
    '67b4e18b-29ad-43a9-b3de-263953bcaf36',
    '548d8c41-1ea8-46b7-b4a5-0578c7c8d62f',
    '4644fdc6-9443-4512-9c0a-a919de8f2dd7',
    '9c006e63-3989-4de2-8867-b3c4016757ec',
    '5c130eb6-59c3-476c-853f-bf3d8aa61de1',
    'ad46f20a-d6ce-42aa-962d-a116be0e3bf4',
    'a9612c7a-3350-42d5-adc2-d0b4b339bc2b',
    'fd2b25fb-de59-48c2-a531-5d548838a249',
    '1009205d-8fdc-4fdd-b5ef-f40be83c8a36',
    'e383f41a-6da9-4001-9db4-0dd41095d294',
    'afb0a3de-ba5d-4efd-bd93-463bbd1f76ab',
    '4fcc8b7d-245b-4a71-9e93-30f87fc231d7',
    '77084f0e-489c-4e4c-a136-4a2d376df31c',
    '84adaadd-8388-487d-87c0-631d9ba4f055',
    'e8153e93-0173-46a4-bbaa-8ffcbdb50323',
    '12ac7fea-8778-4ccb-a634-059959d6e957',
    '7db17838-34aa-48b9-b069-6a18cd3d0af7',
    '1a5ba0eb-d667-40f2-bfde-20cb1ce4b46d',
    '82ab3427-0cb4-4ce0-8c76-61152e9f12c0',
    'b001f05e-4162-4168-9304-82e5320b7fe1',
}
ACCEPTED_TERMINAL_RESULT_IDS = {
    '64f07bb3-0573-4287-abcd-bb615ef31cdd',  # TGAT with Kimi K3.
}
RESEARCH_WINDOW_SECONDS = 23 * 3600
DISPLAY_WINDOW_HOURS = 24


def apply_published_window(run):
    """Carry a short published result flat through the 24-hour score window."""
    if run.get('points') and run.get('hours', 0) < DISPLAY_WINDOW_HOURS:
        run['hours'] = DISPLAY_WINDOW_HOURS
        run['extension'] = True


def retain_previous_run(evaluation_id, previous):
    """Reuse an unchanged cell when a partial snapshot omits its payload."""
    if not previous or previous.get('evaluationId') != evaluation_id:
        raise FileNotFoundError(f'Missing fresh snapshot for changed evaluation {evaluation_id}')
    return copy.deepcopy(previous)


def read_site(path):
    return json.loads(path.read_text().split('=', 1)[1].rstrip(';\n'))


def elapsed(row):
    return max(row.get('public_elapsed_seconds') or 0, row.get('private_elapsed_seconds') or 0)


def api_ledger_cost(ledger, evaluation_id):
    """API-priced usage, including shadow pricing for subscription traffic."""
    if ledger.get('selector') != {'kind': 'evaluation_id', 'id': evaluation_id}:
        raise ValueError('API ledger evaluation does not match the selected run')
    if not ledger.get('workload_ids') or not ledger.get('requests'):
        return None
    routes = ledger.get('by_route') or []
    if routes:
        values = [r.get('shadow_cost_usd') if r.get('route_channel') == 'subscription'
                  else r.get('cost_usd') for r in routes]
    else:
        values = [ledger.get('cost_usd')]
    if any(not isinstance(v, (int, float)) or not math.isfinite(v) or v < 0 for v in values):
        raise ValueError('Missing or invalid API ledger cost')
    return sum(values)


def api_ledger_output_tokens(ledger, evaluation_id):
    """Output tokens from the same LLM usage ledger as API cost."""
    if ledger.get('selector') != {'kind': 'evaluation_id', 'id': evaluation_id}:
        raise ValueError('API ledger evaluation does not match the selected run')
    if not ledger.get('workload_ids') or not ledger.get('requests'):
        return None
    value = ledger.get('output_tokens')
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError('Missing or invalid API ledger output tokens')
    return value


def validate_selected_evaluation(source_status, horizon_status):
    """Reject a replacement that is still running."""
    if source_status.strip().lower() in {'rerun submitted', 'running'}:
        raise ValueError('Selected evaluation is still marked as running in the evaluation index')
    if horizon_status.strip().lower() == 'running':
        raise ValueError('Selected evaluation is still running in Horizon')


def fully_graded_checkpoint(row):
    return (row.get('public_score') is not None
            and row.get('private_score') is not None
            and row.get('artifact_uploaded') is not False)


def eligible_terminal_result(status, iterations):
    terminal = (status or '').strip().lower() in {'completed', 'cancelled', 'failed'}
    return terminal and any(fully_graded_checkpoint(row) for row in iterations)


def eligible_current_result(source, status, attempt, rollout_statuses):
    """Publish only completed current runs, with no crashed or errored fallback."""
    return ((status == 'completed' and attempt['status'] == 'completed')
            and not attempt.get('error')
            and 'crash' not in source['manifest_status'].lower()
            and not any(row['status'] == 'errored' for row in rollout_statuses))


def eligible_selected_result(evaluation_id, source, status, attempt, rollout_statuses,
                             include_current_runs):
    if not include_current_runs:
        validate_selected_evaluation(source['manifest_status'], status)
        return eligible_terminal_result(status, attempt['iterations'])
    if evaluation_id in APPROVED_FLAT_EXTENSION_IDS | ACCEPTED_TERMINAL_RESULT_IDS:
        return eligible_terminal_result(status, attempt['iterations'])
    return eligible_current_result(source, status, attempt, rollout_statuses)


def active_time_share(messages):
    """Fraction outside grading, from research start through last model response.

    Grading of the last active phase occurs after that response and is outside
    this window. Later empty phases contribute neither time nor grading.
    """
    phase = last_phase = 0
    start = last = None
    grading = {}
    stamp = lambda value: datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp()
    for message in sorted(messages, key=lambda m: m['sequence_number']):
        text = message.get('content') or ''
        if message['role'] == 'user':
            phases = re.findall(r'- phase: (\d+)', text)
            if phases:
                phase = int(phases[-1])
                values = re.findall(r'- previous validation grading: ([\d.]+) seconds', text)
                if values:
                    grading[phase - 1] = float(values[-1])
                if start is None:
                    budget = re.findall(r'- total autoresearch budget: ([\d.]+) seconds', text)
                    remaining = re.findall(r'- wall-clock time remaining before this phase: ([\d.]+) seconds', text)
                    if budget and remaining:
                        start = stamp(message['timestamp']) - (float(budget[-1]) - float(remaining[-1]))
        elif message['role'] == 'assistant':
            content = message.get('content_json') or {}
            if text.strip() or (isinstance(content, dict) and content.get('tool_calls')):
                last = stamp(message['timestamp'])
                last_phase = phase
    if start is None or last is None or last <= start:
        return {'percent': None, 'reason': 'No measured activity window'}
    prior_phases = range(1, last_phase)
    if any(p not in grading for p in prior_phases):
        return {'percent': None, 'reason': 'Missing grading record inside activity window'}
    duration = last - start
    grade_seconds = sum(grading[p] for p in prior_phases)
    if grade_seconds > duration:
        return {'percent': None, 'reason': 'Grading exceeds activity window'}
    outside = duration - grade_seconds
    return {'percent': 100 * outside / duration, 'active_elapsed_seconds': duration,
            'outside_grading_seconds': outside, 'grading_seconds': grade_seconds,
            'last_active_phase': last_phase, 'last_response_timestamp': last}


def activity_and_time(messages, iterations):
    phase = last_active = 0
    grades = {}
    for message in sorted(messages, key=lambda m: m['sequence_number']):
        text = message.get('content') or ''
        if message['role'] == 'user':
            phases = re.findall(r'- phase: (\d+)', text)
            if phases:
                phase = int(phases[-1])
                grading = re.findall(r'- previous validation grading: ([\d.]+) seconds', text)
                if grading:
                    grades[phase - 1] = float(grading[-1])
        if message['role'] == 'assistant':
            content = message.get('content_json') or {}
            if text.strip() or (isinstance(content, dict) and content.get('tool_calls')):
                last_active = phase
    count = sum(row['iteration'] <= last_active for row in iterations)
    prefix = []
    for row in iterations:
        if row['iteration'] not in grades:
            break
        prefix.append(row)
    if not prefix:
        return count, None, {'last_active_round': last_active, 'missing_timing': True}
    known = [grades[row['iteration']] for row in prefix]
    end = max([0] + [elapsed(row) for row in iterations])
    tail = max(0, end - elapsed(prefix[-1]))
    missing = len(iterations) - len(prefix)
    estimated = min(tail, statistics.median(known[-3:]) * missing)
    hours = max(0, end - sum(known) - estimated) / 3600
    return count, hours, {'last_active_round': last_active, 'missing_timing_records': missing,
                          'estimated_missing_grading_seconds': estimated,
                          'recorded_grading_seconds': sum(known)}


def curve(iterations, end):
    best, selected, previous = float('-inf'), None, 0
    points = []
    for row in iterations:
        if fully_graded_checkpoint(row) and row['public_score'] > best:
            best, selected = row['public_score'], row
        previous = max(previous, min(end, elapsed(row)))
        points.append({'iteration': row['iteration'], 'seconds': previous,
                       'bestValidation': selected.get('public_score') if selected else None,
                       'testAtBest': selected.get('private_score') if selected else None,
                       'rawValidation': selected.get('public_raw_score') if selected else None,
                       'rawTestAtBest': selected.get('private_raw_score') if selected else None})
    return points


def main():
    parser = argparse.ArgumentParser(__doc__)
    parser.add_argument('--snapshot', type=Path, required=True)
    parser.add_argument('--previous', type=Path, required=True)
    parser.add_argument('--older-manifest', type=Path,
                        help='Legacy evaluation manifest. Current site data already records each source file.')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--include-current-runs', action='store_true',
                        help='Use current completed/running IDs; exclude crashes and cost estimates.')
    args = parser.parse_args()
    site = read_site(args.previous)
    known = {r['evaluationId']: t['name'] for t in site['tasks'] for r in t['models']}
    site_names = {}
    for task in site['tasks']:
        for run in task['models']:
            source_file = run.get('sourceFile')
            if source_file:
                site_names[Path(source_file).stem] = task['name']
    if args.older_manifest:
        old = json.loads(args.older_manifest.read_text())['evaluations']
        old_names = {r['task_slug']: known[r['evaluation_id']] for r in old if r['evaluation_id'] in known}
        site_names.update(old_names)
    manifest = json.loads((args.snapshot / 'manifest.json').read_text())
    names = {r['task_slug']: site_names[r['task_slug']] for r in manifest['evaluations']}
    assert len(names) == 29
    task_lookup = {t['name']: t for t in site['tasks']}
    models = {m['name']: m['codename'] for m in site['models']}
    old_runs = {r['evaluationId']: r for t in site['tasks'] for r in t['models']}
    old_runs_by_cell = {(t['name'], r['model']): r for t in site['tasks'] for r in t['models']}
    for task in site['tasks']:
        task['models'] = []
    audit = []
    fresh_updates = 0
    for source in manifest['evaluations']:
        eid = source['evaluation_id']
        task_name = names[source['task_slug']]
        model = models[source['model']]
        previous = old_runs_by_cell.get((task_name, model))
        payload_path = args.snapshot / 'evaluations' / (eid + '.json.gz')
        if not payload_path.is_file():
            run = retain_previous_run(eid, previous)
            task_lookup[task_name]['models'].append(run)
            audit.append({**source, 'included': bool(run.get('points')),
                          'status': run.get('status'), 'task_name': task_name,
                          'published_evaluation_id': eid,
                          'retained_from_previous_snapshot': True})
            continue
        payload = json.load(gzip.open(payload_path))
        result = payload['results']['rollouts'][0]
        attempts = result['attempts']
        attempt = next((a for a in attempts if a.get('is_final_attempt')), attempts[-1])
        status = payload['status']['job_status']
        # Batch-job records may expire after a completed evaluation. Use the
        # evaluation status fetched in this same inventory, never a cached status.
        if args.include_current_runs and status == 'unknown':
            status = source.get('live_status', status)
        eligible = eligible_selected_result(
            eid, source, status, attempt,
            payload['status'].get('rollout_statuses', []), args.include_current_runs)
        # Explicit user-approved exception: carry iteration 22 into the missing
        # iteration 23 test measurement. Never generalize this score repair.
        iterations = copy.deepcopy(attempt['iterations'])
        carried = False
        if eid == '60a7e9e2-c234-4091-a258-242d0574dc30':
            previous = next(r for r in iterations if r['iteration'] == 22)
            missing = next(r for r in iterations if r['iteration'] == 23)
            if missing.get('private_score') is None:
                for field in ('private_score', 'private_raw_score'):
                    missing[field] = previous.get(field)
                carried = True
        ro = payload['rollouts'][0]['rollout']
        end = max([0] + [elapsed(row) for row in iterations])
        if status == 'completed' and ro.get('created_at') and ro.get('completed_at'):
            dt = lambda s: datetime.fromisoformat(s.replace('Z', '+00:00'))
            end = max(end, (dt(ro['completed_at']) - dt(ro['created_at'])).total_seconds())
        end = min(86400, end)
        completed_23h_rerun = eid in COMPLETED_23H_RERUN_IDS and eligible
        if completed_23h_rerun:
            end = RESEARCH_WINDOW_SECONDS
        extension = eid in APPROVED_FLAT_EXTENSION_IDS
        if extension:
            end = 86400
        points = curve(iterations, end) if eligible else []
        count, hours, timing = activity_and_time(payload['rollouts'][0]['messages'], iterations)
        active = active_time_share(payload['rollouts'][0]['messages'])
        old_run = old_runs.get(eid, {})
        ledger = payload.get('api_ledger')
        cost = api_ledger_cost(ledger, eid) if ledger is not None else old_run.get('apiCost')
        if cost is None:
            cost = ESTIMATED_API_COSTS.get(eid)
        ledger_output_tokens = api_ledger_output_tokens(ledger, eid) if ledger is not None else None
        output_tokens = ledger_output_tokens if ledger_output_tokens is not None else ro.get('total_output_tokens')
        run = {'model': models[source['model']], 'hours': end / 3600 if eligible else 0,
               # Running and completed results use the same verified ledger source.
               # Never substitute rollout total_cost for missing API ledger data.
               'apiCost': cost if eligible else None,
               'apiCostEstimated': eid in ESTIMATED_API_COSTS,
               'apiCostFetchedAt': payload.get('api_ledger_fetched_at', old_run.get('apiCostFetchedAt')),
               'outputTokens': output_tokens, 'evaluationId': eid,
               'sourceStatus': source['manifest_status'], 'sourceFile': source['source_path'],
               'status': status, 'provisional': status == 'running',
               'extension': extension,
               'points': points, 'submissions': count if eligible else None,
               'workHours': hours if eligible else None,
               'activeTimePercent': active['percent'] if eligible else None,
               'activeElapsedHours': active.get('active_elapsed_seconds', 0) / 3600 if eligible else None}
        if completed_23h_rerun:
            run.update({'displayHours': DISPLAY_WINDOW_HOURS,
                        'benchmarkWindow': '23h research + 1h infrastructure'})
        if eligible and previous and previous.get('evaluationId') != eid:
            fresh_updates += 1
        replacement_status = None
        if args.include_current_runs and not eligible:
            manifest_status = source['manifest_status'].lower()
            if status == 'running' or manifest_status.startswith(('rerun incomplete', 'rerun failed')):
                prior = old_runs_by_cell.get((task_name, model))
                if prior and prior.get('points') and prior.get('evaluationId') != eid:
                    run = copy.deepcopy(prior)
                    replacement_status = 'running' if status == 'running' else 'invalid'
                    run.update({'replacementEvaluationId': eid,
                                'replacementStatus': replacement_status})
        apply_published_window(run)
        task_lookup[task_name]['models'].append(run)
        audit.append({**source, 'included': bool(eligible), 'status': status,
                      'batch_job_status': payload['status']['job_status'],
                      'attempt_status': attempt['status'], 'task_name': names[source['task_slug']],
                      'submissions': count, 'work_hours': hours, 'timing': timing,
                      'active_time': active,
                      'published_evaluation_id': run['evaluationId'],
                      'replacement_status': replacement_status,
                      'api_cost_usd': run['apiCost'],
                      'api_cost_fetched_at': run['apiCostFetchedAt'],
                      'score_carried_forward': carried, 'observed_end_hours': end / 3600})
    for task in site['tasks']:
        task['models'].sort(key=lambda r: list(models.values()).index(r['model']))
        assert len(task['models']) == 9
    all_runs = [r for task in site['tasks'] for r in task['models']]
    fetched_at = max(json.loads(line)['fetched_at'] for line in (args.snapshot / 'download_progress.jsonl').read_text().splitlines())
    site['snapshot'] = {'fetchedAt': fetched_at,
                        'completedRerunsCheckedAt': fetched_at,
                        'sourceCommit': manifest['source_commit'],
                        'selectionPolicy': 'current' if args.include_current_runs else 'terminal',
                        'selectionDetail': 'completed reruns with prior results retained for running and invalid replacements' if args.include_current_runs else 'terminal',
                        'provisional': any(r['provisional'] and r['points'] for r in all_runs),
                        'eligibleRuns': sum(bool(r['points']) for r in all_runs),
                        'includedRuns': sum(bool(r['points']) for r in all_runs),
                        'completedRerunCount': site.get('snapshot', {}).get('completedRerunCount', 0) + fresh_updates,
                        'runningRerunCount': sum(r['replacementStatus'] == 'running' for r in all_runs if r.get('replacementStatus')),
                        'invalidRerunCount': sum(r['replacementStatus'] == 'invalid' for r in all_runs if r.get('replacementStatus')),
                        'apiCostsFetchedAt': max(r['apiCostFetchedAt'] for r in all_runs if r.get('apiCostFetchedAt'))}
    args.output.write_text('window.ARB_DATA = ' + json.dumps(site, separators=(',', ':')) + ';\n')
    (args.snapshot / 'score-refresh-audit.json').write_text(json.dumps(audit, indent=2) + '\n')
    print(json.dumps(site['snapshot']))


if __name__ == '__main__':
    main()
