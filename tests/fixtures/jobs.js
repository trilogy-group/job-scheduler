// Shared fixture factory for job rows (P-T5 — co-located fixtures)

/**
 * Build a job row fixture suitable for admission/scheduler unit tests.
 *
 * @param {number|string} id - Job id (also used to derive a deterministic created_at second).
 * @param {string} user - Owning user id.
 * @param {string} [kind='SFT'] - Job kind (e.g. 'SFT' or 'DPO').
 * @param {number} [gpu=4] - GPU count requested.
 * @param {string} [created_at] - ISO timestamp; defaults to a deterministic value derived from `id`.
 * @param {string} [gpu_type='h200'] - GPU type requested (h200/b200/h100).
 * @returns {{id: any, user_id: string, kind: string, gpu_count: number, gpu_type: string, created_at: string}}
 */
export function mkJob(id, user, kind = 'SFT', gpu = 4, created_at = `2026-04-20T00:00:0${id}Z`, gpu_type = 'h200') {
  return { id, user_id: user, kind, gpu_count: gpu, gpu_type, created_at };
}
