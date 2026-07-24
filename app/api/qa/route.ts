import { listBugs, listExplorations, replayConfigured } from "@/lib/server/replay";

/** Live QA state: what Replay Loop QA has actually found on this deployment. */
export async function GET() {
  if (!replayConfigured()) {
    return Response.json(
      { configured: false, error: "REPLAY_QA_TOKEN / REPLAY_QA_PROJECT_ID not set" },
      { status: 503 },
    );
  }
  try {
    const [bugs, explorations] = await Promise.all([listBugs(), listExplorations()]);
    return Response.json({
      configured: true,
      bugs: bugs.items,
      openCount: bugs.total - (bugs.resolvedCount ?? 0),
      resolvedCount: bugs.resolvedCount ?? 0,
      totalBugs: bugs.total,
      explorations: explorations.items,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 });
  }
}
