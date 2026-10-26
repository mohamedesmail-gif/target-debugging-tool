-- =====================================================================================================
-- TARGET TRACKER ON REDSHIFT: what to add to build the VP / Head / Team leader / Sales / AM levels
-- Nothing in this file has been created in your warehouse. Section 6 (the hierarchy roll-up) WAS run
-- read-only on 2026-10-09 and checked; see the note there.
-- =====================================================================================================
-- Short answer: yes, Redshift can be the database. It already holds every metric, supports recursive CTEs
-- (the org tree), and the people/targets tables are small and change monthly. What it is NOT good at:
-- frequent single-row writes (comments, edits, sessions), thousands of tiny concurrent queries, and
-- enforced constraints (primary/foreign keys are informational only). So:
--   * Redshift  = data + small config tables below (loaded in batches).
--   * An API layer between the app and Redshift (Redshift Data API / Lambda or a Next.js route with a
--     read-only user). The browser never connects to Redshift and never holds credentials.
--   * Only if you later need write-heavy features (notes, manual overrides, audit of clicks) add a small
--     Postgres next to it. Do not put UI state or sessions in Redshift.
-- =====================================================================================================

CREATE SCHEMA IF NOT EXISTS app;

-- 1) PEOPLE AND HIERARCHY ---------------------------------------------------------------------------
-- One row per person per validity period. The tree is manager_id (parent pointer): VP -> HEAD -> TL -> AM / SALES.
-- Sales who report straight to a head simply have the head as manager (5 Fashion sales today).
CREATE TABLE app.employee (
  employee_id  BIGINT IDENTITY(1,1),
  hr_id        INT,                      -- HR ID from the sheet (missing for AMs and for one TL: keep nullable)
  full_name    VARCHAR(200) NOT NULL,
  email        VARCHAR(200),
  role         VARCHAR(10)  NOT NULL,    -- VP | HEAD | TL | SALES | AM
  team         VARCHAR(100),             -- Growth - Cosmatics | Growth - Fashion | Growth - General Trade | Key | Startups
  manager_id   BIGINT,                   -- employee_id of the direct manager; NULL only for the VP (Sameh Shaheen)
  valid_from   DATE NOT NULL,
  valid_to     DATE,                     -- NULL = current. Re-orgs add a row, they never overwrite history.
  is_active    BOOLEAN DEFAULT TRUE,
  updated_at   TIMESTAMP DEFAULT GETDATE()
) DISTSTYLE ALL SORTKEY (role, employee_id);

-- 2) ALIASES: the source systems spell people differently ------------------------------------------
-- mart.*.account_manager ("Nourhan Hossam Farid"), public.businesses*.sales_manager_name ("salma seliem"),
-- the sheet ("Kahled El Menshawy" vs "Khaled El Menshawy"). The app must never join on free text names.
CREATE TABLE app.employee_alias (
  alias_name   VARCHAR(200) NOT NULL,
  source       VARCHAR(40)  NOT NULL,    -- 'mart.account_manager' | 'public.sales_manager_name' | 'sheet'
  employee_id  BIGINT       NOT NULL,
  valid_from   DATE, valid_to DATE
) DISTSTYLE ALL;

-- 3) TARGETS (long format: a new metric is a new row, not a new column) ------------------------------
CREATE TABLE app.target (
  period_month DATE        NOT NULL,     -- first day of the month
  employee_id  BIGINT      NOT NULL,
  metric       VARCHAR(30) NOT NULL,     -- pickups | asp | fresh_pickups | retention_min | churn_max
                                         -- sales 'Churn%' 0.81-0.86 (Growth/Key) is stored as churn_max = 1 - value; Startups 0.25 as churn_max = 0.25
  target_value DOUBLE PRECISION,
  weight       DOUBLE PRECISION,         -- scorecard weight from the sheet (0.6 / 0.2 / 0.2 ...)
  source_file  VARCHAR(200),
  loaded_by    VARCHAR(100),
  loaded_at    TIMESTAMP DEFAULT GETDATE()
) DISTSTYLE ALL SORTKEY (period_month, employee_id);
-- Load once a month: parse October_Targets_2026.xlsx, INSERT (or COPY from S3). Never edit rows in place:
-- insert a corrected row with a later loaded_at and let the views take the latest per (period, employee, metric).

