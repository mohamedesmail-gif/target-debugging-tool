"""Independent expectations for the leadership views (tests/smoke.mjs), computed from the raw data files with their own code path.

Scopes: VP (all), teams Key / Startups / Growth - Fashion, team leader t4 (Ahmed Saleh), AM Ali Aboudy.
Per scope: where it stands (pickups vs Target, estimate at the current daily average), base (portfolio, active, retention), activity, rankings.
Tie-break everywhere: value, then Business ID ascending.   Output: data/expected_lead.json
"""
import json, pathlib
DATA = pathlib.Path(__file__).resolve().parents[1] / 'data'
D = json.load(open(DATA / 'new_data_oct.json')); O = json.load(open(DATA / 'org_final.json', encoding='utf-8'))
A = json.load(open(DATA / 'merchant_asp.json')); DSR = json.load(open(DATA / 'merchant_dsr.json'))
PTD = json.load(open(DATA / 'ptd_sep1_4.json')); TD = json.load(open(DATA / 'td_oct1_4.json'))
FULL, ELAPSED, FACTOR = D['wdFull'], D['wdElapsed'], 1.0      # achievement is measured against the monthly target of the sheet
heads = {h['id']: h for h in O['heads']}; tls = {t['id']: t for t in O['tls']}

rows = {}                               # business id -> row, plus the AM it belongs to
for a in O['ams']:
    for m in D['ams'][a['name']]['merchants']:
        mon = m['monthly']; mavg = m['mtdAvgDaily']
        if m['newThisMonth']: cat = 'New'
        elif mavg <= 0: cat = 'Churned'
        elif (m['prevFull'] or 0) <= 0 and (mon['jul'] > 0 or mon['aug'] > 0): cat = 'Reactivation'
        else: cat = 'Existing'
        has = cat not in ('New', 'Churned'); tgt = mon['sep'] * 1.6 / FULL if has else None
        rev, vas, dl = A[m['id']][0], A[m['id']][1], A[m['id']][2]
        rows[m['id']] = dict(id=m['id'], name=m['name'], am=a['name'], team=a['team'], tl=a['tlId'], head=a['headId'], mtd=m['mtd'], avg=mavg, cat=cat, has=has, tgt=tgt,
                             dev=(mavg - tgt) if has else None, missed=(mavg < tgt) if has else False, ach=(mavg / tgt) if has and tgt else None,
                             dl=dl, rev=rev, vas=vas, asp=rev / dl if dl > 0 else None, vasasp=vas / dl if dl > 0 else None, gain=TD[m['id']] - PTD[m['id']], td=TD[m['id']], ptd=PTD[m['id']],
                             dsr=DSR[m['id']][0], sep=DSR[m['id']][1])

def top(lst, key, desc=True, n=10):
    return sorted(lst, key=lambda r: ((-key(r)) if desc else key(r), r['id']))[:n]
