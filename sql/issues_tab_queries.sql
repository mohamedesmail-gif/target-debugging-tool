-- =====================================================================================================
-- ISSUES TAB: one query per metric (Operational, CX, Merchants & customers)
-- Redshift (Metabase database 11). Parameters: :business_id (merchant), :account_manager (AM name),
-- :from / :to (dates). Ownership of a merchant = its latest row in the monthly wide view (never MAX()).
--
-- HOW EACH QUERY WAS CHECKED (Trend Hub ImbeR25m9, September 2026, against the numbers the tab shows)
--   Metric                | tab (mart wide view) | rebuilt from mart.v_parcel_lifecycle            | verdict
--   Lost parcels          | 12                   | 12   (lost_at)                                   | EXACT
--   Compensation (EGP)    | 171,260              | 171,260 (last_compensation_at)                   | EXACT
--   Damaged parcels       | 28                   | 26   (damaged_at, or black_damaged by grey_date) | close, 2 short
--   Fake attempts         | 407                  | 591 (grey_reason_fake_attempt by grey_date; 572 by created_at) | DIFFERENT rule
--   RTO without attempt   | 5,064                | 2,026 (rto_initiated_at set and 0 attempts)      | DIFFERENT rule
--   The mart computes fake attempts and RTO-without-attempt upstream with a rule that is not visible in the
--   views, so for those two the parcel list (Part B) is a close proxy, NOT a reconciling breakdown.
--
-- DATA FRESHNESS (checked 2026-10-05) -- use the PUBLIC schema, not data_dev
--   mart.v_parcel_lifecycle             fresh: parcels up to 2026-10-04 (4.08M parcels in Sept 2026)
--   public.freshdesk_tickets_enriched   fresh: tickets up to 2026-10-04 23:58 (279,743 since Sept 1)
--   public.freshdesk_tickets            fresh: up to 2026-10-05 01:44 (24,959 tickets since Oct 1)
--   public.deliveries_attempts          fresh: up to 2026-10-06 01:30 (867,161 attempts since Oct 1, 187,848 with a reason)
--   data_dev.freshdesk_tickets / data_dev.deliveries_attempts are stale development mirrors (last rows 2026-02-23 and 2025-11-11).
--   An earlier version of this file pointed at data_dev by mistake.
--
-- MERCHANT LINK FOR TICKETS: a ticket is attached to a merchant by the first of business_id, company_business_id,
--   freshchat_business_id, then the parcel's merchant via tracking_number. Ticket tracking numbers are text like '9622709071.0',
--   so strip the decimal first: TRY_CAST(SPLIT_PART(tracking_number, '.', 1) AS BIGINT). About half of October tickets can be linked.
-- =====================================================================================================

-- ##################################################################################################
-- PART A. OPERATIONAL: the counts, KPI cards and trend charts (mart.v_merchant_monthly_wide / daily_wide)
-- ##################################################################################################

-- ======== A1. Fake attempts (fake_attempts) ========
-- A1.1  Merchant, monthly (trend chart + KPI card)
SELECT date::date AS month, SUM(fake_attempts) AS fake_attempts
FROM mart.v_merchant_monthly_wide
WHERE business_id = :business_id AND date >= DATE '2026-01-01'
GROUP BY 1 ORDER BY 1;
-- A1.2  Merchant, daily (Sep 1 onward; used for month-to-date vs the same days of last month)
SELECT date::date AS day, SUM(fake_attempts) AS fake_attempts
FROM mart.v_merchant_daily_wide
WHERE business_id = :business_id AND date BETWEEN DATE '2026-09-01' AND :to
GROUP BY 1 ORDER BY 1;
-- A1.3  AM portfolio, monthly
WITH latest AS (
  SELECT business_id, account_manager, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) rn
  FROM mart.v_merchant_monthly_wide WHERE date >= DATE '2026-06-01'),
