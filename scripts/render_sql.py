"""Fill the placeholders of a sql/pull_*.sql template and print / save the query.

Examples
  python scripts/render_sql.py sql/pull_issue_rows_current_month.sql --from 2026-10-01 --to 2026-10-05 --rn 0 700
  python scripts/render_sql.py sql/pull_daily_packs.sql --from 2026-09-01 --to 2026-10-04 --limit 1000 --offset 0
  python scripts/render_sql.py sql/pull_sales_cohorts.sql --from 2026-10-01 --to 2026-10-05 --new-from 2026-09-25 --new-to 2026-10-25 --prev-from 2026-08-25 --prev-to 2026-09-25 --snapshot 2026-09-01
  python scripts/render_sql.py <template> ... -o out.sql

The AM list and the sales list come from data/org_final.json (built from the targets workbook).
"""
import argparse, json, pathlib, re, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('template'); ap.add_argument('-o', '--out')
    ap.add_argument('--from', dest='frm', default='2026-10-01'); ap.add_argument('--to', default='2026-10-05')
    ap.add_argument('--prev-from', default='2026-08-25'); ap.add_argument('--prev-to', default='2026-09-25'); ap.add_argument('--snapshot', default='2026-09-01')
    ap.add_argument('--new-from', default='2026-09-25'); ap.add_argument('--new-to', default='2026-10-25')
    ap.add_argument('--owner-since', default='2026-06-01'); ap.add_argument('--ids', nargs='*', default=[])
    ap.add_argument('--rn', nargs=2, type=int, default=[0, 700]); ap.add_argument('--limit', type=int, default=1000); ap.add_argument('--offset', type=int, default=0)
    a = ap.parse_args()
    # people of the month: the targets table of the month of --to (data/commercial_monthly_targets_db_YYYY-MM.json), else the built org file
    tf = ROOT / 'data' / ('commercial_monthly_targets_db_%s.json' % a.to[:7])
    if tf.exists():
        t = json.load(open(tf, encoding='utf-8'))
        am_names = sorted({r[1] for r in t if r[2] == 'Account Manager'}); sales_names = sorted({r[1] for r in t if r[2] == 'Sales Manager'})
    else:
        org = json.load(open(ROOT / 'data' / 'org_final.json', encoding='utf-8'))
        am_names = [x['name'] for x in org['ams']]; sales_names = [x['name'] for x in org['sales']]
    q = lambda names: ','.join("'" + n.replace("'", "''") + "'" for n in names)
    sub = {'__AM_LIST__': q(am_names), '__SALES_LIST__': q(sales_names),
           '__SALES_UNION__': ' UNION ALL '.join("SELECT '%s' n" % x.replace("'", "''") for x in sales_names),
           '__OWNER_SINCE__': a.owner_since, '__CUR0__': a.to[:8] + '01', '__FROM__': a.frm, '__TO__': a.to, '__NEW_FROM__': a.new_from, '__NEW_TO__': a.new_to, '__PREV_FROM__': a.prev_from, '__PREV_TO__': a.prev_to, '__SNAPSHOT__': a.snapshot,
           '__IDS__': ','.join("'" + x.replace("'", "''") + "'" for x in a.ids) or "''", '__RN_FROM__': str(a.rn[0]), '__RN_TO__': str(a.rn[1]), '__LIMIT__': str(a.limit), '__OFFSET__': str(a.offset)}
    text = open(a.template, encoding='utf-8').read()
    for k, v in sub.items(): text = text.replace(k, v)
    left = sorted(set(re.findall(r'__[A-Z_]+__', text)))
    if left: sys.exit('unfilled placeholders: ' + ', '.join(left))
    (open(a.out, 'w', encoding='utf-8').write(text) if a.out else print(text))

if __name__ == '__main__':
    main()
