"""Render tests/smoke.mjs for the month of the data.

The smoke test is written for the data month October 2026 (this month = October, last month = September, two months back = August,
as of the 15th). This script writes tests/.smoke_run.mjs with the month names, the "1-15" day windows and the month keys of the
data in dist/payload.json (the same idea as scripts/assemble.py, which names the months of the data in the app's labels).
Run: python3 tests/month_map.py && node tests/.smoke_run.mjs
"""
import datetime, json, pathlib, re
ROOT = pathlib.Path(__file__).resolve().parents[1]
P = json.load(open(ROOT / 'dist' / 'payload.json', encoding='utf-8'))['data']
c0 = datetime.date.fromisoformat(P['asOf']).replace(day=1)
back = lambda d, n: d if n == 0 else back((d - datetime.timedelta(days=1)).replace(day=1), n - 1)
p0, pp0 = back(c0, 1), back(c0, 2)
M = {'October': c0.strftime('%B'), 'September': p0.strftime('%B'), 'August': pp0.strftime('%B'),
     'Oct': c0.strftime('%b'), 'Sep': p0.strftime('%b'), 'Aug': pp0.strftime('%b'),
     '2026-10': c0.strftime('%Y-%m'), '2026-09': p0.strftime('%Y-%m'), '2026-08': pp0.strftime('%Y-%m'),
     '1–15': '1–%d' % P['ptdDays'], 'Jan-Oct': 'Jan-' + c0.strftime('%b'), 'Jan-Sep': 'Jan-' + p0.strftime('%b')}
src = open(ROOT / 'tests' / 'smoke.mjs', encoding='utf-8').read()
keep = re.compile(r'"Jan", "Feb"|September 2026 actual profit')
pat = re.compile(r'Jan-Oct|Jan-Sep|2026-(?:10|09|08)|1–15\b|\b(?:October|September|August|Oct|Sep|Aug)\b')
out = '\n'.join(l if keep.search(l) else pat.sub(lambda m: M[m.group(0)], l) for l in src.split('\n'))
open(ROOT / 'tests' / '.smoke_run.mjs', 'w', encoding='utf-8').write(out)
print('tests/.smoke_run.mjs for', c0.strftime('%B %Y'), '| days', P['ptdDays'])
