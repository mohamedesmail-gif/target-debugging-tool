# Where every number comes from

The app file contains **no data**. It loads `payload.json` ({data, org, store}), which `jobs/refresh_payload.py` builds from the warehouse with the SQL in `sql/`.
Status: **MART** = read from the `mart` schema. **TARGETS** = `public.commercial_monthly_targets` (as requested). **NOT MART** = read from `public.*`, no `mart` equivalent found. **NO TABLE** = no table in the warehouse has it.

| Data in the app | Source | Status |
|---|---|---|
| Targets: pickups, ASP, retention, churn, fresh pickups per head / team leader / AM / sales | `public.commercial_monthly_targets` (236 rows for October: all matched the workbook-derived values exactly) | TARGETS |
| Merchant roster (merchant to AM), merchant name, segment, joining date, last activity | `mart.v_merchant_monthly_wide` (account_manager, segment, joining_date), `mart.dim_merchant_period` (business_name), `mart.v_merchant_daily_wide` | MART |
| Monthly packs per merchant (volumes, revenue, VAS by type, DSR, ASR, RTO, lost, damaged, compensation, delivery zones) | `mart.v_merchant_monthly_wide` | MART |
| Daily packs per merchant | `mart.v_merchant_daily_wide` | MART |
| Portfolio packs per AM (monthly, daily) | aggregated from the two tables above | MART |
| Working days elapsed / in the month | `mart.v_bosta_calendar` (Fridays excluded) | MART |
| Parcel issues of the month (fake attempts, RTO without attempt, lost, damaged, compensated) with hubs, stars, liability, amounts | `mart.v_parcel_lifecycle` | MART |
| Creation source, its share and the two main pickup locations | `mart.v_parcel_lifecycle` (creation_source, pickup_city, pickup_zone), last 90 days. Rule defined in `sql/pull_merchant_profile_mart.sql`; on a 40-merchant sample the dominant source equals the old (copied) value for 38 | MART |
| Website, parent account, number of sub-accounts | `public.businesses`, `public.business_invitations` | NOT MART |
| Support tickets of the month | `public.freshdesk_tickets_enriched` | NOT MART |
| Failed delivery attempts by reason, per merchant and day, and the latest ten | `public.deliveries_attempts` (the mart only has totals: `total_attempts`, fake-attempt counts) | NOT MART |
| Sales cohorts: new merchants of the month and last month's new merchants, per sales rep | `public.businesses` (sales_manager_name, firstpickuppickedupat), `public.businesses_monthly_snapshot`. The mart has `sales_manager` and `joining_date` per merchant, so this could move to mart, but I did not validate that it gives the same cohorts | NOT MART (candidate) |
| Who reports to whom (head, team leader, AM, sales), team of each person | the targets workbook (sheets Managers, Team Leaders, AMs, Sales) | NO TABLE |
| Scoring weights per role and team (e.g. 50 / 25 / 25), the Hajar Bahaa Eldin exception, which Startups column is churn | targets workbook / `scripts/build_org.py` | NO TABLE |
| Display names of heads and team leaders | `DISPLAY_NAMES` in `scripts/build_org.py` | NO TABLE |
| Emails for sign-in (login is off for now) | targets workbook; `sql/app_user_access.sql` + `data/user_access.sql` define the user table, not created yet | NO TABLE |
| The VP (name) | constant in the code | NO TABLE |

## Meaning to confirm in the targets table
- Sales reps: the new-pickups target is stored with the type `fresh pickups`.
- Sales `churn` for Growth and Key holds the raw sheet value (0.81 to 0.86). The app reads it as retention (maximum churn = 1 - value); for Startups the value is the churn target as it is. Is that right, or does 0.86 mean "at most 86% may leave"? A separate type (for example `sales retention`) would remove the doubt.

## Business rules that are constants in the code (not warehouse data)
Merchant own target = September pickups x 1.60 / 26 (growth 60%); growth status thresholds; low DSR = at or below 65%; minimum 30 parcels for ASP and VAS lists; status bands (Achieved / On track / At risk within 10% / Behind); the ASP gap formula. Month constants for the current month (`MP_CUR_LABEL`, `MP_CUR_NAME`, `MP_MONTH_KEYS`, `MP_DAILY_START`, `MP_CUR_MONTH_START` in `src/head.jsx`) and `WD_BY_MONTH` in `src/tracker.jsx` are still fixed values and should be derived from the calendar.

---

# Pricing calculator and Pricing tab

Added 2026-11-10. Engine `src/pricing_engine.js`, UI `src/m11_pricing.jsx`, pack `scripts/build_pricing.py`,
tests `tests/pricing.mjs`. The engine is a faithful port of the Merchant Pricing Simulator (v66, data 2026-11-02):
the formulas were not re-derived, so its validated results carry over. `npm run test:pricing` re-checks that on
every build.

