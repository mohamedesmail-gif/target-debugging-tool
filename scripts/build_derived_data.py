"""Derive the per-merchant ASP inputs, the Oct/Sep same-days pickups and the org file used by the app.

Inputs : data/profile_store.b64, data/roster_rows.json, data/new_data_oct.json, data/sales_rows_fp.json, data/October_Targets_2026.xlsx
Outputs: data/ptd_sep1_4.json   pickups Sep 1-4 per merchant   (same days of the previous month)
         data/td_oct1_4.json    pickups Oct 1-4 per merchant
         data/merchant_asp.json [rev, vas, delivered] Oct 1-4 then Sep 1-4, per merchant
         data/merchant_dsr.json [September DSR %, September parcels picked] per merchant (low-DSR list of the leadership views)
         data/org_final.json    hierarchy + targets + AM actuals (ASP, retention) + sales cohorts (new merchants, churn base)
         data/expected_org.json independent roll-ups used by the tests
Days in the daily pack: index 0.. = Sep 1 ..  (the current month starts at index 30; the same N days of September are indexes 0..N-1).
"""
import json, pathlib, collections, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build_org import heads, tls, ams, sales       # parses the targets workbook
from store_tools import load_store
DATA = pathlib.Path(__file__).resolve().parents[1] / 'data'
store = load_store()
rows = json.load(open(DATA / 'roster_rows.json')); am_of = {r[0]: r[2] for r in rows}
D = json.load(open(DATA / 'new_data_oct.json'))

act = {a['name']: dict(aspNum=0, aspDen=0, retBase=0, retKept=0, tdPicked=0) for a in ams}
asp, ptd, td, dsr = {}, {}, {}, {}
for bid, (mpack, dpack) in store['p'].items():
    days = [list(map(int, s.split(','))) for s in dpack.split(';')]
    NDAYS = len(days) - 30                                       # days of the current month in the pack (Sep has 30)
    oc, sp_ = days[30:], days[:NDAYS]                            # current month so far / the same days of the previous month
    asp[bid] = [sum(d[5] for d in oc), sum(d[6] for d in oc), sum(d[4] for d in oc), sum(d[5] for d in sp_), sum(d[6] for d in sp_), sum(d[4] for d in sp_)]
    ptd[bid] = sum(d[3] for d in sp_); td[bid] = sum(d[3] for d in oc)
    sepm = list(map(int, mpack.split(';')[8].split(',')))                                   # September monthly row
    dsr[bid] = [round(sepm[15] / 100, 2) if sepm[15] >= 0 else None, sepm[3]]              # [DSR %, parcels picked]
    am = am_of.get(bid)
    if am not in act: continue
    pk = td[bid]; sep = int(mpack.split(';')[8].split(',')[3])      # September parcels_picked
    a = act[am]; a['aspNum'] += asp[bid][0]; a['aspDen'] += asp[bid][2]; a['tdPicked'] += pk
    if sep > 0:                                                      # retention base: active in September ...
        a['retBase'] += 1
        if pk > 0: a['retKept'] += 1                                 # ... and already picking up this month
for a in ams: a['a'] = act[a['name']]

srows = json.load(open(DATA / 'sales_rows_fp.json'))   # kind N = first pickup this month, C = last month's first-pickup cohort
by = collections.defaultdict(lambda: {'N': [], 'C': []})
for kind, sm, bid, name, fp, op, od, orv, sp in srows: by[sm.strip().lower()][kind].append([bid, name, fp, op, od, orv, sp])
for s in sales:
    v = by.get(s['name'].lower(), {'N': [], 'C': []}); N, C = v['N'], v['C']
    s['a'] = dict(newMerchants=len(N), newPicked=sum(x[3] for x in N), newDelivered=sum(x[4] for x in N), newRevenue=sum(x[5] for x in N), cohort=len(C), cohortChurned=sum(1 for x in C if x[3] == 0))
    s['newList'] = sorted(N, key=lambda x: -x[3]); s['cohortList'] = sorted(C, key=lambda x: (x[3] > 0, -x[3]))
for e in heads + tls + ams + sales: e['w'] = list(e['w'])
strip = lambda L: [{k: v for k, v in p.items() if k not in ('email', 'fullName')} for p in L]     # emails stay out of the app file (see build_access.py)
ORG = dict(asOf=D['asOf'], days=NDAYS, wdElapsed=D['wdElapsed'], vp=dict(name='Sameh Shaheen'), heads=strip(heads), tls=strip(tls), ams=strip(ams), sales=strip(sales))

def rollup(a_, s_):
    pk = sum(sum(m['mtd'] for m in D['ams'][a['name']]['merchants']) for a in a_); num = sum(a['a']['aspNum'] for a in a_); den = sum(a['a']['aspDen'] for a in a_)
    rb = sum(a['a']['retBase'] for a in a_); rk = sum(a['a']['retKept'] for a in a_)
    return dict(pickups=pk, asp=num / den if den else None, retention=rk / rb if rb else None, newPicked=sum(s['a']['newPicked'] for s in s_), cohort=sum(s['a']['cohort'] for s in s_), churned=sum(s['a']['cohortChurned'] for s in s_))
EXP = dict(vp=rollup(ams, sales), heads={h['name']: rollup([a for a in ams if a['headId'] == h['id']], [s for s in sales if s['headId'] == h['id']]) for h in heads})
fa = [a for a in ams if a['name'] == 'Farha Aly Saad'][0]; EXP['am_farha'] = dict(rollup([fa], []), target=fa['t'])
EXP['tl_ahmed_saleh'] = rollup([a for a in ams if a['tlId'] == 't4'], [s for s in sales if s['tlId'] == 't4'])
EXP['tl_mohamed_samir'] = rollup([a for a in ams if a['tlId'] == 't8'], [])
EXP['tl_moataz'] = rollup([a for a in ams if a['tlId'] == 't7'], [])
EXP['merchant_th'] = dict(zip(['rev', 'vas', 'dlv', 'prev', 'pvas', 'pdlv'], asp['ImbeR25m9']))

out = lambda name, obj, **k: json.dump(obj, open(DATA / name, 'w', encoding='utf-8'), ensure_ascii=False, **k)
out('ptd_sep1_4.json', ptd); out('td_oct1_4.json', td); out('merchant_asp.json', asp); out('merchant_dsr.json', dsr)
out('org_final.json', ORG, separators=(',', ':')); out('expected_org.json', EXP, indent=1)
print('wrote ptd/td/merchant_asp/org_final/expected_org | AMs', len(ams), 'sales', len(sales), 'merchants', len(asp))
