import { authorize } from "@/lib/server/agent-auth";
import { applySabotage, snapshot } from "@/lib/server/app-state";
import { SCENARIOS } from "@/lib/evolution/scenarios";

/** The defect catalog, so a caller can discover what it may break. */
export async function GET() {
  return Response.json({
    scenarios: SCENARIOS.map(({ id, label, story, severity, breaks }) => ({
      id,
      label,
      story,
      severity,
      breaks,
    })),
  });
}

export async function POST(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;

  const { scenarioId } = (await request.json()) as { scenarioId: string };
  try {
    const { scenario, changes } = applySabotage(scenarioId);
    return Response.json({ applied: scenario.id, story: scenario.story, changes, state: snapshot() });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
