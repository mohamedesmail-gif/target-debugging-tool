# Data pipeline

```
targets workbook ──► scripts/build_org.py ─────────────┐
Redshift pulls (sql/*.sql, scripts/render_sql.py) ──┐   │
   monthly + daily packs, meta, portfolio packs      ├─► data/profile_store.b64 ─┐
   current-month detail ► scripts/ingest_cm.py ──────┘                            ├─► scripts/build_derived_data.py ─► org_final.json, merchant_asp.json, ptd/td
sales cohorts ► data/sales_rows_fp.json ────────────────────────────────────────┘                                  │
                                                                                                                    ▼
src/*.jsx + data/* ──► scripts/assemble.py ──► dist/target_tracker.jsx ──► esbuild bundle ──► tests/smoke.mjs
                                                                      └─► vite build ──► dist-web/ (deploy)
```

## Store format (`data/profile_store.b64`, see `scripts/store_tools.py`)
`p` merchant packs (monthly 10 x 32 fields, daily 45 x 16 (Sep 1 - Oct 15)), `x` metadata (creation source, locations, website, parent / sub-account), `pf` portfolio packs per AM, `cm` current-month detail. Packs are `;`-separated periods of `,`-separated integers; ratios are x10000, -1 = no data.

## Refreshing for a new date (the procedure used for the Oct 15 refresh)
1. Update the targets workbook if needed; run `python scripts/build_org.py`. Keep the previous store: `cp data/profile_store.b64 data/profile_store_prev.b64` (creation source, share and pickup locations of a merchant live there and are not re-pulled).
2. Roster pull, paged (about 1,700 merchants per page, three pages for ~4,900): `python scripts/render_sql.py sql/pull_roster_packs.sql --from 2026-09-01 --to <last day> --limit 1700 --offset 0|1700|3400`. One row per merchant: identity, segment, joining date, last activity, monthly pack, daily pack, website and sub-account metadata. Then `sql/pull_portfolio_monthly.sql` (one row per AM).
3. Current-month detail: `sql/pull_issue_rows_current_month.sql`, `pull_tickets_current_month.sql`, `pull_failed_attempts_current_month.sql` (the first statement of that file is the failure-reason dictionary), each with `--from <first of month> --to <day after the last day>` and `--rn` pages of 2,000. Keep the pad column large enough that Metabase stores the result as a file. Sales: `sql/pull_sales_cohorts.sql`.
4. `python scripts/ingest_roster.py --pages p1 p2 p3 --portfolio pf.json`, then `python scripts/build_store.py`, then `python scripts/ingest_cm.py --issues ... --tickets ... --attempts ... --days <days of the month so far> --as-of <last day> --stamp "pulled <date>"`, then save the sales rows as `data/sales_rows_fp.json`.
5. `python scripts/build_tracker_data.py --as-of <last day> --elapsed <working days elapsed> --full <working days in the month>` (working days: the calendar excluding Fridays).
6. `python scripts/build_access.py` (access list from the sheet emails), then `python scripts/build_derived_data.py`, `python scripts/build_expected.py`, `python scripts/build_expected_lead.py`, then `npm test`. The windows ("Oct 1-N" / "Sep 1-N", the last day, the range end) are taken from the data; a NEW MONTH still needs the month constants in `src/head.jsx` (`MP_PREV_LABEL`, `MP_CUR_LABEL`, `MP_CUR_NAME`, `MP_MONTH_KEYS`, `MP_DAILY_START`, `MP_CUR_MONTH_START`), the "Oct" label in `src/m6_cm.jsx`, and the pack window index 30 in the scripts.

What was checked for the Oct 15 refresh: the monthly Oct row equals the daily sum for all roster merchants; `build_tracker_data.py` and `build_store.py` reproduce the previous data exactly when fed the previous inputs (apart from the points below); 249 checks pass.

Known limits of the Oct 15 data: (a) the 348 merchants that joined the roster since the previous pull have no creation source, share or pickup locations; (b) the portfolio VAS-merchant count is derived from rounded merchant packs and can differ by one merchant; (c) `sql/pull_monthly_daily_packs.sql.txt`, `pull_daily_packs.sql` and `pull_merchant_meta.sql` are superseded by `pull_roster_packs.sql`.

## What was verified when this repo was created
- `scripts/assemble.py` reproduces the delivered app byte for byte.
- `build_derived_data.py`, `build_expected.py` and `ingest_cm.py` regenerate their outputs identically to the files the app was built from.
- A rendered `pull_sales_cohorts.sql` ran on Redshift and returned the same 303 merchants (2 rows differ by +1 and +3 pickups: late data restated in the mart).

## Not in the repo
The interactive code that turned the first monthly / daily pulls into `roster_rows.json` and the packs of `profile_store.b64` (earlier sessions). The SQL that feeds them is here (`pull_monthly_daily_packs.sql.txt`, `pull_daily_packs.sql`, `pull_merchant_meta.sql`); the packs are in the data pack. Rebuilding them from raw results needs a small ingest script of the same shape as `ingest_cm.py`.