owner AS (SELECT business_id FROM latest WHERE rn = 1 AND account_manager = :account_manager)
SELECT w.date::date AS month, SUM(w.fake_attempts) AS fake_attempts
FROM owner o JOIN mart.v_merchant_monthly_wide w ON w.business_id = o.business_id AND w.date >= DATE '2026-01-01'
GROUP BY 1 ORDER BY 1;
-- A1.4  AM portfolio, which merchants (the clickable ranking, one month)
WITH latest AS (
  SELECT business_id, account_manager, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) rn
  FROM mart.v_merchant_monthly_wide WHERE date >= DATE '2026-06-01'),
owner AS (SELECT business_id FROM latest WHERE rn = 1 AND account_manager = :account_manager)
SELECT w.business_id, w.business_name, SUM(w.fake_attempts) AS fake_attempts
FROM owner o JOIN mart.v_merchant_monthly_wide w ON w.business_id = o.business_id AND w.date = :month_start::date
GROUP BY 1, 2 HAVING SUM(w.fake_attempts) > 0 ORDER BY 3 DESC LIMIT 6;

-- ======== A2. RTO without attempt (rto_without_attempt) ========
-- A2.1  Merchant, monthly (trend chart + KPI card)
SELECT date::date AS month, SUM(rto_without_attempt) AS rto_without_attempt
FROM mart.v_merchant_monthly_wide
WHERE business_id = :business_id AND date >= DATE '2026-01-01'
GROUP BY 1 ORDER BY 1;
-- A2.2  Merchant, daily (Sep 1 onward; used for month-to-date vs the same days of last month)
SELECT date::date AS day, SUM(rto_without_attempt) AS rto_without_attempt
FROM mart.v_merchant_daily_wide
WHERE business_id = :business_id AND date BETWEEN DATE '2026-09-01' AND :to
GROUP BY 1 ORDER BY 1;
-- A2.3  AM portfolio, monthly
WITH latest AS (
  SELECT business_id, account_manager, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) rn
  FROM mart.v_merchant_monthly_wide WHERE date >= DATE '2026-06-01'),
owner AS (SELECT business_id FROM latest WHERE rn = 1 AND account_manager = :account_manager)
SELECT w.date::date AS month, SUM(w.rto_without_attempt) AS rto_without_attempt
FROM owner o JOIN mart.v_merchant_monthly_wide w ON w.business_id = o.business_id AND w.date >= DATE '2026-01-01'
GROUP BY 1 ORDER BY 1;
-- A2.4  AM portfolio, which merchants (the clickable ranking, one month)
WITH latest AS (
  SELECT business_id, account_manager, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) rn
  FROM mart.v_merchant_monthly_wide WHERE date >= DATE '2026-06-01'),
owner AS (SELECT business_id FROM latest WHERE rn = 1 AND account_manager = :account_manager)
SELECT w.business_id, w.business_name, SUM(w.rto_without_attempt) AS rto_without_attempt
FROM owner o JOIN mart.v_merchant_monthly_wide w ON w.business_id = o.business_id AND w.date = :month_start::date
GROUP BY 1, 2 HAVING SUM(w.rto_without_attempt) > 0 ORDER BY 3 DESC LIMIT 6;

-- ======== A3. Lost parcels (parcels_lost) ========
-- A3.1  Merchant, monthly (trend chart + KPI card)
SELECT date::date AS month, SUM(parcels_lost) AS parcels_lost
FROM mart.v_merchant_monthly_wide
WHERE business_id = :business_id AND date >= DATE '2026-01-01'
GROUP BY 1 ORDER BY 1;
-- A3.2  Merchant, daily (Sep 1 onward; used for month-to-date vs the same days of last month)
SELECT date::date AS day, SUM(parcels_lost) AS parcels_lost
FROM mart.v_merchant_daily_wide
WHERE business_id = :business_id AND date BETWEEN DATE '2026-09-01' AND :to
GROUP BY 1 ORDER BY 1;
-- A3.3  AM portfolio, monthly
WITH latest AS (
  SELECT business_id, account_manager, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) rn
  FROM mart.v_merchant_monthly_wide WHERE date >= DATE '2026-06-01'),
