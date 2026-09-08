"""Build display curves from a selected, immutable Horizon download.

No network calls. Missing/current failed attempts never fall back to older IDs.
Run with --help for inputs. The audit belongs in the local snapshot directory.
"""
import argparse
import copy
import gzip
import json
import re
import statistics
from datetime import datetime
from pathlib import Path


def read_site(path):
    return json.loads(path.read_text().split('=', 1)[1].rstrip(';\n'))


def elapsed(row):
    return max(row.get('public_elapsed_seconds') or 0, row.get('private_elapsed_seconds') or 0)


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
        if row.get('public_score') is not None and row['public_score'] > best:
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
    parser.add_argument('--older-manifest', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    site = read_site(args.previous)
    known = {r['evaluationId']: t['name'] for t in site['tasks'] for r in t['models']}
    old = json.loads(args.older_manifest.read_text())['evaluations']
    old_names = {r['task_slug']: known[r['evaluation_id']] for r in old if r['evaluation_id'] in known}
    by_id = {r['evaluation_id']: old_names[r['task_slug']] for r in old}
    manifest = json.loads((args.snapshot / 'manifest.json').read_text())
    names = {r['task_slug']: by_id[r['evaluation_id']] for r in manifest['evaluations'] if r['evaluation_id'] in by_id}
    assert len(names) == 29
    task_lookup = {t['name']: t for t in site['tasks']}
    models = {m['name']: m['codename'] for m in site['models']}
    old_runs = {r['evaluationId']: r for t in site['tasks'] for r in t['models']}
    for task in site['tasks']:
        task['models'] = []
    audit = []
    for source in manifest['evaluations']:
        eid = source['evaluation_id']
        payload = json.load(gzip.open(args.snapshot / 'evaluations' / (eid + '.json.gz')))
        result = payload['results']['rollouts'][0]
        attempts = result['attempts']
        attempt = next((a for a in attempts if a.get('is_final_attempt')), attempts[-1])
        status = payload['status']['job_status']
        eligible = (status == 'running' or (status == 'completed' and attempt['status'] == 'completed'))
        eligible = eligible and not attempt.get('error') and 'crash' not in source['manifest_status'].lower()
        eligible = eligible and not any(r['status'] == 'errored' for r in payload['status'].get('rollout_statuses', []))
        # Explicit user-approved exception: retain this result and carry iteration 22
        # into its missing iteration 23 test measurement. Never generalize to errors.
        if eid == '60a7e9e2-c234-4091-a258-242d0574dc30':
            eligible = True
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
        points = curve(iterations, end) if eligible else []
        count, hours, timing = activity_and_time(payload['rollouts'][0]['messages'], iterations)
        active = active_time_share(payload['rollouts'][0]['messages'])
        old_run = old_runs.get(eid, {})
        run = {'model': models[source['model']], 'hours': end / 3600 if eligible else 0,
               # Only preserve the existing ledger value for this exact completed ID.
               # Runner total_cost is a different source and is not an API ledger.
               'apiCost': old_run.get('apiCost') if status == 'completed' else None,
               'outputTokens': ro.get('total_output_tokens'), 'evaluationId': eid,
               'sourceStatus': source['manifest_status'], 'sourceFile': source['source_path'],
               'status': status, 'provisional': eligible and status == 'running', 'extension': False,
               'points': points, 'submissions': count if eligible else None,
               'workHours': hours if eligible else None,
               'activeTimePercent': active['percent'] if eligible else None,
               'activeElapsedHours': active.get('active_elapsed_seconds', 0) / 3600 if eligible else None}
        task_lookup[names[source['task_slug']]]['models'].append(run)
        audit.append({**source, 'included': bool(eligible), 'status': status,
                      'attempt_status': attempt['status'], 'task_name': names[source['task_slug']],
                      'submissions': count, 'work_hours': hours, 'timing': timing,
                      'active_time': active,
                      'score_carried_forward': carried, 'observed_end_hours': end / 3600})
    for task in site['tasks']:
        task['models'].sort(key=lambda r: list(models.values()).index(r['model']))
        assert len(task['models']) == 9
    site['snapshot'] = {'fetchedAt': max(json.loads(line)['fetched_at'] for line in (args.snapshot / 'download_progress.jsonl').read_text().splitlines()),
                        'sourceCommit': manifest['source_commit'], 'provisional': True,
                        'includedRuns': sum(r['included'] for r in audit)}
    args.output.write_text('window.ARB_DATA = ' + json.dumps(site, separators=(',', ':')) + ';\n')
    (args.snapshot / 'score-refresh-audit.json').write_text(json.dumps(audit, indent=2) + '\n')
    print(json.dumps(site['snapshot']))


if __name__ == '__main__':
    main()
