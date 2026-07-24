/**
 * Sponsor integration mode.
 *
 * "sim"  — everything runs in-process against a faithful simulation of each
 *          sponsor API. No network, no accounts, no keys. This is the default
 *          and what runs during development and the pitch video.
 *
 * "live" — the same interfaces, backed by real HTTP calls to Actian VectorAI,
 *          Replay Loop QA, and Guild. Flip the env var, drop in credentials,
 *          and the adapters below light up. The rest of the app never changes,
 *          because it only ever talks to the interfaces in ./types.
 *
 * We stay in "sim" until the hackathon starts; the live paths are written and
 * ready so the switch is a one-line change, not a rewrite.
 */
export type SponsorMode = "sim" | "live";

export function sponsorMode(): SponsorMode {
  const env =
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_REGENESIS_MODE) || "sim";
  return env === "live" ? "live" : "sim";
}

export const SPONSOR_ENDPOINTS = {
  actian: "https://api.vectoraidb.actian.com/v1",
  replay: "https://loop-qa.replay.io/api/v1",
  guild: "https://api.guild.ai/v1",
} as const;
