-- Creation source and pickup locations per merchant, from mart.v_parcel_lifecycle only (replaces the values that were copied from an old store).
-- Rule (defined here, not recovered from the old snapshot): parcels created in the last 90 days (__FROM__ = today - 90); dominant creation_source, its % share,
-- and the 2 most frequent "pickup_city / pickup_zone" pairs. Output: merchant_id, creation_source, source_pct, locations ("a|b").
-- Check on 40 old merchants: the dominant source equals the old value for 38 of 40; share and locations differ because the old window is unknown.
WITH owner AS (SELECT business_id, account_manager_name AS account_manager FROM public.businesses   -- today's owner (public.businesses), AMs of the targets table
  WHERE account_type = 'merchant' AND account_manager_name IN (__AM_LIST__)),
p AS (SELECT l.merchant_id, NVL(l.creation_source, 'null') AS cs, l.pickup_city || ' / ' || NVL(l.pickup_zone, 'None') AS loc
      FROM mart.v_parcel_lifecycle l JOIN owner o ON o.business_id = l.merchant_id WHERE l.created_at >= DATE '__FROM__'),
s AS (SELECT merchant_id, cs, COUNT(*) AS n, ROW_NUMBER() OVER (PARTITION BY merchant_id ORDER BY COUNT(*) DESC, cs) AS rk, SUM(COUNT(*)) OVER (PARTITION BY merchant_id) AS tot FROM p GROUP BY merchant_id, cs),
l2 AS (SELECT merchant_id, loc, ROW_NUMBER() OVER (PARTITION BY merchant_id ORDER BY COUNT(*) DESC, loc) AS rk FROM p GROUP BY merchant_id, loc),
ll AS (SELECT merchant_id, LISTAGG(loc, '|') WITHIN GROUP (ORDER BY rk) AS locs FROM l2 WHERE rk <= 2 GROUP BY merchant_id)
SELECT s.merchant_id, s.cs AS creation_source, ROUND(100.0 * s.n / s.tot)::int AS source_pct, ll.locs AS locations
FROM s JOIN ll ON ll.merchant_id = s.merchant_id WHERE s.rk = 1 ORDER BY 1
