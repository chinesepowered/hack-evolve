#!/usr/bin/env node
/**
 * Repoint every live integration at a new public URL.
 *
 * Tunnels get a fresh hostname on every restart, and the URL is baked into
 * three separate places. Doing this by hand mid-demo costs ten minutes, so:
 *
 *   node scripts/retarget.mjs                 # auto-detect the running tunnel
 *   node scripts/retarget.mjs https://x.dev   # or pass one explicitly
 *
 * Replay's API silently ignores target_url on update, so a new URL means a new
 * project — this creates one and rewrites REPLAY_QA_PROJECT_ID for you.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { resolveAppUrl } from "./app-url.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = resolve(ROOT, ".env.local");
const INTEGRATION = "chineseman~regenesis-medshift";

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  warn: (s) => `\x1b[33m${s}\x1b[0m`,
  err: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function readEnv() {
  const text = readFileSync(ENV_PATH, "utf8");
  const map = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) map[m[1]] = m[2];
  }
  return { text, map };
}

function setEnv(text, key, value) {
  if (new RegExp(`^${key}=`, "m").test(text)) {
    return text.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`);
  }
  return `${text.replace(/\n*$/, "")}\n${key}=${value}\n`;
}

/** Find a live tunnel: cloudflared's local API first, then ngrok's. */
async function detectTunnel() {
  try {
    const res = await fetch("http://localhost:4040/api/tunnels", { signal: AbortSignal.timeout(2000) });
    const json = await res.json();
    const https = json.tunnels?.find((t) => t.public_url?.startsWith("https://"));
    if (https) return https.public_url;
  } catch {
    /* ngrok not running */
  }
  return null;
}

const argUrl = process.argv[2];
const url = (argUrl ?? (await detectTunnel()))?.replace(/\/$/, "");

if (!url) {
  console.error(c.err("No URL given and no tunnel detected."));
  console.error("Start one, then re-run:");
  console.error(c.dim(`  cloudflared tunnel --url ${await resolveAppUrl()}`));
  console.error(c.dim("  node scripts/retarget.mjs https://<your-tunnel>"));
  process.exit(1);
}

console.log(`${c.bold("Retargeting Regenesis →")} ${url}\n`);

// 1. Wait for the URL to actually serve the app before rewiring anything.
process.stdout.write("① reachability … ");
let reachable = false;
for (let i = 0; i < 20; i++) {
  try {
    const res = await fetch(`${url}/api/regenesis/state`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      reachable = true;
      break;
    }
  } catch {
    /* keep trying: fresh tunnels take a moment to propagate */
  }
  await new Promise((r) => setTimeout(r, 3000));
}
if (!reachable) {
  console.log(c.err("unreachable"));
  console.error("  The app must be running and served at that URL first.");
  process.exit(1);
}
console.log(c.ok("ok"));

// 2. Local env.
process.stdout.write("② .env.local … ");
let { text, map } = readEnv();
text = setEnv(text, "REPLAY_TARGET_URL", url);
writeFileSync(ENV_PATH, text);
console.log(c.ok("updated"));

// 3. Guild integration base URL — the agent's tools resolve through this.
process.stdout.write("③ Guild integration … ");
try {
  execFileSync("guild", ["--non-interactive", "integration", "update", INTEGRATION, "--base-url", url], {
    stdio: "pipe",
  });
  console.log(c.ok("base URL updated"));
} catch (error) {
  console.log(c.warn("skipped"));
  console.log(c.dim(`   ${String(error.stderr ?? error).slice(0, 160)}`));
}

// 4. Replay project. target_url is immutable on update, so make a new one.
process.stdout.write("④ Replay project … ");
const token = map.REPLAY_QA_TOKEN;
const base = map.REPLAY_QA_URL ?? "https://loop-qa.replay.io/api/v1";
if (!token) {
  console.log(c.warn("skipped (no REPLAY_QA_TOKEN)"));
} else {
  try {
    const res = await fetch(`${base}/projects`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `Regenesis MedShift ${new Date().toISOString().slice(5, 16).replace("T", " ")}`,
        target_url: url,
      }),
      signal: AbortSignal.timeout(30000),
    });
    const project = await res.json();
    if (!project?.id) throw new Error(JSON.stringify(project).slice(0, 200));
    text = setEnv(readEnv().text, "REPLAY_QA_PROJECT_ID", project.id);
    writeFileSync(ENV_PATH, text);
    console.log(`${c.ok("created")} ${c.dim(project.id)}`);
  } catch (error) {
    console.log(c.warn("skipped"));
    console.log(c.dim(`   ${String(error).slice(0, 160)}`));
  }
}

console.log(`\n${c.bold("Done.")} Restart the dev server so it picks up the new env:`);
console.log(c.dim("  pnpm dev"));
console.log(`\nVerify with ${c.bold("node scripts/preflight.mjs")}`);
