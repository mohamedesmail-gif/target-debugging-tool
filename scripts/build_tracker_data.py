"""Build data/new_data_oct.json (the tracker data: AMs, targets, merchants with monthly volumes and month-to-date) from the roster rows.
The file name is historical: it holds the month given by --as-of (any month).

Inputs : data/roster_rows.json  rows [business_id, name, account_manager, segment, joining_date, last_activity, monthly_pack, daily_pack]
         data/October_Targets_2026.xlsx (through build_org: AM pickups targets and teams)
Usage  : python scripts/build_tracker_data.py --as-of 2026-10-15 --elapsed 13 --full 26 [--month "October 2026"]
Fields per merchant: monthly{jan..last month} = ecomm + fulfillment pickups, mtd = parcels picked this month, mtdAvgDaily = mtd / working days elapsed,
prevFull = previous month ecomm + fulfillment, prevPicked / prev2Picked = parcels picked last month / the month before,
reactivated (25th-to-25th months, like new merchants) = not new, no pickup from the 25th of two months ago to the 24th of last month,
pickups since the 25th of last month, and active before that (first pickup before it, or pickups in an earlier month);
its numbers count from the 25th of last month like a new merchant's. scope 'sales' rows (sales reps' merchants in no AM portfolio) go to salesExtra,
an empty segment takes the AM's team segment, newThisMonth / newPrevMonth from the joining date (= first pickup date), daysSinceJoin at the as-of date.
A NEW merchant (first pickup from the 25th of last month) is measured from the 25th: mtd = pickups from the 25th of last month to the as-of day,
mtdAvgDaily = mtd / working days from the 25th (mtdMonth = this month only, preNew = the 25th .. end of last month). These numbers count in every total.
VP-only merchants (roster scope 'vp': Box, no segment, other segments, active this month) go to vpExtra {group: merchants}, not to an AM.
"""
import argparse, datetime, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build_org import ams as ORG_AMS, sales as ORG_SALES
DATA = pathlib.Path(__file__).resolve().parents[1] / 'data'
SEG_OF_TEAM = {'Growth - General Trade': 'Growth-General-Trade', 'Startups': 'Startups', 'Growth - Cosmatics': 'Growth-Cosmetics', 'Growth - Fashion': 'Growth-Fashion', 'Key': 'Key-Account'}
def new_window(asof_d):
    """New-merchant window of the reporting month M: from the 25th of M-1 up to (not including) the 25th of M.
    Example: November -> 25 Oct to 24 Nov. Returns (previous window start, this window start, this window end)."""
    def d25(y, m):
        while m < 1: y, m = y - 1, m + 12
        return datetime.date(y, m, 25)
    y, m = asof_d.year, asof_d.month
    return d25(y, m - 2), d25(y, m - 1), d25(y, m)

_pwa = DATA / 'prev_window_active.json'                              # sql/pull_prev_window_active.sql
PREV_WIN_ACTIVE = set(json.load(open(_pwa))) if _pwa.exists() else set()
_srf = DATA / 'sales_rows_fp.json'                                   # owner of each sales merchant (new, last month's new, reactivation)
SALES_OF = {r[2]: r[1] for r in json.load(open(_srf))} if _srf.exists() else {}
SALES_TEAM = {x['name']: x['team'] for x in ORG_SALES}
MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
VP_GROUP = lambda seg: 'Box' if seg == 'Box' else 'No segment' if seg in (None, '', 'Non') else 'Other segments'

