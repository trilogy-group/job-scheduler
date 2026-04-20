// Pure validators for the jobs-api. Kept as free functions so Node tests
// can cover them without stubbing Supabase.

import type { Kind } from "../_shared/fireworks.ts";

export const VALID_KINDS = new Set<Kind>(["SFT", "DPO"]);
export const TERMINAL_STATES = new Set(["SUCCESS", "FAIL", "CANCELLED"]);

export interface EnqueueInput {
  kind: Kind;
  display_name: string | null;
  gpu_count: number;
  fireworks_payload: Record<string, unknown>;
}

export interface ValidationError {
  message: string;
}

export function validateEnqueue(
  raw: unknown,
): { ok: true; value: EnqueueInput } | { ok: false; err: ValidationError } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, err: { message: "body must be a JSON object" } };
  }
  const body = raw as Record<string, unknown>;

  const kind = body.kind;
  if (typeof kind !== "string" || !VALID_KINDS.has(kind as Kind)) {
    return { ok: false, err: { message: "kind must be 'SFT' or 'DPO'" } };
  }

  const payload = body.fireworks_payload;
  if (!payload || typeof payload !== "object") {
    return { ok: false, err: { message: "fireworks_payload is required" } };
  }

  let gpu = 4;
  if (body.gpu_count !== undefined) {
    if (
      typeof body.gpu_count !== "number" ||
      !Number.isInteger(body.gpu_count) ||
      body.gpu_count <= 0
    ) {
      return {
        ok: false,
        err: { message: "gpu_count must be a positive integer" },
      };
    }
    gpu = body.gpu_count;
  }

  const displayName = body.display_name;
  if (displayName !== undefined && displayName !== null && typeof displayName !== "string") {
    return { ok: false, err: { message: "display_name must be a string" } };
  }

  return {
    ok: true,
    value: {
      kind: kind as Kind,
      display_name: (displayName as string | null | undefined) ?? null,
      gpu_count: gpu,
      fireworks_payload: payload as Record<string, unknown>,
    },
  };
}
