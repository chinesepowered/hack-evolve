/**
 * Find the dev server, wherever it actually landed.
 *
 * `next dev` walks forward from 3000 when the port is taken, so hardcoding
 * 3000 makes the demo scripts report false failures against a perfectly
 * healthy app. Probe the real control surface instead of assuming.
 */
const CANDIDATES = [3000, 3210, 3001, 3002, 3003];

async function serves(url) {
  try {
    const res = await fetch(`${url}/api/regenesis/state`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Resolve the app's base URL. An explicit argument or PORT/APP_URL always
 * wins; otherwise probe the ports `next dev` is likely to have chosen.
 */
export async function resolveAppUrl(explicit) {
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.PORT) return `http://localhost:${process.env.PORT}`;

  for (const port of CANDIDATES) {
    const url = `http://localhost:${port}`;
    if (await serves(url)) return url;
  }
  return `http://localhost:${CANDIDATES[0]}`;
}
