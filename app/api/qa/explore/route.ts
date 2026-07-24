import { authorize } from "@/lib/server/agent-auth";
import { replayConfigured, startExploration } from "@/lib/server/replay";

/** Trigger a fresh autonomous exploration of the deployed app. */
export async function POST(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;

  if (!replayConfigured()) {
    return Response.json({ error: "Replay Loop QA is not configured" }, { status: 503 });
  }
  const { prompt } = ((await request.json().catch(() => ({}))) ?? {}) as { prompt?: string };
  try {
    const exploration = await startExploration(prompt);
    return Response.json({ exploration });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 });
  }
}
