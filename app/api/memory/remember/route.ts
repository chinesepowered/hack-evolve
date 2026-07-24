import type { GuardId } from "@/lib/domain/types";
import { embed } from "@/lib/evolution/embeddings";
import { getPoint, upsertPoints } from "@/lib/server/actian";

/**
 * Store a proven fix as agent memory.
 *
 * Keyed by guard so a repeat of the same defect reinforces the existing point
 * instead of accumulating near-duplicates — that is what makes the second
 * encounter a warm recall rather than a fresh lesson. The prior is fetched by
 * exact ID, not by similarity search, so the counter survives the concurrent
 * writes a compound defect produces.
 */
export async function POST(request: Request) {
  const { text, guard, outcome, skillVersion, generation } = (await request.json()) as {
    text: string;
    guard: GuardId;
    outcome?: "success" | "fail";
    skillVersion?: number;
    generation?: number;
  };
  try {
    const id = `mem:${guard}`;
    const prior = await getPoint(id);
    const timesReinforced = (prior?.payload?.timesReinforced ?? -1) + 1;

    await upsertPoints([
      {
        id,
        vector: embed(text),
        payload: {
          guard,
          defectId: guard,
          text,
          outcome: outcome ?? "success",
          skillVersion,
          generation: generation ?? 0,
          timesReinforced,
        },
      },
    ]);
    return Response.json({ ok: true, id, timesReinforced, firstEncounter: prior === null });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 });
  }
}
