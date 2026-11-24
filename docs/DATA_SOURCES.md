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

## Company daily pickups (VP Daily analysis)

- `sql/pull_company_daily.sql` sums parcels picked per day for the whole company from `mart.v_merchant_daily_wide`: total, ecommerce, fulfillment, box, and the number of active businesses.
- `jobs/refresh_payload.py` writes it to `data/company_daily.json` (one row per day, from the first day of last month to the as-of day). The file is not committed.
- Only the VP Daily analysis uses it. It shows all company pickups (box included, any account manager or segment) with an "Other pickups" card and "Other" and "Box" rows. "Other" = company total minus the target-segment merchants. Heads, team leaders, sales and AMs are unchanged.
- If the file is missing or does not cover every day of the merchant data, the VP view falls back to the target segments only.

## Consignee scores (Customers tab)

- `sql/pull_consignee_scores.sql` reads `public.delivery_attempts_asr` (one parcel = one tracking number, delivery attempts only) and joins the consignee phone to `public.consignees_fraud_score` on digits only (the score table stores `+20…`, the attempts table `20…`).
- A parcel's month = the month of its first `confirmed_date`. Delivered = at least one attempt with `attemptstatus = 1`.
- Consignee score from `delivery_success_rate` (0–100): 70 or more = High, 40 to below 70 = Medium, below 40 = Bad, 0 or no score = No data.
- `jobs/refresh_payload.py` writes `data/consignee_scores.json` (`{months, bands, p: {businessId: [[monthIdx, bandIdx, parcels, delivered], …]}}`), same window as the merchant packs. Not committed.
- Check (1 Sep–15 Oct 2026, whole company): Sep High 2,892,665 / Medium 533,640 / Bad 169,130 / No data 136,671 parcels; the per-merchant file adds up to exactly these totals.


## Portfolio, VP-only merchants and reactivations (from the November 2026 build)

- **Portfolio of an account manager** = merchants whose `public.businesses.account_manager_name` is that AM (today's owner), for the AMs of the month's targets table, when the merchant's latest mart segment is one of the five target segments or empty. An empty segment takes the AM's team segment. Before, the owner was the latest `account_manager` in `mart.v_merchant_monthly_wide`.
- **VP-only merchants** (`sql/pull_roster_packs.sql`, scope `vp`): merchants with at least one pickup this month whose segment is Box, another segment outside the five, or empty without a target AM. They appear in the VP view only, grouped as "Box", "No segment" (empty or "Non") and "Other segments", with the same cards, lists and segment rows as the five segments. They are not in any AM, team leader or head view, and not in the targets scorecard.
- **Reactivation** (`scripts/build_tracker_data.py`, field `reactivated`), on the same 25th-to-25th months as new merchants: not a new merchant, no pickups from the 25th of two months ago to the 24th of last month, pickups since the 25th of last month, and active before that (first pickup before the 25th of two months ago, or pickups in an earlier month). The daily packs start on the 1st of last month, so the 25th .. end of two months ago comes from `sql/pull_prev_window_active.sql` (`data/prev_window_active.json`: merchants active in those days, who are therefore not reactivations). A reactivated merchant's pickups, delivered parcels, revenue, ASP and average per working day count from the 25th of last month (like a new merchant's) and are in every total; it is not in the retention base. Sales reps get their own reactivations (`sql/pull_sales_cohorts.sql`, kind R: live owner = the sales rep, same rule); their numbers count in the sales rep's new pickups, ASP and the fresh sales of the team.
- **Hierarchy of the month**: `data/commercial_monthly_targets_hierarchy_YYYY-MM.json` ([role, name, manager, team]) sets who reports to whom; `TARGETS_MONTH=YYYY-MM` picks the month (`jobs/refresh_payload.py` sets it from `--month`).
- **Current-month detail** (parcel issues, tickets, failed attempts) is shown only for the month it was pulled for. The November detail was not pulled (Metabase has no read access to `public.deliveries_attempts`, and the full month is too large to embed), so the Issues and CX tables say it is not loaded; the monthly trends are unaffected.
- **New merchants are measured from the 25th of last month** (`scripts/build_tracker_data.py`, `scripts/build_derived_data.py`): pickups, delivered parcels, revenue and ASP of a merchant with a first pickup in the window add the days from the 25th to the end of last month (from the daily pack, which starts on the 1st of last month). `mtd` is then "since the 25th", `mtdMonth` is this month only, `preNew` the days before the 1st, and the average per working day uses the working days since the 25th. These numbers are part of every total (pickups so far, ASP, activity analysis). The fresh sales cohort (`sql/pull_sales_cohorts.sql`, kind N) is summed from the 25th as well. A new merchant of this window is not in the retention base. The VP-only groups count a new merchant as active when it has pickups since the 25th. The portfolio overview's monthly charts stay on calendar months.
- **Sales reps' merchants in the team leader, head and VP views**: the merchants of a scope's sales reps (new, last month's new, reactivations) are added to its lists, cards, Live and Daily analysis. Those in no AM portfolio are pulled with `sql/pull_roster_by_ids.sql` (scope `sales`, `DATA.salesExtra`); the VP sees all of them. Pickups against the monthly pickups target stay the AM portfolios only. A team with sales reps only (e.g. a sales team leader) shows its fresh-sales numbers (new merchants + reactivations) under Pickups and ASP, against its fresh target.
- **Status filter**: the merchant detail tables of the AM and sales views filter by group (growers, droppers, stable, churned, new, reactivations).
