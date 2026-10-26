"""Build data/new_data_oct.json (the tracker data: AMs, targets, merchants with monthly volumes and month-to-date) from the roster rows.

Inputs : data/roster_rows.json  rows [business_id, name, account_manager, segment, joining_date, last_activity, monthly_pack, daily_pack]
         data/October_Targets_2026.xlsx (through build_org: AM pickups targets and teams)
Usage  : python scripts/build_tracker_data.py --as-of 2026-10-15 --elapsed 13 --full 26 [--month "October 2026"]
Fields per merchant: monthly{jan..sep} = ecomm + fulfillment pickups, mtd = parcels picked this month, mtdAvgDaily = mtd / working days elapsed,
prevFull = previous month ecomm + fulfillment, an empty segment takes the AM's team segment, newThisMonth / newPrevMonth from the joining date (= first pickup date), daysSinceJoin at the as-of date.
"""
import argparse, datetime, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build_org import ams as ORG_AMS
DATA = pathlib.Path(__file__).resolve().parents[1] / 'data'
SEG_OF_TEAM = {'Growth - General Trade': 'Growth-General-Trade', 'Startups': 'Startups', 'Growth - Cosmatics': 'Growth-Cosmetics', 'Growth - Fashion': 'Growth-Fashion', 'Key': 'Key-Account'}
MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep']

def build(asof, elapsed, full, month, rows):
    asof_d = datetime.date.fromisoformat(asof); cur0 = asof_d.replace(day=1)
    prev0 = (cur0 - datetime.timedelta(days=1)).replace(day=1)
    by_am = {}
    for bid, name, am, seg, jd, la, mp, dp in rows:
        packs = [list(map(int, s.split(','))) for s in mp.split(';')]
        monthly = {k: packs[i][0] + packs[i][1] for i, k in enumerate(MONTHS)}
        mtd = packs[9][3]; jdd = datetime.date.fromisoformat(jd) if jd else None
        by_am.setdefault(am, []).append(dict(id=bid, name=name, seg=seg, jd=jd, newThisMonth=bool(jdd and jdd >= cur0), newPrevMonth=bool(jdd and prev0 <= jdd < cur0),
                                             daysSinceJoin=(asof_d - jdd).days if jdd else None, monthly=monthly, mtd=mtd, mtdAvgDaily=round(mtd / elapsed, 1),
                                             prevFull=monthly['sep'], lastActivity=la))
    n = asof_d.day                                                     # days of the month so far = days compared in the previous month
    wd_ptd = n - sum(1 for i in range(n) if (prev0 + datetime.timedelta(days=i)).weekday() == 4)   # working days (no Fridays) of the same days last month
    ams = {}
    for a in ORG_AMS:
        ms = by_am.get(a['name'], [])
        for m in ms:
            if not m['seg']: m['seg'] = SEG_OF_TEAM[a['team']]      # the pull has no segment for a few merchants: use the segment of the AM's team
        ams[a['name']] = dict(target=a['t']['pickups'], team=a['team'], base=len(ms), merchants=ms)
    return dict(month=month, wdFull=full, wdElapsed=elapsed, asOf=asof, ptdDays=n, wdPtd=wd_ptd, ams=ams)

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--as-of', required=True); ap.add_argument('--elapsed', type=int, required=True); ap.add_argument('--full', type=int, required=True)
    ap.add_argument('--month', default='October 2026'); ap.add_argument('--out', default=str(DATA / 'new_data_oct.json'))
    a = ap.parse_args()
    rows = json.load(open(DATA / 'roster_rows.json'))
    d = build(a.as_of, a.elapsed, a.full, a.month, rows)
    json.dump(d, open(a.out, 'w', encoding='utf-8'), ensure_ascii=False)
    print('wrote', a.out, '| AMs', len(d['ams']), '| merchants', sum(x['base'] for x in d['ams'].values()))
