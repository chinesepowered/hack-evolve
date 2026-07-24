#!/usr/bin/env node
/**
 * Reset to a clean demo state: app healthy, memory cold.
 *
 * A cold memory matters — the demo's best beat is the *second* encounter with
 * a defect recalling at cosine 1.00, and that only lands if the first one is
 * genuinely a first encounter.
 *
 *   node scripts/reset-demo.mjs            # keep learned memories
 *   node scripts/reset-demo.mjs --cold     # wipe memory too (default for a take)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { resolveAppUrl } from "./app-url.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(resolve(ROOT, ".env.local"), "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

const APP = await resolveAppUrl(process.argv.find((a) => a.startsWith("http")));
const KEEP_MEMORY = process.argv.includes("--keep-memory");
const g = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

const res = await fetch(`${APP}/api/regenesis/reset`, {
  method: "POST",
  headers: env.REGENESIS_AGENT_TOKEN ? { Authorization: `Bearer ${env.REGENESIS_AGENT_TOKEN}` } : {},
});
const state = await res.json();
console.log(`${g("✓")} rules restored to baseline ${dim(`violations=${state.state?.totalViolations ?? "?"}`)}`);

if (!KEEP_MEMORY) {
  const actian = env.ACTIAN_URL ?? "http://localhost:6573";
  const collection = env.ACTIAN_COLLECTION ?? "regenesis_memory";
  await fetch(`${actian}/collections/${collection}`, { method: "DELETE" });
  // Touch the API so the collection is recreated empty rather than on first demo click.
  const m = await (await fetch(`${APP}/api/memory`)).json();
  console.log(`${g("✓")} memory wiped ${dim(`${m.count} points`)}`);
} else {
  const m = await (await fetch(`${APP}/api/memory`)).json();
  console.log(`${g("✓")} memory kept ${dim(`${m.count} points`)}`);
}

console.log(`\nReady. ${dim("Reload the browser tab to reset the in-page engine too.")}`);
