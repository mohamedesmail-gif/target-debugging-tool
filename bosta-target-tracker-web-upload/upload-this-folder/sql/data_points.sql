-- =====================================================================================================================
-- Commercial Portal / Target Tracker: one query per data point.
-- Every query is self-contained: edit the `params` line (month_start = first day of the month, as_of = last day with data) and run it.
-- No hardcoded people: account managers and sales managers come from public.commercial_monthly_targets for the month.
-- Source tags:  [MART] mart schema only   [TARGETS] public.commercial_monthly_targets   [NOT MART] a public.* table, no mart equivalent found
-- Run on Redshift through Metabase on Oct 20 (params Oct 1 - Oct 15): section 2 roster 4,883 merchants / 49 AMs; section 7 gives 13 elapsed, 26 in the month, 13 same days
-- last month, 15 calendar days; section 8 gives 70,703 issue rows; section 13 last month's cohort 273, new merchants 124 (the Oct 16 pull had 4,855 / 70,443 / 120: the
-- warehouse has moved since). Section 9 was run on a 40-merchant sample (39 returned). Sections 3, 4, 5, 6, 10, 11 and 12 use the same expressions as the queries that were
-- run for the Oct 15 data, rewritten with readable columns and with the people lists taken from the targets table; those rewrites were not each run again.
-- =====================================================================================================================


-- 1. TARGETS  [TARGETS]  one row per person and target type (pickups, ASP, retention, churn, fresh pickups).
--    Note: sales reps keep their new-pickups target under target_type = 'fresh pickups'; sales 'churn' for Growth / Key holds the raw sheet value (0.81-0.86).
SELECT target_month, employee_name, role, target_type, target_value
FROM public.commercial_monthly_targets
WHERE target_month = DATE '2026-10-01'
ORDER BY role, employee_name, target_type;


-- 2. ROSTER  [MART]  merchant -> account manager, name, segment, sales manager, joining date, last activity.
WITH params AS (SELECT DATE '2026-10-01' AS month_start, DATE '2026-10-15' AS as_of),
owner AS (   -- the merchants of the account managers listed in the targets table, with their CURRENT account manager
  SELECT business_id, account_manager, joining_date FROM (
    SELECT business_id, account_manager, joining_date, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) AS rn
    FROM mart.v_merchant_monthly_wide WHERE date >= DATEADD(month, -4, (SELECT month_start FROM params)))
  WHERE rn = 1 AND account_manager IN (SELECT employee_name FROM public.commercial_monthly_targets
                                       WHERE role = 'Account Manager' AND target_month = (SELECT month_start FROM params))),
nm AS (SELECT business_id, business_name FROM (SELECT business_id, business_name, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) AS rn
        FROM mart.dim_merchant_period WHERE business_name IS NOT NULL AND date >= DATEADD(month, -4, (SELECT month_start FROM params))) WHERE rn = 1),
seg AS (SELECT business_id, segment, sales_manager FROM (SELECT business_id, segment, sales_manager, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) AS rn
        FROM mart.v_merchant_monthly_wide WHERE date >= DATEADD(month, -4, (SELECT month_start FROM params)) AND segment IS NOT NULL) WHERE rn = 1),
la AS (SELECT business_id, MAX(date) AS last_activity FROM mart.v_merchant_daily_wide WHERE date >= DATE_TRUNC('year', (SELECT month_start FROM params)) AND parcels_picked > 0 GROUP BY business_id)
SELECT o.business_id, nm.business_name, o.account_manager, seg.segment, seg.sales_manager, o.joining_date, la.last_activity
FROM owner o LEFT JOIN nm ON nm.business_id = o.business_id LEFT JOIN seg ON seg.business_id = o.business_id LEFT JOIN la ON la.business_id = o.business_id
ORDER BY o.account_manager, o.business_id;


-- 3. MONTHLY METRICS PER MERCHANT  [MART]  one row per merchant and month (January of the year up to month_start).
WITH params AS (SELECT DATE '2026-10-01' AS month_start, DATE '2026-10-15' AS as_of),
owner AS (   -- the merchants of the account managers listed in the targets table, with their CURRENT account manager
  SELECT business_id, account_manager, joining_date FROM (
    SELECT business_id, account_manager, joining_date, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) AS rn
    FROM mart.v_merchant_monthly_wide WHERE date >= DATEADD(month, -4, (SELECT month_start FROM params)))
  WHERE rn = 1 AND account_manager IN (SELECT employee_name FROM public.commercial_monthly_targets
                                       WHERE role = 'Account Manager' AND target_month = (SELECT month_start FROM params)))
