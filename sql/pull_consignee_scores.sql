-- Consignee score of every parcel, per merchant and month (Customers tab of the merchant profile and the portfolio overview).
-- Parcel     = one tracking number in public.delivery_attempts_asr; its month = the month of its first confirmed_date
--              (the confirmed delivery-attempt date). Only delivery attempts are used.
-- Delivered  = at least one attempt of the parcel with attemptstatus = 1 (successful attempt).
-- Consignee  = receiver_phone, matched to public.consignees_fraud_score.consignee_phone on digits only
--              (the score table stores '+20...', the attempts table '20...').
-- Score band = the consignee's delivery_success_rate (0-100, one row per phone):
--              0 or no score -> 'No data'; below 40 -> 'Bad'; 40 to below 70 -> 'Medium'; 70 or more -> 'High'.
-- __FROM__ and __TO__ are inclusive confirmed dates.
WITH cfs AS (
  SELECT REGEXP_REPLACE(consignee_phone, '[^0-9]', '') AS phone, MAX(delivery_success_rate) AS dsr
  FROM public.consignees_fraud_score
  GROUP BY 1
), p AS (
  SELECT a.sender_id AS business_id, a.trackingnumber, MAX(REGEXP_REPLACE(a.receiver_phone, '[^0-9]', '')) AS phone,
         MIN(a.confirmed_date) AS confirmed, MAX(CASE WHEN a.attemptstatus = 1 THEN 1 ELSE 0 END) AS delivered
  FROM public.delivery_attempts_asr a
  WHERE a.confirmed_date BETWEEN DATE '__FROM__' AND DATE '__TO__'
    AND a.attempt_type = 'delivery'
  GROUP BY 1, 2
)
SELECT p.business_id,
       TO_CHAR(p.confirmed, 'YYYY-MM') AS month,
       CASE WHEN c.dsr IS NULL OR c.dsr = 0 THEN 'No data'
            WHEN c.dsr < 40 THEN 'Bad'
            WHEN c.dsr < 70 THEN 'Medium'
            ELSE 'High' END AS band,
       COUNT(*) AS parcels,
       SUM(p.delivered) AS delivered
FROM p
LEFT JOIN cfs c ON c.phone = p.phone
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;
