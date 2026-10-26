-- Daily pack per merchant (34 days, Sep 1 - Oct 4), 16 fields per day, incl. DSR/ASR numerators and denominators (so ratios can be summed exactly):
--   ecomm, fulfillment, box, picked, delivered, revenue_total, revenue_vas, dsr_num, dsr_den, asr_num, asr_den, fake_attempts, rto_without_attempt, lost, damaged, compensation
-- Page the roster with --limit 1000 --offset 0, 1000, 2000, ... (render_sql.py options).
WITH latest AS (
  SELECT business_id, account_manager, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) rn
  FROM mart.v_merchant_monthly_wide WHERE date >= DATE '__OWNER_SINCE__'),
owner AS (SELECT business_id FROM latest WHERE rn=1 AND account_manager IN (__AM_LIST__)),
page AS (SELECT business_id FROM owner ORDER BY business_id LIMIT __LIMIT__ OFFSET __OFFSET__),
days AS (SELECT date AS d FROM mart.v_bosta_calendar WHERE date BETWEEN DATE '__FROM__' AND DATE '__TO__')   -- here __TO__ is INCLUSIVE
SELECT p.business_id, LISTAGG(ROUND(NVL(w.ecomm_pickups,0))::bigint::varchar||','||ROUND(NVL(w.fulfillment_pickups,0))::bigint::varchar||','||ROUND(NVL(w.box_pickups,0))::bigint::varchar||','||ROUND(NVL(w.parcels_picked,0))::bigint::varchar||','||ROUND(NVL(w.parcels_delivered,0))::bigint::varchar||','||ROUND(NVL(w.delivery_revenue_total,0))::bigint::varchar||','||ROUND(NVL(w.delivery_revenue_vas_total,0))::bigint::varchar||','||ROUND(NVL(w.dsr_numerator,0))::bigint::varchar||','||ROUND(NVL(w.dsr_denominator,0))::bigint::varchar||','||ROUND(NVL(w.asr_numerator,0))::bigint::varchar||','||ROUND(NVL(w.asr_denominator,0))::bigint::varchar||','||ROUND(NVL(w.fake_attempts,0))::bigint::varchar||','||ROUND(NVL(w.rto_without_attempt,0))::bigint::varchar||','||ROUND(NVL(w.parcels_lost,0))::bigint::varchar||','||ROUND(NVL(w.parcels_damaged,0))::bigint::varchar||','||ROUND(NVL(w.compensation_amount,0))::bigint::varchar, ';') WITHIN GROUP (ORDER BY dd.d) AS dpack, lpad('',900,'x') AS pad
FROM page p CROSS JOIN days dd LEFT JOIN mart.v_merchant_daily_wide w ON w.business_id=p.business_id AND w.date=dd.d
GROUP BY p.business_id ORDER BY p.business_id
