"""Rebuild the pricing rate card (pricing.plans, pricing.card, pricing_asof) from Redshift and put it into the pricing packs.

Replaces the pricing Google Sheet (Esraa) as the source of the rate card.
Tables used:
  mart.v_pricing_rate_card   one row per price plan x service type x drop-off sector (prices, size add-ons, fee rules)
  dim.pricing_transit_costs  origin sector x drop-off sector transit cost per plan, used only by origin dependent plans

How a price is built (checked against the sheet on EGY-3A and SuperJet, 2026-11-16):
  normal price = platform_base_fee + plan_base_fee + drop-off price + service_price
  size N = normal, L = normal + large, X = normal + xlarge, W = normal + white bag, B = light bulky, H = heavy bulky
  The drop-off price does not depend on the pickup zone for most plans. For origin dependent plans
  (is_origin_dependent) it is the transit cost of the pickup sector -> drop-off sector pair.
Service types: S SEND, F FXF_SEND, R RTO, E EXCHANGE, C CUSTOMER_RETURN_PICKUP, K CASH_COLLECTION,
G SIGN_AND_RETURN, P PICK_AND_CHOOSE (the order of the engine's TYPES string).

Usage:
    export REDSHIFT_HOST=... REDSHIFT_DB=... REDSHIFT_USER=... REDSHIFT_PASSWORD=...
    python3 scripts/refresh_pricing.py            # rewrites data/pricing_store.b64 and data/pricing_store_full.b64
    python3 scripts/refresh_pricing.py --compare  # only prints how the new rate card differs from the one in the pack
STATUS: the logic is tested on rows shaped like the view (tests/test_refresh_pricing.py). The database connection has NOT been run
from the build sandbox (no warehouse credentials there).
"""
import argparse, base64, gzip, json, os, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / 'data'
TYPES = 'SFRECKGP'
SIZES = 'NLXWBH'
SERVICE = {'SEND': 'S', 'FXF_SEND': 'F', 'RTO': 'R', 'EXCHANGE': 'E', 'CUSTOMER_RETURN_PICKUP': 'C',
           'CASH_COLLECTION': 'K', 'SIGN_AND_RETURN': 'G', 'PICK_AND_CHOOSE': 'P'}

RATE_SQL = """
select price_plan, plan_type, service_type_key, destination_sector_id, is_origin_dependent,
       platform_base_fee, plan_base_fee, destination_price, service_price,
       normal_price, light_bulky_price, heavy_bulky_price, large_size_cost, xlarge_size_cost, white_bag_size_cost,
       opening_package_fee_amount, opening_package_fee_is_applied, flex_ship_fee_amount,
       extra_cod_fee_percentage, extra_cod_fee_cod_threshold, extra_cod_fee_is_applied,
       expedite_fee_percentage, expedite_fee_min_charge, expedite_fee_is_applied, loaded_at
from mart.v_pricing_rate_card where is_deleted = false"""
TRANSIT_SQL = """
select tier_name, origin_sector_id, destination_sector_id, cost
from dim.pricing_transit_costs where deleted = false"""
RATE_COLS = ['plan', 'plan_type', 'service', 'dest', 'od', 'pbf', 'plbf', 'dp', 'sp', 'normal', 'lb', 'hb', 'large', 'xlarge', 'white',
             'ato', 'ato_on', 'flex', 'xcod', 'xcod_lim', 'xcod_on', 'nd', 'nd_min', 'nd_on', 'loaded_at']


def idx(t, p, s, z):
    return ((TYPES.index(t) * 7 + (p - 1)) * 7 + (s - 1)) * 6 + SIZES.index(z)


def card_of(r, old):
    """Fee rules of a plan. type and group are labels kept from the old card when the plan was in it."""
    o = old or {}
    pt = r['plan_type'] or ''
    custom = 'Customize' in pt
    return {'type': o.get('type') or ('Custom / Key account' if custom else pt),
            'group': o.get('group') or ('Customize' if custom else pt),
            'ato': float(r['ato'] or 0), 'ato_on': bool(r['ato_on']), 'flex': float(r['flex'] or 0),
            'xcod': float(r['xcod'] or 0), 'xcod_lim': float(r['xcod_lim'] or 0), 'xcod_on': bool(r['xcod_on']),
            'nd': float(r['nd'] or 0), 'nd_min': float(r['nd_min'] or 0), 'nd_on': bool(r['nd_on'])}


