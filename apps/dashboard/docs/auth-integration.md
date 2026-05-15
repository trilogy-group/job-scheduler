# Dashboard Auth Integration

This document tracks the dashboard's authentication posture and the
forward path to a real identity provider (Keycloak via NextAuth).

## 1. Current State — Single-User Bypass

The dashboard is currently deployed in **single-user mode**. There is
no interactive sign-in. Every request is served as a fixed user whose
UUID is supplied via an environment variable:

```
DASHBOARD_USER_ID=<uuid>
```

- Set in the Amplify Console (App settings → Environment variables).
- Read by the dashboard server code on each request; the value is
  treated as the authenticated `user_id` for all data fetches against
  the `jobs_enriched` view and related Supabase queries.
- This bypass exists so the dashboard can ship before the SSO rollout.
  It is **not** safe for multi-tenant exposure — keep the Amplify app
  behind an allow-list / VPN / Cloudfront WAF until SSO lands.

> Removing this variable while no other auth is configured will cause
> every page to 500. Do not unset it until step 2(b) below is complete.

## 2. Keycloak Integration Path (3 steps)

The intended end state is OIDC sign-in against the existing Keycloak
realm, with NextAuth.js handling session cookies. Migration is staged
so the bypass can stay live until the cutover.

### (a) Provision the Keycloak client

In the Keycloak admin console for the target realm:

1. Create a new **OpenID Connect** client with client ID
   `job-scheduler-dashboard`.
2. Set **Access Type** to *confidential*, enable **Standard Flow**.
3. Add **Valid Redirect URI**:
   `https://<amplify-domain>/api/auth/callback/keycloak`.
4. Add **Web Origin**: `https://<amplify-domain>`.
5. From the *Credentials* tab, copy the generated client secret.
6. Record the realm **issuer URL**
   (`https://<keycloak-host>/realms/<realm>`).

Hand the three values (issuer, client id, client secret) to whoever
manages the Amplify Console.

### (b) Configure Amplify env vars and remove the bypass

In the Amplify Console → App settings → Environment variables, set the
five `KEYCLOAK_DEFERRED` stubs that currently sit commented out in
`apps/dashboard/amplify.yml`:

```
KEYCLOAK_ISSUER=<from step a>
KEYCLOAK_CLIENT_ID=job-scheduler-dashboard
KEYCLOAK_CLIENT_SECRET=<from step a>
NEXTAUTH_SECRET=$(openssl rand -base64 32)   # generate once, store in Amplify
NEXTAUTH_URL=https://<amplify-domain>
```

Then **remove** `DASHBOARD_USER_ID` from the same env var screen and
redeploy. The next deploy will use NextAuth instead of the bypass.

### (c) Wire NextAuth into the Next.js app

Code changes required in `apps/dashboard/`:

1. Add the route handler `app/api/auth/[...nextauth]/route.ts` that
   exports a NextAuth handler configured with the Keycloak provider:

   ```ts
   import NextAuth from "next-auth";
   import Keycloak from "next-auth/providers/keycloak";

   const handler = NextAuth({
     providers: [
       Keycloak({
         issuer: process.env.KEYCLOAK_ISSUER,
         clientId: process.env.KEYCLOAK_CLIENT_ID!,
         clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
       }),
     ],
   });

   export { handler as GET, handler as POST };
   ```

2. Wrap the root layout (or a top-level client component) with
   `<SessionProvider>` from `next-auth/react` so pages can call
   `useSession()`.

3. Replace every `process.env.DASHBOARD_USER_ID` read with the
   `user_id` from the resolved session (server-side: `getServerSession`;
   client-side: `useSession`). Delete the bypass branch once the
   replacement is verified in a preview deploy.

## 3. One-Time Amplify App Creation

The Amplify app itself needs to be created **once**, before any
deploys. The command below is the canonical invocation — but it is
**production-touching, requires human approval, and must not be run
by an automated agent**.

> ⚠️ Do **NOT** execute this command from a worker session. Hand it to
> the human operator and have them run it (or run it through the AWS
> Console) after confirming the IAM service role ARN.

```bash
aws amplify create-app \
  --name job-scheduler-dashboard \
  --platform WEB_COMPUTE \
  --repository https://github.com/trilogy-group/job-scheduler \
  --iam-service-role-arn PLACEHOLDER \
  --region us-east-1
```

Argument notes:

- `--platform WEB_COMPUTE` is required for Next.js SSR (App Router,
  route handlers, middleware). The default `WEB` platform only
  supports fully static exports.
- `--iam-service-role-arn PLACEHOLDER` — replace with the ARN of the
  Amplify service role that has permission to read CloudWatch logs,
  pull the GitHub source, and (if needed) read SSM parameters. The
  operator running the command supplies this value.
- `--region us-east-1` is the default region for this project.

### GitHub connection (Console step)

`create-app` only registers the app; it does **not** wire the GitHub
source. After the app exists:

1. Open the Amplify Console → the new `job-scheduler-dashboard` app.
2. Click **Connect repository**.
3. Choose **GitHub** and authorize the **AWS Amplify GitHub App** for
   the `trilogy-group` organization (or accept the existing
   installation).
4. Select the `job-scheduler` repository and the `main` branch.
5. Confirm the build spec is read from `apps/dashboard/amplify.yml`
   (Amplify auto-detects the monorepo `appRoot`).
6. Save and trigger the initial deploy.

Subsequent branches (preview environments) can be added from the same
Console screen — they will inherit the `amplify.yml` build spec.
