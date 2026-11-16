"""Round trip: rows shaped like mart.v_pricing_rate_card, made from the current sheet-based pack, must rebuild the same rate card.
Also checks the origin dependent formula on the SuperJet numbers read from Redshift on 2026-11-16."""
import base64, gzip, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / 'scripts'))
import refresh_pricing as R

ROOT = pathlib.Path(__file__).resolve().parent.parent
packf = next((f for f in (ROOT / 'data' / 'pricing_store_full.b64', ROOT / 'data' / 'pricing_store.b64') if f.exists()), None)
if not packf:
    print('no pack, skipped'); sys.exit(0)
st = R.load_pack(packf)
P, C = st['pricing']['plans'], st['pricing']['card']
INV = {v: k for k, v in R.SERVICE.items()}
rows = []
for name in ['EGY-3A', 'AMAZON', 'EGY-6C', 'Bundle01', 'FX10A', 'Warehousing-EGY-Traders']:
    c = C[name]
    for t in R.TYPES:
        for s in range(1, 8):
            g = lambda z: P[name][R.idx(t, 1, s, z)]
            rows.append(dict(plan=name, plan_type='Group (3)', service=INV[t], dest=s, od=False, pbf=26, plbf=24, dp=0, sp=0, normal=g('N'),
                             lb=g('B'), hb=g('H'), large=g('L') - g('N'), xlarge=g('X') - g('N'), white=g('W') - g('N'),
                             ato=c['ato'], ato_on=c['ato_on'], flex=c['flex'], xcod=c['xcod'], xcod_lim=c['xcod_lim'], xcod_on=c['xcod_on'],
                             nd=c['nd'], nd_min=c['nd_min'], nd_on=c['nd_on'], loaded_at='2026-11-16 03:15:02'))
new, skipped = R.build(rows, [], C)
bad = 0
for name in {r['plan'] for r in rows}:
    only_old, only_new, diff = R.compare({name: P[name]}, {name: new['plans'][name]})
    if diff:
        bad += 1; print('FAIL plan differs', name)
    if new['card'][name] != C[name]:
        bad += 1; print('FAIL card differs', name, new['card'][name], C[name])
print('round trip:', 'ok' if not bad else 'FAILED', '| asof', new['asof'])

# origin dependent: SuperJet, FXF_SEND, normal = pbf 26 + plbf 59 + transit + service 0 (Redshift 2026-11-16: 100,100,100,120,135,120,145 from pickup sector 1)
transit = [('SuperJet', 1, d, c) for d, c in zip(range(1, 8), [15, 15, 15, 35, 50, 35, 60])]
od_rows = [dict(plan='SuperJet', plan_type='Customize Plan', service='FXF_SEND', dest=d, od=True, pbf=26, plbf=59, dp=0, sp=0, normal=100, lb=500, hb=500,
                large=5, xlarge=10, white=15, ato=7, ato_on=False, flex=15, xcod=0.01, xcod_lim=2000, xcod_on=False, nd=0.01, nd_min=12, nd_on=False, loaded_at=None) for d in range(1, 8)]
n2, sk = R.build(od_rows, transit, {})
got = [n2['plans']['SuperJet'][R.idx('F', 1, d, 'N')] for d in range(1, 8)]
want = [100, 100, 100, 120, 135, 120, 145]
print('origin dependent SuperJet:', 'ok' if got == want else 'FAILED %s' % got)
sys.exit(0 if not bad and got == want else 1)
