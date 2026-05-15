# Contributing to job-scheduler

## PR-only flow

All changes to this repo must go through a pull request. No direct pushes to `main`.

1. Create a feature branch: `git switch -c feature/<short-description>`
2. Push it: `git push -u origin feature/<short-description>`
3. Open a PR against `main` on GitHub.
4. CI must be green before merge (see [CI workflow](.github/workflows/ci.yml)).
5. Use squash-merge.

## No force push

Force pushes (`--force`, `--force-with-lease`) are prohibited on all branches.
They rewrite remote history, making concurrent agent PRs impossible to reconcile.

If you need to amend history:
- For in-progress work: push to a new branch name (`feature/foo-v2`) and open a new PR.
- To undo a commit: use `git revert <sha>` and push the revert commit.

The `pre-push` hook enforces this mechanically. See `scripts/git-hooks/pre-push`.

## Installing the git hooks

For a fresh clone, run once:

```sh
bash scripts/git-hooks/install.sh
```

Or manually: `git config core.hooksPath scripts/git-hooks`

This sets Git to use the repo-versioned hooks in `scripts/git-hooks/` rather than `.git/hooks/`. Required for every fresh clone.

## Bypassing hooks

`git push --no-verify` bypasses the pre-push hook. This is a **social violation**, not a technical safeguard. CI is the second line of defense (required status check). Branch protection (PR-required, CI-required) is the third.

Use `--no-verify` only in an emergency and document why in the PR description.

## Deploying the Edge Function

The `jobs-api` Supabase Edge Function is deployed by a checked-in script,
`scripts/deploy-jobs-api.sh`. See [`docs/deploy-rationale.md`](docs/deploy-rationale.md)
for the full background on why a local script (rather than a GitHub Actions
workflow) is used, why `--no-verify-jwt` is required, and the resulting
security tradeoffs.

### Step-by-step

```sh
export SUPABASE_ACCESS_TOKEN=<your-personal-access-token>
export SUPABASE_PROJECT_REF=<your-project-ref>
bash scripts/deploy-jobs-api.sh
```

The script performs preflight checks on the two environment variables and
then runs `supabase functions deploy jobs-api --no-verify-jwt --project-ref "$SUPABASE_PROJECT_REF"`.

### ⚠️ Do not remove `--no-verify-jwt`

`--no-verify-jwt` is baked into the script intentionally. The function is
authenticated solely by `sftq_*` API keys via
`supabase/functions/_shared/auth.ts`; with the platform-level JWT gate
enabled, every legitimate request would be rejected before reaching the auth
layer. **Never remove `--no-verify-jwt` without first reading
[`docs/deploy-rationale.md`](docs/deploy-rationale.md) in full.** Doing so
will break every client.

### ⚠️ Production deploys require human approval

Do **not** run this script against a production project ref without explicit
human approval recorded in the PR. The script will deploy to whatever
`SUPABASE_PROJECT_REF` you export — there is no built-in environment
guardrail. Treat the project ref you export as a load-bearing decision.
