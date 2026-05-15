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
