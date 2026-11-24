-- Roster pull, one row per merchant: identity, segment, joining (= first pickup) date, last activity, the monthly pack (Jan to the current month, 32 fields),
-- the daily pack (16 fields per day, incl. DSR/ASR numerators and denominators) and the website / sub-account metadata.
-- Page the roster with --limit 1000 --offset 0, 1000, 2000 ... ; the daily window is --from .. --to (BOTH inclusive here).
-- Portfolio (scope 'am'): the account manager comes from public.businesses.account_manager_name (today's owner), for the AMs of the targets table,
--   when the merchant's segment is one of the five target segments or empty (an empty segment later takes the AM's team segment).
-- VP extra (scope 'vp'): merchants with at least one pickup this month (__CUR0__ .. __TO__; for a new or reactivated merchant since __NEW_FROM__) whose segment is Box, another segment outside the five,
--   or empty without a target AM. They are shown in the VP view only.
-- Output columns: business_id, business_name, account_manager, segment, joining_date, last_activity, mpack, dpack, website, parent_id, parent_name, n_subs, scope
-- Sub-account = sub_business_id of an ACCEPTED invitation (latest wins); parent = has accepted sub-accounts.
WITH bz AS (SELECT business_id, NULLIF(NULLIF(TRIM(account_manager_name), ''), 'None') AS am, firstpickuppickedupat FROM public.businesses WHERE account_type = 'merchant'),
seg AS (SELECT business_id, segment FROM (SELECT business_id, segment, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) rn FROM mart.v_merchant_monthly_wide WHERE date >= DATE '__OWNER_SINCE__' AND segment IS NOT NULL) WHERE rn=1),
jd AS (SELECT business_id, joining_date FROM (SELECT business_id, joining_date, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) rn FROM mart.v_merchant_monthly_wide WHERE date >= DATE '2026-01-01' AND joining_date IS NOT NULL) WHERE rn=1),
cur AS (SELECT w.business_id FROM mart.v_merchant_daily_wide w LEFT JOIN bz ON bz.business_id = w.business_id
             WHERE w.date BETWEEN DATE '__PREV_FROM__' AND DATE '__TO__'
             GROUP BY 1
             HAVING SUM(CASE WHEN w.date >= DATE '__CUR0__' THEN NVL(w.parcels_picked,0) ELSE 0 END) > 0                    -- active this month
                 OR (SUM(CASE WHEN w.date >= DATE '__NEW_FROM__' THEN NVL(w.parcels_picked,0) ELSE 0 END) > 0             -- or, since the 25th of last month:
                     AND (MAX(bz.firstpickuppickedupat) >= DATE '__NEW_FROM__'                                                 --   a new merchant
                          OR (MAX(bz.firstpickuppickedupat) < DATE '__PREV_FROM__'                                             --   or a reactivation (nothing in the previous window)
                              AND SUM(CASE WHEN w.date < DATE '__NEW_FROM__' THEN NVL(w.parcels_picked,0) ELSE 0 END) = 0)))),
pool AS (
  SELECT bz.business_id, bz.am AS account_manager, 'am' AS scope FROM bz LEFT JOIN seg ON seg.business_id = bz.business_id
  WHERE bz.am IN (__AM_LIST__) AND (seg.segment IS NULL OR seg.segment IN ('Key-Account','Growth-Fashion','Growth-Cosmetics','Growth-General-Trade','Startups'))
  UNION ALL
  SELECT c.business_id, bz.am, 'vp' FROM cur c LEFT JOIN bz ON bz.business_id = c.business_id LEFT JOIN seg ON seg.business_id = c.business_id
  WHERE (seg.segment IS NULL OR seg.segment NOT IN ('Key-Account','Growth-Fashion','Growth-Cosmetics','Growth-General-Trade','Startups'))
    AND NOT (NVL(bz.am, '') IN (__AM_LIST__) AND seg.segment IS NULL)),
