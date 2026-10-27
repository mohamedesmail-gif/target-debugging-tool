-- Current-month tickets (public.freshdesk_tickets_enriched, NOT data_dev: that copy is stale) attached to a roster merchant.
-- Merchant link, first available: business_id, company_business_id, freshchat_business_id, then the parcel's merchant via tracking number.
-- Ticket tracking numbers are text like '9622709071.0': strip the decimal before casting. About half of all tickets can be linked.
-- Output: (mid, chunk, s, rn)  fields: id|day|status|agent|type|category|sub_category|tracking|compensation_type
WITH latest AS (
  SELECT business_id, account_manager, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) rn
  FROM mart.v_merchant_monthly_wide WHERE date >= DATE '__OWNER_SINCE__'),
owner AS (SELECT business_id FROM latest WHERE rn=1 AND account_manager IN (__AM_LIST__)),
tk AS (
  SELECT t.id, EXTRACT(day FROM t.created_date)::int AS dom, t.status, t.agent_name, t.ticket_type, t.category, t.sub_category, SPLIT_PART(t.tracking_number, '.', 1) AS tn, t.compensation_type,
         COALESCE(NULLIF(t.business_id,''), NULLIF(t.company_business_id,''), NULLIF(t.freshchat_business_id,''), p.merchant_id) AS mid
  FROM public.freshdesk_tickets_enriched t
  LEFT JOIN mart.v_parcel_lifecycle p ON p.tracking_number = TRY_CAST(SPLIT_PART(t.tracking_number, '.', 1) AS BIGINT) AND NVL(t.tracking_number,'') <> ''
  WHERE t.created_date >= DATE '__FROM__' AND t.created_date < DATE '__TO__'),
rows_ AS (
  SELECT k.mid, k.id, (ROW_NUMBER() OVER (PARTITION BY k.mid ORDER BY k.id) - 1) / 300 AS chunk,
         k.id::varchar||'|'||k.dom::varchar||'|'||REPLACE(REPLACE(NVL(k.status,''),'|',' '),'~',' ')||'|'||REPLACE(REPLACE(NVL(k.agent_name,''),'|',' '),'~',' ')||'|'||REPLACE(REPLACE(NVL(k.ticket_type,''),'|',' '),'~',' ')||'|'||REPLACE(REPLACE(NVL(k.category,''),'|',' '),'~',' ')||'|'||REPLACE(REPLACE(NVL(k.sub_category,''),'|',' '),'~',' ')||'|'||NVL(k.tn,'')||'|'||REPLACE(REPLACE(NVL(k.compensation_type,''),'|',' '),'~',' ') AS rowstr
  FROM tk k JOIN owner o ON o.business_id = k.mid),
g AS (SELECT mid, chunk, LISTAGG(rowstr, '~') WITHIN GROUP (ORDER BY id) AS s FROM rows_ GROUP BY mid, chunk),
n AS (SELECT mid, chunk, s, ROW_NUMBER() OVER (ORDER BY mid, chunk) AS rn FROM g)
SELECT mid, chunk, s, rn, lpad('', 1500, 'x') AS pad FROM n WHERE rn > __RN_FROM__ AND rn <= __RN_TO__ ORDER BY rn