def build(rate_rows, transit_rows, old_cards=None):
    """rate_rows: dicts keyed by RATE_COLS. transit_rows: (plan, origin_sector, dest_sector, cost). Returns {plans, card, types, sizes, asof}."""
    old_cards = old_cards or {}
    transit = {}
    for plan, o, d, c in transit_rows:
        transit[(plan, int(o), int(d))] = float(c or 0)
    plans, card, asof, skipped = {}, {}, '', []
    for r in rate_rows:
        t = SERVICE.get(r['service'])
        if t is None:
            continue  # a service type the engine does not price
        name = r['plan']
        arr = plans.setdefault(name, [None] * (len(TYPES) * 7 * 7 * 6))
        if name not in card:
            card[name] = card_of(r, old_cards.get(name))
        if r['loaded_at']:
            asof = max(asof, str(r['loaded_at'])[:10])
        s = int(r['dest'])
        n = float(r['normal'] or 0)
        # size price minus normal price, taken from the same row
        delta = {'N': 0.0, 'L': float(r['large'] or 0), 'X': float(r['xlarge'] or 0), 'W': float(r['white'] or 0),
                 'B': float(r['lb'] or 0) - n, 'H': float(r['hb'] or 0) - n}
        for p in range(1, 8):
            base = n
            if r['od']:
                key = (name, p, s)
                if key not in transit:
                    skipped.append(key)
                    continue
                base = float(r['pbf'] or 0) + float(r['plbf'] or 0) + transit[key] + float(r['sp'] or 0)
            for z in SIZES:
                arr[idx(t, p, s, z)] = round(base + delta[z], 2)
    return {'plans': plans, 'card': card, 'types': TYPES, 'sizes': SIZES, 'asof': asof}, skipped


def load_pack(path):
    return json.loads(gzip.decompress(base64.b64decode(path.read_text())))


def save_pack(path, store):
    path.write_text(base64.b64encode(gzip.compress(json.dumps(store, separators=(',', ':')).encode(), 9)).decode())


def compare(old_plans, new_plans):
    only_old = sorted(set(old_plans) - set(new_plans)); only_new = sorted(set(new_plans) - set(old_plans))
    diff = [k for k in new_plans if k in old_plans and any((a or 0) != (b or 0) for a, b in zip(old_plans[k], new_plans[k]))]
    return only_old, only_new, sorted(diff)


def fetch():
    import redshift_connector
    conn = redshift_connector.connect(host=os.environ['REDSHIFT_HOST'], database=os.environ['REDSHIFT_DB'],
                                      user=os.environ['REDSHIFT_USER'], password=os.environ['REDSHIFT_PASSWORD'])
    cur = conn.cursor()
    cur.execute(RATE_SQL)
    rate = [dict(zip(RATE_COLS, row)) for row in cur.fetchall()]
    cur.execute(TRANSIT_SQL)
    transit = [tuple(row) for row in cur.fetchall()]
    conn.close()
    return rate, transit


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--compare', action='store_true', help='print differences only, change nothing')
    a = ap.parse_args()
    packs = [p for p in (DATA / 'pricing_store.b64', DATA / 'pricing_store_full.b64') if p.exists()]
    if not packs:
        sys.exit('no pricing pack in data/')
    first = load_pack(packs[0])
    rate, transit = fetch()
    new, skipped = build(rate, transit, first['pricing'].get('card'))
    only_old, only_new, diff = compare(first['pricing']['plans'], new['plans'])
    print('plans: pack %d, Redshift %d' % (len(first['pricing']['plans']), len(new['plans'])))
    print('only in the pack (will be removed): %d %s' % (len(only_old), only_old[:15]))
    print('new in Redshift: %d %s' % (len(only_new), only_new[:15]))
    print('price differs: %d %s' % (len(diff), diff[:15]))
    if skipped:
        print('origin dependent prices with no transit cost (left empty): %d' % len(skipped))
    if a.compare:
        return
    for p in packs:
        s = load_pack(p)
        s['pricing'] = {'plans': new['plans'], 'card': new['card']}
        s['pricing_asof'] = new['asof']
        save_pack(p, s)
        print('updated', p.name, 'rate card as of', new['asof'])


if __name__ == '__main__':
    main()
