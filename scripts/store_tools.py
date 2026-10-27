"""Read / write the embedded profile store (data/profile_store.b64 = base64(gzip(JSON))).

Store schema
  p  : {business_id: [monthlyPack, dailyPack]}   monthly: 10 months x 32 fields ; daily: 34 days (Sep 1 - Oct 4) x 16 fields
  x  : {business_id: {s, sp, l, w, pid, pn, ns}} creation source, % of parcels, pickup locations, website, parent id/name, sub-accounts
  pf : {account_manager: [monthlyPack, dailyPack]} portfolio totals (35 monthly fields, 17 daily fields)
  cm : current-month detail: {asOf, days, stamp, rs: [failure reasons], i: parcel issues, t: tickets, a: failed attempts}
Packs are ';'-separated periods of ','-separated integers (ratios x10000, -1 = no data).
"""
import base64, gzip, json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
STORE = ROOT / 'data' / 'profile_store.b64'

def load_store(path=STORE):
    return json.loads(gzip.decompress(base64.b64decode(open(path).read())))

def save_store(store, path=STORE):
    raw = json.dumps(store, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    # mtime=0 keeps the gzip header constant, so saving the same store twice gives identical bytes
    open(path, 'w').write(base64.b64encode(gzip.compress(raw, 9, mtime=0)).decode('ascii'))

if __name__ == '__main__':
    s = load_store()
    print({k: len(v) if hasattr(v, '__len__') else v for k, v in s.items()})
