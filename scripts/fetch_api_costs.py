"""Add fresh API usage ledgers to a selected evaluation snapshot.

Run with the Horizon SDK environment, before refresh_score_snapshot.py.
"""
import argparse
import concurrent.futures
import gzip
import json
from datetime import datetime, timezone
from pathlib import Path

from horizon import HorizonClient


def main():
    parser = argparse.ArgumentParser(__doc__)
    parser.add_argument('--snapshot', type=Path, required=True)
    args = parser.parse_args()
    rows = json.loads((args.snapshot / 'manifest.json').read_text())['evaluations']

    def fetch(row):
        eid = row['evaluation_id']
        path = args.snapshot / 'evaluations' / (eid + '.json.gz')
        with gzip.open(path, 'rt') as stream:
            payload = json.load(stream)
        payload['api_ledger'] = HorizonClient().request(
            'GET', '/api/v1/workloads/cost', params={'evaluation_id': eid})
        payload['api_ledger_fetched_at'] = datetime.now(timezone.utc).isoformat()
        temporary = path.with_suffix('.tmp')
        with gzip.open(temporary, 'wt') as stream:
            json.dump(payload, stream)
        temporary.replace(path)
        return eid

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        done = list(pool.map(fetch, rows))
    print(f'Fetched API ledgers for {len(done)} selected evaluations.')


if __name__ == '__main__':
    main()
