#!/usr/bin/env bash
# Enqueue an SFT job via the scheduler. Reads $SUPABASE_URL and $SFTQ_API_KEY.
#
# Example:
#   SUPABASE_URL=https://abc.supabase.co \
#   SFTQ_API_KEY=sftq_... \
#     ./examples/enqueue_sft.sh
set -euo pipefail

: "${SUPABASE_URL:?SUPABASE_URL not set}"
: "${SFTQ_API_KEY:?SFTQ_API_KEY not set}"

curl -sS -X POST "${SUPABASE_URL%/}/functions/v1/jobs-api/jobs" \
  -H "Authorization: Bearer ${SFTQ_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "SFT",
    "display_name": "qwen3-14b sft demo",
    "gpu_count": 4,
    "fireworks_payload": {
      "baseModel": "accounts/fireworks/models/qwen3-14b",
      "dataset": "accounts/trilogy/datasets/edullm-ela-sft-v3-thinking",
      "displayName": "qwen3-14b sft demo",
      "outputModel": "accounts/trilogy/models/edullm-ela-qwen3-14b-sft-demo",
      "evaluationDataset": "accounts/trilogy/datasets/edullm-ela-sft-val-v2",
      "epochs": 3,
      "learningRate": 0.0002,
      "loraRank": 32,
      "maxContextLength": 8192,
      "learningRateWarmupSteps": 10,
      "batchSize": 65536,
      "gradientAccumulationSteps": 1
    }
  }'
echo
