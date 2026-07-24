import type { GuardId } from "@/lib/domain/types";
import { authorize } from "@/lib/server/agent-auth";
import { applyPatch, snapshot } from "@/lib/server/app-state";

/** Repair the guard a finding maps to, and report whether it actually helped. */
export async function POST(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;

  const { guard } = (await request.json()) as { guard: GuardId };
  try {
    const result = applyPatch(guard);
    return Response.json({ ...result, state: snapshot() });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
