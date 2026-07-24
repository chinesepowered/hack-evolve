import { authorize } from "@/lib/server/agent-auth";
import { resetToBaseline, snapshot } from "@/lib/server/app-state";

export async function POST(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;

  resetToBaseline();
  return Response.json({ ok: true, state: snapshot() });
}
