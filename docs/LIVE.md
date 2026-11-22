# Live section

The first block of every view (VP, heads, team leaders, AMs, sales), above the Pickups targets. It shows today's parcels from the warehouse table `fact.deliveries_live`.

## What it shows
| Item | Meaning |
|---|---|
| Created today | Parcels created today (`created_date` = today's business date). |
| Picked up today | Parcels picked up today (`pickup_date` = today's business date), whatever day they were created. |
| At same time yesterday | The same count for yesterday, up to the same minute (newest timestamp minus 1 day). The chip is today versus that. |
| vs baseline same minute | Average of the same weekday over the last 4 weeks, up to the same minute. Shown only when at least one past week is complete (see below). |
| Picked up of created today | Parcels created today that already have a pickup time, as a share of parcels created today; the rest is "remaining". |
| Yesterday button | The same card for the full day yesterday, compared with the day before. |
| Created / Picked up by merchant | List of merchants with Business ID, merchant, segment, account manager and counts. |

Each view adds up only its own merchants: the AM's portfolio, the team leader's AMs, the head's teams, the whole roster for the VP. A sales rep sees the rep's new merchants of this month and last month. Merchants not in a portfolio are not counted.

## Rules in the SQL
- Deleted parcels (`is_deleted`) are left out.
- The business day starts at 04:00 Cairo time (checked in the data: `created_date` and `pickup_date` change at 04:00). "Today" is the newest `created_date`.
- Timestamps in the table are Cairo local time. The label "Live · Today 23:50" shows the newest row of the table, not the browser clock.
- A past day counts as a baseline day only when the table holds at least 10,000 parcels for it (`--min-day`). The table is young (full days start on 20 Nov 2026), so no baseline shows yet. It appears by itself once a same weekday of the last 4 weeks is complete. Created and picked up are checked separately.

## How the numbers reach the page
1. `jobs/refresh_live.py` runs `sql/live_meta.sql` and `sql/live_rows.sql` (one row per business, 13 columns) and writes `live.json` (about 0.3 MB).
2. The page reads `/live.json` when it opens and every 60 seconds, and when the refresh button is pressed.
3. If the feed cannot be read, the page keeps the last numbers and says how old they are. If the data is older than 15 minutes, the green dot turns grey.

Run the job every minute next to the app:
```
REDSHIFT_HOST=... REDSHIFT_DB=... REDSHIFT_USER=... REDSHIFT_PASSWORD=... python jobs/refresh_live.py --out /usr/share/nginx/html/live.json --every 60
```
With S3, add `S3_BUCKET=... S3_LIVE_KEY=live.json` and serve the bucket at `/live.json`. `nginx.conf` already sends `Cache-Control: no-store` for it.

Settings in the page (`window.PORTAL_CONFIG`): `liveUrl` (default `/live.json`), `live` (a snapshot inside the page: used by the offline file and as the fallback).

## Check
`npm test` covers the SQL columns against the file columns, the file shape, the sums per view, the Yesterday button, the merchant lists, the baseline line and the three states (fresh feed, snapshot, nothing).
`live.json` holds business IDs with counts: treat it as private, like `payload.json`.

## Not verified here
`jobs/refresh_live.py` was tested with a fake database connection, not against Redshift (the sandbox has no direct connection). The two SQL files were run through Metabase on 21 Nov 2026 and returned 6,055 businesses.