SELECT o.business_id, o.account_manager, w.date AS month,
       w.ecomm_pickups, w.fulfillment_pickups, w.box_pickups, w.parcels_picked, w.parcels_delivered,
       w.delivery_revenue_total, w.delivery_revenue_shipping, w.delivery_revenue_vas_total, w.delivery_revenue_vas_extracod,
       w.delivery_revenue_vas_next_day, w.delivery_revenue_vas_insurance, w.delivery_revenue_vas_flexship, w.delivery_revenue_vas_allow_to_open,
       NVL(w.delivery_revenue_vas_materials, 0) + NVL(w.delivery_revenue_vas_materials_delivery, 0) AS delivery_revenue_vas_materials,
       w.delivery_revenue_vas_fulfillment_handling_fees, w.dsr, w.asr, w.dsr_numerator, w.dsr_denominator, w.asr_numerator, w.asr_denominator,
       w.fake_attempts, w.rto_without_attempt, w.parcels_lost, w.parcels_damaged, w.compensation_amount, w.parcels_rto, w.parcels_returned,
       w.parcels_delivered_zone_cairo_giza, w.parcels_delivered_zone_alex_behira, w.parcels_delivered_zone_delta_canal, w.parcels_delivered_zone_near_upper,
       w.parcels_delivered_zone_far_upper_matrouh, w.parcels_delivered_zone_north_coast, w.parcels_delivered_zone_sinai_new_valley, w.parcels_delivered_zone_other
FROM owner o JOIN mart.v_merchant_monthly_wide w ON w.business_id = o.business_id
WHERE w.date >= DATE_TRUNC('year', (SELECT month_start FROM params)) AND w.date <= (SELECT month_start FROM params)
ORDER BY o.business_id, w.date;


-- 4. DAILY METRICS PER MERCHANT  [MART]  one row per merchant and day, from the first day of the previous month to as_of.
WITH params AS (SELECT DATE '2026-10-01' AS month_start, DATE '2026-10-15' AS as_of),
owner AS (   -- the merchants of the account managers listed in the targets table, with their CURRENT account manager
  SELECT business_id, account_manager, joining_date FROM (
    SELECT business_id, account_manager, joining_date, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) AS rn
    FROM mart.v_merchant_monthly_wide WHERE date >= DATEADD(month, -4, (SELECT month_start FROM params)))
  WHERE rn = 1 AND account_manager IN (SELECT employee_name FROM public.commercial_monthly_targets
                                       WHERE role = 'Account Manager' AND target_month = (SELECT month_start FROM params)))
SELECT o.business_id, o.account_manager, w.date AS day,
       w.ecomm_pickups, w.fulfillment_pickups, w.box_pickups, w.parcels_picked, w.parcels_delivered, w.delivery_revenue_total, w.delivery_revenue_vas_total,
       w.dsr_numerator, w.dsr_denominator, w.asr_numerator, w.asr_denominator, w.fake_attempts, w.rto_without_attempt, w.parcels_lost, w.parcels_damaged, w.compensation_amount
FROM owner o JOIN mart.v_merchant_daily_wide w ON w.business_id = o.business_id
WHERE w.date >= DATEADD(month, -1, (SELECT month_start FROM params)) AND w.date <= (SELECT as_of FROM params)
ORDER BY o.business_id, w.date;


-- 5. PORTFOLIO MONTHLY PER ACCOUNT MANAGER  [MART]  sums over the AM's merchants; DSR / ASR = sum of numerators / sum of denominators;
--    active merchants (a pickup in the month), VAS merchants (VAS revenue > 0), new merchants (joining month = month).
WITH params AS (SELECT DATE '2026-10-01' AS month_start, DATE '2026-10-15' AS as_of),
owner AS (   -- the merchants of the account managers listed in the targets table, with their CURRENT account manager
  SELECT business_id, account_manager, joining_date FROM (
    SELECT business_id, account_manager, joining_date, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) AS rn
    FROM mart.v_merchant_monthly_wide WHERE date >= DATEADD(month, -4, (SELECT month_start FROM params)))
  WHERE rn = 1 AND account_manager IN (SELECT employee_name FROM public.commercial_monthly_targets
                                       WHERE role = 'Account Manager' AND target_month = (SELECT month_start FROM params)))
