-- Sales cohorts. "New acquisition" = the merchant's FIRST PICKUP date (public.businesses.firstpickuppickedupat); this equals the mart's joining_date
-- (checked on all 786 September first-pickup merchants), NOT the sign-up date (createdat).
--   N = merchants whose first pickup is in the NEW-MERCHANT WINDOW of the reporting month = from the 25th of last month up to (not including) the 25th of this month,
--       live owner (public.businesses.sales_manager_name). Their pickups / delivered / revenue are summed from the start of their window (__NEW_FROM__) to __TO__ (exclusive), not from the 1st of the month.
--   C = last month's new merchants (first pickup in the PREVIOUS window: 25th of two months ago up to the 25th of last month), owner as of the END of last month (public.businesses_monthly_snapshot; the snapshot labelled 2026-09-01
--       is taken on Oct 1 = end-of-September state). Churn so far = C merchants with no pickup yet this month.
-- Window options of scripts/render_sql.py: --snapshot (first day of last month), --new-from / --new-to (this month's window, TO exclusive), --prev-from / --prev-to (previous window, TO exclusive), --from / --to (calendar month so far: activity of last month's new merchants; this month's new merchants count from --new-from).
-- R = reactivations of the sales rep's merchants (see the reac CTE; last-month column = 0 for them: no pickup in the previous window). Their numbers count in the sales rep's new pickups, ASP and fresh sales.
-- Output: (kind, sales, business_id, name, first_pickup, picked, delivered, revenue, prev_month_picked)  -> data/sales_rows_fp.json
WITH names AS (SELECT LOWER(TRIM(n)) AS nm FROM (__SALES_UNION__)),
octn AS (SELECT 'N' AS kind, b.business_id, b.name AS bname, b.sales_manager_name AS sm, b.firstpickuppickedupat::date AS fp
         FROM public.businesses b WHERE b.firstpickuppickedupat >= DATE '__NEW_FROM__' AND b.firstpickuppickedupat < DATE '__NEW_TO__' AND LOWER(TRIM(b.sales_manager_name)) IN (SELECT nm FROM names)),
sepc AS (SELECT 'C' AS kind, s.business_id, s.name AS bname, s.sales_manager_name AS sm, s.firstpickuppickedupat::date AS fp
         FROM public.businesses_monthly_snapshot s WHERE s.snapshot_month = DATE '__SNAPSHOT__' AND s.firstpickuppickedupat >= DATE '__PREV_FROM__' AND s.firstpickuppickedupat < DATE '__PREV_TO__' AND LOWER(TRIM(s.sales_manager_name)) IN (SELECT nm FROM names)),
u0 AS (SELECT * FROM octn UNION ALL SELECT * FROM sepc),
oct_act AS (SELECT business_id, SUM(NVL(parcels_picked,0)) p, SUM(NVL(parcels_delivered,0)) d, SUM(NVL(delivery_revenue_total,0)) r FROM mart.v_merchant_daily_wide WHERE date >= DATE '__FROM__' AND date < DATE '__TO__' GROUP BY 1),
new_act AS (SELECT business_id, SUM(NVL(parcels_picked,0)) p, SUM(NVL(parcels_delivered,0)) d, SUM(NVL(delivery_revenue_total,0)) r FROM mart.v_merchant_daily_wide WHERE date >= DATE '__NEW_FROM__' AND date < DATE '__TO__' GROUP BY 1),
sep_act AS (SELECT business_id, SUM(NVL(parcels_picked,0)) p FROM mart.v_merchant_monthly_wide WHERE date = DATE '__SNAPSHOT__' GROUP BY 1),
-- R = reactivations, on the same 25th-to-25th months as new merchants: live owner = the sales rep, first pickup before the previous window (__PREV_FROM__),
--     no pickup in the previous window (__PREV_FROM__ .. __NEW_FROM__), pickups since __NEW_FROM__. Not already N or C. Their activity counts from __NEW_FROM__.
pw_act AS (SELECT business_id, SUM(NVL(parcels_picked,0)) p FROM mart.v_merchant_daily_wide WHERE date >= DATE '__PREV_FROM__' AND date < DATE '__NEW_FROM__' GROUP BY 1),
reac AS (SELECT 'R' AS kind, b.business_id, b.name AS bname, b.sales_manager_name AS sm, b.firstpickuppickedupat::date AS fp
         FROM public.businesses b JOIN new_act na ON na.business_id = b.business_id AND na.p > 0 LEFT JOIN pw_act pw ON pw.business_id = b.business_id
         WHERE b.firstpickuppickedupat < DATE '__PREV_FROM__' AND NVL(pw.p,0) = 0 AND LOWER(TRIM(b.sales_manager_name)) IN (SELECT nm FROM names)
           AND b.business_id NOT IN (SELECT business_id FROM u0)),
u AS (SELECT * FROM u0 UNION ALL SELECT * FROM reac)
SELECT u.kind, u.sm, u.business_id, u.bname, u.fp::varchar AS first_pickup, CASE WHEN u.kind IN ('N','R') THEN NVL(na.p,0) ELSE NVL(a.p,0) END::bigint AS oct_picked, CASE WHEN u.kind IN ('N','R') THEN NVL(na.d,0) ELSE NVL(a.d,0) END::bigint AS oct_delivered, ROUND(CASE WHEN u.kind IN ('N','R') THEN NVL(na.r,0) ELSE NVL(a.r,0) END)::bigint AS oct_revenue, CASE WHEN u.kind = 'R' THEN 0 ELSE NVL(sp.p,0) END::bigint AS sep_picked, lpad('', 2500, 'x') AS pad
FROM u LEFT JOIN oct_act a ON a.business_id = u.business_id LEFT JOIN new_act na ON na.business_id = u.business_id LEFT JOIN sep_act sp ON sp.business_id = u.business_id
ORDER BY u.kind, u.sm, u.business_id
