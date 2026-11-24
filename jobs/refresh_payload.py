"""Refresh job: reads the warehouse and writes dist/payload.json (the only file the app needs besides its code).

Run it on a schedule (EventBridge + ECS task / Lambda container / cron) after the mart tables load:
    pip install redshift_connector openpyxl boto3
    REDSHIFT_HOST=... REDSHIFT_DB=... REDSHIFT_USER=... REDSHIFT_PASSWORD=... [S3_BUCKET=... S3_KEY=payload.json] python jobs/refresh_payload.py --month 2026-10-01
Every query is in sql/ (mart tables, except where docs/DATA_SOURCES.md says otherwise). The pages / ingest / build steps are the same scripts that were
validated against the previous data, so this job only replaces "a person pastes SQL into Metabase" with a database connection.
STATUS: the SQL was run through Metabase; this connection code has NOT been run against the warehouse (no direct connection from the build sandbox).
"""
import argparse, calendar, datetime, json, os, pathlib, subprocess, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]; DATA = ROOT / 'data'; SQL = ROOT / 'sql'; S = ROOT / 'scripts'
sys.path.insert(0, str(S))

def connect():
    import redshift_connector
    return redshift_connector.connect(host=os.environ['REDSHIFT_HOST'], database=os.environ['REDSHIFT_DB'], user=os.environ['REDSHIFT_USER'], password=os.environ['REDSHIFT_PASSWORD'], port=int(os.environ.get('REDSHIFT_PORT', 5439)))

def run(conn, sql):
    cur = conn.cursor(); cur.execute(sql); rows = [[(str(v) if isinstance(v, (datetime.date, datetime.datetime)) else v) for v in r] for r in cur.fetchall()]; cur.close(); return rows

def save(rows, path): json.dump({'data': {'rows': rows}}, open(path, 'w', encoding='utf-8'), ensure_ascii=False)

def render(template, **kw):
    cmd = [sys.executable, str(S / 'render_sql.py'), str(SQL / template)] + [x for k, v in kw.items() for x in ('--' + k.replace('_', '-'), *(v if isinstance(v, (list, tuple)) else [str(v)]))]
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout

