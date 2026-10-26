"""Assemble the embedded store (data/profile_store.b64) from the pulled roster files.

Inputs : data/roster_rows.json, data/daily_packs.json, data/meta_rows.json, data/pf_monthly.json (see scripts/ingest_roster.py)
         the previous store: creation source, % share and pickup locations of a merchant are kept (they are not refreshed here);
         the current-month detail block `cm` is kept until scripts/ingest_cm.py replaces it.
Output : p  {id: [monthly pack, daily pack]}   x  {id: {s, sp, l, w, pid, pn, ns}}   pf {am: [monthly pack (35 fields), daily pack (17 fields)]}   cm
Portfolio monthly pack = the 32 pulled fields + active / VAS / new merchants (counted from the merchant packs); portfolio daily pack = the sum
of the merchants' daily packs + the number of merchants with a pickup that day. Usage: python scripts/build_store.py [--prev data/profile_store_prev.b64]
"""
import argparse, json, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from store_tools import load_store, save_store
DATA = pathlib.Path(__file__).resolve().parents[1] / 'data'
F_PICKED, F_VAS = 3, 7                      # monthly pack field indexes: parcels_picked, delivery_revenue_vas_total

def domain(u):
    raw = (u or '').strip(); d = raw.lower()
    d = re.sub(r'^[a-z]+://', '', d); d = re.sub(r'^www\d?\.', '', d)
    d = re.split(r'[/?#]', d)[0].split('@')[-1]; d = re.sub(r':\d+$', '', d).strip()
    return d or raw

def build(prev, rows, daily, meta, pfm, xmart=None):
    p = {r[0]: [r[6], daily[r[0]]] for r in rows}
    x = {}
    for r in rows:
        old = prev['x'].get(r[0], {}); e = {k: old[k] for k in ('s', 'sp', 'l') if k in old}
        if xmart and r[0] in xmart:                       # from mart.v_parcel_lifecycle (sql/pull_merchant_profile_mart.sql): replaces the old values
            src, pct, locs = xmart[r[0]]; e['s'] = src; e['sp'] = int(pct); e['l'] = [t for t in (locs or '').split('|') if t]
        m = meta.get(r[0], {})
        if m.get('w'): e['w'] = domain(m['w'])
        for k in ('pid', 'pn', 'ns'):
            if m.get(k) not in (None, ''): e[k] = m[k]
        x[r[0]] = e
    by_am = {}
    for r in rows: by_am.setdefault(r[2], []).append(r)
    pf = {}
    for am, ms in by_am.items():
        pulled = [list(map(int, s.split(','))) for s in pfm[am].split(';')]
        mon = [[list(map(int, s.split(','))) for s in r[6].split(';')] for r in ms]
        out = []
        for i, row in enumerate(pulled):
            active = sum(1 for m in mon if m[i][F_PICKED] > 0); vas = sum(1 for m in mon if m[i][F_VAS] > 0)
            new = sum(1 for r in ms if r[4] and r[4][:7] == '2026-%02d' % (i + 1))
            out.append(row + [active, vas, new])
        days = [[list(map(int, s.split(','))) for s in daily[r[0]].split(';')] for r in ms]
        dsum = []
        for d in range(len(days[0])):
            dsum.append([sum(m[d][f] for m in days) for f in range(16)] + [sum(1 for m in days if m[d][3] > 0)])
        pf[am] = [';'.join(','.join(map(str, r)) for r in out), ';'.join(','.join(map(str, r)) for r in dsum)]
    return {'p': p, 'x': x, 'pf': pf, 'cm': prev['cm']}

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--prev', default=str(DATA / 'profile_store_prev.b64'))
    a = ap.parse_args()
    xm = DATA / 'profile_x_mart.json'
    store = build(load_store(a.prev), json.load(open(DATA / 'roster_rows.json')), json.load(open(DATA / 'daily_packs.json')), json.load(open(DATA / 'meta_rows.json', encoding='utf-8')), json.load(open(DATA / 'pf_monthly.json')), json.load(open(xm)) if xm.exists() else None)
    save_store(store)
    print('store: merchants', len(store['p']), '| x', len(store['x']), '| portfolio packs', len(store['pf']), '| days per merchant', len(next(iter(store['p'].values()))[1].split(';')))
