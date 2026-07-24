import { embed } from "@/lib/evolution/embeddings";
import { searchPoints } from "@/lib/server/actian";
import type { GuardId } from "@/lib/domain/types";

/** Cosine above which the agent treats a memory as "seen this before". */
const RECALL_THRESHOLD = 0.75;

/**
 * Text-level recall over Actian.
 *
 * Embedding happens here rather than in the caller so a remote agent can ask
 * "have I seen this failure before?" in plain language and get a real vector
 * search back.
 */
export async function POST(request: Request) {
  const { text, guard } = (await request.json()) as { text: string; guard?: GuardId };
  try {
    const hits = await searchPoints(embed(text), {
      topK: 3,
      // Only ever recall fixes that actually worked.
      filter: { must: { outcome: "success" } },
    });
    const best = hits[0];
    const warm = Boolean(best && best.score >= RECALL_THRESHOLD);
    return Response.json({
      warm,
      threshold: RECALL_THRESHOLD,
      score: best?.score ?? 0,
      match: warm ? best.payload : null,
      // Guard the caller asked about, echoed for traceability.
      queriedGuard: guard ?? null,
      candidates: hits.map((h) => ({ id: h.id, score: h.score, guard: h.payload?.guard })),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 });
  }
}
