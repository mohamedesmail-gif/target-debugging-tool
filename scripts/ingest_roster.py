"""Ingest the raw pages of sql/pull_roster_packs.sql and the result of sql/pull_portfolio_monthly.sql.

Usage: python scripts/ingest_roster.py --pages p1.json p2.json p3.json --portfolio pf.json
Writes: data/roster_rows.json  [id, name, am, segment, joining_date, last_activity, monthly_pack, daily_pack, scope]   scope 'am' = AM portfolio, 'vp' = VP-only extra
        data/daily_packs.json  {id: daily_pack}      data/meta_rows.json {id: {w, pid, pn, ns}} (raw website; the domain is taken in build_store)
        data/pf_monthly.json   {am: 10 months x 32 fields}
"""
import argparse, json, pathlib
DATA = pathlib.Path(__file__).resolve().parents[1] / 'data'

def load_rows(path):
    d = json.load(open(path, encoding='utf-8'))
    obj = json.loads(d[0]['text']) if isinstance(d, list) else d
    return obj['data']['rows']

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--pages', nargs='+', required=True); ap.add_argument('--portfolio', required=True)
    a = ap.parse_args()
    rows, daily, meta, seen = [], {}, {}, set()
    for f in a.pages:
        for bid, name, am, seg, jd, la, mp, dp, web, pid, pn, ns, *rest in load_rows(f):
            assert bid not in seen, bid; seen.add(bid)
            scope = rest[0] if rest and rest[0] in ('am', 'vp', 'sales') else 'am'      # older pulls have no scope column: all AM portfolio
            rows.append([bid, name, am, seg, jd, la, mp, dp, scope]); daily[bid] = dp
            m = {}
            if web: m['w'] = web
            if pid: m['pid'] = pid; m['pn'] = pn
            if ns: m['ns'] = int(ns)
            meta[bid] = m
    rows.sort(key=lambda r: r[0])
    pf = {r[0]: r[1] for r in load_rows(a.portfolio)}
    json.dump(rows, open(DATA / 'roster_rows.json', 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump(daily, open(DATA / 'daily_packs.json', 'w')); json.dump(meta, open(DATA / 'meta_rows.json', 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump(pf, open(DATA / 'pf_monthly.json', 'w'))
    print('merchants', len(rows), '| AMs with merchants', len({r[2] for r in rows}), '| portfolio packs', len(pf))
