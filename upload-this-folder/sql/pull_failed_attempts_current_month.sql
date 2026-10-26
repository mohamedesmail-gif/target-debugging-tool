-- Failed delivery attempts (public.deliveries_attempts, NOT data_dev). Two statements: run the first once, the second in pages.
-- (1) reason dictionary: code = rank by count in the period (ties by text). Save the result as data/cm_reasons.json (list of reason texts in code order).
SELECT ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, exception_reason) - 1 AS code, exception_reason, COUNT(*) AS attempts
FROM public.deliveries_attempts
WHERE date >= DATE '__FROM__' AND date < DATE '__TO__' AND exception_reason IS NOT NULL
GROUP BY exception_reason ORDER BY 1;

-- (2) per merchant: counts by day and reason code, plus the latest 10 attempts. (mid, counts 'day,code,n;...', recent 'tracking,day,code;...', rn)
WITH latest AS (
  SELECT business_id, account_manager, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) rn
  FROM mart.v_merchant_monthly_wide WHERE date >= DATE '__OWNER_SINCE__'),
owner AS (SELECT business_id FROM latest WHERE rn=1 AND account_manager IN (__AM_LIST__)),
rs AS (SELECT exception_reason r, ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, exception_reason) - 1 AS code FROM public.deliveries_attempts WHERE date >= DATE '__FROM__' AND date < DATE '__TO__' AND exception_reason IS NOT NULL GROUP BY 1),
a AS (SELECT x.business_id mid, x.trackingnumber tn, EXTRACT(day FROM x.date)::int dom, rs.code, x.exception_at ea
      FROM public.deliveries_attempts x JOIN owner o ON o.business_id = x.business_id JOIN rs ON rs.r = x.exception_reason
      WHERE x.date >= DATE '__FROM__' AND x.date < DATE '__TO__' AND x.exception_reason IS NOT NULL),
cnt AS (SELECT mid, LISTAGG(dom::varchar||','||code::varchar||','||n::varchar, ';') WITHIN GROUP (ORDER BY dom, code) AS s FROM (SELECT mid, dom, code, COUNT(*) n FROM a GROUP BY 1,2,3) GROUP BY mid),
rec AS (SELECT mid, LISTAGG(tn::varchar||','||dom::varchar||','||code::varchar, ';') WITHIN GROUP (ORDER BY rk) AS s FROM (SELECT mid, tn, dom, code, ROW_NUMBER() OVER (PARTITION BY mid ORDER BY ea DESC NULLS LAST, tn) AS rk FROM a) WHERE rk <= 10 GROUP BY mid),
j AS (SELECT cnt.mid, cnt.s AS counts, NVL(rec.s,'') AS recent, ROW_NUMBER() OVER (ORDER BY cnt.mid) AS rn FROM cnt LEFT JOIN rec ON rec.mid = cnt.mid)
SELECT mid, counts, recent, rn, lpad('', 800, 'x') AS pad FROM j WHERE rn > __RN_FROM__ AND rn <= __RN_TO__ ORDER BY rn;