SELECT o.account_manager, w.date AS month,
       SUM(NVL(w.ecomm_pickups, 0)) AS ecomm_pickups,
       SUM(NVL(w.fulfillment_pickups, 0)) AS fulfillment_pickups,
       SUM(NVL(w.box_pickups, 0)) AS box_pickups,
       SUM(NVL(w.parcels_picked, 0)) AS parcels_picked,
       SUM(NVL(w.parcels_delivered, 0)) AS parcels_delivered,
       SUM(NVL(w.delivery_revenue_total, 0)) AS delivery_revenue_total,
       SUM(NVL(w.delivery_revenue_shipping, 0)) AS delivery_revenue_shipping,
       SUM(NVL(w.delivery_revenue_vas_total, 0)) AS delivery_revenue_vas_total,
       SUM(NVL(w.delivery_revenue_vas_extracod, 0)) AS delivery_revenue_vas_extracod,
       SUM(NVL(w.delivery_revenue_vas_next_day, 0)) AS delivery_revenue_vas_next_day,
       SUM(NVL(w.delivery_revenue_vas_insurance, 0)) AS delivery_revenue_vas_insurance,
       SUM(NVL(w.delivery_revenue_vas_flexship, 0)) AS delivery_revenue_vas_flexship,
       SUM(NVL(w.delivery_revenue_vas_allow_to_open, 0)) AS delivery_revenue_vas_allow_to_open,
       SUM(NVL(w.delivery_revenue_vas_fulfillment_handling_fees, 0)) AS delivery_revenue_vas_fulfillment_handling_fees,
       SUM(NVL(w.fake_attempts, 0)) AS fake_attempts,
       SUM(NVL(w.rto_without_attempt, 0)) AS rto_without_attempt,
       SUM(NVL(w.parcels_lost, 0)) AS parcels_lost,
       SUM(NVL(w.parcels_damaged, 0)) AS parcels_damaged,
       SUM(NVL(w.compensation_amount, 0)) AS compensation_amount,
       SUM(NVL(w.parcels_rto, 0)) AS parcels_rto,
       SUM(NVL(w.parcels_returned, 0)) AS parcels_returned,
       SUM(NVL(w.parcels_delivered_zone_cairo_giza, 0)) AS parcels_delivered_zone_cairo_giza,
       SUM(NVL(w.parcels_delivered_zone_alex_behira, 0)) AS parcels_delivered_zone_alex_behira,
       SUM(NVL(w.parcels_delivered_zone_delta_canal, 0)) AS parcels_delivered_zone_delta_canal,
       SUM(NVL(w.parcels_delivered_zone_near_upper, 0)) AS parcels_delivered_zone_near_upper,
       SUM(NVL(w.parcels_delivered_zone_far_upper_matrouh, 0)) AS parcels_delivered_zone_far_upper_matrouh,
       SUM(NVL(w.parcels_delivered_zone_north_coast, 0)) AS parcels_delivered_zone_north_coast,
       SUM(NVL(w.parcels_delivered_zone_sinai_new_valley, 0)) AS parcels_delivered_zone_sinai_new_valley,
       SUM(NVL(w.parcels_delivered_zone_other, 0)) AS parcels_delivered_zone_other,
       SUM(NVL(w.delivery_revenue_vas_materials, 0) + NVL(w.delivery_revenue_vas_materials_delivery, 0)) AS delivery_revenue_vas_materials,
       SUM(w.dsr_numerator)::float / NULLIF(SUM(w.dsr_denominator), 0) AS dsr,
       SUM(w.asr_numerator)::float / NULLIF(SUM(w.asr_denominator), 0) AS asr,
       COUNT(DISTINCT CASE WHEN w.parcels_picked > 0 THEN o.business_id END) AS active_merchants,
       COUNT(DISTINCT CASE WHEN w.delivery_revenue_vas_total > 0 THEN o.business_id END) AS vas_merchants,
       COUNT(DISTINCT CASE WHEN DATE_TRUNC('month', o.joining_date) = w.date THEN o.business_id END) AS new_merchants