def build(asof, elapsed, full, month, rows):
    asof_d = datetime.date.fromisoformat(asof); cur0 = asof_d.replace(day=1)
    pw0, nw0, nw1 = new_window(asof_d)       # a merchant is NEW when its first pickup is in [nw0, nw1); last month's new = [pw0, nw0)
    prev0 = (cur0 - datetime.timedelta(days=1)).replace(day=1)
    by_am, extra, sales_extra = {}, {}, []
    months = MONTH_KEYS[:cur0.month - 1]                                # complete months of the year: January .. last month (the pack's last row is this month)
    nwi, prev_len = (nw0 - prev0).days, (cur0 - prev0).days               # daily pack starts on the 1st of last month: index of the 25th, days of last month
    wd_pre = sum(1 for i in range(nwi, prev_len) if (prev0 + datetime.timedelta(days=i)).weekday() != 4)   # working days (no Fridays) from the 25th to the end of last month
    for r in rows:
        bid, name, am, seg, jd, la, mp, dp = r[:8]; scope = r[8] if len(r) > 8 else 'am'
        packs = [list(map(int, s.split(','))) for s in mp.split(';')]
        assert len(packs) == cur0.month, (bid, len(packs))             # one row per month, January .. this month
        monthly = {k: packs[i][0] + packs[i][1] for i, k in enumerate(months)}
        mtd = packs[-1][3]; jdd = datetime.date.fromisoformat(jd) if jd else None
        prevP = packs[-2][3] if len(packs) > 1 else 0; prev2P = packs[-3][3] if len(packs) > 2 else 0
        is_new = bool(jdd and nw0 <= jdd < nw1)
        # 25th-to-25th months: "this month" = the 25th of last month .. today, "last month" = the 25th of two months ago .. the 24th of last month
        dpk = [int(d.split(',')[3]) for d in dp.split(';')]               # daily pickups from the 1st of last month
        win_now = sum(dpk[nwi:])                                         # pickups since the 25th of last month
        prev_win_in_pack = sum(dpk[:nwi])                                # pickups from the 1st to the 24th of last month (rest of the previous window: prev_window_active.json)
        # REACTIVATION: not new, active before the previous window (first pickup before it, or pickups in January .. two months ago - the
        # previous-window days are excluded by the two checks below), no pickups in the previous window, pickups since the 25th of last month
        is_react = bool(not is_new and win_now > 0 and prev_win_in_pack == 0 and bid not in PREV_WIN_ACTIVE
                        and ((jdd and jdd < pw0) or any(p[3] > 0 for p in packs[:-2])))
        # a NEW or REACTIVATED merchant is measured from the start of its window (the 25th of last month), not from the 1st: add its pickups of the 25th .. end of last month
        pre = sum(dpk[nwi:prev_len]) if (is_new or is_react) else 0
        wd = elapsed + (wd_pre if (is_new or is_react) else 0)           # working days measured: this month so far (+ the 25th .. end of last month)
        m = dict(id=bid, name=name, seg=seg, jd=jd, newThisMonth=is_new, newPrevMonth=bool(jdd and pw0 <= jdd < nw0),
                 daysSinceJoin=(asof_d - jdd).days if jdd else None, monthly=monthly, mtd=mtd + pre, mtdAvgDaily=round((mtd + pre) / wd, 1),
                 prevFull=monthly[months[-1]] if months else 0, prevPicked=prevP, prev2Picked=prev2P,
                 reactivated=is_react, lastActivity=la)
        if is_new or is_react: m.update(mtdMonth=mtd, preNew=pre, wdMeasured=wd)   # this month only / the 25th .. end of last month / working days in the average
        if scope == 'vp':
            m['seg'] = VP_GROUP(seg); m['am'] = am or ''
            extra.setdefault(m['seg'], []).append(m)
        elif scope == 'sales':                                           # a sales rep's merchant that is in no AM portfolio (team leader / head / VP views)
            sm = SALES_OF.get(bid); m['am'] = am or ''; m['salesRep'] = sm
            if not m['seg'] or m['seg'] == 'Non': m['seg'] = SEG_OF_TEAM.get(SALES_TEAM.get(sm), 'No segment')
            sales_extra.append(m)
        else:
            by_am.setdefault(am, []).append(m)
    n = asof_d.day                                                     # days of the month so far = days compared in the previous month
    wd_ptd = n - sum(1 for i in range(n) if (prev0 + datetime.timedelta(days=i)).weekday() == 4)   # working days (no Fridays) of the same days last month
    ams = {}
    for a in ORG_AMS:
        ms = by_am.get(a['name'], [])
        for m in ms:
            if not m['seg']: m['seg'] = SEG_OF_TEAM[a['team']]      # the pull has no segment for a few merchants: use the segment of the AM's team
        ams[a['name']] = dict(target=a['t']['pickups'], team=a['team'], base=len(ms), merchants=ms)
    return dict(newFrom=str(nw0), newTo=str(nw1 - datetime.timedelta(days=1)), month=month, monthKeys=months, wdFull=full, wdElapsed=elapsed, asOf=asof, ptdDays=n, wdPtd=wd_ptd, ams=ams,
                vpExtra={g: dict(merchants=ms) for g, ms in sorted(extra.items())}, salesExtra=dict(merchants=sales_extra))

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--as-of', required=True); ap.add_argument('--elapsed', type=int, required=True); ap.add_argument('--full', type=int, required=True)
    ap.add_argument('--month', default=None); ap.add_argument('--out', default=str(DATA / 'new_data_oct.json'))
    a = ap.parse_args()
    rows = json.load(open(DATA / 'roster_rows.json'))
    d = build(a.as_of, a.elapsed, a.full, a.month or datetime.date.fromisoformat(a.as_of).strftime('%B %Y'), rows)
    json.dump(d, open(a.out, 'w', encoding='utf-8'), ensure_ascii=False)
    print('wrote', a.out, '| AMs', len(d['ams']), '| merchants', sum(x['base'] for x in d['ams'].values()), '| VP extra', {g: len(v['merchants']) for g, v in d['vpExtra'].items()})
