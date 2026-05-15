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

[Unreleased]: https://github.com/anirudhs-ti/job-scheduler/compare/96b29dd...HEAD
