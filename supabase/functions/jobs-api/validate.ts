// Pure validators for the jobs-api. Kept as free functions so Node tests
// can cover them without stubbing Supabase.

import type { Kind } from "../_shared/providers.ts";
import { VALID_KINDS } from "../_shared/providers.ts";

export const TERMINAL_STATES = new Set(["SUCCESS", "FAIL", "CANCELLED"]);

export interface UnifiedJobInput {
  kind: Kind;
  base_model: string;
  dataset: string;
  display_name: string | null;
  gpu_count: number;
  hyperparameters: Record<string, unknown> | null;
  preferred_provider: string | null;
  provider_overrides: Record<string, unknown> | null;
  // Legacy backward compat
  fireworks_payload: Record<string, unknown> | null;
}

export interface ValidationError {
  message: string;
}

export function validateEnqueue(
  raw: unknown,
): { ok: true; value: UnifiedJobInput } | { ok: false; err: ValidationError } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, err: { message: "body must be a JSON object" } };
  }
  const body = raw as Record<string, unknown>;

  // --- kind (required) ---
  const kind = body.kind;
  if (typeof kind !== "string" || !VALID_KINDS.has(kind as Kind)) {
    return { ok: false, err: { message: "kind must be 'SFT', 'DPO', or 'RFT'" } };
  }

  // --- Legacy mode: fireworks_payload present -> skip unified schema validation ---
  const legacyPayload = body.fireworks_payload;
  const isLegacy = legacyPayload !== undefined && legacyPayload !== null;

  if (isLegacy) {
    if (typeof legacyPayload !== "object") {
      return { ok: false, err: { message: "fireworks_payload must be an object" } };
    }

    // Validate gpu_count in legacy mode too
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

    // Validate display_name in legacy mode too
    const displayName = body.display_name;
    if (displayName !== undefined && displayName !== null && typeof displayName !== "string") {
      return { ok: false, err: { message: "display_name must be a string" } };
    }

    return {
      ok: true,
      value: {
        kind: kind as Kind,
        base_model: "",
        dataset: "",
        display_name: (displayName as string | null | undefined) ?? null,
        gpu_count: gpu,
        hyperparameters: null,
        preferred_provider: "fireworks",
        provider_overrides: null,
        fireworks_payload: legacyPayload as Record<string, unknown>,
      },
    };
  }

  // --- Unified schema mode ---

  // base_model (required)
  const baseModel = body.base_model;
  if (typeof baseModel !== "string" || !baseModel.trim()) {
    return { ok: false, err: { message: "base_model is required" } };
  }

  // dataset (required)
  const dataset = body.dataset;
  if (typeof dataset !== "string" || !dataset.trim()) {
    return { ok: false, err: { message: "dataset is required" } };
  }

  // display_name (optional)
  const displayName = body.display_name;
  if (displayName !== undefined && displayName !== null && typeof displayName !== "string") {
    return { ok: false, err: { message: "display_name must be a string" } };
  }

  // gpu_count (optional, default 4)
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

  // hyperparameters (optional)
  const hyperparameters = body.hyperparameters;
  if (hyperparameters !== undefined && hyperparameters !== null) {
    if (typeof hyperparameters !== "object") {
      return { ok: false, err: { message: "hyperparameters must be an object" } };
    }
  }

  // preferred_provider (optional, default 'fireworks')
  let preferredProvider: string | null = "fireworks";
  if (body.preferred_provider !== undefined) {
    if (typeof body.preferred_provider !== "string") {
      return { ok: false, err: { message: "preferred_provider must be a string" } };
    }
    const allowed = new Set(["fireworks", "primeintellect"]);
    if (!allowed.has(body.preferred_provider)) {
      return {
        ok: false,
        err: { message: "preferred_provider must be 'fireworks' or 'primeintellect'" },
      };
    }
    preferredProvider = body.preferred_provider;
  }

  // provider_overrides (optional)
  const providerOverrides = body.provider_overrides;
  if (providerOverrides !== undefined && providerOverrides !== null) {
    if (typeof providerOverrides !== "object") {
      return { ok: false, err: { message: "provider_overrides must be an object" } };
    }
  }

  return {
    ok: true,
    value: {
      kind: kind as Kind,
      base_model: baseModel,
      dataset: dataset,
      display_name: (displayName as string | null | undefined) ?? null,
      gpu_count: gpu,
      hyperparameters: (hyperparameters as Record<string, unknown> | null | undefined) ?? null,
      preferred_provider: preferredProvider,
      provider_overrides: (providerOverrides as Record<string, unknown> | null | undefined) ?? null,
      fireworks_payload: null,
    },
  };
}