FROM owner o JOIN mart.v_merchant_monthly_wide w ON w.business_id = o.business_id
WHERE w.date >= DATE_TRUNC('year', (SELECT month_start FROM params)) AND w.date <= (SELECT month_start FROM params)
GROUP BY o.account_manager, w.date
ORDER BY o.account_manager, w.date;


-- 6. PORTFOLIO DAILY PER ACCOUNT MANAGER  [MART]  sums per day and number of merchants with a pickup that day.
WITH params AS (SELECT DATE '2026-10-01' AS month_start, DATE '2026-10-15' AS as_of),
owner AS (   -- the merchants of the account managers listed in the targets table, with their CURRENT account manager
  SELECT business_id, account_manager, joining_date FROM (
    SELECT business_id, account_manager, joining_date, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) AS rn
    FROM mart.v_merchant_monthly_wide WHERE date >= DATEADD(month, -4, (SELECT month_start FROM params)))
  WHERE rn = 1 AND account_manager IN (SELECT employee_name FROM public.commercial_monthly_targets
                                       WHERE role = 'Account Manager' AND target_month = (SELECT month_start FROM params)))
SELECT o.account_manager, w.date AS day,
       SUM(NVL(w.ecomm_pickups, 0)) AS ecomm_pickups,
       SUM(NVL(w.fulfillment_pickups, 0)) AS fulfillment_pickups,
       SUM(NVL(w.box_pickups, 0)) AS box_pickups,
       SUM(NVL(w.parcels_picked, 0)) AS parcels_picked,
       SUM(NVL(w.parcels_delivered, 0)) AS parcels_delivered,
       SUM(NVL(w.delivery_revenue_total, 0)) AS delivery_revenue_total,
       SUM(NVL(w.delivery_revenue_vas_total, 0)) AS delivery_revenue_vas_total,
       SUM(NVL(w.dsr_numerator, 0)) AS dsr_numerator,
       SUM(NVL(w.dsr_denominator, 0)) AS dsr_denominator,
       SUM(NVL(w.asr_numerator, 0)) AS asr_numerator,
       SUM(NVL(w.asr_denominator, 0)) AS asr_denominator,
       SUM(NVL(w.fake_attempts, 0)) AS fake_attempts,
       SUM(NVL(w.rto_without_attempt, 0)) AS rto_without_attempt,
       SUM(NVL(w.parcels_lost, 0)) AS parcels_lost,
       SUM(NVL(w.parcels_damaged, 0)) AS parcels_damaged,
       SUM(NVL(w.compensation_amount, 0)) AS compensation_amount,
       COUNT(DISTINCT CASE WHEN w.parcels_picked > 0 THEN o.business_id END) AS active_merchants
FROM owner o JOIN mart.v_merchant_daily_wide w ON w.business_id = o.business_id
WHERE w.date >= DATEADD(month, -1, (SELECT month_start FROM params)) AND w.date <= (SELECT as_of FROM params)
GROUP BY o.account_manager, w.date
ORDER BY o.account_manager, w.date;


-- 7. WORKING DAYS  [MART]  Fridays are not working days. elapsed = month_start..as_of, full = the whole month, same_days_last_month = the same N days of the previous month.
WITH params AS (SELECT DATE '2026-10-01' AS month_start, DATE '2026-10-15' AS as_of)
SELECT (SELECT COUNT(*) FROM mart.v_bosta_calendar WHERE date BETWEEN (SELECT month_start FROM params) AND (SELECT as_of FROM params) AND EXTRACT(dow FROM date) <> 5) AS elapsed,
       (SELECT COUNT(*) FROM mart.v_bosta_calendar WHERE date >= (SELECT month_start FROM params) AND date < DATEADD(month, 1, (SELECT month_start FROM params)) AND EXTRACT(dow FROM date) <> 5) AS full_month,
       (SELECT COUNT(*) FROM mart.v_bosta_calendar WHERE date BETWEEN DATEADD(month, -1, (SELECT month_start FROM params)) AND DATEADD(day, DATEDIFF(day, (SELECT month_start FROM params), (SELECT as_of FROM params)), DATEADD(month, -1, (SELECT month_start FROM params))) AND EXTRACT(dow FROM date) <> 5) AS same_days_last_month,
       DATEDIFF(day, (SELECT month_start FROM params), (SELECT as_of FROM params)) + 1 AS calendar_days_elapsed;


