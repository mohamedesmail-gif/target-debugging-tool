# Hosting on AWS

1. **App code** (static, ~270 KB): `npm run web:build` produces `dist-web/`; upload it to S3 and serve it through CloudFront (or use the Dockerfile + nginx on ECS).
2. **Data**: `dist/payload.json` (about 11 MB, about 3 MB gzipped). Put it in a private S3 bucket behind CloudFront (origin access control), `Content-Encoding: gzip`, short cache (5 minutes).
3. **Config**: before the app starts set `window.PORTAL_CONFIG = { payloadUrl: "https://<cloudfront-domain>/payload.json" }` (for example in `web/index.html`), or pass `payloadUrl` as a prop. Default: `/payload.json`.
4. **Refresh**: schedule `jobs/refresh_payload.py --month <first of month>` (EventBridge + ECS task or a Lambda container; it needs `redshift_connector`, `openpyxl`, `boto3`, read access to `mart` and the `public` tables listed in `docs/DATA_SOURCES.md`, and write access to the bucket). Run it after the mart load. The connection code of the job has not been run against the warehouse; the SQL it uses was run through Metabase.
5. **Access**: the payload holds everyone's numbers, so anyone who can open the URL sees everything. Login and permissions are switched off for now (`AUTH_ENABLED` in `src/m9_auth.jsx`). Before opening the app beyond the commercial team, put CloudFront behind SSO (Cognito / Google) or filter the payload per person on the server (`docs/ACCESS.md`).
