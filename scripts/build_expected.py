"""Independent expectations used by tests/smoke.mjs.

Everything here is computed straight from the raw packs and rows, with its own code path, NOT from the app's JavaScript: the tests then
check that the app shows the same numbers.
Inputs : data/profile_store.b64, data/roster_rows.json, data/new_data_oct.json, data/org_final.json, data/merchant_asp.json, data/cm_*.json
Outputs: data/expected_v4.json (same-days hero values, DSR/ASR months), data/expected_cm.json (current-month detail counts),
         data/expected_asp.json (ASP gap analysis per the spec, 3 AMs), data/test_examples.json (a sub-account and a parent merchant)
"""
import json, pathlib, statistics, collections, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from store_tools import load_store
DATA = pathlib.Path(__file__).resolve().parents[1] / 'data'
store = load_store(); rows = json.load(open(DATA / 'roster_rows.json')); byid = {r[0]: r for r in rows}; am_of = {r[0]: r[2] for r in rows}
dump = lambda name, obj, **k: json.dump(obj, open(DATA / name, 'w', encoding='utf-8'), ensure_ascii=False, **k)

# ---------------- expected_v4.json: Oct 1-4 vs Sep 1-4 and last complete months
def win(dpack, a, b):
    days = [list(map(int, s.split(','))) for s in dpack.split(';')][a:b]
    S = [sum(d[j] for d in days) for j in range(16)]
    vol = S[0] + S[1] + S[2]; rev = S[5]; vas = S[6]
    return dict(vol=vol, rev=rev, asp=(rev - vas) / vol if vol else None, dsr=S[7] / S[8] * 100 if S[8] else None, asr=S[9] / S[10] * 100 if S[10] else None, comp=S[15], fake=S[11], lost=S[13])
import datetime, calendar
_D0 = json.load(open(DATA / 'new_data_oct.json')); _c0 = datetime.date.fromisoformat(_D0['asOf']).replace(day=1); _p0 = (_c0 - datetime.timedelta(days=1)).replace(day=1)
PL = calendar.monthrange(_p0.year, _p0.month)[1]                 # days of last month at the start of the daily pack
CM = _c0.month - 1                                               # this month's row in the monthly pack (January = 0)
th = store['p']['ImbeR25m9'][1]; ND = len(th.split(';')); N = ND - PL          # N = days of the current month in the pack
day = lambda i: _p0 + datetime.timedelta(days=i)
last = ND - 1; same_wd = [i for i in range(last, -1, -1) if day(i).weekday() == day(last).weekday()]          # last day and every earlier same weekday
week_start = max(i for i in range(ND) if day(i).weekday() == 6 and i <= last); K = last - week_start + 1          # current week starts on a Sunday; K days so far
out = {'th': {'td': win(th, PL, ND), 'ptd': win(th, 0, N), 'oct4': win(th, last, last + 1), 'N': N, 'lastLabel': day(last).strftime('%a %b ') + str(day(last).day), 'prevLabel': day(last - 1).strftime('%a %b ') + str(day(last - 1).day),
              'sameWeekday': [win(th, i, i + 1)['vol'] for i in same_wd], 'weekK': K, 'weekStart': day(week_start).strftime('%b ') + str(day(week_start).day),
              'weekPrev': [(day(i).strftime('%b ') + str(day(i).day), win(th, i, i + K)['vol']) for i in range(week_start - 7, -1, -7) if i + K <= ND]}}
fids = [r[0] for r in rows if r[2] == 'Farha Aly Saad' and (len(r) < 9 or r[8] == 'am')]
def pwin(a, b):
    tot = None; act = 0
    for bid in fids:
        w = [list(map(int, s.split(','))) for s in store['p'][bid][1].split(';')][a:b]
        S = [sum(d[j] for d in w) for j in range(16)]
        tot = S if tot is None else [x + y for x, y in zip(tot, S)]
        if S[3] > 0: act += 1
    return dict(vol=tot[0] + tot[1] + tot[2], rev=tot[5], dsr=tot[7] / tot[8] * 100, asr=tot[9] / tot[10] * 100, comp=tot[15], active=act)
out['pf'] = {'td': pwin(PL, ND), 'ptd': pwin(0, N)}
pk = [list(map(int, s.split(','))) for s in store['pf']['Farha Aly Saad'][1].split(';')]
out['pf_pack_td_vol'] = sum(d[0] + d[1] + d[2] for d in pk[PL:]); out['pf_pack_td_active_last'] = pk[-1][16]
def mrates(pack, mi): v = pack.split(';')[mi].split(','); return int(v[15]) / 100, int(v[16]) / 100     # percent
for key, pack in (('th', byid['ImbeR25m9'][6]), ('pf', store['pf']['Farha Aly Saad'][0])):
    sd, sa = mrates(pack, CM - 1); ad, aa = mrates(pack, CM - 2)      # last complete month and the one before
    out[key].update(dsr_sep=sd, dsr_aug=ad, asr_sep=sa, asr_aug=aa)
dump('expected_v4.json', out, indent=1)

