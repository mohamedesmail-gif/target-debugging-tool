-- =====================================================================================
-- Target Tracker + Merchant Profile : October 2026 queries and metric calculations
-- Source objects (schema mart): v_merchant_monthly_wide, v_merchant_daily_wide, v_merchant_weekly_wide,
--   v_parcel_lifecycle, dim_merchant_period, v_bosta_calendar, mart_hub_metrics, mart_star_metrics
-- Redshift notes: no FILTER clause (use CASE WHEN), ownership = ROW_NUMBER() on date DESC (never MAX()).
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- 1) METRICS COVERED IN THE MART  (column -> how the profile calculates it)
-- -------------------------------------------------------------------------------------
-- Volume (LM / Fulfillment / Box)  : ecomm_pickups, fulfillment_pickups, box_pickups ; total picked = parcels_picked
-- Baseline for targets             : ecomm_pickups + fulfillment_pickups of the PREVIOUS month (September)
-- Current month (MTD)              : parcels_picked of the current month from v_merchant_monthly_wide
-- Target avg daily (per merchant)  : (previous-month ecomm+fulfillment pickups x 1.60) / working days in the month (26 in Oct)
-- MTD avg daily                    : parcels_picked(Oct) / elapsed working days (Fridays excluded; 3 through Oct 4)
-- Below own target %               : max(0, target - mtd_avg_daily) / target x 100
-- AM Target (the former "80% bar") : 0.80 x AM monthly target from the October sheet
-- Achievement vs Target (bar)      : sum(parcels_picked MTD) / (0.80 x monthly target) x 100
-- Delivered / returned / lost / damaged / not found : parcels_delivered, parcels_returned, parcels_lost, parcels_damaged, parcels_not_found
-- DSR                              : dsr = dsr_numerator / dsr_denominator   (Low DSR flag: <= 65%)
-- ASR                              : asr = asr_numerator / asr_denominator   (no denominator on Fridays -> null)
-- Fake attempts / RTO w/o attempt  : fake_attempts, rto_without_attempt
-- Revenue                          : delivery_revenue_total ; shipping = delivery_revenue_shipping ; VAS = delivery_revenue_vas_total
-- ASP shipping / ASP VAS           : delivery_revenue_shipping / pickups ; delivery_revenue_vas_total / pickups
-- VAS types                        : delivery_revenue_vas_extracod, _next_day, _insurance, _flexship, _allow_to_open,
--                                    _materials (+ _materials_delivery), _fulfillment_handling_fees, _pickup, _amazon_extracod
-- VAS flag                         : count of the six core types with revenue in the selected month or the 2 before
--                                    (0 None, 1 Single, 2-5 Multiple, 6 Full)  -- taxonomy still to be confirmed
-- Compensation                     : compensation_amount
-- Delivery zones                   : parcels_delivered_zone_cairo_giza / alex_behira / delta_canal / near_upper /
--                                    far_upper_matrouh / north_coast / sinai_new_valley / other
-- Business-line shares             : ecomm / fulfillment / box pickups divided by their sum
-- Lifecycle (New/Retained/Reactivated): joining_date month = current -> New ; active last month + this month -> Retained ;
--                                    inactive last month, active before, active now -> Reactivated
-- Creation source / pickup city+zone: v_parcel_lifecycle (most frequent value over parcels created since 2026-07-01)
-- Tracking-number-level issues (NOT embedded, available live): v_parcel_lifecycle -> tracking_number, assigned_hub_name,
--    first_hub, current_hub, pickup_star_id, delivery_star_id, current_star_name, lost_at, damaged_at, rto_initiated_at,
--    total_attempts, grey_reason_fake_attempt, has_whatsapp_fake_attempt, full_compensation_amount, last_compensation_reason,
--    last_compensation_liability, last_compensation_liability_on, last_compensation_department

-- -------------------------------------------------------------------------------------
-- 2) METRICS NOT COVERED IN THE MART SCHEMA  (and where they live)
-- -------------------------------------------------------------------------------------
-- CX tickets (id, agent, type, aging)      : data_dev.freshdesk_tickets, v_freshdesk_tickets_enriched, fact_ticket_lifecycle,
--                                            multi_tracking_numbers (ticket <-> tracking number)
-- Failed-order exception reasons           : data_dev.deliveries_attempts.exception_reason, delivery_attempts_asr
--                                            (mart.v_parcel_lifecycle.cancellation_reason is almost always null)
-- Website                                  : data_dev.businesses.website
-- Pickup addresses                         : mart only has pickup_city / pickup_zone ; data_dev.businesses.default_pickup_location_city
-- Facebook ads active                      : not found in any schema
-- Seasonality                              : no official tag (profile derives: low variation = Stable, peak >= 1.4x mean = Peaks in <month>)
-- ASR attention bar                        : no official bar (profile colours ASR < 45% amber)

