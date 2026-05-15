# tests/ — Test Suite Index (P-T1, P-T5)

`npm test` runs `node --test "tests/*.test.js"` against the four files in this
directory. Start here when navigating the suite:

| File | What it covers |
|---|---|
| [`admission.test.js`](./admission.test.js) | Unit tests for the admission loop: FIFO order, per-user small/big caps, big-job headroom reserve, and Fireworks-launch failure handling. Pure logic — no Postgres, no live Fireworks. |
| [`fireworks.test.js`](./fireworks.test.js) | Fireworks API client behavior: status mapping, retry/backoff, error shapes. |
| [`hash.test.js`](./hash.test.js) | API-key hashing/verification helpers used by `jobs-api`. |
| [`jobs-api.validate.test.js`](./jobs-api.validate.test.js) | Request validation for the `jobs-api` Edge Function (payload shape, kind/gpu_count rules, auth header parsing). |

## Subdirectories

- [`fixtures/`](./fixtures/) — Shared fixture factories (e.g. `mkJob`) imported
  by multiple test files. Add new factories here rather than inlining duplicate
  helpers per file.
- [`invariants/`](./invariants/) — Structural invariant tier (P-T2). Empty
  placeholder for now; see [`invariants/README.md`](./invariants/README.md)
  for the planned scope (one-PROGRESS-per-user, GPU quota ≥ 0, FIFO admission).