owner AS (SELECT business_id FROM latest WHERE rn = 1 AND account_manager = :account_manager)
SELECT w.date::date AS month, SUM(w.parcels_lost) AS parcels_lost
FROM owner o JOIN mart.v_merchant_monthly_wide w ON w.business_id = o.business_id AND w.date >= DATE '2026-01-01'
GROUP BY 1 ORDER BY 1;
-- A3.4  AM portfolio, which merchants (the clickable ranking, one month)
WITH latest AS (
  SELECT business_id, account_manager, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) rn
  FROM mart.v_merchant_monthly_wide WHERE date >= DATE '2026-06-01'),
owner AS (SELECT business_id FROM latest WHERE rn = 1 AND account_manager = :account_manager)
SELECT w.business_id, w.business_name, SUM(w.parcels_lost) AS parcels_lost
FROM owner o JOIN mart.v_merchant_monthly_wide w ON w.business_id = o.business_id AND w.date = :month_start::date
GROUP BY 1, 2 HAVING SUM(w.parcels_lost) > 0 ORDER BY 3 DESC LIMIT 6;

-- ======== A4. Damaged parcels (parcels_damaged) ========
-- A4.1  Merchant, monthly (trend chart + KPI card)
SELECT date::date AS month, SUM(parcels_damaged) AS parcels_damaged
FROM mart.v_merchant_monthly_wide
WHERE business_id = :business_id AND date >= DATE '2026-01-01'
GROUP BY 1 ORDER BY 1;
-- A4.2  Merchant, daily (Sep 1 onward; used for month-to-date vs the same days of last month)
SELECT date::date AS day, SUM(parcels_damaged) AS parcels_damaged
FROM mart.v_merchant_daily_wide
WHERE business_id = :business_id AND date BETWEEN DATE '2026-09-01' AND :to
GROUP BY 1 ORDER BY 1;
-- A4.3  AM portfolio, monthly
WITH latest AS (
  SELECT business_id, account_manager, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) rn
  FROM mart.v_merchant_monthly_wide WHERE date >= DATE '2026-06-01'),
owner AS (SELECT business_id FROM latest WHERE rn = 1 AND account_manager = :account_manager)
SELECT w.date::date AS month, SUM(w.parcels_damaged) AS parcels_damaged
FROM owner o JOIN mart.v_merchant_monthly_wide w ON w.business_id = o.business_id AND w.date >= DATE '2026-01-01'
GROUP BY 1 ORDER BY 1;
-- A4.4  AM portfolio, which merchants (the clickable ranking, one month)
WITH latest AS (
  SELECT business_id, account_manager, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) rn
  FROM mart.v_merchant_monthly_wide WHERE date >= DATE '2026-06-01'),
owner AS (SELECT business_id FROM latest WHERE rn = 1 AND account_manager = :account_manager)
SELECT w.business_id, w.business_name, SUM(w.parcels_damaged) AS parcels_damaged
FROM owner o JOIN mart.v_merchant_monthly_wide w ON w.business_id = o.business_id AND w.date = :month_start::date
GROUP BY 1, 2 HAVING SUM(w.parcels_damaged) > 0 ORDER BY 3 DESC LIMIT 6;

-- ======== A5. Compensation (EGP) (compensation_amount) ========
-- A5.1  Merchant, monthly (trend chart + KPI card)
SELECT date::date AS month, SUM(compensation_amount) AS compensation_amount
FROM mart.v_merchant_monthly_wide
WHERE business_id = :business_id AND date >= DATE '2026-01-01'
GROUP BY 1 ORDER BY 1;
-- A5.2  Merchant, daily (Sep 1 onward; used for month-to-date vs the same days of last month)
SELECT date::date AS day, SUM(compensation_amount) AS compensation_amount
FROM mart.v_merchant_daily_wide
WHERE business_id = :business_id AND date BETWEEN DATE '2026-09-01' AND :to
GROUP BY 1 ORDER BY 1;
-- A5.3  AM portfolio, monthly
WITH latest AS (
  SELECT business_id, account_manager, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) rn
  FROM mart.v_merchant_monthly_wide WHERE date >= DATE '2026-06-01'),
