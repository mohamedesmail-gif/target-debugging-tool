"""Live feed job: reads fact.deliveries_live and writes live.json, the file behind the Live section of the portal.

Run it every minute (cron / ECS scheduled task / Lambda container) and serve the file next to the app (same host, path /live.json):
    pip install redshift_connector boto3
    REDSHIFT_HOST=... REDSHIFT_DB=... REDSHIFT_USER=... REDSHIFT_PASSWORD=... python jobs/refresh_live.py --out dist-web/live.json
    python jobs/refresh_live.py --out /usr/share/nginx/html/live.json --every 60        # keep running, one refresh per minute
    S3_BUCKET=... S3_LIVE_KEY=live.json python jobs/refresh_live.py --every 60            # also upload to S3 (the bucket must be served at /live.json)
SQL: sql/live_meta.sql (clock and baseline weeks) and sql/live_rows.sql (one row per business). The file is written in one step (temp file, then rename),
so the portal never reads half a file. If a refresh fails, the old file stays and the portal shows how old it is. docs/LIVE.md has the definitions.
"""
import argparse, json, os, pathlib, sys, time, datetime
ROOT = pathlib.Path(__file__).resolve().parents[1]; SQL = ROOT / 'sql'
sys.path.insert(0, str(pathlib.Path(__file__).parent))
COLS = ['id', 'c_t', 'c_ys', 'c_b', 'p_t', 'p_ys', 'p_b', 'pc_t', 'c_y', 'c_yy', 'p_y', 'p_yy', 'pc_y']   # the portal checks this exact list

def sql_text(name, min_day):
    return (SQL / name).read_text(encoding='utf-8').replace('__MIN_DAY__', str(int(min_day))).strip().rstrip(';')

def build_live(run, min_day=10000):
    """run(sql) -> list of rows. Returns the live.json dictionary."""
    meta = run(sql_text('live_meta.sql', min_day))
    assert len(meta) == 1, 'live_meta.sql must return one row'
    dt, cut, bw_c, bw_p = meta[0]
    rows = [[str(r[0])] + [int(v or 0) for v in r[1:]] for r in run(sql_text('live_rows.sql', min_day))]
    assert rows, 'live_rows.sql returned no rows: the table is empty or the clock is wrong'
    assert all(len(r) == len(COLS) for r in rows), 'live_rows.sql must return %d columns' % len(COLS)
    return {'v': 1, 'asOf': str(cut)[:19], 'day': str(dt)[:10], 'bwC': int(bw_c), 'bwP': int(bw_p), 'cols': COLS, 'rows': rows, 'source': 'fact.deliveries_live', 'builtAt': datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S') + ' UTC'}

def write_atomic(path, live):
    path = pathlib.Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + '.tmp'); tmp.write_text(json.dumps(live, separators=(',', ':')), encoding='utf-8'); os.replace(tmp, path)

def upload_s3(path):
    import boto3
    boto3.client('s3').upload_file(str(path), os.environ['S3_BUCKET'], os.environ.get('S3_LIVE_KEY', 'live.json'), ExtraArgs={'ContentType': 'application/json', 'CacheControl': 'no-store'})

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--out', default=str(ROOT / 'dist-web' / 'live.json')); ap.add_argument('--every', type=int, default=0, help='seconds between refreshes (0 = once)'); ap.add_argument('--min-day', type=int, default=10000, help='parcels a past day needs to count as a baseline day')
    a = ap.parse_args()
    from refresh_payload import connect, run as _run
    while True:
        try:
            conn = connect()
            try: live = build_live(lambda q: _run(conn, q), a.min_day)
            finally: conn.close()
            write_atomic(a.out, live)
            if os.environ.get('S3_BUCKET'): upload_s3(a.out)
            print(datetime.datetime.now().strftime('%H:%M:%S'), 'live.json written:', len(live['rows']), 'businesses, as of', live['asOf'], flush=True)
        except Exception as e:
            print('refresh failed (the old file stays):', repr(e), file=sys.stderr, flush=True)
            if not a.every: sys.exit(1)
        if not a.every: break
        time.sleep(a.every)
