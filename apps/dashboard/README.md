# job-scheduler-dashboard

Next.js (SSR) dashboard for the Fireworks RFT job scheduler. Hosted on AWS Amplify (WEB_COMPUTE).

## Deployment

Hosted on [AWS Amplify Hosting](https://d2y6yvvlxvd81b.amplifyapp.com) (WEB_COMPUTE / Next.js SSR, us-east-1).

| Property | Value |
|---|---|
| **Live URL** | https://d2y6yvvlxvd81b.amplifyapp.com |
| **App ID** | `d2y6yvvlxvd81b` |
| **Branch** | `main` (auto-build on push) |

Build config: [`amplify.yml`](../../amplify.yml) at repo root — defines preBuild/build phases for the Next.js app.

### Environment variables (set in Amplify Console)

| Variable | Purpose |
|---|---|
| `DASHBOARD_USER_ID` | UUID of the single active user (single-user auth bypass) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

### Infra record

Machine-readable config: [`infra/amplify.json`](../../infra/amplify.json)

## Seed Data Policy — NEVER seed against prod

**Incident 2026-05-15:** `supabase db push --linked --include-seed` was accidentally run against the prod project ref `mteiejqiocldpdaxjmra`. This pushed 30 synthetic jobs and 5 synthetic users (alice/bob/carol/dave/eve) to the live database, polluting the `/queue` page.

**Cleanup:** 30 synthetic jobs + 5 synthetic users were deleted from prod on 2026-05-15. Rollback SQL archived at `drafts/prod-cleanup-full-backup.sql`.

**Prevention measures now in place:**
1. `supabase/config.toml` — `[db.seed] enabled = false` by default. Only enable temporarily for `supabase db reset` on local.
2. `supabase/seed.sql` — `inet_server_addr()` guard at top: raises EXCEPTION if run against a non-private-IP host.
3. `package.json` `seed` script — refuses if `SUPABASE_URL` is not localhost/127.0.0.1/kong.
4. `/queue` page — `export const dynamic = 'force-dynamic'` added so the page always server-renders from live DB data (not build-time cache).

**Rules:**
- Never run `npm run seed` or `supabase db push --include-seed` with a remote `SUPABASE_URL`.
- For local dev: `supabase db reset` (this applies seed.sql only to local Postgres).
- For prod schema changes: `supabase db push --linked` (WITHOUT `--include-seed`).
