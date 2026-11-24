"""Parse the monthly targets workbook into the org tree (heads, team leaders, AMs, sales) with targets and weights.

Input : data/October_Targets_2026.xlsx  (sheets: Managers, Team Leaders, AMs, Sales)
Output: data/org_base.json  (when run directly)
Decisions baked in (see docs/METRICS.md): Hajar Bahaa Eldin sits under Mohamed Samir; sales "Churn%" for Growth/Key is read as
retention (max churn = 1 - value); the Startups sales unlabelled column (0.25) is the churn target.
"""
import openpyxl, json, collections, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
wb = openpyxl.load_workbook(DATA / 'October_Targets_2026.xlsx', data_only=True)
WS = {s.title.strip(): s for s in wb.worksheets}
num = lambda v: v if isinstance(v, (int, float)) else None

heads = []
W_HEAD = {'default': (0.5, 0.25, 0.25), 'Startups': (0.65, 0.15, 0.2)}
for r in WS['Managers'].iter_rows(min_row=3, values_only=True):
    team, hr, name, email, pk, asp, fresh = r[:7]
    if team and name and isinstance(pk, (int, float)):
        heads.append(dict(id='h%d' % (len(heads) + 1), name=name.strip(), team=team.strip(), hr=hr, email=email, t=dict(pickups=pk, asp=asp, fresh=num(fresh)), w=W_HEAD.get(team.strip(), W_HEAD['default'])))
HEAD_SHORT = {'khaled el menshawy': 'Khaled Mohamed El-Sadek Menshawy', 'kahled el menshawy': 'Khaled Mohamed El-Sadek Menshawy', 'rodina salem': 'Rodina Magdy Hassan Salem Badawy', 'mostafa sedeik': 'Mostafa Mohamed Aboelabass Sedek', 'abed ali': 'Abed Abdelrahim Abed Ali', 'soha shaaban': 'Soha Shabaan Zakarya'}
head_by_name = {h['name']: h for h in heads}
hid = lambda short: head_by_name[HEAD_SHORT[short.strip().lower()]]['id']

tls = []
rows = list(WS['Team Leaders'].iter_rows(values_only=True))
spec = {3: ((0.5, .25, .25), 'fresh'), 4: ((0.5, .25, .25), 'fresh'), 5: ((0.5, .25, .25), 'fresh'), 6: ((0.5, .25, .25), 'fresh'), 7: ((0.5, .25, .25), 'fresh'),
        9: ((0.5, .25, .25), 'retention'), 12: ((0.7, .3, 0), None), 13: ((0.7, .3, 0), None), 15: ((0, .2, .8), 'fresh')}
cur_team = None
for i, r in enumerate(rows, 1):
    if i in spec:
        team, mgr, hr, name, email, pk, asp, third = r[:8]
        if team: cur_team = team
        w, tt = spec[i]
        tls.append(dict(id='t%d' % (len(tls) + 1), name=name.strip(), team=cur_team, headId=head_by_name[mgr.strip()]['id'], hr=hr, email=email, t=dict(pickups=num(pk), asp=num(asp), **({tt: num(third)} if tt else {})), w=w))
TL_SHORT = {'ahmed abdelrahman': 'Ahmed Abdelrahman', 'mona mohsen': 'Mona Mohsen Abdel wahed Kassem', 'ahmed hamdy': 'Ahmed Hamdi Abdulla Abdulaal Ahmed', 'moataz elshazly': 'Moataz Mohi El-Din Ahmed Mahmoud', 'ahmed saleh': 'Ahmed Saleh Mohamed Mohamed', 'mostafa elsaeied': 'Mostafa Elsaeied El sayed Mohamed', 'moataz mohamed': 'Moataz Muhammed Muhammed Zenhom Eid', 'mohamed samir': 'Mohamed Samir Mohamed Ahmed Hussien', 'dina khaled': 'Dina Khaled Sayed Hussien'}
tl_by_name = {t['name']: t for t in tls}
tlid = lambda short: tl_by_name[TL_SHORT[short.strip().lower()]]['id'] if short and short.strip() else None

ams = []; teamname = None
for i, r in enumerate(WS['AMs'].iter_rows(values_only=True), 1):
    if i < 3: continue
    t_, name, email, pk, asp, ret, tl, hd = r[:8]
    if t_ and t_ not in ('-', 'Team'): teamname = t_
    if name and isinstance(pk, (int, float)) and tl:
        st = teamname == 'Startups'
        if name.strip() == 'Hajar Bahaa Eldin': tl = 'Mohamed Samir'   # moved by the user: the TL targets only add up this way
        ams.append(dict(name=name.strip(), email=email, team=teamname, tlId=tlid(tl), headId=hid(hd), t=dict(pickups=pk, asp=asp, retention=None if st else num(ret)), w=(0.7, 0.3, 0) if st else (0.6, 0.2, 0.2)))

