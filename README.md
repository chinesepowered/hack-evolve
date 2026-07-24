# Regenesis

**A scheduling SaaS that detects, diagnoses, and repairs its own safety defects — and gets faster every time it sees one.**

Regenesis runs a real product, **MedShift** (hospital shift scheduling), under a live self-healing loop. When a defect ships, the app's oracle surfaces genuine violations, an agent running on **Guild** recalls whether it has seen the failure before via **Actian VectorAI DB**, patches the rule that caused it, and verifies. **Replay Loop QA** explores the deployment as the external quality gate. The app's health is rendered as a patient monitor: the ECG trace *is* the open-finding count. Sabotage reads as arrhythmia; healing returns it to sinus rhythm.

Theme: **self-evolving agents.** The genome is a mutable rules config; memory is a vector collection; natural selection is externally-judged QA.

**All three integrations are live.** No mocks in the paths described below.

---

## The core design choice

**Rules** (what the app enforces — mutable, the genome) are separate from **invariants** (the signed-off safety spec — immutable, the oracle).

Sabotage weakens the *rules*. The oracle keeps auditing against the *fixed spec*. So every finding is **genuinely computed, never scripted**, and every repair is verified against a standard the agent cannot talk its way around. Disabling the certification guard doesn't hide its own violations — it produces 14 real ones.

Server state is only the rules genome; the roster, schedule, and violations are deterministic functions of it (`autoSchedule` is seeded, `audit` is pure). That is what lets an agent running off-machine drive the real application and read back honestly recomputed consequences.

---

## The loop

```
   ①  Sabotage weakens a safety rule (a plausible bad config push)
        │
   ②  Oracle audits against the immutable spec → real violations
        │
   ③  Agent probes, then asks Actian: "have I seen this failure?" ── warm ──┐
        │                                                                   │
   ④  Patch: restore the implicated guard to policy  ◄────────────────────┘
        │
   ⑤  Probe again — a repair only counts if the finding is gone
        │
   ⑥  Held? → reinforce the memory in Actian.  Failed? → record a negative.
        └──────────────────── generation++ ────────────────────
```

---

## Why this wins each prize

### 🟣 Guild — Best use of agents

`chineseman~regenesis-healer` is **published and running on Guild**, driving a real external application.

Guild agents are sandboxed: no external npm, no Node built-ins, and **no outbound sockets** — a raw `fetch` from a tool fails. The sanctioned path is a first-class integration, so MedShift is registered as one:

- **`chineseman~regenesis-medshift`** (v1.0.0, published) — generated from an OpenAPI spec (`guild/regenesis-openapi.json`) into four proxied operations: `medshift_probe`, `medshift_patch`, `memory_recall`, `memory_remember`. Guild's proxy makes the calls and injects the bearer credential.
- The agent is an `llmAgent` in TypeScript whose system prompt encodes the evolutionary loop, running `mode: "multi-turn"` so it iterates autonomously.

**Verified end to end.** Against a cold memory and a sabotaged app, the agent executed exactly the intended sequence:

```
medshift_probe → memory_recall → medshift_patch → medshift_probe → memory_remember
```

App went from 14 violations to 0, with `recentChanges: ['sabotage:cert', 'patch:certification']` — the patch applied by an agent that never ran on this machine.

### 🔵 Replay — Best SaaS app with completed QA

MedShift is a genuinely designed SaaS for a complex domain (certification, rest windows, overtime, consecutive days, coverage minimums), and Replay Loop QA is the external gate on the real deployment.

- Live project `proj-regenesis-medshift-mrzbyrb6` points at the public tunnel. Loop QA started exploring on creation and discovered real journeys ("Load the main page", …) on its own.
- Two audiences, kept honestly distinct in the UI: **Safety findings** is the in-app oracle checking invariants; **Autonomous QA** is Replay checking the product. Conflating them would be the easy lie; we don't.
- The win condition of the product is a green ledger — QA isn't a checkbox, it's the fitness function.

### 🟢 Actian — Best use of Actian VectorAI DB

Actian is the agent's memory — what makes this evolution rather than retry.

- Runs from `actian/vectorai:latest` (REST :6573, gRPC :6574). Collection `regenesis_memory`, 96-dim, cosine, auto-created on first use.
- Every verified fix is a point: the failure's embedding as the vector, `{guard, outcome, generation, timesReinforced}` as payload. Recall filters `must: {outcome: "success"}` so a failed fix is never recalled as a solution.
- **Measured:** first encounter `warm:false, score:0`. Same defect again → `warm:true, score:1.00`, and the memory reinforces *in place* (count stays 1, `timesReinforced` increments).

Three things worth flagging, because they are easy to get wrong:

