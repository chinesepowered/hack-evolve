import "server-only";

/**
 * The control endpoints are reachable from the public internet during the demo
 * (the Guild agent and Replay both need to hit them), so mutating routes take a
 * shared secret when one is configured. Unset in local development, where the
 * app is only on localhost.
 */
export function authorize(request: Request): Response | null {
  const expected = process.env.REGENESIS_AGENT_TOKEN;
  if (!expected) return null;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== expected) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