sales = []
for i, r in enumerate(WS['Sales'].iter_rows(values_only=True), 1):
    if i in (1, 2, 21, 22): continue
    hr, name, email, npk, asp, third, tl, hd = r[:8]
    if name and isinstance(npk, (int, float)):
        st = i >= 23
        h = hid(hd)
        sales.append(dict(id='s%d' % (len(sales) + 1), name=name.strip(), hr=hr, email=email, tlId=tlid(tl), headId=h, team=[x for x in heads if x['id'] == h][0]['team'], t=dict(newPickups=npk, asp=asp, churn=(num(third) if st else (round(1 - num(third), 4) if num(third) is not None else None)), churnSheet=num(third)), w=(0.8, 0.2, 0) if st else (0.6, 0.2, 0.2)))
# ---- targets from the warehouse table public.commercial_monthly_targets (target_month, employee_name, role, target_type, target_value).
# The sheet is only used for the hierarchy (who reports to whom), teams, weights and emails: the table has none of those. Set TARGETS_SOURCE=sheet to use the sheet's numbers.
import os
def apply_db_targets(rows):
    db = {(r[2], r[1].strip(), r[3]): r[4] for r in rows}
    g = lambda role, name, typ: db.get((role, name, typ))
    for h in heads:
        h['t'] = dict(pickups=g('Head', h['name'], 'pickups'), asp=g('Head', h['name'], 'ASP'), fresh=g('Head', h['name'], 'fresh pickups'))
    for t in tls:
        t['t'] = {k: v for k, v in dict(pickups=g('Team Leader', t['name'], 'pickups'), asp=g('Team Leader', t['name'], 'ASP'), fresh=g('Team Leader', t['name'], 'fresh pickups'), retention=g('Team Leader', t['name'], 'retention')).items() if k in t['t'] or v is not None}
    for a in ams:
        a['t'] = dict(pickups=g('Account Manager', a['name'], 'pickups'), asp=g('Account Manager', a['name'], 'ASP'), retention=None if a['team'] == 'Startups' else g('Account Manager', a['name'], 'retention'))
    for s in sales:
        churn = g('Sales Manager', s['name'], 'churn')
        # Startups: the value is the churn target as it is. Growth / Key: the sheet column "Churn%" is read as retention (max churn = 1 - value), see docs/METRICS.md
        s['t'] = dict(newPickups=g('Sales Manager', s['name'], 'fresh pickups'), asp=g('Sales Manager', s['name'], 'ASP'), churn=churn if s['team'] == 'Startups' else (None if churn is None else round(1 - churn, 10)), churnSheet=churn)
TARGETS_MONTH = os.environ.get('TARGETS_MONTH', '2026-10')
# ---- who reports to whom in the month: data/commercial_monthly_targets_hierarchy_YYYY-MM.json ([role, name, manager, team]) when it exists.
# It replaces the sheet's AM / sales lists and their team leader / head; people missing from the sheet are added (no email, team weights);
# people not in the month's list are dropped. Heads and team leaders keep the sheet's ids.
_H = DATA / ('commercial_monthly_targets_hierarchy_%s.json' % TARGETS_MONTH)
TEAM_OF = {'Growth Cosmetics': 'Growth - Cosmatics', 'Growth Fashion': 'Growth - Fashion', 'Growth General Trade': 'Growth - General Trade', 'Key Accounts': 'Key', 'Startups': 'Startups'}
if _H.exists():
    _h = json.load(open(_H, encoding='utf-8'))
    _tl_id = {t['name']: t['id'] for t in tls}; _tl_head = {t['name']: t['headId'] for t in tls}; _head_id = {x['name']: x['id'] for x in heads}
    for role, name, mgr, team in _h:
        if role == 'Team Leader' and name in _tl_id and mgr in _head_id:
            t = [x for x in tls if x['name'] == name][0]; t['headId'] = _head_id[mgr]; _tl_head[name] = _head_id[mgr]
    def _place(mgr):   # (team leader id, head id) of a manager name: a team leader, or a head directly
        if mgr in _tl_id: return _tl_id[mgr], _tl_head[mgr]
        if mgr in _head_id: return None, _head_id[mgr]
        raise SystemExit('hierarchy: unknown manager ' + repr(mgr))
    _old_am = {a['name']: a for a in ams}; _new_am = []
    for role, name, mgr, team in _h:
        if role != 'Account Manager': continue
        tl_, hd_ = _place(mgr); tm = TEAM_OF[team]; st = tm == 'Startups'
        a = dict(_old_am.get(name) or dict(name=name, email=None, t=dict(pickups=None, asp=None, retention=None), w=(0.7, 0.3, 0) if st else (0.6, 0.2, 0.2)))
        a.update(team=tm, tlId=tl_, headId=hd_); _new_am.append(a)
    _old_s = {x['name']: x for x in sales}; _new_s = []
    for role, name, mgr, team in _h:
        if role != 'Sales Manager': continue
        tl_, hd_ = _place(mgr); tm = TEAM_OF[team]
        x = dict(_old_s.get(name) or dict(name=name, hr=None, email=None, t=dict(newPickups=None, asp=None, churn=None), w=list(([x2 for x2 in sales if x2['team'] == tm] or sales)[0]['w'])))
        x.update(team=tm, tlId=tl_, headId=hd_); _new_s.append(x)
    for i, x in enumerate(_new_s): x['id'] = 's%d' % (i + 1)
    ams[:] = _new_am; sales[:] = _new_s
    HIERARCHY_FROM = str(_H.name)   # which month of public.commercial_monthly_targets to use (YYYY-MM); the file is written by jobs/refresh_payload.py --month