-- 8. PARCEL ISSUES OF THE MONTH  [MART]  fake attempts (F), RTO without attempt (R), lost (L), damaged (D), compensated (C), with hubs / stars / liability / amount.
WITH params AS (SELECT DATE '2026-10-01' AS month_start, DATE '2026-10-15' AS as_of),
owner AS (   -- the merchants of the account managers listed in the targets table, with their CURRENT account manager
  SELECT business_id, account_manager, joining_date FROM (
    SELECT business_id, account_manager, joining_date, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) AS rn
    FROM mart.v_merchant_monthly_wide WHERE date >= DATEADD(month, -4, (SELECT month_start FROM params)))
  WHERE rn = 1 AND account_manager IN (SELECT employee_name FROM public.commercial_monthly_targets
                                       WHERE role = 'Account Manager' AND target_month = (SELECT month_start FROM params)))
SELECT * FROM (
  SELECT p.merchant_id, 'F' AS issue, p.tracking_number, p.grey_date AS issue_date, p.assigned_hub_name, p.current_hub, p.pickup_star_id, p.delivery_star_id, p.current_star_name, NVL(p.total_attempts, 0) AS attempts, p.current_status, NULL::varchar AS liability, NULL::float AS amount, NULL::varchar AS reason
  FROM mart.v_parcel_lifecycle p JOIN owner o ON o.business_id = p.merchant_id WHERE p.grey_reason_fake_attempt AND p.grey_date >= (SELECT month_start FROM params) AND p.grey_date < DATEADD(day, 1, (SELECT as_of FROM params))
  UNION ALL
  SELECT p.merchant_id, 'R', p.tracking_number, p.rto_initiated_at, p.assigned_hub_name, p.current_hub, p.pickup_star_id, p.delivery_star_id, p.current_star_name, 0, p.current_status, NULL, NULL, NULL
  FROM mart.v_parcel_lifecycle p JOIN owner o ON o.business_id = p.merchant_id WHERE p.rto_initiated_at >= (SELECT month_start FROM params) AND p.rto_initiated_at < DATEADD(day, 1, (SELECT as_of FROM params)) AND NVL(p.total_attempts, 0) = 0
  UNION ALL
  SELECT p.merchant_id, 'L', p.tracking_number, p.lost_at, p.assigned_hub_name, p.current_hub, p.pickup_star_id, p.delivery_star_id, p.current_star_name, NVL(p.total_attempts, 0), p.current_status, p.last_compensation_liability, p.full_compensation_amount, NULL
  FROM mart.v_parcel_lifecycle p JOIN owner o ON o.business_id = p.merchant_id WHERE p.lost_at >= (SELECT month_start FROM params) AND p.lost_at < DATEADD(day, 1, (SELECT as_of FROM params))
  UNION ALL
  SELECT p.merchant_id, 'D', p.tracking_number, p.damaged_at, p.assigned_hub_name, p.current_hub, p.pickup_star_id, p.delivery_star_id, p.current_star_name, NVL(p.total_attempts, 0), p.current_status, p.last_compensation_liability, p.full_compensation_amount, NULL
  FROM mart.v_parcel_lifecycle p JOIN owner o ON o.business_id = p.merchant_id WHERE p.damaged_at >= (SELECT month_start FROM params) AND p.damaged_at < DATEADD(day, 1, (SELECT as_of FROM params))
  UNION ALL
  SELECT p.merchant_id, 'C', p.tracking_number, p.last_compensation_at, p.assigned_hub_name, p.current_hub, p.pickup_star_id, p.delivery_star_id, p.current_star_name, NVL(p.total_attempts, 0), p.current_status, p.last_compensation_liability, p.full_compensation_amount, p.last_compensation_reason
  FROM mart.v_parcel_lifecycle p JOIN owner o ON o.business_id = p.merchant_id WHERE p.last_compensation_at >= (SELECT month_start FROM params) AND p.last_compensation_at < DATEADD(day, 1, (SELECT as_of FROM params))
) ORDER BY merchant_id, issue, tracking_number;