-- -------------------------------------------------------------------------------------
-- 3) PROFILE + TRACKER PULL  (run with __OFFSET__ = 0, 1000, 2000, 3000, 4000; 1000 merchants per page)
--    One row per merchant: mpack = 10 months (Jan-Oct) x 32 fields, dpack = 34 days (Sep 1 - Oct 4) x 14 fields.
--    Ratios are stored x10000 and -1 = no data.
-- -------------------------------------------------------------------------------------
WITH latest AS (
  SELECT business_id, account_manager, joining_date, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) rn
  FROM mart.v_merchant_monthly_wide WHERE date >= DATE '2026-06-01'),
owner AS (SELECT business_id, account_manager, joining_date FROM latest WHERE rn=1 AND account_manager IN ('Ahmed Saied Sayed','Sabah Osama','Yousra Gamal Youssef Elawady','Esraa Shaaban','Fatma Fouad','Wissam Ahmed','Abdelrahman Husein','Ahmed Tarek','Aml Omar','Doha Ahmed','Hager Tarek','Khaled Abuhatab','Marawan Mahmoud','Mohamed Shaker','Mustafa Emad','Nourhan Hossam Farid','Sohaila Emad','Ziad Atef Shatta','Ahmed Atef Mohamed','Ali Fathi','Esraa Mohamed Hussein','Hagar Awad ElShammaa','Mahmoud Elsadany','Taradi Mustafa','Tarek Zaki','Yosra Mohamed Ibrahim','Abdelrhman Salman','Farha Aly Saad','Mayar Adel','Ali Aboudy','Amira Khaled Mohamed','Mohamed Abuewlafa','Mohamed Salama','Abanoub George Nashed','Amal Abdelnaby','Doha AlaaEldien Abdelmonaiemin','Gebaly Salah','maha Kotb','Nada Elsayed','Nariman Mohamed','Omar Shaaban','Hajar Bahaa Eldin','Mahmoud Emam','Menna Adel','Nourhan Mohamed','Rania Abdelmonem','Shadia Abdelhamed','Shereen Ahmed Mahmoud','Shrouk Khaled Ahmed')),
seg AS (SELECT business_id, segment FROM (SELECT business_id, segment, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) rn FROM mart.v_merchant_monthly_wide WHERE date >= DATE '2026-06-01' AND segment IS NOT NULL) WHERE rn=1),
nm AS (SELECT business_id, business_name FROM (SELECT business_id, business_name, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY date DESC) rn FROM mart.dim_merchant_period WHERE business_name IS NOT NULL AND date >= DATE '2026-06-01') WHERE rn=1),
la AS (SELECT business_id, MAX(date) AS last_activity FROM mart.v_merchant_daily_wide WHERE date >= DATE '2026-01-01' AND parcels_picked > 0 GROUP BY business_id),
page AS (SELECT business_id, account_manager, joining_date FROM owner ORDER BY business_id LIMIT 1000 OFFSET __OFFSET__),
months AS (SELECT DATE '2026-01-01' AS d UNION ALL SELECT DATE '2026-02-01' UNION ALL SELECT DATE '2026-03-01' UNION ALL SELECT DATE '2026-04-01' UNION ALL SELECT DATE '2026-05-01' UNION ALL SELECT DATE '2026-06-01' UNION ALL SELECT DATE '2026-07-01' UNION ALL SELECT DATE '2026-08-01' UNION ALL SELECT DATE '2026-09-01' UNION ALL SELECT DATE '2026-10-01'),
days AS (SELECT date AS d FROM mart.v_bosta_calendar WHERE date BETWEEN DATE '2026-09-01' AND DATE '2026-10-04'),
mp AS (SELECT p.business_id, LISTAGG(ROUND(NVL(w.ecomm_pickups,0))::bigint::varchar||','||ROUND(NVL(w.fulfillment_pickups,0))::bigint::varchar||','||ROUND(NVL(w.box_pickups,0))::bigint::varchar||','||ROUND(NVL(w.parcels_picked,0))::bigint::varchar||','||ROUND(NVL(w.parcels_delivered,0))::bigint::varchar||','||ROUND(NVL(w.delivery_revenue_total,0))::bigint::varchar||','||ROUND(NVL(w.delivery_revenue_shipping,0))::bigint::varchar||','||ROUND(NVL(w.delivery_revenue_vas_total,0))::bigint::varchar||','||ROUND(NVL(w.delivery_revenue_vas_extracod,0))::bigint::varchar||','||ROUND(NVL(w.delivery_revenue_vas_next_day,0))::bigint::varchar||','||ROUND(NVL(w.delivery_revenue_vas_insurance,0))::bigint::varchar||','||ROUND(NVL(w.delivery_revenue_vas_flexship,0))::bigint::varchar||','||ROUND(NVL(w.delivery_revenue_vas_allow_to_open,0))::bigint::varchar||','||ROUND(NVL((NVL(w.delivery_revenue_vas_materials,0)+NVL(w.delivery_revenue_vas_materials_delivery,0)),0))::bigint::varchar||','||ROUND(NVL(w.delivery_revenue_vas_fulfillment_handling_fees,0))::bigint::varchar||','||CASE WHEN w.dsr IS NULL THEN '-1' ELSE ROUND(w.dsr*10000)::bigint::varchar END||','||CASE WHEN w.asr IS NULL THEN '-1' ELSE ROUND(w.asr*10000)::bigint::varchar END||','||ROUND(NVL(w.fake_attempts,0))::bigint::varchar||','||ROUND(NVL(w.rto_without_attempt,0))::bigint::varchar||','||ROUND(NVL(w.parcels_lost,0))::bigint::varchar||','||ROUND(NVL(w.parcels_damaged,0))::bigint::varchar||','||ROUND(NVL(w.compensation_amount,0))::bigint::varchar||','||ROUND(NVL(w.parcels_rto,0))::bigint::varchar||','||ROUND(NVL(w.parcels_returned,0))::bigint::varchar||','||ROUND(NVL(w.parcels_delivered_zone_cairo_giza,0))::bigint::varchar||','||ROUND(NVL(w.parcels_delivered_zone_alex_behira,0))::bigint::varchar||','||ROUND(NVL(w.parcels_delivered_zone_delta_canal,0))::bigint::varchar||','||ROUND(NVL(w.parcels_delivered_zone_near_upper,0))::bigint::varchar||','||ROUND(NVL(w.parcels_delivered_zone_far_upper_matrouh,0))::bigint::varchar||','||ROUND(NVL(w.parcels_delivered_zone_north_coast,0))::bigint::varchar||','||ROUND(NVL(w.parcels_delivered_zone_sinai_new_valley,0))::bigint::varchar||','||ROUND(NVL(w.parcels_delivered_zone_other,0))::bigint::varchar, ';') WITHIN GROUP (ORDER BY m.d) AS mpack
       FROM page p CROSS JOIN months m LEFT JOIN mart.v_merchant_monthly_wide w ON w.business_id=p.business_id AND w.date=m.d GROUP BY p.business_id),
