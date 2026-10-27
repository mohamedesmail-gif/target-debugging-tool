# Sign-in, authorization and access levels

## Who can sign in: the emails of the targets sheet
Access is managed by email. `scripts/build_access.py` reads the email column of every sheet (Managers, Team Leaders, AMs, Sales) plus the VP (`sameh.shaheen@bosta.co`) and writes:
- `data/access_hashed.json`: `{sha256(email): access key}`, embedded in the app. The app file contains no email address.
- `data/user_access.sql`: the DDL of `sql/app_user_access.sql` plus one INSERT of all rows, to load the user table (`app.user_access`) in the warehouse. **It has not been run**: creating a schema in the shared warehouse needs the data team.
- `data/test_emails.json`: used by the tests to sign in.
No row = "no access". A person without an email in the sheet cannot sign in (today: team leader Ahmed Abdelrahman has "-"; add his email to the sheet and rerun the script).

## Login screen
Same design as the InsightHub login, branded "Commercial Portal" (`src/m9_auth.jsx`). Continue with Google opens a field for your Bosta email (the simulated Google step). Messages: "You're signed out.", "Enter your Bosta email address.", the domain refusal (not @bosta.co) and "This account doesn't have access to Commercial Portal yet". The Bosta wordmark is styled text: swap it for the official SVG in `LoginScreen`.

## Access levels
| Level | Sees |
|---|---|
| VP | everything: VP view, every head, team leader, AM and sales manager |
| Head | his own team: his team leaders, AMs and sales managers (one tab in Heads) |
| Team leader | his AMs and sales managers (each opens in place) |
| Account manager, Sales manager | their own view only |

`scopeOf` (in `src/m8_lead.jsx`) turns a signed-in person into the set of heads / team leaders / AMs / sales they may open; the level bar, the selectors and the tabs only offer that set.

## What is real and what is a prototype
The email is typed, not verified by Google, and the scoping only shapes the screens: the whole data set is inside the page, so anyone with the file can read everything (the hashes only keep the addresses out of the file; they can be guessed). For production:
1. Google sign-in (OIDC) restricted to the Bosta domain; the server verifies the ID token and sets a session cookie.
2. The verified email is looked up in `app.user_access`; no row or status <> 'active' = no access.
3. Every API request is filtered by the person's subtree (same rules as `scopeOf`).
4. An audit log of who opened what.
A host app that already authenticated the user can pass `<TargetTracker session={{ viewerKey, name, role, access }} onSignOut={...} />` and the login screen is skipped (`viewerKey`: `vp`, `h:<id>`, `t:<id>`, `a:<AM name>`, `s:<id>`).

## Display names
Heads and team leaders are shown by short names (`DISPLAY_NAMES` in `scripts/build_org.py`, e.g. Abed Abdelrahim Abed Ali = Abed Ali); the full names stay in the sheet and in `fullName` while building.
