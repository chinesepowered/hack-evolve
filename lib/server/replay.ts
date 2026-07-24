import "server-only";

/**
 * Server-side client for Replay Loop QA.
 *
 * Loop QA is a hosted service that explores a publicly reachable URL, so the
 * token lives here and never reaches the browser. Endpoint shapes verified
 * against the live API: projects are the root resource, and each one owns
 * /bugs, /explorations and /versions.
 */
const BASE = process.env.REPLAY_QA_URL ?? "https://loop-qa.replay.io/api/v1";
const TOKEN = process.env.REPLAY_QA_TOKEN ?? "";
const PROJECT = process.env.REPLAY_QA_PROJECT_ID ?? "";

export function replayConfigured(): boolean {
  return Boolean(TOKEN && PROJECT);
}

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  if (!TOKEN) throw new Error("REPLAY_QA_TOKEN is not set");
  const res = await fetch(`${BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Replay ${path} → HTTP ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

export interface ReplayPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  resolvedCount?: number;
}

export interface RawReplayBug {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  severity?: string;
  status?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface RawExploration {
  id: string;
  prompt: string;
  status: string;
  journeys_created: number;
  started_at: string | null;
  completed_at: string | null;
}

export async function listBugs(): Promise<ReplayPage<RawReplayBug>> {
  return call(`/projects/${PROJECT}/bugs`);
}

export async function listExplorations(): Promise<ReplayPage<RawExploration>> {
  return call(`/projects/${PROJECT}/explorations`);
}

/** Kick off an autonomous exploration. Loop QA supplies a default prompt. */
export async function startExploration(prompt?: string): Promise<RawExploration> {
  return call(`/projects/${PROJECT}/explorations`, {
    method: "POST",
    body: prompt ? { prompt } : {},
  });
}

export async function listVersions(): Promise<ReplayPage<{ id: string }>> {
  return call(`/projects/${PROJECT}/versions`);
}

export async function project(): Promise<Record<string, unknown>> {
  return call(`/projects/${PROJECT}`);
}
