# SQL

Templates for every pull behind the embedded data, plus the analysis and design SQL. Render a template with `scripts/render_sql.py`
(see its docstring); the AM and sales lists come from `data/org_final.json`.

| File | Purpose |
|---|---|
| `pull_monthly_daily_packs.sql.txt` | Monthly (Jan-Oct, 32 fields) and daily packs per merchant, first version (page with `__OFFSET__`) |
| `pull_daily_packs.sql` | Daily pack with DSR/ASR numerators and denominators (16 fields x 34 days) |
| `pull_merchant_meta.sql` | Website and sub-account / parent flags |
| `pull_issue_rows_current_month.sql` | Parcel issue rows: fake attempts, RTO without attempt, lost, damaged, compensation |
| `pull_tickets_current_month.sql` | Tickets linked to roster merchants (`public.freshdesk_tickets_enriched`) |
| `pull_failed_attempts_current_month.sql` | Failed delivery attempts: reason dictionary, counts by day, latest 10 |
| `pull_sales_cohorts.sql` | Sales new merchants (first pickup this month) and last month's cohort for churn |
| `merchant_profile_queries.sql` | Metric definitions and calculation notes for the profile / portfolio views |
| `issues_tab_queries.sql` | One query per metric of the Issues tab (merchant, daily, portfolio, parcel lists, tickets, failed attempts) |
| `app_schema_redshift.sql` | Proposed `app` schema (employee, alias, target, access) and views; nothing has been created yet |
| `redshift_hierarchy_check.sql` | Read-only proof that a recursive org tree rolls the mart up correctly |

Placeholders: `__AM_LIST__`, `__SALES_LIST__`, `__SALES_UNION__`, `__OWNER_SINCE__`, `__FROM__` / `__TO__` (TO exclusive unless stated),
`__PREV_FROM__` / `__PREV_TO__`, `__SNAPSHOT__`, `__RN_FROM__` / `__RN_TO__`, `__LIMIT__` / `__OFFSET__`.
The Metabase result cap is about 2,000 rows per query, hence the paging; the `lpad('', n, 'x') AS pad` column only forces large results to be stored as a file.
