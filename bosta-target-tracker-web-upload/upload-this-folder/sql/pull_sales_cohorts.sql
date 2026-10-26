-- Sales cohorts. "New acquisition" = the merchant's FIRST PICKUP date (public.businesses.firstpickuppickedupat); this equals the mart's joining_date
-- (checked on all 786 September first-pickup merchants), NOT the sign-up date (createdat).
--   N = merchants whose first pickup is in the pull window, live owner (public.businesses.sales_manager_name)
--   C = last month's first-pickup merchants, owner as of the END of that month (public.businesses_monthly_snapshot; the snapshot labelled 2026-09-01
--       is taken on Oct 1 = end-of-September state). Churn so far = C merchants with no pickup yet this month.
-- Window options of scripts/render_sql.py: --snapshot (snapshot month), --prev-from / --prev-to (previous month, TO exclusive), --from / --to (current month so far).
-- Output: (kind, sales, business_id, name, first_pickup, picked, delivered, revenue, prev_month_picked)  -> data/sales_rows_fp.json
WITH names AS (SELECT LOWER(TRIM(n)) AS nm FROM (__SALES_UNION__)),
octn AS (SELECT 'N' AS kind, b.business_id, b.name AS bname, b.sales_manager_name AS sm, b.firstpickuppickedupat::date AS fp
         FROM public.businesses b WHERE b.firstpickuppickedupat >= DATE '__FROM__' AND b.firstpickuppickedupat < DATE '__TO__' AND LOWER(TRIM(b.sales_manager_name)) IN (SELECT nm FROM names)),
sepc AS (SELECT 'C' AS kind, s.business_id, s.name AS bname, s.sales_manager_name AS sm, s.firstpickuppickedupat::date AS fp
         FROM public.businesses_monthly_snapshot s WHERE s.snapshot_month = DATE '__SNAPSHOT__' AND s.firstpickuppickedupat >= DATE '__PREV_FROM__' AND s.firstpickuppickedupat < DATE '__PREV_TO__' AND LOWER(TRIM(s.sales_manager_name)) IN (SELECT nm FROM names)),
u AS (SELECT * FROM octn UNION ALL SELECT * FROM sepc),
oct_act AS (SELECT business_id, SUM(NVL(parcels_picked,0)) p, SUM(NVL(parcels_delivered,0)) d, SUM(NVL(delivery_revenue_total,0)) r FROM mart.v_merchant_daily_wide WHERE date >= DATE '__FROM__' AND date < DATE '__TO__' GROUP BY 1),
sep_act AS (SELECT business_id, SUM(NVL(parcels_picked,0)) p FROM mart.v_merchant_monthly_wide WHERE date = DATE '__PREV_FROM__' GROUP BY 1)
SELECT u.kind, u.sm, u.business_id, u.bname, u.fp::varchar AS first_pickup, NVL(a.p,0)::bigint AS oct_picked, NVL(a.d,0)::bigint AS oct_delivered, ROUND(NVL(a.r,0))::bigint AS oct_revenue, NVL(sp.p,0)::bigint AS sep_picked, lpad('', 2500, 'x') AS pad
FROM u LEFT JOIN oct_act a ON a.business_id = u.business_id LEFT JOIN sep_act sp ON sp.business_id = u.business_id
ORDER BY u.kind, u.sm, u.business_id
