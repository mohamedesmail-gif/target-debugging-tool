-- Merchants with pickups in the part of the PREVIOUS 25th-to-25th month that lies before the daily packs (__PREV_FROM__ .. the day before __FROM__),
-- no pickups from __FROM__ to the day before __NEW_FROM__, and pickups since __NEW_FROM__ (to __TO__, inclusive).
-- The daily packs start on __FROM__ (1st of last month), so these days are not in them. Such a merchant was active in the previous window,
-- so it is NOT a reactivation (scripts/build_tracker_data.py reads data/prev_window_active.json).
-- Output: business_id
SELECT business_id FROM mart.v_merchant_daily_wide
WHERE date BETWEEN DATE '__PREV_FROM__' AND DATE '__TO__'
GROUP BY business_id
HAVING SUM(CASE WHEN date < DATE '__FROM__' THEN NVL(parcels_picked,0) ELSE 0 END) > 0
   AND SUM(CASE WHEN date >= DATE '__FROM__' AND date < DATE '__NEW_FROM__' THEN NVL(parcels_picked,0) ELSE 0 END) = 0
   AND SUM(CASE WHEN date >= DATE '__NEW_FROM__' THEN NVL(parcels_picked,0) ELSE 0 END) > 0
