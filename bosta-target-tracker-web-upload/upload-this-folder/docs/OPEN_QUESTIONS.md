# Questions for the data engineer

Access and hosting
1. Can the app (Vercel today, AWS later) reach Redshift: network path (VPC / peering / PrivateLink), IAM role or user, Redshift Data API enabled? Who creates a read-only identity and where are its secrets stored?
2. Which cluster is the source of truth: bosta-data-dev (where we query today) or a production cluster / serverless workgroup? How are views and tables promoted from dev to prod?
3. Provisioned or serverless? What concurrency and cost if 100+ people open dashboards at once; is concurrency scaling / result caching on?

Ownership of the new objects
4. Who owns the new `app` schema, and how are changes versioned and reviewed (git, dbt)?
5. Where should the org hierarchy and monthly targets come from: an HR table, or the sheet each month (S3 COPY, scheduled upload, admin page)? Who maintains it when people join, leave or move teams?

Data correctness
6. What is the authoritative source of "who owns this merchant" (AM and sales) with history? Portfolios changed within four days (4,641 to 4,885 roster merchants); is there an assignment table or event log, and does the mart restate history?
7. Please confirm: DSR denominator (= pickups of the cohort), ASR denominator (attempts?), joining_date (= first pickup), the snapshot convention (label 2026-09-01 is taken on Oct 1), and how fake_attempts / rto_without_attempt are computed upstream (the parcel-level view does not reproduce them).

Scheduling and freshness
8. What runs after the mart refresh (Airflow / scheduled queries) and when is a day's data final? Can a daily job build the `app.scorecard` table after it?

Security
9. Row-level access: Redshift row-level security or filtering in the API? Is there an audit log of who opened which view? Which columns are personal data (phone, email, bank info in the snapshot) and must never reach the app?

Operations
10. Backups / DR for the `app` schema, monitoring of query cost per request, and do we want a small Postgres next to Redshift for anything written often (notes, manual overrides, audit of clicks)?

## After the Oct 15 refresh
- Creation source, share and pickup locations are missing for the 348 merchants added to the roster since the previous pull (the SQL for them is not in the repo).
- Team leader Ahmed Abdelrahman has no email in the targets sheet, so he cannot sign in yet.
- The user table (`sql/app_user_access.sql` + `data/user_access.sql`) still has to be created in the warehouse by the data team.
- Real Google sign-in and server-side scoping (docs/ACCESS.md).
- The identity follows the palette of the login screen (red, dark green-grey, Lato); bosta.co could not be opened from the build environment, so nothing was copied from the site.
