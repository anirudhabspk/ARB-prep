"""Rebuild hourly harness curves from pinned Horizon grading records."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parent


def series(iterations):
    result = {key: [] for key in ('validation', 'test', 'raw_validation', 'raw_test')}
    picks = []
    for hour in range(13):
        eligible = [r for r in iterations if r.get('public_elapsed_seconds') is not None
                    and r['public_elapsed_seconds'] <= hour * 3600
                    and r.get('public_score') is not None]
        best = max(eligible, key=lambda r: r['public_score']) if eligible else None
        picks.append(best['iteration'] if best else None)
        for target, source in [('validation','public_score'), ('test','private_score'),
                               ('raw_validation','public_raw_score'), ('raw_test','private_raw_score')]:
            value = best.get(source) if best else None
            if best and source.startswith('private') and (best.get('private_elapsed_seconds') is None
                    or best['private_elapsed_seconds'] > hour * 3600):
                value = None
            result[target].append(value)
    result['selected_iterations'] = picks
    return result


def build(source):
    tasks = []
    totals = {}
    for task in source['tasks']:
        arms = {}
        for key, run in task['runs'].items():
            arms[key] = series(run['iterations'])
            arms[key]['evaluation_id'] = run['evaluation_id']
            count = sum(r.get('public_elapsed_seconds') is not None and
                        r['public_elapsed_seconds'] <= 43200 for r in run['iterations'])
            arms[key]['completed_evaluations'] = count
            totals[key] = totals.get(key, 0) + count
        tasks.append(dict(name=task['name'], series=arms))
    common = [t for t in tasks if all(v['test'][-1] is not None for v in t['series'].values())]
    aggregate = {k: {metric: sum(t['series'][k][metric][-1] for t in common)/len(common)
                     for metric in ('validation','test')} for k in totals} if common else {}
    for k in aggregate:
        aggregate[k]['completed_evaluations'] = sum(t['series'][k]['completed_evaluations'] for t in common)/len(common)
    return dict(aggregate=aggregate, aggregate_tasks=[t['name'] for t in common], hours=list(range(13)), timing='grading_completion', tasks=tasks,
                average_completed_evaluations={k: n / len(tasks) for k,n in totals.items()})


if __name__ == '__main__':
    source = json.loads((ROOT/'analysis/harness/source.json').read_text())
    data = build(source)
    (ROOT/'harness-ablation-data.js').write_text('window.ARB_HARNESS_ABLATIONS='+json.dumps(data,separators=(',',':'))+';\n')
