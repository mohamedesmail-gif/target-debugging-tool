"""Ingest the raw results of the three current-month detail pulls into the profile store.

Each pull returns packed rows (see sql/pull_*_current_month.sql):
  issues   : (merchant_id, chunk, packed_rows, rn[, pad])   rows joined by '~', fields by '|'
  tickets  : (merchant_id, chunk, packed_rows, rn[, pad])
  attempts : (merchant_id, counts, recent, rn[, pad])       counts 'day,reason,n;...'  recent 'tracking,day,reason;...'
Result files are JSON in the Metabase / Redshift Data shape ({"data": {"rows": [...]}}) or the Metabase MCP wrapper.

Usage:
  python scripts/ingest_cm.py --issues f1.json f2.json ... --tickets ... --attempts ... [--stamp "pulled 2026-10-05"] [--days 4] [--as-of 2026-10-04]
Writes data/cm_issues.json, data/cm_tickets.json, data/cm_attempts.json and replaces the `cm` block of data/profile_store.b64.
The failure-reason dictionary (data/cm_reasons.json) must come from the same month: sql/pull_failed_attempts_current_month.sql, first query.
"""
import argparse, collections, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from store_tools import load_store, save_store
DATA = pathlib.Path(__file__).resolve().parents[1] / 'data'

def load_rows(path):
    d = json.load(open(path, encoding='utf-8'))
    obj = json.loads(d[0]['text']) if isinstance(d, list) else d
    return obj['data']['rows']

def packed(files, width):
    out = collections.defaultdict(list)
    for f in files:
        for r in load_rows(f):
            for row in r[2].split('~'):
                fields = row.split('|')
                assert len(fields) == width, (f, len(fields))
                out[r[0]].append(fields)
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--issues', nargs='+', required=True); ap.add_argument('--tickets', nargs='+', required=True); ap.add_argument('--attempts', nargs='+', required=True)
    ap.add_argument('--reasons', default=str(DATA / 'cm_reasons.json')); ap.add_argument('--stamp', default='pulled 2026-10-05')
    ap.add_argument('--days', type=int, default=4); ap.add_argument('--as-of', default='2026-10-04')
    a = ap.parse_args()
    issues, tickets = packed(a.issues, 13), packed(a.tickets, 9)
    att = {}
    for f in a.attempts:
        for mid, counts, recent, rn, *_ in load_rows(f): att[mid] = {'c': counts, 'r': recent}
    json.dump(issues, open(DATA / 'cm_issues.json', 'w')); json.dump(tickets, open(DATA / 'cm_tickets.json', 'w')); json.dump(att, open(DATA / 'cm_attempts.json', 'w'))
    reasons = json.load(open(a.reasons, encoding='utf-8'))
    cm = {'asOf': a.as_of, 'days': a.days, 'stamp': a.stamp, 'rs': reasons,
          'i': {m: '~'.join('|'.join(r) for r in rows) for m, rows in issues.items()},
          't': {m: '~'.join('|'.join(r) for r in rows) for m, rows in tickets.items()}, 'a': att}
    store = load_store(); store['cm'] = cm; save_store(store)
    print('cm: %d merchants with issues (%d rows), %d with tickets (%d rows), %d with failed attempts' % (len(issues), sum(map(len, issues.values())), len(tickets), sum(map(len, tickets.values())), len(att)))

if __name__ == '__main__':
    main()
