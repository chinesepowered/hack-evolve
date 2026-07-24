import { cosine } from "@/lib/evolution/embeddings";
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
 * Reciprocal Rank Fusion over several ranked lists.
 *
 * Actian VectorAI exposes vector similarity search; it has no native hybrid or
 * keyword mode. So the fusion is ours: we issue one real ANN query per view of
 * the defect and fuse the returned rankings here. Shared by the sim and live
 * clients so both behave identically.
 */
const RRF_K = 60;

function fuse(rankings: VectorHit[][], topK: number): VectorHit[] {
  const fused = new Map<string, { hit: VectorHit; score: number }>();
  for (const ranked of rankings) {
    ranked.forEach((hit, rank) => {
      const prev = fused.get(hit.id);
      const contribution = 1 / (RRF_K + rank + 1);
      if (prev) prev.score += contribution;
      else fused.set(hit.id, { hit, score: contribution });
    });
  }
  return [...fused.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ hit, score }) => ({ ...hit, score }));
}

/**
 * Simulated Actian VectorAI collection — used when NEXT_PUBLIC_REGENESIS_MODE
 * is "sim" (no Docker required). Mirrors the live surface: cosine ANN,
 * must/must-not payload filters, RRF fusion.
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
    const rankings = await Promise.all(
      vectors.map((v) => this.search(v, { topK: 20, filter: opts.filter })),
    );
    return fuse(rankings, opts.topK ?? 5);
  }

  async all(): Promise<VectorPoint[]> {
    return [...this.points.values()];
  }

  async count(): Promise<number> {
    return this.points.size;
  }
}

/**
 * Live Actian VectorAI client.
 *
 * VectorAI is a local/edge database (REST :6573, gRPC :6574) — the browser
 * cannot reach it, so this client calls our own route handlers under
 * app/api/memory/*, which hold the real connection server-side. Same interface
 * as the sim, so the engine above never learns which one it has.
 */
export class LiveActianClient implements ActianClient {
  readonly kind = "live" as const;

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? `${path} failed (${res.status})`);
    return json as T;
  }

  async upsert(points: VectorPoint[]): Promise<void> {
    await this.post("/api/memory/upsert", { points });
  }

  async search(
    vector: number[],
    opts: { topK?: number; filter?: VectorFilter } = {},
  ): Promise<VectorHit[]> {
    const { hits } = await this.post<{ hits: VectorHit[] }>("/api/memory/search", {
      vector,
      topK: opts.topK ?? 5,
      filter: opts.filter,
    });
    return hits;
  }

  async hybridSearch(
    vectors: number[][],
    opts: { topK?: number; filter?: VectorFilter } = {},
  ): Promise<VectorHit[]> {
    const rankings = await Promise.all(
      vectors.map((v) => this.search(v, { topK: 20, filter: opts.filter })),
    );
    return fuse(rankings, opts.topK ?? 5);
  }

  async all(): Promise<VectorPoint[]> {
    const res = await fetch("/api/memory", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? "memory dump failed");
    return json.points as VectorPoint[];
  }

  async count(): Promise<number> {
    return (await this.all()).length;
  }
}
