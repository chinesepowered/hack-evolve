# Regenesis

**A scheduling SaaS that detects, diagnoses, and repairs its own safety defects — and gets faster every time it sees one.**

Regenesis runs a real product, **MedShift** (hospital shift scheduling for Mercy General), under a live self-healing loop. When a defect is introduced, autonomous QA finds it, an agent recalls whether it has seen the failure before, patches the rule that caused it, and re-tests — promoting a reusable skill each time a fix holds. The app's health is rendered as a patient monitor: the ECG trace *is* the open-bug count. Sabotage reads as arrhythmia; healing returns it to sinus rhythm.

Theme: **self-evolving agents.** The genome is a declarative rules config in a vector store; the phenotype is a library of versioned Guild skills; natural selection is externally-judged QA.

---

## The loop

```
        ┌─────────────────────────────────────────────────────────────┐
        │                                                             │
   ①  Replay explores MedShift and files bugs (real root-cause QA)    │
        │                                                             │
   ②  Guild trigger wakes the agent with the finding                   │
        │                                                             │
   ③  Actian recall: "have I seen this failure before?"  ── warm ──┐   │
        │                                                       │   │
   ④  Patch the rule genome (restore the violated policy)  ◄────┘   │
        │                                                             │
   ⑤  Record a new app version; Replay re-tests                       │
        │                                                             │
   ⑥  Held?  → promote a versioned Guild skill + reinforce Actian memory
        │     Regressed? → store a negative example                   │
        └──────────────────────── generation++ ──────────────────────┘
```

The crucial design choice: **rules** (what the app enforces — mutable, the genome) are separate from **invariants** (the signed-off safety spec — immutable, the oracle). Sabotage weakens the rules; the oracle keeps auditing against the fixed spec. So every bug is *genuinely detected*, never scripted, and every repair is verified against a standard the agent cannot talk its way around.

---

## Why this wins each prize

### 🟣 Guild — Best use of agents

Regenesis is a self-evolving agent that authors its **own capabilities on Guild's platform**, not a generic agent that merely runs there.

- **Skills as the unit of evolution.** Guild's Skills are versioned, contextually-activated knowledge packages. Every time the agent repairs a new defect class and the fix verifies, it *publishes a new Skill to the Agent Hub*. The next time that defect appears, the Skill is already there and activates instantly — the agent measurably gets faster. Watch "Skills learned" climb and a skill's application count tick up on a repeat defect.
- **Triggers** wake the agent on a QA finding; **Task state** persists the rule revision across steps; the **event stream** is the agent narrating its own run in the Activity panel.
- The whole thing is an agent that **improves its own toolset over generations** — self-evolution expressed directly in Guild primitives.

### 🔵 Replay — Best SaaS app with completed QA

MedShift is a genuinely designed SaaS product for a complex domain (clinical coverage, certification, rest, overtime, and consecutive-day rules), and **Replay is the fitness function** that drives it to zero open bugs.

- Replay's explorer discovers user journeys and files bugs with **reproduction steps, expected-vs-actual, root-cause analysis, and a screenshot chronology** — exactly the artifacts rendered in the QA findings ledger.
- The story isn't "we used Replay to test our app." It's "**the app QA's itself** using Replay, in a closed loop, until the ledger is green." Completed QA with all bugs fixed is the literal win condition of the product.

### 🟢 Actian — Best use of Actian VectorAI DB

Actian is the agent's **memory** — the substrate that makes evolution more than trial-and-error.

- Every verified fix is a point: the bug's embedding as the vector, `{guard, outcome, generation, skillVersion}` as the payload.
- Recall is a real similarity query — cosine ANN over prior *successful* fixes, filtered `must: {outcome: "success"}` so failures are never recalled as solutions. Same defect class → cosine ≈ 1.0 → instant warm recall; a new class → low similarity → "first encounter."
- The client also implements **hybrid retrieval with Reciprocal Rank Fusion** and must/must-not payload filters — the exact primitives Actian documents for AI-agent memory.

---

## The 3-minute demo script

> One tab. The command center shows MedShift (left, "the patient") beside the monitor (right, "the clinician").

1. **0:00 — Resting state.** ECG holds a calm sinus rhythm at 62 bpm. Health 100%, zero findings, the schedule grid all green. "This is a live hospital scheduler. Watch its vital signs."
2. **0:25 — Sabotage.** Press **Sabotage → "Bad deploy: certification + coverage."** The ECG spikes into magenta arrhythmia; the grid lights up red (uncertified staff in the ICU, night shifts understaffed); Replay files two findings with full root-cause. "A bad config push just shipped two safety defects. Replay found them in seconds."
3. **0:55 — Heal, generation 1.** Press **Heal one generation.** Watch the pipeline: QA scan → *recall* (Actian: "first encounter") → patch → verify → promote. The critical certification bug goes green; a skill is published to the Guild Hub. "No memory of this yet — so it diagnoses from root cause and *learns a skill*."
4. **1:30 — Heal, generation 2.** The coverage bug clears. ECG settles toward sinus. Fitness curve descends to zero. "Two defects, healed, verified, zero open bugs."
5. **2:00 — The learning proof.** **Sabotage → "Disable certification check"** again. Then **Heal.** This time the memory panel reads **"Recognized from memory · cosine 1.00"**, the existing skill *activates* instead of being relearned, and its application count ticks up. "It's seen this before. Instant recall, instant fix — that's the evolution."
6. **2:30 — Hand a judge the button.** "Break it however you like." Sabotage → heal, live. Close on the flat mint sinus rhythm.

---

## Running it

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

Everything runs in the browser against a faithful in-process simulation of each sponsor API — **no accounts, keys, or network calls.** That's deliberate for the pre-hackathon build; the architecture is written for a one-line switch to live.

## Going live (hackathon day)

Each sponsor sits behind an interface in `lib/sponsors/`, with a `Sim*` implementation (active now) and a `Live*` implementation stubbed to the real endpoints:

| Sponsor | Interface | Live target |
|---|---|---|
| Actian | `ActianClient` | `POST /collections/{c}/points`, cosine + RRF search |
| Replay | `ReplayClient` | `POST /projects/{id}/explorations`, `/bugs`, `/versions` |
| Guild  | `GuildClient`  | `@guildai/agents-sdk` — triggers, task state, skills |

```bash
# Set credentials, then:
NEXT_PUBLIC_REGENESIS_MODE=live pnpm dev
```

The engine and UI only ever touch the interfaces, so sim → live changes nothing above `lib/sponsors/`.

## How it's built

- **`lib/domain/`** — the real scheduling engine. `rules.ts` (the mutable genome), `oracle.ts` (the immutable safety spec / fitness function), `scheduler.ts` (deterministic auto-scheduler), `seed.ts` (a 26-person roster sized so the healthy schedule is genuinely violation-free).
- **`lib/sponsors/`** — Actian / Replay / Guild adapters (interface + sim + live stub).
- **`lib/evolution/`** — `scenarios.ts` (the sabotage catalog), `repair.ts` (a *general* repair: restore whichever guard the QA bug maps to — no per-scenario hardcoding), `embeddings.ts` (local deterministic embeddings), `engine.ts` (the generation loop).
- **`components/` + `app/page.tsx`** — the command center. `ECGMonitor.tsx` is the signature.

Stack: Next.js 16 · React 19 · TypeScript · Tailwind 4. No runtime dependencies beyond the framework.
