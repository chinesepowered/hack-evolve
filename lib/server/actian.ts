import "server-only";

import { stableUuid } from "@/lib/sponsors/point-id";
import type { MemoryPayload, VectorFilter, VectorHit, VectorPoint } from "@/lib/sponsors/types";

/**
 * Server-side client for Actian VectorAI DB.
 *
 * VectorAI ships as a local/edge database (Docker), exposing a REST API on
 * :6573 and gRPC on :6574 — neither is reachable from the browser, so the
 * command centre talks to the route handlers in app/api/memory/* and those
 * call this module. Credentials and host stay server-side.
 *
 * Verified against actian/vectorai:latest.
 */
const BASE = process.env.ACTIAN_URL ?? "http://localhost:6573";
const COLLECTION = process.env.ACTIAN_COLLECTION ?? "regenesis_memory";

/** Must match DIM in lib/evolution/embeddings.ts. */
export const VECTOR_DIM = 96;

interface Envelope<T> {
  status: "ok" | { error: string };
  result: T;
  time?: number;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Actian ${path} → HTTP ${res.status}: ${text.slice(0, 200)}`);

  let body: Envelope<T>;
  try {
    body = JSON.parse(text) as Envelope<T>;
  } catch {
    throw new Error(`Actian ${path} → non-JSON response: ${text.slice(0, 200)}`);
  }
  if (body.status !== "ok") {
    throw new Error(`Actian ${path} → ${body.status?.error ?? "unknown error"}`);
  }
  return body.result;
}

/** Idempotent: creates the collection on first use so a cold DB just works. */
export async function ensureCollection(): Promise<void> {
  const existing = await call<{ collections: { name: string }[] }>("/collections");
  if (existing.collections?.some((c) => c.name === COLLECTION)) return;
  await call<boolean>(`/collections/${COLLECTION}`, {
    method: "PUT",
    body: JSON.stringify({ vectors: { size: VECTOR_DIM, distance: "Cosine" } }),
  });
}

/** Our filter shape → Actian's `must` / `must_not` payload conditions. */
function toActianFilter(filter?: VectorFilter) {
  if (!filter) return undefined;
  const clause = (obj?: Record<string, unknown>) =>
    Object.entries(obj ?? {}).map(([key, value]) => ({ key, match: { value } }));
  const must = clause(filter.must);
  const mustNot = clause(filter.mustNot);
  if (!must.length && !mustNot.length) return undefined;
  return {
    ...(must.length ? { must } : {}),
    ...(mustNot.length ? { must_not: mustNot } : {}),
  };
}

export async function upsertPoints(points: VectorPoint[]): Promise<void> {
  if (!points.length) return;
  await ensureCollection();
  await call(`/collections/${COLLECTION}/points`, {
    method: "PUT",
    body: JSON.stringify({
      points: points.map((p) => ({
        id: stableUuid(p.id),
        vector: p.vector,
        // memKey preserves the domain identifier through the UUID mapping.
        payload: { ...p.payload, memKey: p.id },
      })),
    }),
  });
}

type RawHit = { id: string | number; score: number; payload: (MemoryPayload & { memKey?: string }) | null };

export async function searchPoints(
  vector: number[],
  opts: { topK?: number; filter?: VectorFilter } = {},
): Promise<VectorHit[]> {
  await ensureCollection();
  const result = await call<RawHit[]>(`/collections/${COLLECTION}/points/search`, {
    method: "POST",
    body: JSON.stringify({
      vector,
      limit: opts.topK ?? 5,
      with_payload: true,
      with_vector: false,
      ...(toActianFilter(opts.filter) ? { filter: toActianFilter(opts.filter) } : {}),
    }),
  });
  return (result ?? []).map((h) => ({
    id: h.payload?.memKey ?? String(h.id),
    score: h.score,
    payload: h.payload as MemoryPayload,
  }));
}

type RawPoint = { id: string | number; payload: (MemoryPayload & { memKey?: string }) | null; vector?: number[] };

export async function scrollPoints(limit = 256): Promise<VectorPoint[]> {
  await ensureCollection();
  const result = await call<{ points: RawPoint[] }>(`/collections/${COLLECTION}/points/scroll`, {
    method: "POST",
    body: JSON.stringify({ limit, with_payload: true, with_vector: true }),
  });
  return (result.points ?? []).map((p) => ({
    id: p.payload?.memKey ?? String(p.id),
    vector: p.vector ?? [],
    payload: p.payload as MemoryPayload,
  }));
}

export async function health(): Promise<{ ok: boolean; base: string; collection: string }> {
  await call("/collections");
  return { ok: true, base: BASE, collection: COLLECTION };
}
