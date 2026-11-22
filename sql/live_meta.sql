-- Live section, step 1 of 2: the clock and the baseline weeks.
-- Source: fact.deliveries_live (one row per parcel). Business day: created_date / pickup_date roll over at 04:00 Cairo time (checked in the data), so "today" is
-- the newest created_date, and "the same minute yesterday" is the newest timestamp minus 1 day. Deleted parcels (is_deleted) are left out everywhere.
-- Returns one row: dt (today's business date), cut (newest timestamp in the table), bw_c / bw_p = how many of the last 4 same weekdays can be a baseline for
-- created / picked up. A baseline day counts only when the table holds at least __MIN_DAY__ parcels for it (the table is young: older days are partial).
with m as (select max(created_date) as dt, greatest(max(created_at), max(pickup_at)) as cut from fact.deliveries_live where is_deleted = false),
k as (select 1 as n union all select 2 union all select 3 union all select 4),
cd as (select created_date as d, count(*) as c from fact.deliveries_live where is_deleted = false and created_date >= dateadd(day, -28, (select dt from m)) group by 1),
pd as (select pickup_date as d, count(*) as c from fact.deliveries_live where is_deleted = false and pickup_date >= dateadd(day, -28, (select dt from m)) group by 1)
select to_char((select dt from m), 'YYYY-MM-DD') as dt, to_char((select cut from m), 'YYYY-MM-DD HH24:MI:SS') as cut,
       (select count(*) from k join cd on cd.d = dateadd(day, -7 * k.n, (select dt from m))::date where cd.c >= __MIN_DAY__) as bw_c,
       (select count(*) from k join pd on pd.d = dateadd(day, -7 * k.n, (select dt from m))::date where pd.c >= __MIN_DAY__) as bw_p;