owner AS (SELECT business_id FROM latest WHERE rn = 1 AND account_manager = :account_manager)
SELECT w.date::date AS month, SUM(w.compensation_amount) AS compensation_amount
FROM owner o JOIN mart.v_merchant_monthly_wide w ON w.business_id = o.business_id AND w.date >= DATE '2026-01-01'
GROUP BY 1 ORDER BY 1;
-- A5.4  AM portfolio, which merchants (the clickable ranking, one month)
WITH latest AS (
  SELECT business_id, account_manager, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) rn
  FROM mart.v_merchant_monthly_wide WHERE date >= DATE '2026-06-01'),
owner AS (SELECT business_id FROM latest WHERE rn = 1 AND account_manager = :account_manager)
SELECT w.business_id, w.business_name, SUM(w.compensation_amount) AS compensation_amount
FROM owner o JOIN mart.v_merchant_monthly_wide w ON w.business_id = o.business_id AND w.date = :month_start::date
GROUP BY 1, 2 HAVING SUM(w.compensation_amount) > 0 ORDER BY 3 DESC LIMIT 6;

-- ##################################################################################################
-- PART B. OPERATIONAL: tracking-number tables (mart.v_parcel_lifecycle, live query per merchant)
-- Common columns: tracking_number, created_at, assigned_hub_name, first_hub, current_hub, pickup_star_id,
-- delivery_star_id, current_star_name, total_attempts, current_status, final_outcome
-- ##################################################################################################

-- ======== B1. Fake attempts (proxy: see verdict above)
SELECT tracking_number, created_at, assigned_hub_name, first_hub, current_hub, pickup_star_id, delivery_star_id, current_star_name, total_attempts, current_status, final_outcome, grey_reason_fake_attempt, has_whatsapp_fake_attempt, grey_date
FROM mart.v_parcel_lifecycle
WHERE merchant_id = :business_id AND grey_reason_fake_attempt
  AND grey_date >= :from AND grey_date < DATEADD(day, 1, :to)
ORDER BY grey_date DESC;

-- ======== B2. RTO without attempt (proxy: return parcels initiated with zero delivery attempts)
SELECT tracking_number, created_at, assigned_hub_name, first_hub, current_hub, pickup_star_id, delivery_star_id, current_star_name, total_attempts, current_status, final_outcome, rto_initiated_at, return_star_id, rp_rto_date
FROM mart.v_parcel_lifecycle
WHERE merchant_id = :business_id AND rto_initiated_at IS NOT NULL AND NVL(total_attempts, 0) = 0
  AND rto_initiated_at >= :from AND rto_initiated_at < DATEADD(day, 1, :to)
ORDER BY rto_initiated_at DESC;

-- ======== B3. Lost parcels (EXACT match to the card) with compensation liability
SELECT tracking_number, created_at, assigned_hub_name, first_hub, current_hub, pickup_star_id, delivery_star_id, current_star_name, total_attempts, current_status, final_outcome, lost_at, full_compensation_amount, last_compensation_type, last_compensation_reason,
       last_compensation_liability, last_compensation_liability_on, last_compensation_department
FROM mart.v_parcel_lifecycle
WHERE merchant_id = :business_id AND lost_at >= :from AND lost_at < DATEADD(day, 1, :to)
ORDER BY lost_at DESC;

-- ======== B4. Damaged parcels (2 short of the card in the one month tested) with compensation liability
SELECT tracking_number, created_at, assigned_hub_name, first_hub, current_hub, pickup_star_id, delivery_star_id, current_star_name, total_attempts, current_status, final_outcome, damaged_at, black_damaged, full_compensation_amount, last_compensation_type, last_compensation_reason,
       last_compensation_liability, last_compensation_liability_on, last_compensation_department
