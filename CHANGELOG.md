# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Pre-push git hook** (`scripts/git-hooks/pre-push`, `scripts/git-hooks/install.sh`): blocks direct pushes to `main` and any force-push, enforcing the PR-only merge flow. Covers both `git push origin main` and `git push --force` variants (T03 harness-engineering alignment).

- **CI workflow** (`.github/workflows/ci.yml`): runs `npm test` on every pull request and push to `main` via GitHub Actions (Node 22, unquoted glob, `--experimental-strip-types` flag). Ensures the admission-invariant test suite is a required gate before merge (T06).

- **Deploy script** (`scripts/deploy-jobs-api.sh`): dry-run-first helper for deploying the `jobs-api` Edge Function. Makes the deploy path explicit and auditable; prevents accidental production deploys (T09).

- **CONTRIBUTING.md**: documents the PR-only merge flow, commit conventions, pre-push hook installation steps, and the CI gate contract. Establishes the development process for future contributors.

- **`docs/deploy-rationale.md`**: explains why the deploy script exists, when to run it, what the dry-run flag does, and how it relates to the CI gate. Captures the decision context so future engineers don't bypass it unknowingly.

- **Test harness scaffolding** (`tests/fixtures/jobs.js`, `tests/invariants/README.md`, `tests/README.md`): fixture data, invariant documentation, and harness orientation notes supporting the admission-invariant test suite introduced alongside the CI gate.

- **Markdown linter** (`npm run lint:md`): runs `prettier --check "**/*.md"` as a dev-time tool to catch formatting drift in documentation files. Uses prettier@latest (^3.8.3) as a devDependency. Non-blocking on CI by design; run locally before PRs. (`#4`)

- **User analytics page** (`apps/dashboard/src/app/users/[id]/page.tsx`): RSC page showing per-user metrics — total jobs, success rate, GPU-hours consumed, fairness-violation count. Includes an O(n²) FIFO-violation detector and a per-job history table sortable via `?sort=asc|desc` query param. Bar chart (recharts) renders jobs-over-time by day. (`#6`)

- **Playwright accessibility tests** (`apps/dashboard/tests/e2e/dashboard-a11y.spec.ts`): end-to-end axe-core accessibility audit for /queue, /jobs/[id], and /users/[id]. Verifies zero violations and presence of `<main>` landmark on every route. (`#8`)

- **Landmark fixes**: wrapped page content in `<main>` on /queue, /jobs/[id], and /users/[id] routes to satisfy WCAG 2.1 landmark requirements. (`#8`)

- **`scheduler_ticks` table** (`supabase/migrations/0005_scheduler_ticks.sql`): append-only GPU-utilisation history for dashboard spark-lines. Columns: id, ticked_at, active_gpu_count, queued_count, in_progress_count. (`#12`)

- **`jobs_enriched` view** (`supabase/migrations/0005_scheduler_ticks.sql`): normalised read model over `public.jobs` exposing kind-aware JSONB fields: base_model, output_model, dataset, failure_class. Eliminates per-call JSONB path logic in dashboard routes. (`#12`)

- **Seed fixtures** (`supabase/seed.sql`, `scripts/seed-dashboard.ts`, `scripts/dashboard-fixtures.ts`): 30+ synthetic jobs spanning all states/kinds with FIFO violation pairs and GPU-quota-pressure scenarios. `dashboard-fixtures.ts` exports helpers for UI-tester mutation rounds (simulateFifoViolation, simulateQuotaExhaustion, resetToBaseline). (`#12`)

[Unreleased]: https://github.com/anirudhs-ti/job-scheduler/compare/96b29dd...HEAD
