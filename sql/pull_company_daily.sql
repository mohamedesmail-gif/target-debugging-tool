-- Company-wide pickups per day (every business in the warehouse, with or without an account manager, in any segment).
-- Used by the VP view of Daily analysis, so the VP sees ALL pickups: the roster merchants of the target segments are one part, the rest is "other".
-- Columns: date, parcels_picked (includes box pickups), ecomm_pickups, fulfillment_pickups, box_pickups, active businesses (at least one parcel picked).
-- __FROM__ and __TO__ are inclusive and must match the daily window of the merchant packs (first day of last month to the as-of day).
SELECT date::varchar AS d,
       ROUND(SUM(NVL(parcels_picked, 0)))::bigint AS picked,
       ROUND(SUM(NVL(ecomm_pickups, 0)))::bigint AS ecomm,
       ROUND(SUM(NVL(fulfillment_pickups, 0)))::bigint AS fulfillment,
       ROUND(SUM(NVL(box_pickups, 0)))::bigint AS box,
       COUNT(DISTINCT CASE WHEN NVL(parcels_picked, 0) > 0 THEN business_id END) AS active
FROM mart.v_merchant_daily_wide
WHERE date BETWEEN DATE '__FROM__' AND DATE '__TO__'
GROUP BY 1 ORDER BY 1;