dp AS (SELECT p.business_id, LISTAGG(ROUND(NVL(w.ecomm_pickups,0))::bigint::varchar||','||ROUND(NVL(w.fulfillment_pickups,0))::bigint::varchar||','||ROUND(NVL(w.box_pickups,0))::bigint::varchar||','||ROUND(NVL(w.parcels_picked,0))::bigint::varchar||','||ROUND(NVL(w.parcels_delivered,0))::bigint::varchar||','||ROUND(NVL(w.delivery_revenue_total,0))::bigint::varchar||','||ROUND(NVL(w.delivery_revenue_vas_total,0))::bigint::varchar||','||CASE WHEN w.dsr IS NULL THEN '-1' ELSE ROUND(w.dsr*10000)::bigint::varchar END||','||CASE WHEN w.asr IS NULL THEN '-1' ELSE ROUND(w.asr*10000)::bigint::varchar END||','||ROUND(NVL(w.fake_attempts,0))::bigint::varchar||','||ROUND(NVL(w.rto_without_attempt,0))::bigint::varchar||','||ROUND(NVL(w.parcels_lost,0))::bigint::varchar||','||ROUND(NVL(w.parcels_damaged,0))::bigint::varchar||','||ROUND(NVL(w.compensation_amount,0))::bigint::varchar, ';') WITHIN GROUP (ORDER BY dd.d) AS dpack
       FROM page p CROSS JOIN days dd LEFT JOIN mart.v_merchant_daily_wide w ON w.business_id=p.business_id AND w.date=dd.d GROUP BY p.business_id)
