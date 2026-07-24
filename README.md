# 🧬 Regenesis

### The app that fixes its own bugs.

**Regenesis** runs a real hospital shift-scheduling SaaS — **MedShift** — under a closed self-healing loop. Break a safety rule and the app *notices*, *remembers whether it has seen that failure before*, *repairs it*, and *verifies the repair*. Its health is rendered as a patient monitor: the ECG trace **is** the open-finding count. Sabotage reads as arrhythmia 💔; healing returns it to sinus rhythm 💚.

> 🔴 **All three sponsor integrations are live.** Real vector database, real published agent, real autonomous QA. No mocks in anything described below.

---

## 🎯 The idea in one paragraph

An app evolves like an organism only if something outside it decides what "fitter" means. So we split the app in two: **rules** are mutable (the genome — an agent may rewrite them), while **invariants** are immutable (the signed-off safety spec). Sabotage weakens the *rules*; the oracle keeps auditing against the *fixed spec*. The result is that **every bug is genuinely computed, never scripted** — disabling the certification guard doesn't hide its own violations, it produces 14 real ones. That's the difference between a demo that *shows* self-healing and one that actually *does* it.

```
   ①  A bad config push weakens a safety rule
   ②  The oracle audits against the immutable spec → real violations
   ③  The agent asks Actian: "have I seen this failure before?"  ──── warm? ───┐
   ④  Patch: restore the implicated guard to policy  ◄───────────────────────┘
   ⑤  Probe again — a repair only counts if the finding is actually gone
   ⑥  Held? Reinforce the memory.  Failed? Store a negative example.
                        └──────── generation++ ────────┘
```

---

# 🟣 Guild — Best use of agents

### `chineseman~regenesis-healer` is published, live, and drives a real external application.

**We hit the interesting wall first.** Guild agents are sandboxed — no external npm, no Node built-ins, and **no outbound sockets**. Our first agent used `fetch` in a tool and got `fetch failed`, then started guessing at localhost ports. That's not a limitation to route around; it's the platform telling you the sanctioned path.

So **MedShift itself became a Guild integration**:

🔌 **`chineseman~regenesis-medshift` v1.0.0 (published)** — generated from an OpenAPI spec (`guild/regenesis-openapi.json`) into four proxied operations. Guild's proxy makes every call and injects the bearer credential:

| Operation | What the agent uses it for |
|---|---|
| `medshift_probe` | See what's actually broken, right now |
| `memory_recall` | "Have I solved this defect class before?" |
| `medshift_patch` | Restore the implicated guard to policy |
| `memory_remember` | Bank a fix *only after verifying it* |

### ✅ Verified, not asserted

Against a **cold memory** and a sabotaged app, the agent ran exactly the intended loop and the app went **14 violations → 0**:

```
medshift_probe → memory_recall → medshift_patch → medshift_probe → memory_remember
```

Then we gave it a **compound defect** — one push breaking *two* guards, 27 violations. It recalled both findings, applied both patches, verified once, and remembered both:

```
recentChanges: ['sabotage:badDeploy', 'patch:coverageMinimum', 'patch:certification']
```

🧠 **That's the agentic part.** Nobody told it there were two problems. It probed, reasoned about what it found, and kept going until the app was clean — from a process that never ran on our machine.

---

# 🔵 Replay — Best SaaS app with completed QA

### Loop QA found three real bugs. We fixed all three. One of them would have killed this demo.

MedShift is a genuinely designed SaaS for a hard domain — certification, rest windows, overtime, consecutive days, unit coverage. Replay Loop QA explored the live deployment on its own and filed:

| 🐞 What Loop QA found | 🔍 Root cause | 🔧 Fix |
|---|---|---|
| **"Root route permanently stuck on 'initializing instruments…' — 0 React commits in the entire recording"** `high` | Next.js blocks cross-origin dev assets. Served through a tunnel, the client bundle never booted, so React never hydrated and the mount guard never flipped | `allowedDevOrigins` in `next.config.ts` |
| "Route / has no `h1` — WCAG 1.3.1" `medium` | The pre-hydration shell had no heading elements at all | Semantic `h1`/`h2` structure |
| "Route / has no `<main>` landmark" `medium` | Shell was a plain `div` | `<main className="shell">` |
| "Tile value and *Heal one generation* button overlap" `medium` | The fixed control dock wraps from 61px to ~200px tall as the viewport narrows; the shell only reserved 120px | Responsive bottom padding |

🎬 **The first one is the whole argument for autonomous QA.** It looked perfect on localhost. Replay's time-travel engine diagnosed a *hydration failure from runtime behaviour* — "0 React commits" — on the public URL. Anyone who opened our demo link would have seen a permanent loading screen. We would not have caught it.

🧐 **Their judge also rejected one of their own findings**, and separately flagged that `cursor:pointer` sat on rows with no click handler. It was right — we fixed that too.

📈 **Tunnel choice measurably changed QA quality.** On ngrok, Loop QA burned a journey on *"Bypass ngrok warning"* and discovered 3 journeys. On a cloudflared tunnel with no interstitial: **8 journeys**. We switched.

🪞 **Two ledgers, kept honestly distinct.** The UI shows *Safety findings* (the in-app oracle checking invariants) separately from *Autonomous QA* (Replay checking the product). Merging them would make a better screenshot and a worse claim.

---

# 🟢 Actian — Best use of Actian VectorAI DB