-- 9. CREATION SOURCE AND PICKUP LOCATIONS  [MART]  parcels created in the last 90 days: dominant creation source, its % share, the two main "city / zone" pairs.
--    The 90-day rule is a definition made for the portal (the earlier values were copied from an old store with an unknown window).
WITH params AS (SELECT DATE '2026-10-01' AS month_start, DATE '2026-10-15' AS as_of),
owner AS (   -- the merchants of the account managers listed in the targets table, with their CURRENT account manager
  SELECT business_id, account_manager, joining_date FROM (
    SELECT business_id, account_manager, joining_date, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) AS rn
    FROM mart.v_merchant_monthly_wide WHERE date >= DATEADD(month, -4, (SELECT month_start FROM params)))
  WHERE rn = 1 AND account_manager IN (SELECT employee_name FROM public.commercial_monthly_targets
                                       WHERE role = 'Account Manager' AND target_month = (SELECT month_start FROM params))),
p AS (SELECT l.merchant_id, NVL(l.creation_source, 'null') AS cs, l.pickup_city || ' / ' || NVL(l.pickup_zone, 'None') AS loc
      FROM mart.v_parcel_lifecycle l JOIN owner o ON o.business_id = l.merchant_id WHERE l.created_at >= DATEADD(day, -90, (SELECT as_of FROM params))),
s AS (SELECT merchant_id, cs, COUNT(*) AS n, ROW_NUMBER() OVER (PARTITION BY merchant_id ORDER BY COUNT(*) DESC, cs) AS rk, SUM(COUNT(*)) OVER (PARTITION BY merchant_id) AS tot FROM p GROUP BY merchant_id, cs),
l2 AS (SELECT merchant_id, loc, ROW_NUMBER() OVER (PARTITION BY merchant_id ORDER BY COUNT(*) DESC, loc) AS rk FROM p GROUP BY merchant_id, loc),
ll AS (SELECT merchant_id, LISTAGG(loc, '|') WITHIN GROUP (ORDER BY rk) AS locations FROM l2 WHERE rk <= 2 GROUP BY merchant_id)
SELECT s.merchant_id, s.cs AS creation_source, ROUND(100.0 * s.n / s.tot)::int AS source_pct, ll.locations
FROM s JOIN ll ON ll.merchant_id = s.merchant_id WHERE s.rk = 1 ORDER BY 1;


-- 10. WEBSITE, PARENT ACCOUNT, SUB-ACCOUNTS  [NOT MART]  public.businesses and public.business_invitations (no website / sub-account column found in the mart).
--     A sub-account is the sub_business_id of an ACCEPTED invitation (the latest wins); a parent is a business that has accepted sub-accounts.
WITH params AS (SELECT DATE '2026-10-01' AS month_start, DATE '2026-10-15' AS as_of),
owner AS (   -- the merchants of the account managers listed in the targets table, with their CURRENT account manager
  SELECT business_id, account_manager, joining_date FROM (
    SELECT business_id, account_manager, joining_date, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) AS rn
    FROM mart.v_merchant_monthly_wide WHERE date >= DATEADD(month, -4, (SELECT month_start FROM params)))
  WHERE rn = 1 AND account_manager IN (SELECT employee_name FROM public.commercial_monthly_targets
                                       WHERE role = 'Account Manager' AND target_month = (SELECT month_start FROM params))),
subp AS (SELECT sub_business_id, business_id AS parent_id, business_name AS parent_name, ROW_NUMBER() OVER (PARTITION BY sub_business_id ORDER BY updatedat DESC) AS rn
         FROM public.business_invitations WHERE status = 'accepted'),
kids AS (SELECT business_id, COUNT(DISTINCT sub_business_id) AS n_sub_accounts FROM public.business_invitations WHERE status = 'accepted' GROUP BY business_id)
SELECT o.business_id, LEFT(b.website, 160) AS website, sp.parent_id, sp.parent_name, k.n_sub_accounts
FROM owner o LEFT JOIN public.businesses b ON b.business_id = o.business_id
LEFT JOIN subp sp ON sp.sub_business_id = o.business_id AND sp.rn = 1 LEFT JOIN kids k ON k.business_id = o.business_id
ORDER BY o.business_id;


