import { cosine } from "@/lib/evolution/embeddings";
import { SPONSOR_ENDPOINTS } from "./config";
import type { ActianClient, VectorFilter, VectorHit, VectorPoint } from "./types";

function matchesFilter(point: VectorPoint, filter?: VectorFilter): boolean {
  if (!filter) return true;
  const p = point.payload as unknown as Record<string, unknown>;
  if (filter.must) {
    for (const [k, v] of Object.entries(filter.must)) {
      if (p[k] !== v) return false;
    }
  }
  if (filter.mustNot) {
    for (const [k, v] of Object.entries(filter.mustNot)) {
      if (p[k] === v) return false;
    }
  }
  return true;
}

/**
 * Simulated Actian VectorAI collection.
 *
 * Faithful to the real API surface: cosine ANN, must/must-not payload filters,
 * and Reciprocal Rank Fusion for hybrid retrieval — the same primitives the
 * live client calls over HTTP.
 */
export class SimActianClient implements ActianClient {
  readonly kind = "sim" as const;
  private points = new Map<string, VectorPoint>();

  async upsert(points: VectorPoint[]): Promise<void> {
    for (const point of points) this.points.set(point.id, point);
  }

  async search(
    vector: number[],
    opts: { topK?: number; filter?: VectorFilter } = {},
  ): Promise<VectorHit[]> {
    const topK = opts.topK ?? 5;
    const hits: VectorHit[] = [];
    for (const point of this.points.values()) {
      if (!matchesFilter(point, opts.filter)) continue;
      hits.push({ id: point.id, score: cosine(vector, point.vector), payload: point.payload });
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, topK);
  }

  async hybridSearch(
    vectors: number[][],
    opts: { topK?: number; filter?: VectorFilter } = {},
  ): Promise<VectorHit[]> {
    const K = 60; // RRF damping constant
    const fused = new Map<string, { hit: VectorHit; score: number }>();
    for (const v of vectors) {
      const ranked = await this.search(v, { topK: 20, filter: opts.filter });
      ranked.forEach((hit, rank) => {
        const prev = fused.get(hit.id);
        const contribution = 1 / (K + rank + 1);
        if (prev) prev.score += contribution;
        else fused.set(hit.id, { hit, score: contribution });
      });
    }
    return [...fused.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, opts.topK ?? 5)
      .map(({ hit, score }) => ({ ...hit, score }));
  }

  async all(): Promise<VectorPoint[]> {
    return [...this.points.values()];
  }

  async count(): Promise<number> {
    return this.points.size;
  }
}

/**
 * Live Actian client — reference implementation for the hackathon switch.
 * Uncomment the fetch bodies and provide ACTIAN_TOKEN once accounts are live.
 * The shapes follow docs.vectoraidb.actian.com (collections / points / search).
 */
export class LiveActianClient implements ActianClient {
  readonly kind = "sim" as const; // reports "sim" until wired, so the UI badge is honest
  constructor(
    private readonly collection = "regenesis_memory",
    private readonly base = SPONSOR_ENDPOINTS.actian,
    private readonly token = (typeof process !== "undefined" && process.env?.ACTIAN_TOKEN) || "",
  ) {}

  async upsert(): Promise<void> {
    throw new Error(
      "LiveActianClient not enabled. Wire POST " +
        `${this.base}/collections/${this.collection}/points with a bearer token.`,
    );
  }
  async search(): Promise<VectorHit[]> {
    throw new Error("LiveActianClient.search not enabled (see actian.ts).");
  }
  async hybridSearch(): Promise<VectorHit[]> {
    throw new Error("LiveActianClient.hybridSearch not enabled (see actian.ts).");
  }
  async all(): Promise<VectorPoint[]> {
    return [];
  }
  async count(): Promise<number> {
    return 0;
  }
}
