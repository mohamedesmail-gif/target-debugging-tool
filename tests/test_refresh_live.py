"""Offline test of jobs/refresh_live.py: the SQL files are complete, the file has the shape the portal checks, and it is written in one step."""
import json, pathlib, sys, tempfile, re
ROOT = pathlib.Path(__file__).resolve().parents[1]; sys.path.insert(0, str(ROOT / 'jobs'))
import refresh_live as R
for n in ('live_meta.sql', 'live_rows.sql'):
    t = R.sql_text(n, 5000)
    assert '__MIN_DAY__' not in t and '5000' in t and 'fact.deliveries_live' in t and 'is_deleted = false' in t, n
sel = re.search(r'select (cur\.business_id, .*?)\nfrom cur', R.sql_text('live_rows.sql', 1), re.S).group(1)
parts, depth, cur_ = [], 0, ''
for ch in sel:                                                          # split the select list on commas outside brackets
    depth += ch == '('; depth -= ch == ')'
    if ch == ',' and depth == 0: parts.append(cur_.strip()); cur_ = ''
    else: cur_ += ch
parts.append(cur_.strip())
cols = [re.split(r' as ', x)[-1].split('.')[-1].strip() for x in parts]
assert cols == ['business_id'] + R.COLS[1:], cols                      # the SQL columns and the file columns are the same list, in the same order
calls = []
def fake(q):
    calls.append(q)
    return [('2026-11-21', '2026-11-21 23:50:18', 0, 1)] if 'as bw_p' in q else [('a1', 3, 1, 0, 4, 0, 0, 2, 5, 6, 7, 8, 9), ('b2', None, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)]
live = R.build_live(fake, 7000)
assert live['cols'] == R.COLS and live['asOf'] == '2026-11-21 23:50:18' and live['day'] == '2026-11-21' and (live['bwC'], live['bwP']) == (0, 1)
assert live['rows'][0] == ['a1', 3, 1, 0, 4, 0, 0, 2, 5, 6, 7, 8, 9] and live['rows'][1][1] == 0           # NULL counts become 0
assert '7000' in calls[0] and '7000' in calls[1]
d = pathlib.Path(tempfile.mkdtemp()); R.write_atomic(d / 'x' / 'live.json', live)
assert json.loads((d / 'x' / 'live.json').read_text())['rows'][0][0] == 'a1' and not (d / 'x' / 'live.json.tmp').exists()
try: R.build_live(lambda q: [('2026-11-21', '2026-11-21 23:50:18', 0, 0)] if 'as bw_p' in q else [], 1); raise SystemExit('empty table must fail')
except AssertionError: pass
print('refresh_live: all checks passed')
