#!/usr/bin/env node
/**
 * Demo preflight: verify every moving part before recording.
 *
 * Checks each dependency the demo actually relies on and prints a single
 * verdict. Run it right before hitting record.
 *
 *   node scripts/preflight.mjs
 */
import { execFileSync } from "node:child_process";
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

const APP = await resolveAppUrl(process.argv[2]);
const PUBLIC_URL = env.REPLAY_TARGET_URL;

const g = (s) => `\x1b[32m${s}\x1b[0m`;
const r = (s) => `\x1b[31m${s}\x1b[0m`;
const y = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

const results = [];
async function check(name, fn, { fatal = true } = {}) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail, fatal });
    console.log(`${g("✓")} ${name} ${dim(detail ?? "")}`);
  } catch (error) {
    const msg = String(error.message ?? error).slice(0, 140);
    results.push({ name, ok: false, detail: msg, fatal });
    console.log(`${fatal ? r("✗") : y("!")} ${name} ${dim(msg)}`);
  }
}

const json = async (url, init) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000), ...init });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
  return body;
};

console.log(`\nRegenesis preflight ${dim(`— app ${APP}`)}\n`);

await check("Actian container running", () => {
  const out = execFileSync("docker", ["ps", "--filter", "name=vectorai", "--format", "{{.Status}}"], {
    encoding: "utf8",
  }).trim();
  if (!out) throw new Error("vectorai container is not running");
  return out;
});

await check("Actian reachable + collection ready", async () => {
  const m = await json(`${APP}/api/memory`);
  return `${m.collection} @ ${m.base} · ${m.count} memories`;
});

await check("App healthy (zero violations)", async () => {
  const s = await json(`${APP}/api/regenesis/state`);
  if (!s.healthy) throw new Error(`${s.totalViolations} violations open — run reset`);
  return `revision ${s.revision}`;
});

await check("Oracle probe responds", async () => {
  const p = await json(`${APP}/api/regenesis/probe`, { method: "POST" });
  return `${p.findings.length} findings`;
});

await check("Public URL serves the app", async () => {
  if (!PUBLIC_URL) throw new Error("REPLAY_TARGET_URL not set");
  const s = await json(`${PUBLIC_URL}/api/regenesis/state`);
  return `${PUBLIC_URL} · healthy=${s.healthy}`;
});

await check("Guild agent published", () => {
  const out = execFileSync("guild", ["--non-interactive", "agent", "versions"], {
    encoding: "utf8",
    cwd: resolve(ROOT, "agent"),
  });
  if (!/PUBLISHED/.test(out)) throw new Error("no published version");
  return "regenesis-healer";
});

await check("Guild integration points at the public URL", () => {
  const out = execFileSync(
    "guild",
    ["--non-interactive", "integration", "get", "chineseman~regenesis-medshift"],
    { encoding: "utf8" },
  );
  const base = out.match(/Base URL\s+(\S+)/)?.[1];
  if (!base) throw new Error("no base URL");
  if (PUBLIC_URL && base.replace(/\/$/, "") !== PUBLIC_URL.replace(/\/$/, "")) {
    throw new Error(`stale: ${base} ≠ ${PUBLIC_URL} — run scripts/retarget.mjs`);
  }
  return base;
});

await check(
  "Replay Loop QA connected",
  async () => {
    const qa = await json(`${APP}/api/qa`);
    const running = (qa.explorations ?? []).filter((e) => e.status === "in-progress").length;
    return `${qa.totalBugs} bugs · ${qa.explorations.length} explorations (${running} running)`;
  },
  { fatal: false },
);

await check(
  "Memory is cold (best first-run demo)",
  async () => {
    const m = await json(`${APP}/api/memory`);
    if (m.count > 0) throw new Error(`${m.count} memories present — warm recall will fire immediately`);
    return "0 memories";
  },
  { fatal: false },
);

const fatalFails = results.filter((x) => !x.ok && x.fatal);
const warns = results.filter((x) => !x.ok && !x.fatal);
console.log("");
if (fatalFails.length === 0) {
  console.log(g(`READY TO DEMO${warns.length ? ` (${warns.length} warning${warns.length > 1 ? "s" : ""})` : ""}`));
} else {
  console.log(r(`NOT READY — ${fatalFails.length} blocking issue(s)`));
  process.exitCode = 1;
}
console.log("");