## Where the pricing numbers come from

| Data | Source | Status |
|---|---|---|
| Merchant-month records: orders, RTO, shipping revenue, allow to open, flexship, next day, extra COD, insurance, COD fee, discounts, compensation, customer colour counts (47 fields) | `public.deliveries`, last 3 full months, Sep 2026 onwards | NOT MART |
| Order mix per merchant: order type x pickup zone x drop-off zone x size, with orders and shipping fee | `public.deliveries` | NOT MART |
| Price plans: ~320 plans, price per type / lane / size, plus the allow to open, flexship, next day and extra COD rules | `mart.v_pricing_rate_card` (daily load) and, for the 3 origin dependent plans, `dim.pricing_transit_costs`. Loaded into the packs by `scripts/refresh_pricing.py`. The Google Sheet (Esraa, finance) is no longer the source. | table |
| Per-merchant cost: first mile, last mile fixed, packaging materials per order | Sep 2026 profitability file | NO TABLE |
| Network cost rates: middle mile per governorate, hub, last mile variable, communication, reverse, cash collection | Sep 2026 profitability file, some entered by hand | NO TABLE |
| Expected GM2 % by monthly orders range (14 bands, 29.3% down to 13.7%) | Sep 2026 actual P&L | NO TABLE |
| Cost overrides saved by the simulator's owner (communication 0.8, last mile variable 20.1, reverse 4.2, saved 2026-11-04) | the simulator page's own store | NO TABLE |

Nothing here has a `mart` source today. That is the main thing to settle with the data engineer: the merchant-month
records and the order mix are the two that most plausibly belong in `mart`, because they are derived from
`public.deliveries` the same way the existing merchant views are. The rate card, the cost file and the GM2 bands are
finance inputs, not warehouse facts, so they need tables of their own (the shape of `public.commercial_monthly_targets`
is a good precedent: one row per key, loaded on a schedule, with a `loaded_at`).

## What is fixed, and when it goes stale
- Costs and the GM2 benchmark are frozen at **September 2026**. They do not move until someone reloads them.
- The rate card was copied on **2026-11-03**, the merchant data refreshed on **2026-11-02**.
- The pack has no refresh job yet. `jobs/refresh_payload.py` should build it once the sources above are agreed;
  until then it is rebuilt by hand from a simulator export.

## Who sees margin
Account managers and sales reps see **volume, revenue and ASP only**. Cost and GM2 are for the VP, heads and team
leaders (`prcCanSeeMargin()` in `src/m11_pricing.jsx`).

**This is not yet enforced.** The pack is downloaded into the browser, so hiding cost in the UI does not stop an
account manager from reading it. Two things make it real, and both are needed:
1. `python3 scripts/build_pricing.py` (the default) builds the pack with every cost input removed. It keeps revenue
   and ASP exact and cannot produce a GM2 at all (`tests/pricing.mjs` checks this).
2. The API must choose which pack to serve from the signed-in person's role. Until login is on and there is an
   endpoint in front of the data, one pack is served to everyone and the gate is cosmetic.

Until then, either serve the `--no-cost` pack to everyone (nobody sees GM2 in the portal), or accept that the full
pack is readable by anyone who can open the page. The second is only safe once access is restricted.

## Known limits, carried over from the simulator
- Drop-off zone fees stay as billed on any plan; in reality they depend on the plan, so moving a Cairo-outskirts
  merchant is slightly off.
- The next day COD minimum charge is not modelled, which understates next day revenue for low-COD merchants.
- Insurance, the COD fee and packaging never change with the plan.
- Customer colour uses today's success rate, not the rate at the time of the order.
- A merchant billed on two plans in one month cannot be re-priced on one plan; the calculator still runs, but the
  "current plan" column will not match what was billed.
- Orders on a lane or size the rate card does not cover are dropped from the simulated revenue. The calculator says
  so when it happens.

## Refreshing the rate card from Redshift (2026-11-16)
`python3 scripts/refresh_pricing.py --compare` prints how Redshift differs from the rate card in the pack (plans added or removed, plans whose
send price changed). Without `--compare` it rewrites `pricing`, `card` and `pricing_asof` in `data/pricing_store.b64` and
`data/pricing_store_full.b64`, then upload both next to `payload.json`. It needs the same four `REDSHIFT_*` variables as `jobs/refresh_payload.py`.
Logic test: `python3 tests/test_refresh_pricing.py`. The connection itself has not been run from the build sandbox.
Known differences found on 2026-11-16 against the sheet of 2026-11-03: 25 plans are new in Redshift, and `Warehousing-EGY-Traders` has a
different send price (sheet 50,54,61,74,74,89,107; Redshift 55,59,63,76,76,91,109). Run `--compare` before relying on the new card.