FROM mart.v_parcel_lifecycle
WHERE merchant_id = :business_id
  AND (damaged_at >= :from AND damaged_at < DATEADD(day, 1, :to)
       OR (black_damaged AND grey_date >= :from AND grey_date < DATEADD(day, 1, :to)))
ORDER BY NVL(damaged_at, grey_date) DESC;

-- ======== B5. Compensation (EXACT match to the card): one row per compensated parcel
SELECT tracking_number, created_at, last_compensation_at, full_compensation_amount, compensation_count, approved_compensation_count,
       last_compensation_type, last_compensation_reason, compensation_reasons, last_compensation_liability,
       last_compensation_liability_on, last_compensation_department, current_status, final_outcome
FROM mart.v_parcel_lifecycle
WHERE merchant_id = :business_id AND last_compensation_at >= :from AND last_compensation_at < DATEADD(day, 1, :to)
ORDER BY last_compensation_at DESC;

-- ##################################################################################################
-- PART C. CX TAB  (public.freshdesk_tickets_enriched). Validated: Trend Hub, Oct 1-4 = 57 tickets (matches the app).
-- Shared CTE used by C1-C7 (replace :from / :to). status values: Closed, Resolved, Pending, Open, Pending Customer Response.
-- ##################################################################################################
-- WITH tk AS (
--   SELECT t.id, t.created_date, t.status, t.agent_name, t.ticket_type, t.category, t.sub_category, t.compensation_type,
--          SPLIT_PART(t.tracking_number, '.', 1) AS tracking_number,
--          COALESCE(NULLIF(t.business_id,''), NULLIF(t.company_business_id,''), NULLIF(t.freshchat_business_id,''), p.merchant_id) AS merchant_id
--   FROM public.freshdesk_tickets_enriched t
--   LEFT JOIN mart.v_parcel_lifecycle p ON p.tracking_number = TRY_CAST(SPLIT_PART(t.tracking_number, '.', 1) AS BIGINT) AND NVL(t.tracking_number,'') <> ''
--   WHERE t.created_date >= :from AND t.created_date < DATEADD(day, 1, :to))

-- ======== C1. Tickets per day
WITH tk AS (SELECT t.created_date, COALESCE(NULLIF(t.business_id,''), NULLIF(t.company_business_id,''), NULLIF(t.freshchat_business_id,''), p.merchant_id) AS merchant_id
            FROM public.freshdesk_tickets_enriched t
            LEFT JOIN mart.v_parcel_lifecycle p ON p.tracking_number = TRY_CAST(SPLIT_PART(t.tracking_number, '.', 1) AS BIGINT) AND NVL(t.tracking_number,'') <> ''
            WHERE t.created_date >= :from AND t.created_date < DATEADD(day, 1, :to))
SELECT created_date::date AS day, COUNT(*) AS tickets FROM tk WHERE merchant_id = :business_id GROUP BY 1 ORDER BY 1;

-- ======== C2. Tickets by status (open / pending cards)
WITH tk AS (SELECT t.status, COALESCE(NULLIF(t.business_id,''), NULLIF(t.company_business_id,''), NULLIF(t.freshchat_business_id,''), p.merchant_id) AS merchant_id
            FROM public.freshdesk_tickets_enriched t
            LEFT JOIN mart.v_parcel_lifecycle p ON p.tracking_number = TRY_CAST(SPLIT_PART(t.tracking_number, '.', 1) AS BIGINT) AND NVL(t.tracking_number,'') <> ''
            WHERE t.created_date >= :from AND t.created_date < DATEADD(day, 1, :to))
SELECT status, COUNT(*) AS tickets FROM tk WHERE merchant_id = :business_id GROUP BY 1 ORDER BY 2 DESC;