# ---------------- expected_cm.json: current-month detail (parcel issues, tickets, failed attempts)
cm = store['cm']; reasons = cm['rs']
issues = {m: [r.split('|') for r in s.split('~')] for m, s in cm['i'].items()}
tick = {m: [r.split('|') for r in s.split('~')] for m, s in cm['t'].items()}
def side(t):
    t = t.lower()
    if t.startswith('retry pickup') or t.startswith('retry return') or 'business' in t or 'product issue' in t or 'description / number of items' in t or '\u0627\u0644\u0648\u0635\u0641' in t: return 'Merchant'
    if 'consignee' in t or 'customer' in t: return 'Customer'
    if t.startswith('waiting for data modification'): return 'Address / phone data'
    return 'Other'
def cnt(mid, t): return sum(1 for r in issues.get(mid, []) if r[1] == t)
def att_tot(ids):
    s = collections.Counter()
    for mid in ids:
        if mid in cm['a']:
            for c in cm['a'][mid]['c'].split(';'):
                d, code, n = map(int, c.split(',')); s[side(reasons[code])] += n
    return dict(s)
th_id = 'ImbeR25m9'
X = {'th': {'F': cnt(th_id, 'F'), 'R': cnt(th_id, 'R'), 'L': cnt(th_id, 'L'), 'D': cnt(th_id, 'D'), 'C': cnt(th_id, 'C'), 'tickets': len(tick.get(th_id, [])), 'att': att_tot([th_id]), 'att_total': sum(att_tot([th_id]).values())},
     'pf': {'F': sum(cnt(m, 'F') for m in fids), 'R': sum(cnt(m, 'R') for m in fids), 'L': sum(cnt(m, 'L') for m in fids), 'D': sum(cnt(m, 'D') for m in fids), 'C': sum(cnt(m, 'C') for m in fids),
            'tickets': sum(len(tick.get(m, [])) for m in fids), 'att': att_tot(fids), 'att_total': sum(att_tot(fids).values())},
     'th_first_F': [r[0] for r in issues.get(th_id, []) if r[1] == 'F'][:2], 'th_first_L': [r[0] for r in issues.get(th_id, []) if r[1] == 'L'][:1]}
dump('expected_cm.json', X, indent=1)

# ---------------- expected_asp.json: the ASP gap analysis spec, computed from revenue / delivered per merchant
D = json.load(open(DATA / 'new_data_oct.json')); O = json.load(open(DATA / 'org_final.json', encoding='utf-8')); A = json.load(open(DATA / 'merchant_asp.json'))
def spec(am):
    a = [x for x in O['ams'] if x['name'] == am][0]; T = a['t']['asp']
    ms = [(m['id'], m['name'], A[m['id']][0], A[m['id']][2]) for m in D['ams'][am]['merchants']]
    el = [m for m in ms if m[3] > 0]                                  # eligible = at least one delivered parcel
    DL = sum(m[3] for m in el); REV = sum(m[2] for m in el); P = REV / DL
    med = statistics.median([m[3] / DL for m in el])
    rows_ = []
    for bid, name, rev, dl in el:
        asp = rev / dl; sh = dl / DL
        grp = ('High Volume' if sh >= med else 'Low Volume') + ', ' + ('High ASP' if asp >= T else 'Low ASP')
        rows_.append(dict(id=bid, name=name, rev=rev, dl=dl, asp=asp, share=sh, gapc=sh * (asp - T), dev=asp - T, revgap=(T - asp) * dl, group=grp))
    rows_.sort(key=lambda r: r['gapc'])
    cnts = {g: sum(1 for r in rows_ if r['group'] == g) for g in ('High Volume, Low ASP', 'Low Volume, Low ASP', 'High Volume, High ASP', 'Low Volume, High ASP')}
    below = [r for r in rows_ if r['asp'] < T]
    return dict(am=am, T=T, nElig=len(el), nAll=len(ms), REV=REV, DL=DL, P=P, gap=P - T, sumGap=sum(r['gapc'] for r in rows_), median=med,
                neg5=[r['name'] for r in rows_ if r['gapc'] < 0][:5], pos5=[r['name'] for r in sorted(rows_, key=lambda r: -r['gapc']) if r['gapc'] > 0][:5],
                counts=cnts, revGapBelow=sum(max(0, r['revgap']) for r in below), nBelow=len(below),
                revNoParcels=[(m[1], m[2]) for m in ms if m[3] == 0 and m[2] != 0], parcelsNoRev=[m[1] for m in el if m[2] == 0],
                kpiRev=a['a']['aspNum'], kpiDl=a['a']['aspDen'], first=rows_[0], rows=rows_)
dump('expected_asp.json', {am: spec(am) for am in ('Ali Aboudy', 'Farha Aly Saad', 'Nada Elsayed')})

# ---------------- test_examples.json: a sub-account and a parent merchant that are in the roster
meta = {bid: {'pid': e.get('pid'), 'ns': e.get('ns', 0)} for bid, e in sorted(store['x'].items())}
pick_am = ('Farha Aly Saad', 'Nourhan Hossam Farid', 'maha Kotb')
inam = lambda i: i in byid and (len(byid[i]) < 9 or byid[i][8] == 'am')          # an AM-portfolio merchant (not a VP-only one)
sub = next((i for i, m in meta.items() if m['pid'] and inam(i) and byid[i][2] in pick_am), None) or next(i for i, m in meta.items() if m['pid'] and inam(i))
par = next(i for i, m in meta.items() if m['ns'] and inam(i))
dump('test_examples.json', {'sub': [sub, byid[sub][1], byid[sub][2], meta[sub]['pid']], 'par': [par, byid[par][1], byid[par][2]]})
print('wrote expected_v4 / expected_cm / expected_asp / test_examples')
