# Deploy Rationale: jobs-api Edge Function

**Status:** Adopted
**Date:** 2026-05-15
**Approach:** Local script wrapper (`scripts/deploy-jobs-api.sh`)

This document records *why* the jobs-api Edge Function is deployed via a checked-in shell script with specific flags baked in. Read it before changing the deploy flow or the auth module.

## Summary

The jobs-api Edge Function is deployed by running:

```sh
bash scripts/deploy-jobs-api.sh
```

That script wraps `supabase functions deploy jobs-api` with `--no-verify-jwt` and the project ref. The flag is **required**, not stylistic. See "The `--no-verify-jwt` requirement" below.

## Why a script wrapper (and not a GitHub Actions workflow)

A maintainer-run script was chosen over a CI-driven deploy for now:

- **T11b (branch protection) is pending user approval.** Auto-deploy on merge cannot be safely configured until a protected `main` branch is in place. Without branch protection, a CI deploy would happily ship whatever last-merged commit hits `main`, including unreviewed pushes.
- **Small project, infrequent deploys.** A local script is simpler, immediately executable, and requires no GitHub-secrets plumbing (`SUPABASE_ACCESS_TOKEN`, project-ref env, etc.).
- **Enforce mechanically (blog principle P5).** Baking flags into the script removes flag-choice from human memory and runbook copy-paste. The correct flag is the only flag the script can pass.
- **Repo is source of truth (blog principle P3).** Both the script and this rationale doc are versioned in the repo, so the deploy procedure and its reasoning travel with the code.
- **No duplication risk later.** A future GitHub Actions workflow can invoke the same script, so adopting the script now does not foreclose CI deploy. See "Deferred work" below.

## The `--no-verify-jwt` requirement

The flag is **required**. The jobs-api Edge Function authenticates entirely via `sftq_*` API keys: the Bearer token is sha256-hashed and looked up in the `api_keys` table (see `supabase/functions/_shared/auth.ts`). Clients never mint Supabase JWTs.

With Supabase's platform-level JWT gate enabled (the default for deployed Edge Functions), every legitimate API request would be rejected with a 401 before reaching our auth layer. Removing `--no-verify-jwt` therefore breaks every client.

**Do not remove `--no-verify-jwt` from the deploy script.** If you believe it should be removed, you are also proposing to change the authentication model of the function, and that requires:

1. A change to `supabase/functions/_shared/auth.ts` so clients can authenticate with Supabase JWTs.
2. A migration plan for existing `sftq_*` API keys.
3. PR review and explicit approval.

## The `auth.ts` dependency

Because `--no-verify-jwt` disables the platform JWT gate, `supabase/functions/_shared/auth.ts` is the **sole authenticator** for every request to jobs-api. There is no defense-in-depth from the platform layer.

Implications:

- A bug in `auth.ts` that allows a request through removes *all* authentication for the function.
- Any change to `auth.ts` must be treated as a security-critical change.
- The deploy script and the auth module are coupled: changing one without considering the other is a footgun.

## Security tradeoff and mitigations

The tradeoff is explicit: we trade platform-level JWT gating for the ability to authenticate clients with our own API-key scheme. Mitigations:

- **Test coverage.** `auth.ts` is covered by unit tests in `tests/`. Any change to the module must pass CI before it can merge.
- **Pending branch protection (T11b).** Once T11b lands, changes to `auth.ts` will additionally require review on a protected `main` branch, preventing direct pushes that bypass review.
- **Documented coupling.** This document exists so future maintainers see the reasoning before changing the flag, the script, or the auth module.

## How to deploy

1. Obtain a Supabase personal access token (`SUPABASE_ACCESS_TOKEN`) and the target project ref (`SUPABASE_PROJECT_REF`).
2. Export both in your shell.
3. Run `bash scripts/deploy-jobs-api.sh`.

See `CONTRIBUTING.md` ("Deploying the Edge Function") for the exact invocation and warnings.

**Never deploy to a production project ref without explicit human approval recorded in the PR.**

## Deferred work

A GitHub Actions workflow that auto-deploys on merge to `main` is a reasonable future state, but it has unmet prerequisites:

- Requires `SUPABASE_ACCESS_TOKEN` (and related) secrets configured in the GitHub repo.
- Requires T11b branch protection so that merges to `main` are reviewed and gated.
- Adds CI surface area and failure modes that are not justified at current deploy cadence.

It is **deferred, not rejected**. Once T11b is approved and merged, a workflow can be added that simply invokes `scripts/deploy-jobs-api.sh` — preserving a single source of truth for deploy flags.

## See also

- `scripts/deploy-jobs-api.sh` — the deploy script itself.
- `supabase/functions/_shared/auth.ts` — the auth module that this deploy configuration depends on.
- `CONTRIBUTING.md` — step-by-step deploy invocation.