-- ======== C3. Tickets by agent
WITH tk AS (SELECT t.agent_name, COALESCE(NULLIF(t.business_id,''), NULLIF(t.company_business_id,''), NULLIF(t.freshchat_business_id,''), p.merchant_id) AS merchant_id
            FROM public.freshdesk_tickets_enriched t
            LEFT JOIN mart.v_parcel_lifecycle p ON p.tracking_number = TRY_CAST(SPLIT_PART(t.tracking_number, '.', 1) AS BIGINT) AND NVL(t.tracking_number,'') <> ''
            WHERE t.created_date >= :from AND t.created_date < DATEADD(day, 1, :to))
SELECT NVL(agent_name, 'Unassigned') AS agent, COUNT(*) AS tickets FROM tk WHERE merchant_id = :business_id GROUP BY 1 ORDER BY 2 DESC;

-- ======== C4. Tickets by category
WITH tk AS (SELECT t.category, COALESCE(NULLIF(t.business_id,''), NULLIF(t.company_business_id,''), NULLIF(t.freshchat_business_id,''), p.merchant_id) AS merchant_id
            FROM public.freshdesk_tickets_enriched t
            LEFT JOIN mart.v_parcel_lifecycle p ON p.tracking_number = TRY_CAST(SPLIT_PART(t.tracking_number, '.', 1) AS BIGINT) AND NVL(t.tracking_number,'') <> ''
            WHERE t.created_date >= :from AND t.created_date < DATEADD(day, 1, :to))
SELECT NVL(category, 'Uncategorised') AS category, COUNT(*) AS tickets FROM tk WHERE merchant_id = :business_id GROUP BY 1 ORDER BY 2 DESC;

-- ======== C5. Opened tickets (list). For pending use status IN ('Pending','Pending Customer Response').
WITH tk AS (SELECT t.id, t.created_date, t.status, t.agent_name, t.ticket_type, t.category, SPLIT_PART(t.tracking_number, '.', 1) AS tracking_number,
                   COALESCE(NULLIF(t.business_id,''), NULLIF(t.company_business_id,''), NULLIF(t.freshchat_business_id,''), p.merchant_id) AS merchant_id
            FROM public.freshdesk_tickets_enriched t
            LEFT JOIN mart.v_parcel_lifecycle p ON p.tracking_number = TRY_CAST(SPLIT_PART(t.tracking_number, '.', 1) AS BIGINT) AND NVL(t.tracking_number,'') <> ''
            WHERE t.created_date >= :from AND t.created_date < DATEADD(day, 1, :to))
SELECT id AS ticket_id, tracking_number, agent_name, ticket_type, category, status, created_date FROM tk WHERE merchant_id = :business_id AND status = 'Open' ORDER BY created_date DESC;

-- ======== C6. Tickets with a compensation outcome (Free order, Credit, Less Than 300 LE, Rejected compensation, ...)
WITH tk AS (SELECT t.id, t.created_date, t.status, t.agent_name, t.category, t.compensation_type, SPLIT_PART(t.tracking_number, '.', 1) AS tracking_number,
                   COALESCE(NULLIF(t.business_id,''), NULLIF(t.company_business_id,''), NULLIF(t.freshchat_business_id,''), p.merchant_id) AS merchant_id
            FROM public.freshdesk_tickets_enriched t
            LEFT JOIN mart.v_parcel_lifecycle p ON p.tracking_number = TRY_CAST(SPLIT_PART(t.tracking_number, '.', 1) AS BIGINT) AND NVL(t.tracking_number,'') <> ''
            WHERE t.created_date >= :from AND t.created_date < DATEADD(day, 1, :to))
SELECT id AS ticket_id, tracking_number, agent_name, category, compensation_type, status, created_date
FROM tk WHERE merchant_id = :business_id AND NVL(compensation_type,'') <> '' AND compensation_type NOT ILIKE 'not ask for a compensation' ORDER BY created_date DESC;