1. **Point IDs must be uint or UUID.** `mem:certification` is rejected outright (`invalid UUID`). Keys map through a deterministic FNV-derived UUID (`lib/sponsors/point-id.ts`); the original travels in the payload as `memKey`. This is what makes reinforcement overwrite instead of duplicate.
2. **There is no managed cloud tier** — VectorAI is local/edge by design.
3. **No native hybrid search.** The RRF fusion is *ours*, computed over real ANN queries (`fuse()` in `lib/sponsors/actian.ts`). We don't claim otherwise.

---

## The 3-minute demo script

1. **0:00 — Resting state.** ECG holds sinus rhythm at 62 bpm, zero findings, grid green. "A live hospital scheduler. Watch its vital signs."
2. **0:20 — Sabotage.** **Sabotage → "Bad deploy: certification + coverage."** ECG spikes into magenta arrhythmia; the grid lights red — uncertified staff in the ICU, nights understaffed. "A bad config push just shipped two safety defects. Nothing is scripted: the oracle audits against the original policy, so it *computes* these."
3. **0:50 — Heal, generation 1.** **Heal one generation.** Pipeline runs: probe → recall (*"first encounter"*) → patch → verify. "No memory of this yet, so it diagnoses from root cause and learns."
4. **1:20 — Generation 2.** Coverage clears, ECG settles, fitness curve descends to zero.
5. **1:45 — The learning proof.** Sabotage the *same* defect again, then heal. Memory panel reads **"Recognized from memory · cosine 1.00."** "It's seen this before. Instant recall — that's the evolution."
6. **2:15 — The real agent.** Show the agent on Guild doing it for real:
   ```bash
   guild session create --workspace <ws> --type chat \
     --agent chineseman~regenesis-healer \
     --prompt "Heal the MedShift app. Report what you find and what you verify."
   ```
   Watch violations go 14 → 0 from a process running on Guild's infrastructure.
7. **2:40 — Hand a judge the button.** "Break it however you like."

---

## Running it

```bash
# 1. Memory: Actian VectorAI
docker run -d --name vectorai -p 6573-6575:6573-6575 \
  -e ACTIAN_VECTORAI_ACCEPT_EULA=YES \
  -v vectorai_data:/var/lib/actian-vectorai \
  actian/vectorai:latest

# 2. The app
pnpm install
pnpm dev

# 3. Public URL (Replay + Guild must reach it)
ngrok http 3000
```

Then set `.env.local` (see the committed defaults) — each sponsor flips **independently**, because they come online at different times:

```bash
NEXT_PUBLIC_ACTIAN_MODE=live     # instant: local Docker
NEXT_PUBLIC_REPLAY_MODE=live     # needs a token + public URL
NEXT_PUBLIC_GUILD_MODE=live      # needs guild auth login
```

The topbar chips report each sponsor's true state, so the UI can never overstate what's live.

> **Note:** the ngrok URL changes per session. It appears in three places: `.env.local` (`REPLAY_TARGET_URL`), the Guild integration base URL (`guild integration update`), and the Replay project's `target_url`.

### Rebuilding the Guild agent

```bash
cd agent
npm install                      # Guild's private registry, configured by `guild auth login`
guild agent save --publish --wait
```

`agent/` is a separate deployable with its own toolchain (npm, not pnpm — Guild's scaffolding and the root pnpm workspace conflict), excluded from the root lint and typecheck. Guild validates it on publish.

---

## How it's built

- **`lib/domain/`** — the real scheduling engine. `rules.ts` (mutable genome), `oracle.ts` (immutable spec / fitness function), `scheduler.ts` (deterministic), `seed.ts` (a 26-person roster sized so the healthy schedule is genuinely violation-free).
- **`lib/server/`** — server-only: `actian.ts` (REST client), `replay.ts` (Loop QA client), `app-state.ts` (the rules genome + derived findings), `agent-auth.ts` (shared-secret guard on public mutating routes).
- **`lib/sponsors/`** — the three adapters, each `Sim*` + `Live*` behind one interface. Nothing above this line knows which is active.
- **`lib/evolution/`** — `scenarios.ts` (sabotage catalog), `repair.ts` (a *general* repair — restore whichever guard the finding maps to, no per-scenario hardcoding), `embeddings.ts`, `engine.ts`.
- **`app/api/`** — the control surface the Guild agent drives: `regenesis/{probe,patch,sabotage,reset,state}`, `memory/{recall,remember,search,upsert}`, `qa/*`.
- **`agent/`** — the Guild agent. **`guild/`** — the OpenAPI spec behind the integration.

Stack: Next.js 16 · React 19 · TypeScript · Tailwind 4.

### Security note

The control routes are reachable from the public internet while the tunnel is up, so mutating ones (`patch`, `sabotage`, `reset`, `qa/explore`) require `REGENESIS_AGENT_TOKEN` as a bearer credential — held by Guild as a connected integration credential. Verified: 401 without, 200 with.
