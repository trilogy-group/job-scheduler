#!/usr/bin/env bash
# Enqueue an RFT (reinforcement fine-tuning) job via the scheduler.
#
# Required env: SUPABASE_URL, SFTQ_API_KEY.
# Adjust dataset / evaluator / baseModel below to your real resources.
set -euo pipefail

: "${SUPABASE_URL:?SUPABASE_URL not set}"
: "${SFTQ_API_KEY:?SFTQ_API_KEY not set}"

curl -sS -X POST "${SUPABASE_URL%/}/functions/v1/jobs-api/jobs" \
  -H "Authorization: Bearer ${SFTQ_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "RFT",
    "display_name": "math-rft-grpo-demo",
    "gpu_count": 4,
    "fireworks_payload": {
      "displayName": "math-rft-grpo-demo",
      "dataset": "accounts/trilogy/datasets/<your-rft-prompts>",
      "evaluator": "accounts/trilogy/evaluators/<your-evaluator>",
      "trainingConfig": {
        "baseModel": "accounts/fireworks/models/qwen3-14b",
        "learningRate": 0.00001,
        "loraRank": 32,
        "epochs": 1,
        "batchSize": 64
      },
      "lossConfig": { "method": "GRPO", "klBeta": 0.1 },
      "inferenceParameters": {
        "maxOutputTokens": 1024,
        "temperature": 0.7,
        "topP": 0.9,
        "responseCandidatesCount": 4
      }
    }
  }'
echo
