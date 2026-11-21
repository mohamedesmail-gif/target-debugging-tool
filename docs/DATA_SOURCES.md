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
