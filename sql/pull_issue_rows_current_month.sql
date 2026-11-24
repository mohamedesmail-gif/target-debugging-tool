-- Current-month parcel issue rows (mart.v_parcel_lifecycle) for the roster merchants, packed per merchant.
-- Types: F fake attempts (grey_reason_fake_attempt, by grey_date) | R RTO without attempt (rto_initiated_at, 0 attempts) | L lost | D damaged | C compensation
-- Output: (mid, chunk, s, rn)  s = rows joined by '~', fields by '|':
--   tracking|type|day|assigned_hub|current_hub|pickup_star|delivery_star|current_star|attempts|status|liability|amount|reason
-- Validation (Trend Hub, Sept): lost 12 = mart, compensation 171,260 = mart, damaged 26 vs 28, fake 591 vs 407, RTO 2,026 vs 5,064 (proxies).
WITH owner AS (SELECT business_id, account_manager_name AS account_manager FROM public.businesses   -- today's owner (public.businesses), AMs of the targets table
  WHERE account_type = 'merchant' AND account_manager_name IN (__AM_LIST__)),
iss AS (
  SELECT p.merchant_id mid, 'F' t, p.tracking_number tn, EXTRACT(day FROM p.grey_date) dom, p.assigned_hub_name hub, p.current_hub chub, p.pickup_star_id ps, p.delivery_star_id dst, p.current_star_name cs, NVL(p.total_attempts,0) att, p.current_status st, '' liab, '' amt, '' rsn
  FROM mart.v_parcel_lifecycle p JOIN owner o ON o.business_id = p.merchant_id WHERE p.grey_reason_fake_attempt AND p.grey_date >= DATE '__FROM__' AND p.grey_date < DATE '__TO__'
  UNION ALL
  SELECT p.merchant_id, 'R', p.tracking_number, EXTRACT(day FROM p.rto_initiated_at), p.assigned_hub_name, p.current_hub, p.pickup_star_id, p.delivery_star_id, p.current_star_name, 0, p.current_status, '', '', ''
  FROM mart.v_parcel_lifecycle p JOIN owner o ON o.business_id = p.merchant_id WHERE p.rto_initiated_at >= DATE '__FROM__' AND p.rto_initiated_at < DATE '__TO__' AND NVL(p.total_attempts,0) = 0
  UNION ALL
  SELECT p.merchant_id, 'L', p.tracking_number, EXTRACT(day FROM p.lost_at), p.assigned_hub_name, p.current_hub, p.pickup_star_id, p.delivery_star_id, p.current_star_name, NVL(p.total_attempts,0), p.current_status, NVL(p.last_compensation_liability,''), NVL(ROUND(p.full_compensation_amount)::bigint::varchar,''), ''
  FROM mart.v_parcel_lifecycle p JOIN owner o ON o.business_id = p.merchant_id WHERE p.lost_at >= DATE '__FROM__' AND p.lost_at < DATE '__TO__'
  UNION ALL
  SELECT p.merchant_id, 'D', p.tracking_number, EXTRACT(day FROM p.damaged_at), p.assigned_hub_name, p.current_hub, p.pickup_star_id, p.delivery_star_id, p.current_star_name, NVL(p.total_attempts,0), p.current_status, NVL(p.last_compensation_liability,''), NVL(ROUND(p.full_compensation_amount)::bigint::varchar,''), ''
  FROM mart.v_parcel_lifecycle p JOIN owner o ON o.business_id = p.merchant_id WHERE p.damaged_at >= DATE '__FROM__' AND p.damaged_at < DATE '__TO__'
  UNION ALL
  SELECT p.merchant_id, 'C', p.tracking_number, EXTRACT(day FROM p.last_compensation_at), p.assigned_hub_name, p.current_hub, p.pickup_star_id, p.delivery_star_id, p.current_star_name, NVL(p.total_attempts,0), p.current_status, NVL(p.last_compensation_liability,''), NVL(ROUND(p.full_compensation_amount)::bigint::varchar,''), NVL(p.last_compensation_reason,'')
  FROM mart.v_parcel_lifecycle p JOIN owner o ON o.business_id = p.merchant_id WHERE p.last_compensation_at >= DATE '__FROM__' AND p.last_compensation_at < DATE '__TO__'),
packed AS (
  SELECT mid, tn, (ROW_NUMBER() OVER (PARTITION BY mid ORDER BY t, tn) - 1) / 150 AS chunk,      -- 150 rows per chunk: stays well under the 64 KB LISTAGG limit
         tn::varchar||'|'||t||'|'||dom::int::varchar||'|'||REPLACE(REPLACE(NVL(hub,''),'|',' '),'~',' ')||'|'||REPLACE(REPLACE(NVL(chub,''),'|',' '),'~',' ')||'|'||NVL(ps,'')||'|'||NVL(dst,'')||'|'||REPLACE(REPLACE(NVL(cs,''),'|',' '),'~',' ')||'|'||att::varchar||'|'||REPLACE(NVL(st,''),'|',' ')||'|'||REPLACE(liab,'|',' ')||'|'||amt||'|'||REPLACE(REPLACE(rsn,'|',' '),'~',' ') AS rowstr
  FROM iss),
g AS (SELECT mid, chunk, LISTAGG(rowstr, '~') WITHIN GROUP (ORDER BY tn) AS s FROM packed GROUP BY mid, chunk),
n AS (SELECT mid, chunk, s, ROW_NUMBER() OVER (ORDER BY mid, chunk) AS rn FROM g)
SELECT mid, chunk, s, rn, lpad('', 1500, 'x') AS pad    -- pad forces the Metabase tool to store large results as a file
FROM n WHERE rn > __RN_FROM__ AND rn <= __RN_TO__ ORDER BY rn
