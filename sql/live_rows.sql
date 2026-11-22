-- Live section, step 2 of 2: one row per business. Same business day, cut and baseline rule as live_meta.sql.
-- Columns: business_id,
--   c_t created today, c_ys created yesterday up to the same minute, c_b baseline created (SUM over the baseline weeks: divide by bw_c),
--   p_t picked up today, p_ys picked up yesterday up to the same minute, p_b baseline picked up (SUM: divide by bw_p),
--   pc_t created today and already picked up,
--   c_y created yesterday, c_yy the day before, p_y picked up yesterday, p_yy the day before, pc_y created yesterday and picked up since.
-- "Picked up on a day" = pickup_date (parcels picked up that day, whatever day they were created).
with m as (select max(created_date) as dt, greatest(max(created_at), max(pickup_at)) as cut from fact.deliveries_live where is_deleted = false),
cd as (select created_date as d, count(*) as c from fact.deliveries_live where is_deleted = false and created_date >= dateadd(day, -28, (select dt from m)) group by 1),
pd as (select pickup_date as d, count(*) as c from fact.deliveries_live where is_deleted = false and pickup_date >= dateadd(day, -28, (select dt from m)) group by 1),
wk as (select n from (select 1 as n union all select 2 union all select 3 union all select 4) q),
okc as (select n from wk join cd on cd.d = dateadd(day, -7 * n, (select dt from m))::date where cd.c >= __MIN_DAY__),
okp as (select n from wk join pd on pd.d = dateadd(day, -7 * n, (select dt from m))::date where pd.c >= __MIN_DAY__),
bc as (
  select f.business_id, count(*) as c_b from fact.deliveries_live f join okc o on f.created_date = dateadd(day, -7 * o.n, (select dt from m))::date
  where f.is_deleted = false and f.created_at <= dateadd(day, -7 * o.n, (select cut from m)) group by 1
),
bp as (
  select f.business_id, count(*) as p_b from fact.deliveries_live f join okp o on f.pickup_date = dateadd(day, -7 * o.n, (select dt from m))::date
  where f.is_deleted = false and f.pickup_at <= dateadd(day, -7 * o.n, (select cut from m)) group by 1
),
cur as (
  select f.business_id,
    sum(case when f.created_date = m.dt then 1 else 0 end) as c_t,
    sum(case when f.created_date = dateadd(day, -1, m.dt) and f.created_at <= dateadd(day, -1, m.cut) then 1 else 0 end) as c_ys,
    sum(case when f.pickup_date = m.dt then 1 else 0 end) as p_t,
    sum(case when f.pickup_date = dateadd(day, -1, m.dt) and f.pickup_at <= dateadd(day, -1, m.cut) then 1 else 0 end) as p_ys,
    sum(case when f.created_date = m.dt and f.pickup_at is not null then 1 else 0 end) as pc_t,
    sum(case when f.created_date = dateadd(day, -1, m.dt) then 1 else 0 end) as c_y,
    sum(case when f.created_date = dateadd(day, -2, m.dt) then 1 else 0 end) as c_yy,
    sum(case when f.pickup_date = dateadd(day, -1, m.dt) then 1 else 0 end) as p_y,
    sum(case when f.pickup_date = dateadd(day, -2, m.dt) then 1 else 0 end) as p_yy,
    sum(case when f.created_date = dateadd(day, -1, m.dt) and f.pickup_at is not null then 1 else 0 end) as pc_y
  from fact.deliveries_live f join m on 1 = 1
  where f.is_deleted = false and (f.created_date >= dateadd(day, -2, m.dt) or f.pickup_date >= dateadd(day, -2, m.dt))
  group by 1
)
select cur.business_id, cur.c_t, cur.c_ys, coalesce(bc.c_b, 0) as c_b, cur.p_t, cur.p_ys, coalesce(bp.p_b, 0) as p_b, cur.pc_t, cur.c_y, cur.c_yy, cur.p_y, cur.p_yy, cur.pc_y
from cur left join bc on bc.business_id = cur.business_id left join bp on bp.business_id = cur.business_id
order by cur.business_id;
