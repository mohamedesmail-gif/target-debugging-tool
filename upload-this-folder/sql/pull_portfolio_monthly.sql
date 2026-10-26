-- Portfolio monthly pack per account manager: the monthly pack fields summed over the AM's CURRENT merchants for each month (Jan-Oct),
-- DSR / ASR as SUM(numerator) / SUM(denominator) x 10000. The three merchant-count fields (active / VAS / new merchants) are derived from the
-- merchant packs by scripts/build_store.py. One row per AM: (account_manager, pfm, pad).
WITH latest AS (
  SELECT business_id, account_manager, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) rn
  FROM mart.v_merchant_monthly_wide WHERE date >= DATE '__OWNER_SINCE__'),
owner AS (SELECT business_id, account_manager FROM latest WHERE rn=1 AND account_manager IN (__AM_LIST__)),
months AS (SELECT DATE '2026-01-01' AS d UNION ALL SELECT DATE '2026-02-01' UNION ALL SELECT DATE '2026-03-01' UNION ALL SELECT DATE '2026-04-01' UNION ALL SELECT DATE '2026-05-01' UNION ALL SELECT DATE '2026-06-01' UNION ALL SELECT DATE '2026-07-01' UNION ALL SELECT DATE '2026-08-01' UNION ALL SELECT DATE '2026-09-01' UNION ALL SELECT DATE '2026-10-01'),
am_m AS (SELECT o.account_manager, m.d,
       ROUND(SUM(NVL(w.ecomm_pickups,0)))::bigint AS c0,
       ROUND(SUM(NVL(w.fulfillment_pickups,0)))::bigint AS c1,
       ROUND(SUM(NVL(w.box_pickups,0)))::bigint AS c2,
       ROUND(SUM(NVL(w.parcels_picked,0)))::bigint AS c3,
       ROUND(SUM(NVL(w.parcels_delivered,0)))::bigint AS c4,
       ROUND(SUM(NVL(w.delivery_revenue_total,0)))::bigint AS c5,
       ROUND(SUM(NVL(w.delivery_revenue_shipping,0)))::bigint AS c6,
       ROUND(SUM(NVL(w.delivery_revenue_vas_total,0)))::bigint AS c7,
       ROUND(SUM(NVL(w.delivery_revenue_vas_extracod,0)))::bigint AS c8,
       ROUND(SUM(NVL(w.delivery_revenue_vas_next_day,0)))::bigint AS c9,
       ROUND(SUM(NVL(w.delivery_revenue_vas_insurance,0)))::bigint AS c10,
       ROUND(SUM(NVL(w.delivery_revenue_vas_flexship,0)))::bigint AS c11,
       ROUND(SUM(NVL(w.delivery_revenue_vas_allow_to_open,0)))::bigint AS c12,
       ROUND(SUM(NVL((NVL(w.delivery_revenue_vas_materials,0)+NVL(w.delivery_revenue_vas_materials_delivery,0)),0)))::bigint AS c13,
       ROUND(SUM(NVL(w.delivery_revenue_vas_fulfillment_handling_fees,0)))::bigint AS c14,
       CASE WHEN SUM(w.dsr_denominator) > 0 THEN ROUND(SUM(w.dsr_numerator)::float / SUM(w.dsr_denominator) * 10000)::bigint ELSE -1 END AS c15,
       CASE WHEN SUM(w.asr_denominator) > 0 THEN ROUND(SUM(w.asr_numerator)::float / SUM(w.asr_denominator) * 10000)::bigint ELSE -1 END AS c16,
       ROUND(SUM(NVL(w.fake_attempts,0)))::bigint AS c17,
       ROUND(SUM(NVL(w.rto_without_attempt,0)))::bigint AS c18,
       ROUND(SUM(NVL(w.parcels_lost,0)))::bigint AS c19,
       ROUND(SUM(NVL(w.parcels_damaged,0)))::bigint AS c20,
       ROUND(SUM(NVL(w.compensation_amount,0)))::bigint AS c21,
       ROUND(SUM(NVL(w.parcels_rto,0)))::bigint AS c22,
       ROUND(SUM(NVL(w.parcels_returned,0)))::bigint AS c23,
       ROUND(SUM(NVL(w.parcels_delivered_zone_cairo_giza,0)))::bigint AS c24,
       ROUND(SUM(NVL(w.parcels_delivered_zone_alex_behira,0)))::bigint AS c25,
       ROUND(SUM(NVL(w.parcels_delivered_zone_delta_canal,0)))::bigint AS c26,
       ROUND(SUM(NVL(w.parcels_delivered_zone_near_upper,0)))::bigint AS c27,
       ROUND(SUM(NVL(w.parcels_delivered_zone_far_upper_matrouh,0)))::bigint AS c28,
       ROUND(SUM(NVL(w.parcels_delivered_zone_north_coast,0)))::bigint AS c29,
       ROUND(SUM(NVL(w.parcels_delivered_zone_sinai_new_valley,0)))::bigint AS c30,
       ROUND(SUM(NVL(w.parcels_delivered_zone_other,0)))::bigint AS c31
       FROM owner o CROSS JOIN months m LEFT JOIN mart.v_merchant_monthly_wide w ON w.business_id=o.business_id AND w.date=m.d
       GROUP BY o.account_manager, m.d)
SELECT account_manager, LISTAGG(c0::varchar||','||c1::varchar||','||c2::varchar||','||c3::varchar||','||c4::varchar||','||c5::varchar||','||c6::varchar||','||c7::varchar||','||c8::varchar||','||c9::varchar||','||c10::varchar||','||c11::varchar||','||c12::varchar||','||c13::varchar||','||c14::varchar||','||c15::varchar||','||c16::varchar||','||c17::varchar||','||c18::varchar||','||c19::varchar||','||c20::varchar||','||c21::varchar||','||c22::varchar||','||c23::varchar||','||c24::varchar||','||c25::varchar||','||c26::varchar||','||c27::varchar||','||c28::varchar||','||c29::varchar||','||c30::varchar||','||c31::varchar, ';') WITHIN GROUP (ORDER BY d) AS pfm, lpad('', 400, 'x') AS pad
FROM am_m GROUP BY account_manager ORDER BY account_manager
