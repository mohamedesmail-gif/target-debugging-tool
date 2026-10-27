-- Website and sub-account flag per roster merchant (page with LIMIT/OFFSET, 1,600 merchants per page).
--   Sub-account  = business_id is the sub_business_id of an ACCEPTED invitation (public.business_invitations; other statuses are ignored;
--                  14 subs have several accepted parents: the latest by updatedat wins)
--   Parent       = business_id has accepted sub-accounts
--   Website      = public.businesses.website (the app shows the bare domain)
WITH latest AS (
  SELECT business_id, account_manager, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) rn
  FROM mart.v_merchant_monthly_wide WHERE date >= DATE '__OWNER_SINCE__'),
owner AS (SELECT business_id FROM latest WHERE rn=1 AND account_manager IN (__AM_LIST__)),
page AS (SELECT business_id FROM owner ORDER BY business_id LIMIT __LIMIT__ OFFSET __OFFSET__),
subp AS (SELECT sub_business_id, business_id AS parent_id, business_name AS parent_name, ROW_NUMBER() OVER (PARTITION BY sub_business_id ORDER BY updatedat DESC) rn FROM public.business_invitations WHERE status = 'accepted'),
kids AS (SELECT business_id, COUNT(DISTINCT sub_business_id) AS n_subs FROM public.business_invitations WHERE status = 'accepted' GROUP BY business_id)
SELECT p.business_id, LEFT(b.website, 160) AS website, sp.parent_id, sp.parent_name, k.n_subs, lpad('',1000,'x') AS pad
FROM page p LEFT JOIN public.businesses b ON b.business_id = p.business_id
LEFT JOIN subp sp ON sp.sub_business_id = p.business_id AND sp.rn = 1
LEFT JOIN kids k ON k.business_id = p.business_id
ORDER BY p.business_id