-- ##################################################################################################
-- PART D. MERCHANTS & CUSTOMERS TAB (public.deliveries_attempts, business_id = merchant). Validated: Trend Hub, Oct 1-4 = 4,480
-- failed attempts: Customer 3,582, Merchant 535, Address/phone data 361, Other 2 (matches the app exactly).
-- The side grouping is derived from the reason wording; it is not a stored field.
-- ##################################################################################################
-- ======== D1. Failed attempts per day
SELECT date::date AS day, COUNT(*) AS failed_attempts
FROM public.deliveries_attempts WHERE business_id = :business_id AND exception_reason IS NOT NULL AND date >= :from AND date < DATEADD(day, 1, :to)
GROUP BY 1 ORDER BY 1;

-- ======== D2. By reason
SELECT exception_reason, COUNT(*) AS failed_attempts
FROM public.deliveries_attempts WHERE business_id = :business_id AND exception_reason IS NOT NULL AND date >= :from AND date < DATEADD(day, 1, :to)
GROUP BY 1 ORDER BY 2 DESC;

-- ======== D3. By side (the grouping the tab uses)
SELECT CASE WHEN LOWER(exception_reason) LIKE 'retry pickup%' OR LOWER(exception_reason) LIKE 'retry return%' OR LOWER(exception_reason) LIKE '%business%'
                 OR LOWER(exception_reason) LIKE '%product issue%' OR LOWER(exception_reason) LIKE '%description / number of items%' OR exception_reason LIKE '%الوصف%' THEN 'Merchant'
            WHEN LOWER(exception_reason) LIKE '%consignee%' OR LOWER(exception_reason) LIKE '%customer%' THEN 'Customer'
            WHEN LOWER(exception_reason) LIKE 'waiting for data modification%' THEN 'Address / phone data'
            ELSE 'Other' END AS side, COUNT(*) AS failed_attempts
FROM public.deliveries_attempts WHERE business_id = :business_id AND exception_reason IS NOT NULL AND date >= :from AND date < DATEADD(day, 1, :to)
GROUP BY 1 ORDER BY 2 DESC;

-- ======== D4. Detail rows (latest first). The tab embeds only the latest 10 per merchant; this returns every attempt.
SELECT trackingnumber AS tracking_number, exception_reason, exception_at, date::date AS attempt_date, star_name, consignee_name
FROM public.deliveries_attempts WHERE business_id = :business_id AND exception_reason IS NOT NULL AND date >= :from AND date < DATEADD(day, 1, :to)
ORDER BY exception_at DESC;

-- ##################################################################################################
-- PART E. HOW THE CURRENT-MONTH DATA IS EMBEDDED (current month only: Oct 1-4; history is deliberately not embedded)
--   Size: 17,165 parcel-issue rows + 8,983 tickets + failed-attempt counts for 3,330 merchants = 0.77 MB compressed.
--   Each pull is restricted to the roster merchants (same ownership CTE as the tracker) and to dates >= first day of the month.
--   To refresh: re-run these with new dates and rebuild the file. The full failed-attempt list (~1M rows by month end) is NOT embedded.
-- ##################################################################################################
-- E1. Parcel issues: UNION ALL of five SELECTs on mart.v_parcel_lifecycle joined to the roster (merchant_id):
--       F  grey_reason_fake_attempt            by grey_date
--       R  rto_initiated_at with total_attempts = 0
--       L  lost_at              D  damaged_at          C  last_compensation_at (full_compensation_amount, last_compensation_reason)
--     each returning tracking_number, the event day, assigned_hub_name, current_hub, pickup_star_id, delivery_star_id,
--     current_star_name, total_attempts, current_status, last_compensation_liability. Rows are packed per merchant with LISTAGG
--     (250 rows per chunk, '|' between fields, '~' between rows) to stay under the 64 KB LISTAGG limit and the 2,000-row result cap.
-- E2. Tickets: the Part C CTE joined to the roster on merchant_id, packed the same way (300 rows per chunk).
-- E3. Failed attempts, per merchant: (a) COUNT(*) by day and reason code, (b) the latest 10 attempts by exception_at.
--     Reason codes are ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, exception_reason) - 1 over all attempts with a reason in the month
--     (25 reasons in October), so the same query run twice gives the same codes.