def sh(*a): subprocess.run([sys.executable, *map(str, a)], check=True, cwd=ROOT)

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--month', required=True, help='first day of the month, e.g. 2026-10-01'); ap.add_argument('--as-of', help='last day with data (default: yesterday)')
    a = ap.parse_args(); m0 = datetime.date.fromisoformat(a.month); asof = datetime.date.fromisoformat(a.as_of) if a.as_of else datetime.date.today() - datetime.timedelta(days=1)
    prev0 = (m0 - datetime.timedelta(days=1)).replace(day=1)
    os.environ['TARGETS_MONTH'] = a.month[:7]                       # scripts/build_org.py: targets and hierarchy of this month
    from build_tracker_data import new_window; pw0, nw0, nw1 = new_window(m0)   # new-merchant window: 25th of last month to the 25th of this month
    conn = connect(); T = DATA / 'tmp_pages'; T.mkdir(exist_ok=True)
    # 1) targets: public.commercial_monthly_targets (the hierarchy / teams / weights still come from the targets workbook: no table has them)
    save(run(conn, "SELECT target_month::varchar, employee_name, role, target_type, target_value, loaded_at::varchar FROM public.commercial_monthly_targets WHERE target_month = DATE '%s'" % a.month), T / 't.json')
    _tf = DATA / ('commercial_monthly_targets_db.json' if a.month[:7] == '2026-10' else 'commercial_monthly_targets_db_%s.json' % a.month[:7]); json.dump(json.load(open(T / 't.json'))['data']['rows'], open(_tf, 'w'), ensure_ascii=False)
    # 2) working days from the calendar (Fridays excluded)
    wd = lambda d0, d1: run(conn, "SELECT COUNT(*) FROM mart.v_bosta_calendar WHERE date BETWEEN DATE '%s' AND DATE '%s' AND EXTRACT(dow FROM date) <> 5" % (d0, d1))[0][0]
    elapsed, full = wd(m0, asof), wd(m0, m0.replace(day=calendar.monthrange(m0.year, m0.month)[1]))
    # 3) roster + monthly / daily packs + metadata. Portfolio = public.businesses.account_manager_name (today's owner) for the AMs of the targets table;
    #    VP-only rows (scope 'vp'): Box / no segment / other segments, active this month. Packs: mart.v_merchant_monthly_wide, v_merchant_daily_wide (see docs/DATA_SOURCES.md)
    ams = sorted({r[1] for r in json.load(open(_tf)) if r[2] == 'Account Manager'}); aml = ', '.join("'" + x.replace("'", "''") + "'" for x in ams)
    pages, off = [], 0
    while True:
        rows = run(conn, render('pull_roster_packs.sql', **{'from': str(prev0), 'to': str(asof), 'new_from': str(nw0), 'prev_from': str(pw0), 'limit': 1700, 'offset': off}).replace('__AM_LIST__', aml)); save(rows, T / ('p%d.json' % len(pages))); pages.append(str(T / ('p%d.json' % len(pages))))
        if len(rows) < 1700: break
        off += 1700
    # 3b) sales cohorts (public.businesses / businesses_monthly_snapshot: see docs/DATA_SOURCES.md): new merchants (N), last month's new (C), reactivations (R)
    save(run(conn, render('pull_sales_cohorts.sql', **{'from': str(m0), 'to': str(asof + datetime.timedelta(days=1)), 'new_from': str(nw0), 'new_to': str(nw1), 'prev_from': str(pw0), 'prev_to': str(nw0), 'snapshot': str(prev0)})), T / 'sales.json')
    json.dump([r[:9] for r in json.load(open(T / 'sales.json'))['data']['rows']], open(DATA / 'sales_rows_fp.json', 'w'))
    #     the sales merchants in no AM portfolio and not VP-only join the roster as scope 'sales' (team leader / head / VP views)
    have = {r[0] for f in pages for r in json.load(open(f))['data']['rows']}
    miss = sorted({r[2] for r in json.load(open(DATA / 'sales_rows_fp.json'))} - have)
    for i in range(0, len(miss), 400):
        rows = run(conn, render('pull_roster_by_ids.sql', **{'from': str(prev0), 'to': str(asof), 'limit': 1000, 'offset': 0, 'ids': miss[i:i + 400]})); save(rows, T / ('s%d.json' % i)); pages.append(str(T / ('s%d.json' % i)))
    #     merchants active in the part of the previous 25th-to-25th month before the daily packs: not reactivations (scripts/build_tracker_data.py)
    json.dump([r[0] for r in run(conn, render('pull_prev_window_active.sql', **{'prev_from': str(pw0), 'from': str(prev0), 'new_from': str(nw0), 'to': str(asof)}))], open(DATA / 'prev_window_active.json', 'w'))
    cd = run(conn, render('pull_company_daily.sql', **{'from': str(prev0), 'to': str(asof)}))   # all pickups of the company per day, for the VP's Daily analysis
    json.dump({'start': cd[0][0], 'cols': ['picked', 'ecomm', 'fulfillment', 'box', 'active'], 'rows': [[int(v or 0) for v in r[1:]] for r in cd]}, open(DATA / 'company_daily.json', 'w'))
    # consignee score of every parcel per merchant and month (Customers tab), same window as the packs: first day of last month to the as-of day
    save(run(conn, render('pull_portfolio_monthly.sql', **{'from': str(prev0), 'to': str(asof), 'new_from': str(nw0), 'prev_from': str(pw0)}).replace('__AM_LIST__', aml)), T / 'pf.json')
    sh(S / 'ingest_roster.py', '--pages', *pages, '--portfolio', T / 'pf.json')
    # consignee score of every parcel per merchant and month (Customers tab), same window as the packs, kept for the roster merchants only
    roster = {r[0] for r in json.load(open(DATA / 'roster_rows.json'))}
    cs = run(conn, render('pull_consignee_scores.sql', **{'from': str(prev0), 'to': str(asof)}))
    bands = ['High', 'Medium', 'Bad', 'No data']; months = sorted({r[1] for r in cs}); csp = {}
    for bid, mo, band, n_p, n_d in cs:
        if bid in roster: csp.setdefault(bid, []).append([months.index(mo), bands.index(band), int(n_p or 0), int(n_d or 0)])
    json.dump({'months': months, 'bands': bands, 'p': csp}, open(DATA / 'consignee_scores.json', 'w'), separators=(',', ':'))
    # 4) creation source / pickup locations from mart.v_parcel_lifecycle
    xr = run(conn, render('pull_merchant_profile_mart.sql', **{'from': str(asof - datetime.timedelta(days=90))}).replace('__AM_LIST__', aml))
    json.dump({r[0]: [r[1], r[2], r[3]] for r in xr}, open(DATA / 'profile_x_mart.json', 'w'))
    sh(S / 'build_store.py', '--prev', DATA / 'profile_store.b64')
    # 5) current-month detail (mart.v_parcel_lifecycle: issues; public.freshdesk_tickets_enriched / public.deliveries_attempts: tickets and failed attempts, no mart source)
    ex = ['--from', str(m0), '--to', str(asof + datetime.timedelta(days=1)), '--rn', '0', '1000000']
    files = {}
    for k, t in (('issues', 'pull_issue_rows_current_month.sql'), ('tickets', 'pull_tickets_current_month.sql'), ('attempts', 'pull_failed_attempts_current_month.sql')):
        txt = render(t, **{'from': str(m0), 'to': str(asof + datetime.timedelta(days=1)), 'rn': ['0', '1000000']}).replace('__AM_LIST__', aml)
        stmts = [s for s in txt.split(';') if s.strip() and not s.strip().startswith('--')]
        rows = run(conn, stmts[-1]); save(rows, T / (k + '.json')); files[k] = str(T / (k + '.json'))
        if k == 'attempts': json.dump([r[1] for r in run(conn, stmts[0])], open(DATA / 'cm_reasons.json', 'w'), ensure_ascii=False)
    sh(S / 'ingest_cm.py', '--issues', files['issues'], '--tickets', files['tickets'], '--attempts', files['attempts'], '--days', asof.day, '--as-of', asof, '--stamp', 'pulled ' + str(datetime.date.today()))
    # 7) build the data, the org and the payload
    sh(S / 'build_tracker_data.py', '--as-of', asof, '--elapsed', elapsed, '--full', full, '--month', m0.strftime('%B %Y'))
    sh(S / 'build_derived_data.py'); sh(S / 'build_expected.py'); sh(S / 'build_expected_lead.py'); sh(S / 'assemble.py')
    out = ROOT / 'dist' / 'payload.json'; print('payload', out, round(out.stat().st_size / 1e6, 1), 'MB')
    if os.environ.get('S3_BUCKET'):
        import boto3; boto3.client('s3').upload_file(str(out), os.environ['S3_BUCKET'], os.environ.get('S3_KEY', 'payload.json'), ExtraArgs={'ContentType': 'application/json', 'CacheControl': 'max-age=300'}); print('uploaded to s3://%s/%s' % (os.environ['S3_BUCKET'], os.environ.get('S3_KEY', 'payload.json')))
