"""Build the pricing store (data/pricing_store.b64) used by the Pricing calculator and the Pricing tab.

Input  : the Merchant Pricing Simulator export (one JSON with a "files" map: data/index.json, data/pricing.json,
         data/legs_net.json, data/peers.json, data/industry.json, data/s0..s47.json).
Output : data/pricing_store.b64 = base64(gzip(JSON)) with
           asof, months, fields        -- record layout, "a" follows "fields"
           idx   {ato_charge_rate, pack_rev_per_order, comp_per_order, cost_defaults, mains}
           cost  {id: [fm_per_order, lm_fixed_per_order, materials_per_order]}   from the profitability file
           plan  {id: current plan code}
           main  {id: main account id}
           net   {mm, pick, drop}      middle-mile legs and cost per governorate
           pricing {plans, card}       the rate card, ~295 plans
           m     {id: {month: record}} merchant-month records (a, g, L, P, Y, D, T, Z, X)

Usage:
    python scripts/build_pricing.py --export <simulator_export.json> [--ids data/roster_ids.json] [--months 2026-10]

--ids   keep only these merchants (a JSON list of business ids, or the roster file). Without it every merchant is kept
        and the store is far larger than the app needs.
--months keep only these months. The calculator needs one month; the Pricing tab compares three.

STATUS: the export is produced outside this repo. docs/DATA_SOURCES.md records which of its inputs have no mart
source; jobs/refresh_payload.py should replace this script once those sources are agreed.
"""
import argparse, base64, gzip, json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'

# keys of a merchant-month record that the engine reads (see src/m11_pricing.jsx, PRC_ENG.combine)
REC_KEYS = ('a', 'g', 'L', 'P', 'Y', 'D', 'T', 'Z', 'X')


def load_export(path):
    d = json.load(open(path, encoding='utf-8'))
    f = d.get('files') or {}
    if 'data/index.json' not in f:
        sys.exit('not a simulator export: no files["data/index.json"] in ' + str(path))
    return d, f


def merge_shards(files):
    """s0..sN -> one {id: {month: record}} map."""
    out = {}
    for name, blob in files.items():
        if not name.startswith('data/s') or not name.endswith('.json'):
            continue
        for mid, months in blob.items():
            out.setdefault(mid, {}).update(months)
    return out


def strip_cost(store):
    """Remove everything GM2 can be computed from, for an account-manager / sales deployment.

    Hiding cost in the UI is not a control: the pack is downloaded into the browser. This produces a
    second pack that physically cannot produce a cost or a GM2 figure, so the API can serve it to AM
    and sales sessions and the full pack to the VP, heads and team leaders.

    Revenue and ASP still work: they need the rate card and the order mix, not the cost rates.
    """
    store['cost'] = {}                       # per-merchant first mile / last mile fixed / materials
    store['cost_overrides'] = {}             # the owner's saved cost edits
    store['idx']['cost_defaults'] = {}       # network cost rates
    store['idx']['comp_per_order'] = None    # compensation per order
    store['net'] = {'mm': {}}                # middle-mile cost per governorate (legs are cost data too)
    i_comp, i_comp3 = store['fields'].index('comp'), store['fields'].index('comp_3m')
    for by_month in store['m'].values():
        for rec in by_month.values():
            rec['a'] = list(rec['a'])
            rec['a'][i_comp] = 0
            rec['a'][i_comp3] = 0
            rec.pop('L', None)               # middle-mile legs
    store['margin'] = False
    return store


def build(export_path, keep_ids=None, keep_months=None):
    d, f = load_export(export_path)
    idx = f['data/index.json']
    pricing = f['data/pricing.json']
    net = f['data/legs_net.json']
    recs = merge_shards(f)

    months = [m for m in idx['months'] if not keep_months or m in keep_months]
    if not months:
        sys.exit('no months left after --months filter; export has ' + ', '.join(idx['months']))

    # index.merchants rows: [id, name, main, segment, plan, ?, [fm, lmf, mat], flags, orders_total, [per-month orders]]
    cost, plan, main, name = {}, {}, {}, {}
    for row in idx['merchants']:
        mid = row[0]
        if keep_ids is not None and mid not in keep_ids:
            continue
        name[mid] = row[1]
        main[mid] = row[2]
        plan[mid] = row[4]
        if isinstance(row[6], list) and len(row[6]) >= 3:
            cost[mid] = [round(float(x), 6) for x in row[6][:3]]

    keep = set(name)
    m = {}
    for mid, by_month in recs.items():
        if mid not in keep:
            continue
        kept = {}
        for mo in months:
            r = by_month.get(mo)
            if r:
                kept[mo] = {k: r[k] for k in REC_KEYS if k in r}
        if kept:
            m[mid] = kept

    store = {
        'asof': idx.get('asof'),
        'pricing_asof': pricing.get('asof'),
        'months': months,
        'fields': idx['fields'],
        'idx': {
            'ato_charge_rate': idx['ato_charge_rate'],
            'pack_rev_per_order': idx['pack_rev_per_order'],
            'comp_per_order': idx['comp_per_order'],
            'cost_defaults': idx['cost_defaults'],
            'mains': {k: v for k, v in idx.get('mains', {}).items() if k in keep or k in set(main.values())},
        },
        'cost': cost,
        'plan': plan,
        'main': main,
        'name': name,
        'net': net,
        'm': m,
        'pricing': {'plans': pricing['plans'], 'card': pricing['card']},
        # cost overrides the simulator's owner saved outside the rate card (see docs/DATA_SOURCES.md)
        'cost_overrides': (d.get('owner_cost_changes') or {}).get('settings/costs') or {},
        'margin': True,
    }
    return store, len(m)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--export', required=True, help='Merchant Pricing Simulator export JSON')
    ap.add_argument('--ids', help='JSON list of business ids to keep (default: all)')
    ap.add_argument('--months', nargs='*', help='months to keep, e.g. 2026-10 (default: all in the export)')
    ap.add_argument('--out', default=str(DATA / 'pricing_store.b64'))
    ap.add_argument('--with-cost', action='store_true',
                    help='keep cost and GM2 in the pack. DEFAULT is revenue and ASP only: AMs and sales must not see cost or GM2, '
                         'and a pack that contains cost can be read by anyone who opens the portal')
    ap.add_argument('--no-cost', action='store_true', help='kept for compatibility: this is now the default')
    a = ap.parse_args()

    ids = None
    if a.ids:
        raw = json.load(open(a.ids, encoding='utf-8'))
        ids = set(raw if isinstance(raw, list) else raw.keys())

    store, n = build(a.export, ids, set(a.months) if a.months else None)
    a.no_cost = not a.with_cost
    if a.no_cost:
        store = strip_cost(store)
    raw = json.dumps(store, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    packed = base64.b64encode(gzip.compress(raw, 9)).decode('ascii')
    pathlib.Path(a.out).write_text(packed, encoding='utf-8')
    print('merchants %d · months %s · %s · raw %.1f MB · gzip+b64 %.1f MB · %s'
          % (n, ','.join(store['months']), 'NO COST (revenue and ASP only)' if a.no_cost else 'with cost and GM2',
             len(raw) / 1e6, len(packed) / 1e6, a.out))
