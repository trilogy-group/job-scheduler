#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# deploy-jobs-api.sh — Deploy the jobs-api Supabase Edge Function.
#
# WHY --no-verify-jwt IS BAKED IN:
#   (a) The jobs-api Edge Function is authenticated solely by sftq_* API keys.
#       Bearer tokens are sha256-hashed and looked up in the api_keys table
#       (see supabase/functions/_shared/auth.ts). Clients never mint Supabase
#       JWTs.
#   (b) With Supabase's platform-level JWT gate enabled (the default), every
#       legitimate request would be rejected before reaching auth.ts. Do NOT
#       remove --no-verify-jwt or every request will be rejected at the
#       platform layer with a 401 before our auth code runs.
#   (c) See docs/deploy-rationale.md for the full rationale, security
#       tradeoffs, and mitigations.
# ----------------------------------------------------------------------------

set -euo pipefail

# Preflight: required environment variables
: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is not set. Export your Supabase personal access token before running this script. See docs/deploy-rationale.md and CONTRIBUTING.md for details.}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF is not set. Export the target Supabase project ref before running this script. See docs/deploy-rationale.md and CONTRIBUTING.md for details.}"

echo "Deploying jobs-api Edge Function to project ref: ${SUPABASE_PROJECT_REF}"
echo "Flag baked in: --no-verify-jwt (required; see docs/deploy-rationale.md)"

supabase functions deploy jobs-api \
  --no-verify-jwt \
  --project-ref "$SUPABASE_PROJECT_REF"

echo "✅ jobs-api deployed successfully to project ref: ${SUPABASE_PROJECT_REF}"