### Memory is what makes this evolution instead of retry.

🐳 Runs from `actian/vectorai:latest` (REST `:6573`, gRPC `:6574`). Collection `regenesis_memory` — **96-dim, cosine**, auto-created on first use.

Every verified fix becomes a point: the failure's embedding as the vector, `{guard, outcome, generation, timesReinforced}` as the payload. Recall filters `must: {outcome: "success"}`, so **a fix that failed is never recalled as a solution.**

### 📊 Measured, on real data

| Encounter | `warm` | cosine | Memory |
|---|---|---|---|
| First time seeing a defect class | `false` | `0.00` | 1 point written |
| **Same defect again** | **`true`** | **`1.00`** | reinforced *in place* — count stays 1 |

### 🧭 Three things we got wrong first, documented so you don't have to

1. **Point IDs must be uint or UUID.** `mem:certification` is rejected outright (`invalid UUID`). Keys now map through a deterministic FNV-derived UUID (`lib/sponsors/point-id.ts`), with the original carried in the payload as `memKey`. **This is precisely what makes reinforcement overwrite instead of duplicate.**
2. **There is no managed cloud tier.** VectorAI is local/edge by design — we'd guessed at an `api.vectoraidb.actian.com` endpoint and were simply wrong.
3. **No native hybrid search.** Our RRF fusion is *ours*, computed over real ANN queries (`fuse()` in `lib/sponsors/actian.ts`). We're not claiming Actian does something it doesn't.

🐛 We also fixed two concurrency bugs of our own that only appear under a compound defect: a reinforcement counter that reset 3 → 0 because the prior lookup used a *filtered vector search* (now an exact-ID fetch), and a collection-creation race that returned 409 and silently dropped a write.

---

## 🎥 The 3-minute demo

| Time | Beat |
|---|---|
| **0:00** | **Resting state.** Sinus rhythm at 62 bpm, zero findings, grid all green. *"A live hospital scheduler. Watch its vital signs."* |
| **0:20** | **Sabotage** → *"Bad deploy: certification + coverage."* ECG spikes into magenta arrhythmia; the grid lights red. *"Two safety defects just shipped. Nothing here is scripted — the oracle audits against the original policy, so it computes these."* |
| **0:50** | **Heal, generation 1.** probe → recall (*"first encounter"*) → patch → verify. *"No memory of this yet, so it diagnoses from root cause and learns."* |
| **1:20** | **Generation 2.** Coverage clears, ECG settles, fitness curve descends to zero. |
| **1:45** | **The learning proof.** Sabotage the *same* defect again → heal. Memory reads **"Recognized from memory · cosine 1.00."** *"It's seen this before. Instant recall — that's the evolution."* |
| **2:15** | **The real agent.** Run it on Guild and watch violations go 14 → 0 from a process running on Guild's infrastructure. |
| **2:40** | **Hand a judge the button.** *"Break it however you like."* |

```bash
# the 2:15 beat
guild session create --workspace <ws> --type chat \
  --agent chineseman~regenesis-healer \
  --prompt "Heal the MedShift app. Report what you find and what you verify."
```

---

## 🚀 Running it

```bash
# 1. Memory
docker run -d --name vectorai -p 6573-6575:6573-6575 \
  -e ACTIAN_VECTORAI_ACCEPT_EULA=YES \
  -v vectorai_data:/var/lib/actian-vectorai actian/vectorai:latest

# 2. App
pnpm install && pnpm dev

# 3. Public URL — Replay and Guild both have to reach it
cloudflared tunnel --url http://localhost:3000

# 4. Point every integration at that URL, then confirm
pnpm retarget            # auto-detects the tunnel
pnpm preflight           # 9 checks → "READY TO DEMO"
pnpm reset               # baseline rules + cold memory, before a take
```

Each sponsor flips **independently** (`NEXT_PUBLIC_ACTIAN_MODE`, `…_REPLAY_MODE`, `…_GUILD_MODE`), because they come online at different times. The topbar chips report each one's true state, so **the UI can't overstate what's live.**

---

## 🏗 How it's built

| Path | What lives there |
|---|---|
| `lib/domain/` | The real scheduler. `rules.ts` (mutable genome), `oracle.ts` (immutable spec), `scheduler.ts` (deterministic, seeded), `seed.ts` (26-person roster sized so a healthy schedule is genuinely violation-free) |
| `lib/server/` | Server-only: Actian REST client, Replay client, the rules genome, bearer-token guard |
| `lib/sponsors/` | Three adapters, each `Sim*` + `Live*` behind one interface — nothing above this line knows which is active |
| `lib/evolution/` | `scenarios.ts` (sabotage catalog), `repair.ts` (a **general** repair — restore whichever guard the finding maps to, zero per-scenario hardcoding), `embeddings.ts`, `engine.ts` |
| `app/api/` | The control surface the Guild agent drives |
| `agent/` · `guild/` | The Guild agent, and the OpenAPI spec behind the integration |

Server state is **only the rules genome** — roster, schedule, and violations are deterministic functions of it. That's what lets an agent running off-machine drive the real app and read back honestly recomputed consequences.

🔐 The control routes are public while the tunnel is up, so mutating ones require `REGENESIS_AGENT_TOKEN` as a bearer credential, held by Guild as a connected integration credential. Verified: **401 without, 200 with.**

Stack: Next.js 16 · React 19 · TypeScript · Tailwind 4.