owner AS (SELECT p.business_id, p.account_manager, p.scope, NVL(jd.joining_date, bz.firstpickuppickedupat::date) AS joining_date FROM pool p LEFT JOIN jd ON jd.business_id = p.business_id LEFT JOIN bz ON bz.business_id = p.business_id),
nm AS (SELECT business_id, business_name FROM (SELECT business_id, business_name, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) rn FROM mart.dim_merchant_period WHERE business_name IS NOT NULL AND date >= DATE '__OWNER_SINCE__') WHERE rn=1),
la AS (SELECT business_id, MAX(date) AS last_activity FROM mart.v_merchant_daily_wide WHERE date >= DATE '2026-01-01' AND parcels_picked > 0 GROUP BY business_id),
page AS (SELECT business_id, account_manager, joining_date, scope FROM owner ORDER BY business_id LIMIT __LIMIT__ OFFSET __OFFSET__),
months AS (SELECT date AS d FROM mart.v_bosta_calendar WHERE EXTRACT(day FROM date) = 1 AND date BETWEEN DATE '2026-01-01' AND DATE '__CUR0__'),
days AS (SELECT date AS d FROM mart.v_bosta_calendar WHERE date BETWEEN DATE '__FROM__' AND DATE '__TO__'),
mp AS (SELECT p.business_id, LISTAGG(ROUND(NVL(w.ecomm_pickups,0))::bigint::varchar||','||ROUND(NVL(w.fulfillment_pickups,0))::bigint::varchar||','||ROUND(NVL(w.box_pickups,0))::bigint::varchar||','||ROUND(NVL(w.parcels_picked,0))::bigint::varchar||','||ROUND(NVL(w.parcels_delivered,0))::bigint::varchar||','||ROUND(NVL(w.delivery_revenue_total,0))::bigint::varchar||','||ROUND(NVL(w.delivery_revenue_shipping,0))::bigint::varchar||','||ROUND(NVL(w.delivery_revenue_vas_total,0))::bigint::varchar||','||ROUND(NVL(w.delivery_revenue_vas_extracod,0))::bigint::varchar||','||ROUND(NVL(w.delivery_revenue_vas_next_day,0))::bigint::varchar||','||ROUND(NVL(w.delivery_revenue_vas_insurance,0))::bigint::varchar||','||ROUND(NVL(w.delivery_revenue_vas_flexship,0))::bigint::varchar||','||ROUND(NVL(w.delivery_revenue_vas_allow_to_open,0))::bigint::varchar||','||ROUND(NVL((NVL(w.delivery_revenue_vas_materials,0)+NVL(w.delivery_revenue_vas_materials_delivery,0)),0))::bigint::varchar||','||ROUND(NVL(w.delivery_revenue_vas_fulfillment_handling_fees,0))::bigint::varchar||','||CASE WHEN w.dsr IS NULL THEN '-1' ELSE ROUND(w.dsr*10000)::bigint::varchar END||','||CASE WHEN w.asr IS NULL THEN '-1' ELSE ROUND(w.asr*10000)::bigint::varchar END||','||ROUND(NVL(w.fake_attempts,0))::bigint::varchar||','||ROUND(NVL(w.rto_without_attempt,0))::bigint::varchar||','||ROUND(NVL(w.parcels_lost,0))::bigint::varchar||','||ROUND(NVL(w.parcels_damaged,0))::bigint::varchar||','||ROUND(NVL(w.compensation_amount,0))::bigint::varchar||','||ROUND(NVL(w.parcels_rto,0))::bigint::varchar||','||ROUND(NVL(w.parcels_returned,0))::bigint::varchar||','||ROUND(NVL(w.parcels_delivered_zone_cairo_giza,0))::bigint::varchar||','||ROUND(NVL(w.parcels_delivered_zone_alex_behira,0))::bigint::varchar||','||ROUND(NVL(w.parcels_delivered_zone_delta_canal,0))::bigint::varchar||','||ROUND(NVL(w.parcels_delivered_zone_near_upper,0))::bigint::varchar||','||ROUND(NVL(w.parcels_delivered_zone_far_upper_matrouh,0))::bigint::varchar||','||ROUND(NVL(w.parcels_delivered_zone_north_coast,0))::bigint::varchar||','||ROUND(NVL(w.parcels_delivered_zone_sinai_new_valley,0))::bigint::varchar||','||ROUND(NVL(w.parcels_delivered_zone_other,0))::bigint::varchar, ';') WITHIN GROUP (ORDER BY m.d) AS mpack
       FROM page p CROSS JOIN months m LEFT JOIN mart.v_merchant_monthly_wide w ON w.business_id=p.business_id AND w.date=m.d GROUP BY p.business_id),
dp AS (SELECT p.business_id, LISTAGG(ROUND(NVL(w.ecomm_pickups,0))::bigint::varchar||','||ROUND(NVL(w.fulfillment_pickups,0))::bigint::varchar||','||ROUND(NVL(w.box_pickups,0))::bigint::varchar||','||ROUND(NVL(w.parcels_picked,0))::bigint::varchar||','||ROUND(NVL(w.parcels_delivered,0))::bigint::varchar||','||ROUND(NVL(w.delivery_revenue_total,0))::bigint::varchar||','||ROUND(NVL(w.delivery_revenue_vas_total,0))::bigint::varchar||','||ROUND(NVL(w.dsr_numerator,0))::bigint::varchar||','||ROUND(NVL(w.dsr_denominator,0))::bigint::varchar||','||ROUND(NVL(w.asr_numerator,0))::bigint::varchar||','||ROUND(NVL(w.asr_denominator,0))::bigint::varchar||','||ROUND(NVL(w.fake_attempts,0))::bigint::varchar||','||ROUND(NVL(w.rto_without_attempt,0))::bigint::varchar||','||ROUND(NVL(w.parcels_lost,0))::bigint::varchar||','||ROUND(NVL(w.parcels_damaged,0))::bigint::varchar||','||ROUND(NVL(w.compensation_amount,0))::bigint::varchar, ';') WITHIN GROUP (ORDER BY dd.d) AS dpack
       FROM page p CROSS JOIN days dd LEFT JOIN mart.v_merchant_daily_wide w ON w.business_id=p.business_id AND w.date=dd.d GROUP BY p.business_id),
subp AS (SELECT sub_business_id, business_id AS parent_id, business_name AS parent_name, ROW_NUMBER() OVER (PARTITION BY sub_business_id ORDER BY updatedat DESC) rn FROM public.business_invitations WHERE status = 'accepted'),
kids AS (SELECT business_id, COUNT(DISTINCT sub_business_id) AS n_subs FROM public.business_invitations WHERE status = 'accepted' GROUP BY business_id)
SELECT p.business_id, nm.business_name, p.account_manager, seg.segment, p.joining_date::varchar AS joining_date, la.last_activity::varchar AS last_activity, mp.mpack, dp.dpack,
       LEFT(b.website, 160) AS website, sp.parent_id, sp.parent_name, k.n_subs, p.scope, lpad('', 600, 'x') AS pad
FROM page p LEFT JOIN nm ON nm.business_id=p.business_id LEFT JOIN seg ON seg.business_id=p.business_id LEFT JOIN la ON la.business_id=p.business_id
LEFT JOIN mp ON mp.business_id=p.business_id LEFT JOIN dp ON dp.business_id=p.business_id
LEFT JOIN public.businesses b ON b.business_id=p.business_id
LEFT JOIN subp sp ON sp.sub_business_id=p.business_id AND sp.rn=1
LEFT JOIN kids k ON k.business_id=p.business_id
ORDER BY p.business_id