-- 11. SUPPORT TICKETS OF THE MONTH  [NOT MART]  public.freshdesk_tickets_enriched. The merchant is the first non-empty of business_id, company_business_id,
--     freshchat_business_id, or the merchant of the ticket's tracking number (through mart.v_parcel_lifecycle).
WITH params AS (SELECT DATE '2026-10-01' AS month_start, DATE '2026-10-15' AS as_of),
owner AS (   -- the merchants of the account managers listed in the targets table, with their CURRENT account manager
  SELECT business_id, account_manager, joining_date FROM (
    SELECT business_id, account_manager, joining_date, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) AS rn
    FROM mart.v_merchant_monthly_wide WHERE date >= DATEADD(month, -4, (SELECT month_start FROM params)))
  WHERE rn = 1 AND account_manager IN (SELECT employee_name FROM public.commercial_monthly_targets
                                       WHERE role = 'Account Manager' AND target_month = (SELECT month_start FROM params))),
tk AS (SELECT t.id, t.created_date, t.status, t.agent_name, t.ticket_type, t.category, t.sub_category, SPLIT_PART(t.tracking_number, '.', 1) AS tracking_number, t.compensation_type,
              COALESCE(NULLIF(t.business_id, ''), NULLIF(t.company_business_id, ''), NULLIF(t.freshchat_business_id, ''), p.merchant_id) AS merchant_id
       FROM public.freshdesk_tickets_enriched t
       LEFT JOIN mart.v_parcel_lifecycle p ON p.tracking_number = TRY_CAST(SPLIT_PART(t.tracking_number, '.', 1) AS BIGINT) AND NVL(t.tracking_number, '') <> ''
       WHERE t.created_date >= (SELECT month_start FROM params) AND t.created_date < DATEADD(day, 1, (SELECT as_of FROM params)))
SELECT k.merchant_id, k.id AS ticket_id, k.created_date, k.status, k.agent_name, k.ticket_type, k.category, k.sub_category, k.tracking_number, k.compensation_type
FROM tk k JOIN owner o ON o.business_id = k.merchant_id
ORDER BY k.merchant_id, k.id;


-- 12. FAILED DELIVERY ATTEMPTS BY REASON  [NOT MART]  public.deliveries_attempts (the mart only has attempt totals).
-- 12a. reasons of the month, most frequent first (the app numbers them 0, 1, 2 ... in this order)
WITH params AS (SELECT DATE '2026-10-01' AS month_start, DATE '2026-10-15' AS as_of)
SELECT ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, exception_reason) - 1 AS code, exception_reason, COUNT(*) AS attempts
FROM public.deliveries_attempts
WHERE date >= (SELECT month_start FROM params) AND date < DATEADD(day, 1, (SELECT as_of FROM params)) AND exception_reason IS NOT NULL
GROUP BY exception_reason ORDER BY 1;

-- 12b. attempts per merchant, day and reason
WITH params AS (SELECT DATE '2026-10-01' AS month_start, DATE '2026-10-15' AS as_of),
owner AS (   -- the merchants of the account managers listed in the targets table, with their CURRENT account manager
  SELECT business_id, account_manager, joining_date FROM (
    SELECT business_id, account_manager, joining_date, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) AS rn
    FROM mart.v_merchant_monthly_wide WHERE date >= DATEADD(month, -4, (SELECT month_start FROM params)))
  WHERE rn = 1 AND account_manager IN (SELECT employee_name FROM public.commercial_monthly_targets
                                       WHERE role = 'Account Manager' AND target_month = (SELECT month_start FROM params)))
SELECT x.business_id AS merchant_id, x.date AS day, x.exception_reason, COUNT(*) AS attempts
FROM public.deliveries_attempts x JOIN owner o ON o.business_id = x.business_id
WHERE x.date >= (SELECT month_start FROM params) AND x.date < DATEADD(day, 1, (SELECT as_of FROM params)) AND x.exception_reason IS NOT NULL
GROUP BY x.business_id, x.date, x.exception_reason ORDER BY 1, 2, 3;