_DB_T = DATA / ('commercial_monthly_targets_db.json' if TARGETS_MONTH == '2026-10' else 'commercial_monthly_targets_db_%s.json' % TARGETS_MONTH)
if _DB_T.exists() and os.environ.get('TARGETS_SOURCE', 'db') == 'db':
    _sheet_t = {id(p): dict(p['t']) for p in heads + tls + ams + sales}
    _before = {(k, p.get('id') or p['name']): dict(p['t']) for k, L in (('h', heads), ('t', tls), ('a', ams), ('s', sales)) for p in L}
    apply_db_targets(json.load(open(_DB_T, encoding='utf-8')))
    _after = {(k, p.get('id') or p['name']): dict(p['t']) for k, L in (('h', heads), ('t', tls), ('a', ams), ('s', sales)) for p in L}
    TARGETS_FROM_DB_DIFF = [k for k in _before if any(abs((_before[k].get(f) or 0) - (_after[k].get(f) or 0)) > 1e-9 for f in set(_before[k]) | set(_after[k]))]

DISPLAY_NAMES = {'Abed Abdelrahim Abed Ali': 'Abed Ali', 'Rodina Magdy Hassan Salem Badawy': 'Rodina Salem', 'Mostafa Mohamed Aboelabass Sedek': 'Mostafa Sedek',
                 'Khaled Mohamed El-Sadek Menshawy': 'Khaled Menshawy', 'Soha Shabaan Zakarya': 'Soha Shabaan', 'Mona Mohsen Abdel wahed Kassem': 'Mona Mohsen',
                 'Moataz Mohi El-Din Ahmed Mahmoud': 'Moataz Elshazly', 'Ahmed Saleh Mohamed Mohamed': 'Ahmed Saleh', 'Mostafa Elsaeied El sayed Mohamed': 'Mostafa Elsaeied',
                 'Ahmed Hamdi Abdulla Abdulaal Ahmed': 'Ahmed Hamdi', 'Moataz Muhammed Muhammed Zenhom Eid': 'Moataz Muhammed', 'Mohamed Samir Mohamed Ahmed Hussien': 'Mohamed Samir',
                 'Dina Khaled Sayed Hussien': 'Dina Khaled'}
for _p in heads + tls:                                   # parsing is finished (the lookups above use the full names); from here on the app name is the short one
    _p['fullName'] = _p['name']; _p['name'] = DISPLAY_NAMES.get(_p['name'], _p['name'])

if __name__ == '__main__':
    print('heads', len(heads), 'tls', len(tls), 'ams', len(ams), 'sales', len(sales))
    D = json.load(open(DATA / 'new_data_oct.json'))
    print('AM names missing in tracker data:', [a['name'] for a in ams if a['name'] not in D['ams']])
    print('AM pickup targets equal tracker targets:', all(D['ams'][a['name']]['target'] == a['t']['pickups'] for a in ams))
    for t in tls:
        s = sum(a['t']['pickups'] for a in ams if a['tlId'] == t['id'])
        if t['t']['pickups'] is not None and abs(s - t['t']['pickups']) > 5: print('  TL pickups mismatch', t['name'], t['t']['pickups'], 'vs sum of AMs', s)
    for h in heads:
        s = sum(a['t']['pickups'] for a in ams if a['headId'] == h['id']); fs = sum(x['t']['newPickups'] for x in sales if x['headId'] == h['id'])
        print('  head', h['name'][:24].ljust(24), 'pickups', h['t']['pickups'], '| sum AMs', s, '| fresh', h['t']['fresh'], '| sum sales', fs, '<-- MISMATCH' if h['t']['fresh'] != fs else '')
    for t in tls:
        fs = sum(x['t']['newPickups'] for x in sales if x['tlId'] == t['id'])
        if t['t'].get('fresh') is not None and t['t']['fresh'] != fs: print('  TL fresh mismatch', t['name'], t['t']['fresh'], fs)
    print('TLs:', [(t['id'], t['name'][:18], t['team']) for t in tls])
    print('sales per (tl, head):', dict(collections.Counter((x['tlId'], x['headId']) for x in sales)))
    json.dump(dict(heads=heads, tls=tls, ams=ams, sales=sales), open(DATA / 'org_base.json', 'w'), indent=1, default=str)
