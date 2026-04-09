# Content Hub Staging Contract

## Environment Contract

| Environment | URL                                                  | Health          | Data source                                        | Secrets owner                                                       | Rollback                                                                                  |
| ----------- | ---------------------------------------------------- | --------------- | -------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Preview     | Cloudflare Pages preview URL for the staging project | `/healthz.json` | Staging Supabase project and staging storage       | GitHub repo secrets (`STAGING_*`) + Cloudflare Pages project config | Redeploy the previous preview deployment from Cloudflare Pages                            |
| Staging     | `https://content-hub-staging.populationmatters.org`  | `/healthz.json` | Staging Supabase project and staging storage       | GitHub repo secrets (`STAGING_*`) + Cloudflare Pages project config | Restore the previous successful staging deployment in Cloudflare Pages                    |
| Production  | Existing GitHub Pages URL/custom domain              | `/healthz.json` | Production Supabase project and production storage | Existing GitHub repository secrets                                  | Restore the previous successful GitHub Pages deployment from the Pages deployment history |

## CI Contract

- Pull requests deploy a Cloudflare Pages preview from the staging project.
- Pushes to `main` promote the latest commit to the persistent staging deployment.
- Production deploys are manual-only through `.github/workflows/deploy.yml`.
- Promotion gate before production:
  - `npm run build`
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
  - Smoke check `https://content-hub-staging.populationmatters.org/healthz.json`
  - Manual auth and publish smoke checks

## Integration Contract

- Staging must use a separate Supabase project, storage bucket, OAuth redirect URIs, and notification recipients.
- Staging publish flows must never post to production social accounts. Use sandbox/test app credentials only.
- Webhooks and callback URLs must point to the staging domain, not the production domain.
- Any unavoidable production dependency must be read-only and documented before release approval.

## Required Secrets

- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_ANON_KEY`
- `STAGING_META_APP_ID`
- `STAGING_META_FLOB_CONFIG_ID`
- `STAGING_LINKEDIN_CLIENT_ID`
- `STAGING_LINKEDIN_ORG_CLIENT_ID`
- `STAGING_GOOGLE_CLIENT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CF_PAGES_STAGING_PROJECT`