SELECT p.business_id, nm.business_name, p.account_manager, seg.segment, p.joining_date::varchar AS joining_date, la.last_activity::varchar AS last_activity, mp.mpack, dp.dpack
FROM page p LEFT JOIN nm ON nm.business_id=p.business_id LEFT JOIN seg ON seg.business_id=p.business_id LEFT JOIN la ON la.business_id=p.business_id
LEFT JOIN mp ON mp.business_id=p.business_id LEFT JOIN dp ON dp.business_id=p.business_id ORDER BY p.business_id

-- -------------------------------------------------------------------------------------
-- 4) CREATION SOURCE + PICKUP LOCATION per merchant (v_parcel_lifecycle).  Replace the OWNER CTE with the same one as above.
-- -------------------------------------------------------------------------------------
-- WITH owner AS (... same roster CTE as section 3 ...),
-- page AS (SELECT business_id FROM owner ORDER BY business_id LIMIT 1600 OFFSET 0),
-- pl AS (SELECT p.merchant_id AS business_id, p.creation_source, p.pickup_city, p.pickup_zone
--        FROM mart.v_parcel_lifecycle p WHERE p.created_at >= DATE '2026-07-01' AND p.merchant_id IN (SELECT business_id FROM page)),
-- src AS (SELECT business_id, creation_source, COUNT(*) n, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY COUNT(*) DESC) rk
--         FROM pl WHERE creation_source IS NOT NULL GROUP BY business_id, creation_source),
-- loc AS (SELECT business_id, pickup_city, pickup_zone, COUNT(*) n, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY COUNT(*) DESC) rk
--         FROM pl WHERE pickup_city IS NOT NULL GROUP BY business_id, pickup_city, pickup_zone)
-- SELECT pg.business_id, s.creation_source, s.n, l1.pickup_city, l1.pickup_zone, l2.pickup_city, l2.pickup_zone
-- FROM page pg LEFT JOIN src s ON s.business_id=pg.business_id AND s.rk=1
-- LEFT JOIN loc l1 ON l1.business_id=pg.business_id AND l1.rk=1 LEFT JOIN loc l2 ON l2.business_id=pg.business_id AND l2.rk=2;

-- -------------------------------------------------------------------------------------
-- 5) EXAMPLE: tracking-number-level fake attempts for one merchant (live, not embedded in the app)
-- -------------------------------------------------------------------------------------
-- SELECT tracking_number, created_at, assigned_hub_name, first_hub, current_hub, pickup_star_id, delivery_star_id,
--        total_attempts, grey_reason_fake_attempt, has_whatsapp_fake_attempt, last_compensation_liability_on
-- FROM mart.v_parcel_lifecycle
-- WHERE merchant_id = 'ImbeR25m9' AND created_at >= DATE '2026-10-01'
--   AND (grey_reason_fake_attempt = 1 OR has_whatsapp_fake_attempt = 1);


