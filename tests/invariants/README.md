# tests/invariants — Structural Invariant Tier (P-T2)

This directory is reserved for **structural / architecture-enforcement tests** that
assert the scheduler's hard invariants hold across any sequence of admissions,
reconciliations, and cancellations. These are the rules the system must never
violate, expressed as properties rather than scenario-level assertions:

1. **At most one `PROGRESS` job per user** at any moment.
2. **GPU quota never goes negative** — the sum of admitted live GPU usage
   across SFT + DPO endpoints stays ≤ `FIREWORKS_GPU_QUOTA`.
3. **FIFO admission order** — among eligible jobs, the earliest `created_at`
   is always admitted first.

## Status

No test files live here yet. This tier will be populated by tickets **T10+**
(see `bd list` and `milestones.md`). Until then, the structural invariants are
exercised indirectly by the scenario tests in `tests/admission.test.js`.

## Conventions (for future files)

- Filenames: `*.invariant.test.js` (still matched by `tests/*.test.js`?
  No — note that `npm test` currently uses the glob `tests/*.test.js`, which
  does **not** recurse. When invariant tests are added, either the glob will
  be widened or files will be hoisted; see the T10+ ticket for the chosen
  approach.)
- Each test should generate or enumerate a family of inputs and assert the
  invariant over the entire family, rather than checking a single scenario.
