"""Fill the placeholders of a sql/pull_*.sql template and print / save the query.

Examples
  python scripts/render_sql.py sql/pull_issue_rows_current_month.sql --from 2026-10-01 --to 2026-10-05 --rn 0 700
  python scripts/render_sql.py sql/pull_daily_packs.sql --from 2026-09-01 --to 2026-10-04 --limit 1000 --offset 0
  python scripts/render_sql.py sql/pull_sales_cohorts.sql --from 2026-10-01 --to 2026-10-05 --prev-from 2026-09-01 --prev-to 2026-10-01 --snapshot 2026-09-01
  python scripts/render_sql.py <template> ... -o out.sql

The AM list and the sales list come from data/org_final.json (built from the targets workbook).
"""
import argparse, json, pathlib, re, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('template'); ap.add_argument('-o', '--out')
    ap.add_argument('--from', dest='frm', default='2026-10-01'); ap.add_argument('--to', default='2026-10-05')
    ap.add_argument('--prev-from', default='2026-09-01'); ap.add_argument('--prev-to', default='2026-10-01'); ap.add_argument('--snapshot', default='2026-09-01')
    ap.add_argument('--owner-since', default='2026-06-01')
    ap.add_argument('--rn', nargs=2, type=int, default=[0, 700]); ap.add_argument('--limit', type=int, default=1000); ap.add_argument('--offset', type=int, default=0)
    a = ap.parse_args()
    org = json.load(open(ROOT / 'data' / 'org_final.json', encoding='utf-8'))
    q = lambda names: ','.join("'" + n.replace("'", "''") + "'" for n in names)
    sub = {'__AM_LIST__': q(x['name'] for x in org['ams']), '__SALES_LIST__': q(x['name'] for x in org['sales']),
           '__SALES_UNION__': ' UNION ALL '.join("SELECT '%s' n" % x['name'].replace("'", "''") for x in org['sales']),
           '__OWNER_SINCE__': a.owner_since, '__FROM__': a.frm, '__TO__': a.to, '__PREV_FROM__': a.prev_from, '__PREV_TO__': a.prev_to, '__SNAPSHOT__': a.snapshot,
           '__RN_FROM__': str(a.rn[0]), '__RN_TO__': str(a.rn[1]), '__LIMIT__': str(a.limit), '__OFFSET__': str(a.offset)}
    text = open(a.template, encoding='utf-8').read()
    for k, v in sub.items(): text = text.replace(k, v)
    left = sorted(set(re.findall(r'__[A-Z_]+__', text)))
    if left: sys.exit('unfilled placeholders: ' + ', '.join(left))
    (open(a.out, 'w', encoding='utf-8').write(text) if a.out else print(text))

if __name__ == '__main__':
    main()