-- 4) ACCESS: who may see whom ------------------------------------------------------------------------
CREATE TABLE app.user_access (
  email        VARCHAR(200) NOT NULL,    -- SSO identity
  employee_id  BIGINT       NOT NULL,    -- the person they ARE; scope = that person's subtree
  can_see_all  BOOLEAN DEFAULT FALSE,    -- VP / admins
  is_active    BOOLEAN DEFAULT TRUE
) DISTSTYLE ALL;
-- Rule used by the API on every request: scope = descendants of employee_id in app.v_org_closure
-- (everyone if can_see_all). A head sees his team leaders, a team leader his AMs and sales, an AM only himself.

-- 5) VIEWS ----------------------------------------------------------------------------------------
-- 5a) every ancestor/descendant pair (a person is their own ancestor at depth 0). Regular view, not materialized
--     (materialized views cannot contain recursive CTEs).
CREATE OR REPLACE VIEW app.v_org_closure AS
WITH RECURSIVE e AS (SELECT employee_id, manager_id FROM app.employee WHERE valid_to IS NULL AND is_active),
c(ancestor_id, descendant_id, depth) AS (
  SELECT employee_id, employee_id, 0 FROM e
  UNION ALL
  SELECT c.ancestor_id, e.employee_id, c.depth + 1 FROM c JOIN e ON e.manager_id = c.descendant_id)
SELECT ancestor_id, descendant_id, depth FROM c;

-- 5b) AM ownership: the latest owner of each merchant in the monthly mart, mapped through the alias table
--     (the same rule the tracker uses: ROW_NUMBER on date DESC, never MAX()).
CREATE OR REPLACE VIEW app.v_merchant_am AS
WITH latest AS (SELECT business_id, account_manager, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) rn
                FROM mart.v_merchant_monthly_wide WHERE date >= DATEADD(month, -4, CURRENT_DATE))
SELECT l.business_id, a.employee_id AS am_id
FROM latest l JOIN app.employee_alias a ON a.alias_name = l.account_manager AND a.source = 'mart.account_manager'
WHERE l.rn = 1;

-- 5c) SALES. "New acquisition" = the merchant's FIRST PICKUP date (public.businesses.firstpickuppickedupat). This equals the
--     mart's joining_date (checked: all 786 September first-pickup merchants match), NOT the sign-up date (createdat).
--     The snapshot labelled 2026-09-01 is taken on Oct 1, i.e. it is the END-of-September state.
CREATE OR REPLACE VIEW app.v_sales_new_merchants AS          -- this month's new merchants, live owner
SELECT b.business_id, b.name, b.firstpickuppickedupat::date AS first_pickup, a.employee_id AS sales_id, DATE_TRUNC('month', b.firstpickuppickedupat)::date AS period_month
FROM public.businesses b JOIN app.employee_alias a ON a.alias_name = b.sales_manager_name AND a.source = 'public.sales_manager_name'
WHERE b.firstpickuppickedupat >= DATE_TRUNC('month', CURRENT_DATE);

CREATE OR REPLACE VIEW app.v_sales_cohort AS          -- merchants whose first pickup was in month M, owner as of the snapshot taken at the end of M
SELECT s.snapshot_month AS cohort_month, s.business_id, s.name, s.firstpickuppickedupat::date AS first_pickup, a.employee_id AS sales_id
FROM public.businesses_monthly_snapshot s JOIN app.employee_alias a ON a.alias_name = s.sales_manager_name AND a.source = 'public.sales_manager_name'
WHERE s.firstpickuppickedupat >= s.snapshot_month AND s.firstpickuppickedupat < DATEADD(month, 1, s.snapshot_month);
-- Churn of last month's cohort (provisional until month end) = cohort merchants with no pickup yet this month / cohort size.

