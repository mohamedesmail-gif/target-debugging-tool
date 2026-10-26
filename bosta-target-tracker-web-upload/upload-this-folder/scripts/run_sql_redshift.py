"""Run a rendered SQL file directly on Redshift and save the result in the same JSON shape the ingest scripts read.

NOT RUN in the environment where this repo was built: there was no direct Redshift access there, every pull so far was executed through
the Metabase connector. Treat it as a starting point and test it against a small query first.

  pip install redshift_connector
  python scripts/render_sql.py sql/pull_daily_packs.sql --from 2026-09-01 --to 2026-10-04 --limit 1000 --offset 0 -o /tmp/q.sql
  REDSHIFT_HOST=... REDSHIFT_DB=... REDSHIFT_USER=... REDSHIFT_PASSWORD=... python scripts/run_sql_redshift.py /tmp/q.sql data/raw/daily_page1.json
"""
import json, os, sys
import redshift_connector

def main(sql_path, out_path):
    conn = redshift_connector.connect(host=os.environ['REDSHIFT_HOST'], database=os.environ['REDSHIFT_DB'], user=os.environ['REDSHIFT_USER'],
                                      password=os.environ['REDSHIFT_PASSWORD'], port=int(os.environ.get('REDSHIFT_PORT', 5439)))
    cur = conn.cursor(); cur.execute(open(sql_path, encoding='utf-8').read())
    rows = [list(r) for r in cur.fetchall()]
    json.dump({'data': {'rows': rows}}, open(out_path, 'w', encoding='utf-8'), default=str)
    print(len(rows), 'rows ->', out_path)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