def agg(ams, sales, label, target_asp, target_pick):
    names = {a['name'] for a in ams}; rs = [r for r in rows.values() if r['am'] in names]
    pick = sum(r['mtd'] for r in rs); goal = target_pick * FACTOR
    avg = pick / ELAPSED; rem = FULL - ELAPSED; proj = pick + avg * rem
    status = 'Achieved' if pick >= goal else 'On track' if proj >= goal else 'At risk' if proj >= 0.9 * goal else 'Behind'
    rb = sum(a['a']['retBase'] for a in ams); rk = sum(a['a']['retKept'] for a in ams)
    num = sum(a['a']['aspNum'] for a in ams); den = sum(a['a']['aspDen'] for a in ams)
    fresh = sum(s['a']['newPicked'] for s in sales); roster = {x for x in rows}
    outside = sum(x[3] for s in sales for x in s['newList'] if x[0] not in roster)
    T = target_asp; elig = [r for r in rs if r['dl'] > 0]; DL = sum(r['dl'] for r in elig)
    for r in elig: r['share'] = r['dl'] / DL; r['gapc'] = r['share'] * (r['asp'] - T) if T is not None else None
    targeted = [r for r in rs if r['has']]; low = [r for r in rs if r['dsr'] is not None and r['dsr'] <= 65 and r['sep'] > 0]
    withd = [r for r in rs if r['dsr'] is not None and r['sep'] > 0]; minp = 30; big = [r for r in rs if r['dl'] >= minp]
    names_ = lambda l: [r['name'] for r in l]
    retained = [r for r in rs if r['sep'] > 0 and r['td'] > 0]; churnedm = [r for r in rs if r['sep'] > 0 and r['td'] == 0]
    coh = [dict(id=x[0], name=x[1], oct=x[3], sep=x[6]) for s in sales for x in s['cohortList']]
    frs = [dict(id=x[0], name=x[1], picked=x[3]) for s in sales for x in s['newList']]
    out = dict(label=label, target=target_pick, goal=goal, pickups=pick, avgDaily=avg, projected=proj, short=max(0, goal - pick), status=status, achv=pick / goal, projVsGoal=proj / goal, projPctMonthly=proj / target_pick,
               portfolio=len(rs), active=sum(1 for r in rs if r['mtd'] > 0), retBase=rb, retKept=rk, churned=rb - rk, retention=rk / rb, churnRate=(rb - rk) / rb,
               asp=num / den, aspTarget=T, fresh=fresh, freshOutside=outside, contribution=fresh / (pick + outside),
               nHit=sum(1 for r in targeted if not r['missed']), nMissed=sum(1 for r in targeted if r['missed']), nLowDsr=len(low), lowShare=sum(r['sep'] for r in low) / sum(r['sep'] for r in withd),
               topPick=names_(top(rs, lambda r: r['mtd'])), botPick=names_(top([r for r in rs if r['mtd'] > 0], lambda r: r['mtd'], False)),
               topAsp=names_(top(big, lambda r: r['asp'])), botAsp=names_(top(big, lambda r: r['asp'], False)),
               hit=names_(top([r for r in targeted if not r['missed']], lambda r: r['dev'])), missed=names_(top([r for r in targeted if r['missed']], lambda r: r['dev'], False)),
               lowDsr=names_(top(low, lambda r: r['sep'])), growers=names_(top([r for r in rs if r['gain'] > 0], lambda r: r['gain'])), droppers=names_(top([r for r in rs if r['gain'] < 0], lambda r: r['gain'], False)),
               gapNeg=names_(top([r for r in elig if r['gapc'] is not None and r['gapc'] < 0], lambda r: r['gapc'], False)), gapPos=names_(top([r for r in elig if r['gapc'] is not None and r['gapc'] > 0], lambda r: r['gapc'])),
               vasTop=names_(top([r for r in rs if r['vas'] > 0], lambda r: r['vas'])),
               vasBot=names_(sorted(big, key=lambda r: (r['vasasp'], -r['dl'], r['id']))[:10]),
               retTop=names_(top(retained, lambda r: r['td'])), retBot=names_(top(churnedm, lambda r: r['sep'])), nRet=len(retained), nChurnM=len(churnedm),
               cohRet=names_(top([c for c in coh if c['oct'] > 0], lambda c: c['oct'])), cohChurn=names_(top([c for c in coh if c['oct'] == 0], lambda c: c['sep'])),
               nCohRet=sum(1 for c in coh if c['oct'] > 0), nCohChurn=sum(1 for c in coh if c['oct'] == 0),
               freshTop=names_(top(frs, lambda r: r['picked'])), freshBot=names_(top(frs, lambda r: r['picked'], False)),
               scopeAsp=sum(r['rev'] for r in elig) / DL)
    return out

E = {}
allams, allsales = O['ams'], O['sales']
E['all'] = agg(allams, allsales, 'All', sum(a['t']['asp'] * a['t']['pickups'] for a in allams) / sum(a['t']['pickups'] for a in allams), sum(a['t']['pickups'] for a in allams))
for team in ('Key', 'Startups', 'Growth - Fashion'):
    h = [x for x in O['heads'] if x['team'] == team][0]
    E[team] = agg([a for a in allams if a['headId'] == h['id']], [s for s in allsales if s['headId'] == h['id']], team, h['t']['asp'], h['t']['pickups'])
t4 = tls['t4']; E['t4'] = agg([a for a in allams if a['tlId'] == 't4'], [s for s in allsales if s['tlId'] == 't4'], t4['name'], t4['t']['asp'], t4['t']['pickups'])
al = [a for a in allams if a['name'] == 'Ali Aboudy']; E['Ali Aboudy'] = agg(al, [], 'Ali Aboudy', al[0]['t']['asp'], al[0]['t']['pickups'])
E['elapsed'] = ELAPSED
json.dump(E, open(DATA / 'expected_lead.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for k, e in [(k, e) for k, e in E.items() if k != 'elapsed']: print('%-17s target %9d pickups %8d (%.1f%% of Target) est %9.0f (%.0f%%) %-9s | portfolio %4d active %4d retention %.1f%% | fresh %4d ASP %.2f' % (k, e['target'], e['pickups'], 100 * e['achv'], e['projected'], 100 * e['projVsGoal'], e['status'], e['portfolio'], e['active'], 100 * e['retention'], e['fresh'], e['asp']))
