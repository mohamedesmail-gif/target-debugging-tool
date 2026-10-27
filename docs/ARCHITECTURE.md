# Technical parts

Today the whole app is one React component with its data embedded (a snapshot, as of 2026-10-04). For a live system, each AM, TL, head and the VP must see their own scope from current data. This lists every technical part that has to exist.

| # | Part | What it is | Why | Open decision |
|---|---|---|---|---|
| T1 | Data sources | Redshift tables the app reads | Every number comes from them | Confirm definitions with the data engineer |
| T2 | Redshift connection | Secure path from the app to Redshift | The app cannot query today; the Metabase / Redshift MCP connector only serves the assistant in chat | Network, identity, API method |
| T3 | App tables in Redshift | New `app` schema: people, targets, access | Hierarchy and targets cannot live in a file | Schema owner |
| T4 | Scheduled jobs | Daily scorecard build, monthly target load, HR sync | Keeps data current without manual pulls | Scheduler, run time |
| T5 | Backend API | Thin service between app and Redshift | The browser must never hold credentials | Lambda vs container |
| T6 | Frontend hosting on AWS | Where the React app is served | Replaces the current deployment | S3 + CloudFront vs container |
| T7 | Login and access | SSO plus "who can see whom" | Each level sees only its own subtree | Identity provider |
| T8 | Security and privacy | Read-only access, no personal columns | Merchant data is sensitive | Security review |
| T9 | Operations | Logging, monitoring, backups, cost | Production readiness | |
| T10 | Quality | Metric dictionary, data checks, tests | Numbers must reconcile and stay stable | |

## T1. Data sources
- `mart.v_merchant_monthly_wide`, `mart.v_merchant_daily_wide`: pickups, delivered parcels, revenue, DSR/ASR numerators and denominators, VAS, zones, compensation, owner (account manager).
- `mart.v_parcel_lifecycle`: parcel rows for lost, damaged, compensation; proxies for fake attempts and RTO without attempt; creation source, pickup city/zone.
- `mart.v_bosta_calendar`: working days.
- `public.businesses` (website, sales owner, first pickup date), `public.businesses_monthly_snapshot` (previous month's owners; the snapshot labelled `2026-09-01` is taken on Oct 1, so it is the end-of-September state), `public.business_invitations` (sub-accounts).
- `public.freshdesk_tickets_enriched` (tickets, attached to a merchant by business id, chat id or tracking number; only about half are linkable) and `public.deliveries_attempts` (failure reasons).
- Do NOT use the `data_dev` copies of tickets and attempts: they are stale development mirrors.

## T2. Redshift connection
- Network path from AWS (VPC, security group or PrivateLink); which cluster is the source of truth (dev vs production).
- A read-only identity for the app; credentials in AWS Secrets Manager; Redshift Data API vs pooled JDBC.
- Provisioned or serverless, concurrency, query timeout, a dedicated workload queue so the app cannot slow other teams.

## T3. App tables in Redshift (`app` schema, see `sql/app_schema_redshift.sql`)
- `employee` (org tree with history), `employee_alias` (name spellings across systems), `target` (long format), `user_access`.
- Views for the org tree, merchant owner, sales new merchants and cohorts, per-AM actuals and retention; a daily `scorecard` table so the app does not run heavy joins per click. The org-tree view is recursive and cannot be materialized: persist it nightly.
- Ownership history: portfolios change a lot (4,641 to 4,885 roster merchants in four days).

## T4. Scheduled jobs
Daily scorecard build after the mart refresh; monthly target load (upload page or S3) followed by checks; HR sync; refresh of the current-month parcel, ticket and failed-attempt detail; an "as of" date on every screen, so the daily cut-off must be defined.

## T5. Backend API (one endpoint family per screen)
Org scorecards (VP, heads, TLs, sales) and the AM tracker with its merchant table (pickups and ASP); portfolio and merchant overview (date range, granularity); parcel / ticket / failed-attempt lists with paging and CSV export; sales merchant lists; admin target upload; "who am I" for scope. Cross-cutting: parameterised SQL only, 5-15 minute cache, pagination, consistent errors.

## T6. Frontend hosting on AWS
S3 + CloudFront for the static app with API Gateway + Lambda behind it, or a container on ECS/Fargate (see `Dockerfile`). CI/CD (template in `.github/workflows/ci-deploy.yml`), dev/staging/prod, domain and TLS, and splitting the large embedded file so each screen loads only what it needs. See `docs/DEPLOYMENT.md`.

## T7. Login and access
SSO; email mapped to an employee; scope = that person's subtree; VP and admins see everything; every request checked in the API; audit log of who opened what. The rules (already modelled in the app as `scopeOf`): VP all; head his team's team leaders, AMs and sales; team leader his AMs and sales; AM and sales only themselves. Until the API exists the app only scopes the screens: the embedded data is still in the page.

## T8. Security and privacy
Read-only database user, no credentials in the browser, no personal columns (phone, email, bank details of the snapshot) in any app view, merchant data never committed to git (`data/` is ignored).

## T9. Operations
Logs, alerts for failed jobs and slow queries, query-cost budget, backups / recovery of the `app` schema. Decide later whether a small Postgres is needed for anything written often (notes, overrides).

## T10. Quality
One metric dictionary (`docs/METRICS.md`), data checks after every load (people without managers, unmapped names, targets that do not add up), numbers re-checked against the mart for the same date, the smoke suite in `tests/`.

## Data points to resolve
Ownership history; the upstream rules for fake attempts and RTO without attempt (the parcel view only approximates them); whether missing revenue is stored as zero; the ASR denominator. Full list: `docs/OPEN_QUESTIONS.md`.

## Migration path
1. Load employee / alias / target from the sheet; run the checks. 2. Create the views and compare with the app for the same date. 3. Add the API (read-only user, one query per request, cache). 4. Switch the app from embedded data to the API one screen at a time (VP view first). 5. Add SSO and `user_access`.