-- 5d) per-AM monthly actuals (numerators and denominators, so any level can re-aggregate exactly).
--     ASP = delivery_revenue_total / parcels_delivered (target taken as given, no growth factor).
CREATE OR REPLACE VIEW app.v_am_month_actuals AS
SELECT DATE_TRUNC('month', w.date)::date AS period_month, o.am_id AS employee_id,
       SUM(w.parcels_picked) AS pickups, SUM(w.delivery_revenue_total) AS revenue, SUM(w.parcels_delivered) AS delivered
FROM app.v_merchant_am o JOIN mart.v_merchant_daily_wide w ON w.business_id = o.business_id
GROUP BY 1, 2;

-- 5e) AM retention, provisional until month end: merchants active last month that already have a pickup this month.
CREATE OR REPLACE VIEW app.v_am_retention AS
SELECT cur.date::date AS period_month, o.am_id AS employee_id,
       COUNT(DISTINCT CASE WHEN prv.parcels_picked > 0 THEN o.business_id END) AS base,
       COUNT(DISTINCT CASE WHEN prv.parcels_picked > 0 AND cur.parcels_picked > 0 THEN o.business_id END) AS kept
FROM app.v_merchant_am o
JOIN mart.v_merchant_monthly_wide cur ON cur.business_id = o.business_id
LEFT JOIN mart.v_merchant_monthly_wide prv ON prv.business_id = o.business_id AND prv.date = DATEADD(month, -1, cur.date)
GROUP BY 1, 2;

-- 5f) read model for the app: one row per person per metric (numerator / denominator / target), rolled up
--     through the closure. Materialise it into a table once a day, after the mart refresh (scheduled query),
--     so the app never runs the heavy joins per click:
--       CREATE TABLE app.scorecard AS SELECT ...;   then   TRUNCATE + INSERT daily
--     The API reads:  SELECT * FROM app.scorecard WHERE employee_id IN
--                       (SELECT descendant_id FROM app.v_org_closure WHERE ancestor_id = :me) ...
-- Example roll-up (pickups and ASP for every ancestor of every AM):
--   SELECT c.ancestor_id, a.period_month, SUM(a.pickups) pickups, SUM(a.revenue)::float / NULLIF(SUM(a.delivered), 0) asp
--   FROM app.v_org_closure c JOIN app.v_am_month_actuals a ON a.employee_id = c.descendant_id
--   GROUP BY 1, 2;

-- 6) VALIDATED ON REAL DATA (read-only, nothing created) -------------------------------------------------
-- The org tree from the October sheet was passed as a VALUES-style CTE, closed with WITH RECURSIVE, and the mart's
-- Oct 1-4 pickups and ASP were rolled up to every head and team leader. Result on 2026-10-09:
--   VP 446,573 pickups (ASP 79.73) = sum of the 5 heads exactly: 49,239 + 121,511 + 66,007 + 170,919 + 38,897
--   each head = the sum of its team leaders; the VP total also equals the sum of the 49 per-AM totals (446,573).
-- These do NOT equal the app's embedded figures (431,526 for the same days) for one reason: AM ownership changed
-- after the app's data was embedded on Oct 5. Roster merchants went from 4,641 to 4,885, no AM portfolio is identical
-- any more, and Yousra Gamal Youssef Elawady went from 0 to 63 merchants. A live database keeps this current;
-- an embedded snapshot cannot.

-- 7) DATA-QUALITY CHECKS TO RUN AFTER EVERY LOAD (each should return zero rows) --------------------------
-- 7a) people without a manager (except the VP), or whose manager does not exist
SELECT e.* FROM app.employee e LEFT JOIN app.employee m ON m.employee_id = e.manager_id AND m.valid_to IS NULL
WHERE e.valid_to IS NULL AND e.role <> 'VP' AND m.employee_id IS NULL;
-- 7b) AM names in the mart that have no alias (their merchants would silently disappear from every level)
SELECT account_manager, COUNT(*) AS merchants FROM mart.v_merchant_monthly_wide w
WHERE w.date >= DATEADD(month, -1, DATE_TRUNC('month', CURRENT_DATE)) AND NVL(account_manager, '') <> ''
  AND NOT EXISTS (SELECT 1 FROM app.employee_alias a WHERE a.alias_name = w.account_manager AND a.source = 'mart.account_manager')
