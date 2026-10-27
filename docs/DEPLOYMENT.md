# Deployment

## What gets deployed
A static site (`dist-web/`, about 7 MB, 4.6 MB gzipped) produced by `npm run web:build`. Today all data is embedded in it, so there is no backend yet. The build needs the private data pack (`data/`), which is not in git.

## Local
```bash
# 1. unpack the data pack into data/ (private zip, see data/README.md)
pip install openpyxl && npm install
npm test            # assemble + bundle + 149 smoke checks
npm run web:dev     # http://localhost:5173
npm run web:build   # -> dist-web/
```

## Option A: S3 + CloudFront (recommended for the static phase)
1. Private S3 bucket for the site; CloudFront distribution with Origin Access Control, default root `index.html`, SPA fallback (403/404 -> `/index.html`), compression on.
2. Private S3 bucket for the data pack (`target-tracker-data/`), versioned, SSE-KMS.
3. GitHub OIDC role (no long-lived keys) with read on the data bucket, write on the site bucket, `cloudfront:CreateInvalidation`.
4. Set the repository variables / secrets named at the top of `.github/workflows/ci-deploy.yml` and enable it. Assets get a 30-day immutable cache; `index.html` is `no-cache`.
5. Put the site behind SSO (CloudFront + Lambda@Edge / Cognito, or an identity-aware proxy): the embedded data is commercial data, so it must not be public.

## Option B: container
`npm run web:build` then `docker build -t target-tracker .` (nginx serving `dist-web/`, see `Dockerfile` / `nginx.conf`) on ECS/Fargate behind an ALB with OIDC authentication. Untested here: no container runtime was available.

## The live phase (API + Redshift)
When the API exists, the static site stops embedding data and calls it:
- API Gateway + Lambda (or a container) with a read-only Redshift identity from Secrets Manager, queries through the Redshift Data API or a pooled connection, 5-15 minute cache, scope enforced from the SSO identity (`app.user_access`).
- Scheduled jobs build the daily scorecard table and load targets (see `docs/ARCHITECTURE.md`, T3-T5).
- Environments: dev / staging / prod with separate Redshift users; secrets only in Secrets Manager. `.env.example` lists the variables the API will need.

## Status
Validated here: assemble is byte-reproducible, 149 smoke checks pass, the Vite production build succeeds. Not validated here (no AWS / Docker access): the CI workflow, the Dockerfile, the AWS resources.
