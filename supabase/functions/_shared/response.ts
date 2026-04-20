// Tiny JSON response helpers used by the Edge Functions.

export function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export function error(
  status: number,
  message: string,
  extra: Record<string, unknown> = {},
): Response {
  return json({ error: message, ...extra }, status);
}