GROUP BY 1 ORDER BY 2 DESC;
-- 7c) targets that do not add up: a manager's pickup target should equal the sum of the people below him
--     (October sheet: Fashion head fresh-sales target 27,600 vs 23,000 listed; Startups TLs differ by one AM, Hajar Bahaa Eldin)
SELECT m.full_name, t.target_value AS manager_target, SUM(tc.target_value) AS sum_below
FROM app.target t JOIN app.employee m ON m.employee_id = t.employee_id
JOIN app.employee ch ON ch.manager_id = m.employee_id AND ch.valid_to IS NULL
JOIN app.target tc ON tc.employee_id = ch.employee_id AND tc.metric = t.metric AND tc.period_month = t.period_month
WHERE t.metric = 'pickups' AND m.role IN ('HEAD', 'TL') GROUP BY 1, 2 HAVING ABS(t.target_value - SUM(tc.target_value)) > 5;
-- 7d) the same merchant owned by two AMs or two sales
SELECT business_id, COUNT(*) FROM app.v_merchant_am GROUP BY 1 HAVING COUNT(*) > 1;

-- 8) ROLL-OUT ORDER -----------------------------------------------------------------------------------------
--   1. Load employee / employee_alias / target from the sheet; run the checks in section 7 and fix the names.
--   2. Create the views; compare their numbers with the app for the same date (they should match once the app's
--      data is refreshed).
--   3. Add the API route (read-only Redshift user, one query per request, 5-15 minute cache).
--   4. Switch the app from embedded data to the API, one screen at a time (VP view first).
--   5. Add SSO + app.user_access so each person only reaches their own subtree.

-- 9) QUESTIONS FOR THE DATA ENGINEER ---------------------------------------------------------------------------
--  Access and hosting
--   1. Can the app (Vercel today, AWS later) reach Redshift: network path (VPC/peering/PrivateLink), IAM role or user, and is the
--      Redshift Data API enabled? Who creates a READ-ONLY identity for the app and where are its secrets stored?
--   2. Which cluster is the source of truth for the app: bosta-data-dev (where we query today) or a production cluster/serverless
--      workgroup? How do views and tables get promoted from dev to prod?
--   3. Provisioned or serverless? What concurrency and cost do we get if 100+ people open dashboards at the same time, and is
--      concurrency scaling / result caching on?
--  Ownership of the new objects
--   4. Who owns the new `app` schema (who may create tables and views), and how are changes versioned and reviewed (git, dbt)?
--   5. Where should the org hierarchy and monthly targets come from: is there an HR table to sync, or do we load the sheet each
--      month (S3 COPY, a scheduled upload, an admin page)? Who maintains it when people join, leave or move teams?
--  Data correctness
--   6. What is the authoritative source for "who owns this merchant" (AM and sales) with history? We see the latest row of the
--      monthly mart and the monthly snapshot. Portfolios changed a lot within four days (4,641 to 4,885 roster merchants), so is
--      there an assignment table or event log, and does the mart restate history when ownership changes?
--   7. Please confirm: DSR denominator (= pickups of the cohort), ASR denominator (attempts?), joining_date (= first pickup), the
--      snapshot convention (the snapshot labelled 2026-09-01 is taken on Oct 1), and how fake_attempts / rto_without_attempt are
--      computed upstream (the parcel-level view does not reproduce them).
--  Scheduling and freshness
--   8. What runs after the mart refresh (Airflow / scheduled queries) and when is data final each day? Can a daily job build the
--      app.scorecard table after it?
--  Security
--   9. Row-level access: Redshift row-level security policies or filtering in the API? Is there an audit log of who opened which
--      view? Which columns are personal data (phone, email, bank info in the snapshot) and must never be exposed through app views?
--  Operations
--  10. Backups/DR for the app schema, monitoring of query cost per request, and do we want a small Postgres next to Redshift for
--      anything that is written often (notes, manual overrides, audit of clicks)?
