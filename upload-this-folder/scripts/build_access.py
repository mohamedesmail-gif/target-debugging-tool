"""Access list from the emails in the targets sheet (+ the VP).  Who can sign in = whoever has an email here.

Writes (all in data/, private):
  access_hashed.json  {sha256(email): key}   embedded in the app (the app file never contains an email address)
  user_access.sql     DDL + INSERTs for the user table (see sql/app_user_access.sql for the DDL alone)
  test_emails.json    {display name: email}  used by tests/smoke.mjs to sign in
key = vp | h:<id> | t:<id> | a:<AM name> | s:<id>   (the same keys the app uses)
Usage: python scripts/build_access.py
"""
import hashlib, json, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build_org import heads, tls, ams, sales
DATA = pathlib.Path(__file__).resolve().parents[1] / 'data'
VP_NAME, VP_EMAIL = 'Sameh Shaheen', 'sameh.shaheen@bosta.co'
norm = lambda e: (e or '').strip().lower()
ok = lambda e: bool(re.fullmatch(r'[^@\s]+@bosta\.co', e))
people = [('vp', VP_NAME, 'VP', None, None, None, VP_EMAIL)]
people += [('h:' + h['id'], h['name'], 'Head', h['team'], h['id'], None, h['email']) for h in heads]
people += [('t:' + t['id'], t['name'], 'Team Leader', t['team'], t['headId'], t['id'], t['email']) for t in tls]
people += [('a:' + a['name'], a['name'], 'Account Manager', a['team'], a['headId'], a['tlId'], a['email']) for a in ams]
people += [('s:' + s['id'], s['name'], 'Sales Manager', s['team'], s['headId'], s['tlId'], s['email']) for s in sales]
hashed, test, rows, missing, seen = {}, {}, [], [], {}
for key, name, role, team, hid, tid, email in people:
    e = norm(email)
    if not ok(e): missing.append((role, name, email)); continue
    if e in seen: print('DUPLICATE email', e, seen[e], key); continue
    seen[e] = key; hashed[hashlib.sha256(e.encode()).hexdigest()] = key; test[name] = e
    rows.append((e, name, role, team, hid, tid, key))
json.dump(hashed, open(DATA / 'access_hashed.json', 'w')); json.dump(test, open(DATA / 'test_emails.json', 'w'), indent=1)
q = lambda v: 'NULL' if v is None else "'" + str(v).replace("'", "''") + "'"
ddl = open(DATA.parent / 'sql' / 'app_user_access.sql', encoding='utf-8').read() if (DATA.parent / 'sql' / 'app_user_access.sql').exists() else ''
ins = 'INSERT INTO app.user_access (email, employee_name, role, team, head_id, tl_id, access_key) VALUES\n' + ',\n'.join('(%s)' % ', '.join(q(v) for v in r) for r in rows) + ';\n'
open(DATA / 'user_access.sql', 'w', encoding='utf-8').write(ddl + '\n' + ins)
print('people', len(people), '| with a valid @bosta.co email', len(rows), '| without one:', [(r, n) for r, n, e in missing])
