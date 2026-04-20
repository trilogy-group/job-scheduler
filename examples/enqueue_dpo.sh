#!/usr/bin/env bash
# Enqueue a DPO job via the scheduler.
set -euo pipefail

: "${SUPABASE_URL:?SUPABASE_URL not set}"
: "${SFTQ_API_KEY:?SFTQ_API_KEY not set}"

curl -sS -X POST "${SUPABASE_URL%/}/functions/v1/jobs-api/jobs" \
  -H "Authorization: Bearer ${SFTQ_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "DPO",
    "display_name": "qwen3-14b dpo demo",
    "gpu_count": 4,
    "fireworks_payload": {
      "dataset": "accounts/trilogy/datasets/<your-dpo-dataset-id>",
      "displayName": "qwen3-14b dpo demo",
      "lossConfig": { "method": "DPO" },
      "trainingConfig": {
        "warmStartFrom": "accounts/trilogy/models/<your-sft-model>",
        "outputModel": "accounts/trilogy/models/edullm-ela-qwen3-14b-dpo-demo",
        "epochs": 2,
        "learningRate": 0.00005,
        "loraRank": 32,
        "maxContextLength": 8192,
        "learningRateWarmupSteps": 10,
        "batchSize": 65536,
        "gradientAccumulationSteps": 1
      }
    }
  }'
echo