-- -------------------------------------------------------------------------------------
-- 6) WEBSITE + SUB-ACCOUNT FLAG per merchant (public.businesses, public.business_invitations)
--    Sub-account  = business_id appears as sub_business_id in an invitation with status = 'accepted'
--                   (cancelled / pending / pendingCommercialApproval / rejected / rejectedByCommercial are ignored;
--                    14 subs have more than one accepted parent -> the latest by updatedat wins)
--    Parent       = business_id has at least one accepted sub-account
--    Website      = public.businesses.website, shown in the app as the bare domain (https://, www., path and query stripped)
-- -------------------------------------------------------------------------------------
-- WITH owner AS (... same roster CTE as section 3 ...),
-- subp AS (SELECT sub_business_id, business_id AS parent_id, business_name AS parent_name,
--                 ROW_NUMBER() OVER (PARTITION BY sub_business_id ORDER BY updatedat DESC) rn
--          FROM public.business_invitations WHERE status = 'accepted'),
-- kids AS (SELECT business_id, COUNT(DISTINCT sub_business_id) AS n_subs
--          FROM public.business_invitations WHERE status = 'accepted' GROUP BY business_id)
-- SELECT o.business_id, LEFT(b.website, 160) AS website, sp.parent_id, sp.parent_name, k.n_subs
-- FROM owner o LEFT JOIN public.businesses b ON b.business_id = o.business_id
-- LEFT JOIN subp sp ON sp.sub_business_id = o.business_id AND sp.rn = 1
-- LEFT JOIN kids k ON k.business_id = o.business_id;

-- -------------------------------------------------------------------------------------
-- 7) AM PORTFOLIO AGGREGATES (one row per account manager; monthly Jan-Oct and daily Sep 1 - Oct 4)
--    Ratios are computed from SUMS, never averaged:  DSR = SUM(dsr_numerator) / SUM(dsr_denominator),
--                                                    ASR = SUM(asr_numerator) / SUM(asr_denominator)
--    Extra portfolio fields:  active_merchants = COUNT(DISTINCT business_id WHERE parcels_picked > 0)
--                             vas_merchants    = COUNT(DISTINCT business_id WHERE delivery_revenue_vas_total > 0)
--                             new_merchants    = COUNT(DISTINCT business_id WHERE joining_date falls in that month)
--    Validation: the AM's October parcels_picked equals the sum of that AM's merchants in the tracker (0 mismatches across 47 AMs),
--                and the portfolio DSR equals the volume-weighted average of the merchants' DSR to 3 decimals.
-- -------------------------------------------------------------------------------------
-- WITH owner AS (SELECT business_id, account_manager FROM latest WHERE rn = 1 AND account_manager IN (<AM list from the October sheet>)),
-- am_m AS (SELECT o.account_manager, w.date AS d, SUM(w.ecomm_pickups) ..., SUM(w.dsr_numerator) dn, SUM(w.dsr_denominator) dd, ...
--          FROM owner o JOIN mart.v_merchant_monthly_wide w ON w.business_id = o.business_id AND w.date >= DATE '2026-01-01'
--          GROUP BY o.account_manager, w.date),
-- am_d AS (same on mart.v_merchant_daily_wide, date BETWEEN '2026-09-01' AND '2026-10-04')
-- SELECT account_manager, LISTAGG(<fields>, ';') WITHIN GROUP (ORDER BY d) FROM am_m ... GROUP BY account_manager;

-- -------------------------------------------------------------------------------------
-- 8) DEFINITIONS USED IN THE PROFILE / PORTFOLIO FLAGS
-- -------------------------------------------------------------------------------------
-- Lifecycle      : New = joining_date month = selected month. Retained = active last month and selected month.
--                  Reactivated = inactive last month, active in an earlier month, active now. Active = any pickup in the month.
-- Seasonality    : shown as "Coming soon" (no official tag exists and the earlier derived heuristic was removed).
-- DSR status     : Low DSR when the selected month's DSR <= 65%, otherwise Healthy.
-- Pickup locations: top 2 pickup_city / pickup_zone by parcel count since 2026-07-01 in mart.v_parcel_lifecycle (not street addresses).
-- VAS flag       : six core types (insurance, next-day, allow-to-open, extra COD, flexship, materials) with revenue > 0 in the
--                  selected month or either of the 2 months before it. 0 None, 1 Single, 2-5 Multiple, 6 Full. Taxonomy still to be confirmed.
-- Same-length rule: every comparison uses periods of the same length. Month-to-date is compared with the same days of the
--                  previous month (Oct 1-4 vs Sep 1-4), week-to-date with the same days of the previous week, never with a full period.
--                  DSR / ASR are cohort-based (a parcel only counts once it has a final outcome), so recent days are immature.
--                  They are therefore shown for COMPLETE periods only (complete months from the mart, complete 7-day weeks, single days)
--                  and are never aggregated over a partial period: month-to-date, partial weeks and same-days windows show a dash.
--                  The hero cards use the last complete month for DSR / ASR while the current month is running.
-- Table colours   : each cell vs the previous period of the same length (same weekday last week for daily). Within +/-2% = stable (grey),
--                  better = green, worse = red; lost, damaged and compensation are better when they fall. A month-to-date row is not coloured.
-- Growth status   : (tracker) first N days of this month vs the same first N days of last month, both on parcels_picked, per working day:
--                  >= +15% Grower, <= -15% Dropper, otherwise Stable.
