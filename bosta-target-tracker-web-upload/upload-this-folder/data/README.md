# data/ (not in git)

Everything here except this file is ignored by git: it is commercial data (merchant names and ids, revenue, tickets, AM targets and emails).
Keep the **data pack** in a private bucket / drive and unpack it here before building. Files and where they come from:

| File | What | Produced by |
|---|---|---|
| `October_Targets_2026.xlsx` | Targets and org tree (Managers, Team Leaders, AMs, Sales sheets) | HR / commercial, input |
| `new_data_oct.json` | Tracker data: AMs, merchants, monthly volumes, targets, categories | earlier tracker pull (`sql/pull_monthly_daily_packs.sql.txt`) |
| `roster_rows.json` | Per merchant: id, name, AM, segment, monthly pack (Jan-Oct, 32 fields) and the first daily pack | `sql/pull_monthly_daily_packs.sql.txt` |
| `profile_store.b64` | base64(gzip(JSON)) with merchant packs `p`, metadata `x`, portfolio packs `pf`, current-month detail `cm` | pulls in `sql/`, `scripts/ingest_cm.py`, `scripts/store_tools.py` |
| `sales_rows_fp.json` | Sales new merchants and last month's cohort (first-pickup definition) | `sql/pull_sales_cohorts.sql` |
| `cm_issues.json`, `cm_tickets.json`, `cm_attempts.json`, `cm_reasons.json` | Current-month detail before packing | `scripts/ingest_cm.py` |
| `meta_extra.json` | Website / sub-account metadata (informational) | `sql/pull_merchant_meta.sql` |
| `org_base.json` | Org tree parsed from the workbook | `scripts/build_org.py` |
| `ptd_sep1_4.json`, `td_oct1_4.json`, `merchant_asp.json`, `merchant_dsr.json`, `org_final.json`, `expected_org.json` | Derived inputs of the app and tests (`merchant_dsr.json`: September DSR % and parcels per merchant, for the low-DSR list) | `scripts/build_derived_data.py` |
| `expected_v4.json`, `expected_cm.json`, `expected_asp.json`, `test_examples.json` | Independent expectations for the tests | `scripts/build_expected.py` |
| `expected_lead.json` | Independent expectations for the leadership views (standing, base, activity, every ranking, for 6 scopes) | `scripts/build_expected_lead.py` |

Data as of **2026-10-04** (current-month detail pulled 2026-10-05). The roster is the one embedded on Oct 5: AM portfolios have changed since.

Refresh inputs added for the Oct 15 refresh: `daily_packs.json`, `meta_rows.json`, `pf_monthly.json` (from `scripts/ingest_roster.py`), `profile_store_prev.b64` (the previous store, kept for creation source and locations).

Access (private): `access_hashed.json`, `user_access.sql`, `test_emails.json` (from `scripts/build_access.py`; emails come from the targets sheet + the VP).
