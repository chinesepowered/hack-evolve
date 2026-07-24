/**
 * Sponsor integration mode — resolved per sponsor, not globally.
 *
 * "sim"  — runs in-process against a faithful simulation. No Docker, no
 *          accounts, no keys. Good for development and for a demo machine
 *          with no network.
 * "live" — real calls: Actian VectorAI over REST, Replay Loop QA over HTTPS,
 *          Guild via the platform. Same interfaces either way.
 *
 * Each sponsor flips independently, because they come online at different
 * times: Actian is a local Docker container (instant), while Replay and Guild
 * need accounts and a publicly reachable app. `NEXT_PUBLIC_REGENESIS_MODE`
 * sets the default; the per-sponsor vars override it.
 *
 * NEXT_PUBLIC_* vars are inlined at build time, so each must be referenced
 * statically — no dynamic property access.
 */
export type SponsorMode = "sim" | "live";

function normalize(value: string | undefined, fallback: SponsorMode): SponsorMode {
  if (value === "live") return "live";
  if (value === "sim") return "sim";
  return fallback;
}

/** The global default, used by any sponsor without an explicit override. */
export function sponsorMode(): SponsorMode {
  return normalize(process.env.NEXT_PUBLIC_REGENESIS_MODE, "sim");
}

export function actianMode(): SponsorMode {
  return normalize(process.env.NEXT_PUBLIC_ACTIAN_MODE, sponsorMode());
}

export function replayMode(): SponsorMode {
  return normalize(process.env.NEXT_PUBLIC_REPLAY_MODE, sponsorMode());
}

export function guildMode(): SponsorMode {
  return normalize(process.env.NEXT_PUBLIC_GUILD_MODE, sponsorMode());
}

/** True when every sponsor is live — drives the single "live" badge. */
export function allLive(): boolean {
  return actianMode() === "live" && replayMode() === "live" && guildMode() === "live";
}

/**
 * Where the live integrations point.
 *
 * Actian is local-first: the Docker image publishes REST on 6573 and gRPC on
 * 6574. It is read server-side only (see lib/server/actian.ts), so the host is
 * a plain env var, not a NEXT_PUBLIC_ one.
 */
export const SPONSOR_ENDPOINTS = {
  actian: process.env.ACTIAN_URL ?? "http://localhost:6573",
  replay: process.env.REPLAY_QA_URL ?? "https://loop-qa.replay.io/api/v1",
  guild: process.env.GUILD_API_URL ?? "https://api.guild.ai",
} as const;