-- 12c. the latest 10 failed attempts per merchant
WITH params AS (SELECT DATE '2026-10-01' AS month_start, DATE '2026-10-15' AS as_of),
owner AS (   -- the merchants of the account managers listed in the targets table, with their CURRENT account manager
  SELECT business_id, account_manager, joining_date FROM (
    SELECT business_id, account_manager, joining_date, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) AS rn
    FROM mart.v_merchant_monthly_wide WHERE date >= DATEADD(month, -4, (SELECT month_start FROM params)))
  WHERE rn = 1 AND account_manager IN (SELECT employee_name FROM public.commercial_monthly_targets
                                       WHERE role = 'Account Manager' AND target_month = (SELECT month_start FROM params))),
a AS (SELECT x.business_id AS merchant_id, x.trackingnumber, x.date, x.exception_reason, x.exception_at,
             ROW_NUMBER() OVER (PARTITION BY x.business_id ORDER BY x.exception_at DESC NULLS LAST, x.trackingnumber) AS rk
      FROM public.deliveries_attempts x JOIN owner o ON o.business_id = x.business_id
      WHERE x.date >= (SELECT month_start FROM params) AND x.date < DATEADD(day, 1, (SELECT as_of FROM params)) AND x.exception_reason IS NOT NULL)
SELECT merchant_id, trackingnumber, date, exception_reason, exception_at FROM a WHERE rk <= 10 ORDER BY merchant_id, rk;


-- 13. SALES: NEW MERCHANTS AND LAST MONTH'S COHORT  [NOT MART]  public.businesses / public.businesses_monthly_snapshot.
--     New = first pickup this month (kind N); cohort = first pickup last month (kind C), with this month's pickups so far and last month's pickups.
--     (mart.v_merchant_monthly_wide has sales_manager and joining_date and could replace these tables, but that has not been checked.)
WITH params AS (SELECT DATE '2026-10-01' AS month_start, DATE '2026-10-15' AS as_of),
sales_names AS (SELECT LOWER(TRIM(employee_name)) AS nm FROM public.commercial_monthly_targets
                  WHERE role = 'Sales Manager' AND target_month = (SELECT month_start FROM params) GROUP BY 1),
octn AS (SELECT 'N' AS kind, b.business_id, b.name AS business_name, b.sales_manager_name AS sales_manager, b.firstpickuppickedupat::date AS first_pickup
         FROM public.businesses b
         WHERE b.firstpickuppickedupat >= (SELECT month_start FROM params) AND b.firstpickuppickedupat < DATEADD(day, 1, (SELECT as_of FROM params))
           AND LOWER(TRIM(b.sales_manager_name)) IN (SELECT nm FROM sales_names)),
sepc AS (SELECT 'C' AS kind, s.business_id, s.name, s.sales_manager_name, s.firstpickuppickedupat::date
         FROM public.businesses_monthly_snapshot s
         WHERE s.snapshot_month = DATEADD(month, -1, (SELECT month_start FROM params))
           AND s.firstpickuppickedupat >= DATEADD(month, -1, (SELECT month_start FROM params)) AND s.firstpickuppickedupat < (SELECT month_start FROM params)
           AND LOWER(TRIM(s.sales_manager_name)) IN (SELECT nm FROM sales_names)),
u AS (SELECT * FROM octn UNION ALL SELECT * FROM sepc),
cur AS (SELECT business_id, SUM(NVL(parcels_picked, 0)) AS picked, SUM(NVL(parcels_delivered, 0)) AS delivered, SUM(NVL(delivery_revenue_total, 0)) AS revenue
        FROM mart.v_merchant_daily_wide WHERE date >= (SELECT month_start FROM params) AND date <= (SELECT as_of FROM params) GROUP BY 1),
prev AS (SELECT business_id, SUM(NVL(parcels_picked, 0)) AS picked FROM mart.v_merchant_monthly_wide WHERE date = DATEADD(month, -1, (SELECT month_start FROM params)) GROUP BY 1)
SELECT u.kind, u.sales_manager, u.business_id, u.business_name, u.first_pickup, NVL(c.picked, 0) AS picked_this_month, NVL(c.delivered, 0) AS delivered_this_month,
       ROUND(NVL(c.revenue, 0)) AS revenue_this_month, NVL(pv.picked, 0) AS picked_last_month
FROM u LEFT JOIN cur c ON c.business_id = u.business_id LEFT JOIN prev pv ON pv.business_id = u.business_id
ORDER BY u.kind, u.sales_manager, u.business_id;
