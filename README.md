# Bosta Target Tracker

Sales performance tracker for Bosta, built as one React component:

- **Leadership views**: VP & Heads (one screen, a tab per team: where the team stands against targets first, then base, activity and top / bottom 10 rankings), team leaders (with every AM and sales rep opening in place) and a permission model (VP all, head his team, team leader his AMs and sales, AM / sales their own view).
- **AM Target Tracker**: pickups achievement, hit / missed merchants, merchant table with a Pickups view and an ASP view (portfolio ASP gap analysis with scenarios per merchant).
- **AM portfolio overview**: merchant filter, same-length period comparisons, charts, issues (parcels, tickets, failed attempts), opportunities.

Status: working prototype with the data embedded (snapshot as of 2026-10-04). Next step: Redshift + API + AWS (see `docs/ARCHITECTURE.md`).

## Repository layout
```
src/        component source in parts (tracker.jsx, head.jsx, m1..m7), assembled into one file
scripts/    assemble.py, org / derived-data / expectation builders, ingest, SQL renderer
sql/        pull templates, analysis queries, proposed `app` schema (see sql/README.md)
tests/      149-check smoke suite (jsdom) and diagnostic scripts
web/        Vite host app (static build of the component)
docs/       ARCHITECTURE, SCREENS, METRICS, DEPLOYMENT, DATA_PIPELINE, OPEN_QUESTIONS
data/       PRIVATE data pack, not in git (see data/README.md)
```

## Quick start
```bash
# unpack the private data pack into data/ first
pip install openpyxl
npm install
npm test             # assemble -> bundle -> 149 checks
npm run web:dev      # local preview
npm run web:build    # static site in dist-web/
```
Output of the assembler: `dist/target_tracker.jsx` (single file, about 7.6 MB, data embedded) which can also be dropped into an existing React / Next.js app as a component.

## Data policy
Merchant names and ids, revenue, tickets and AM targets are commercial data: they are **never committed**. `data/` is git-ignored; keep the pack in a private bucket.

## Docs
- `docs/SCREENS.md` every screen and section with its logic
- `docs/METRICS.md` metric dictionary, decisions, caveats
- `docs/ARCHITECTURE.md` technical parts for the live system
- `docs/DEPLOYMENT.md` local, AWS (S3 + CloudFront / container), CI
- `docs/DATA_PIPELINE.md` how the data is built and refreshed
- `docs/OPEN_QUESTIONS.md` questions for the data engineer

## Data and hosting
The app has no embedded data: `docs/DATA_SOURCES.md` lists every data point and its source (mart or not), `docs/AWS_DEPLOYMENT.md` the hosting, `jobs/refresh_payload.py` the refresh job.

## Also in this repo
- `sql/data_points.sql`: one self-contained query per data point (section tags show which are mart tables and which are not).
- `docs/org-chart/`: the commercial team structure (VP, heads, team leaders, AMs, sales) as SVG and PNG.

## Latest changes (Oct 27)
- Required daily average card removed everywhere; Achievement % column in the heads, team leaders, AMs and sales tables.
- Main view: New merchants (MTD) in Base, New base ASP in Activity.
- Top 10 / Bottom 10 dropdown: pickups MTD avg daily vs PMTD (GR %), ASP MTD vs PMTD (GR %), DSR, VAS.
- AM merchant table: MTD vs PMTD avg daily, Delta, GR %, MTD vs PMTD total volume, Run rate, Status.
- "Total eligible revenue" renamed "Total revenues". Sales view rebuilt on the AM layout.
