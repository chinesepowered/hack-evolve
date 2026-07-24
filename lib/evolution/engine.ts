import { baselineRules } from "@/lib/domain/rules";
import { audit, severityScore, severityWeight } from "@/lib/domain/oracle";
import { autoSchedule } from "@/lib/domain/scheduler";
import { seedStaff } from "@/lib/domain/seed";
import type { RulesConfig, Shift, StaffMember, Violation } from "@/lib/domain/types";
import { createSponsors, sponsorMode, type SponsorSuite } from "@/lib/sponsors";
import type { GuildEvent, GuildSkill, ReplayBug, VectorHit } from "@/lib/sponsors/types";
import { embed } from "./embeddings";
import { repairForGuard } from "./repair";
import { scenarioById } from "./scenarios";

export type Phase =
  | "idle"
  | "sick"
  | "exploring"
  | "retrieving"
  | "diagnosing"
  | "patching"
  | "verifying"
  | "promoting"
  | "healthy";

export interface GenerationRecord {
  generation: number;
  openBugs: number;
  severity: number;
  version: number;
  guard: string;
  warm: boolean;
  ms: number;
}

export interface RetrievalResult {
  hit: boolean;
  score: number;
  warm: boolean;
  guard: string;
  reinforcedTimes: number;
  hadSkill: boolean;
  topHits: VectorHit[];
}

export interface Vitals {
  openBugs: number;
  criticalBugs: number;
  health: number; // 0..100
  bpm: number;
  rhythm: "sinus" | "arrhythmia" | "flatline-recovering";
}

export interface EngineSnapshot {
  mode: "sim" | "live";
  generation: number;
  version: number;
  phase: Phase;
  phaseLabel: string;
  staff: StaffMember[];
  shifts: Shift[];
  rules: RulesConfig;
  violations: Violation[];
  bugs: ReplayBug[];
  history: GenerationRecord[];
  skills: GuildSkill[];
  memoryPoints: number;
  totalReinforcements: number;
  activity: GuildEvent[];
  vitals: Vitals;
  lastRetrieval?: RetrievalResult;
  lastPatch: string[];
  busy: boolean;
  currentGuard?: string;
}

const RECALL_THRESHOLD = 0.75;

const PHASE_LABELS: Record<Phase, string> = {
  idle: "Standing by",
  sick: "Defect detected",
  exploring: "Replay exploring app",
  retrieving: "Querying Actian memory",
  diagnosing: "Diagnosing root cause",
  patching: "Applying rule patch",
  verifying: "Replay re-testing",
  promoting: "Promoting skill",
  healthy: "All systems nominal",
};

export class RegenesisEngine {
  private staff: StaffMember[];
  private rules: RulesConfig;
  private shifts: Shift[];
  private sponsors: SponsorSuite;

  private generation = 0;
  private phase: Phase = "idle";
  private history: GenerationRecord[] = [];
  private lastRetrieval?: RetrievalResult;
  private lastPatch: string[] = [];
  private busy = false;
  private currentGuard?: string;

  private listeners = new Set<() => void>();
  private snapshot!: EngineSnapshot;

  /** Milliseconds per animated step. Lowered for reduced-motion / fast demo. */
  public stepMs = 620;

  constructor() {
    this.staff = seedStaff();
    this.rules = baselineRules();
    this.shifts = autoSchedule(this.staff, this.rules);
    // The probe IS Replay's exploration: it audits whatever the app currently is.
    this.sponsors = createSponsors(() => audit(this.staff, this.shifts));
    this.rebuild();
    // Prime the ledger with a clean initial exploration.
    void this.sponsors.replay.explore("Baseline safety sweep").then(() => this.rebuild());
    void this.sponsors.guild.log("task.completed", "Baseline roster verified — 0 open findings");
  }

  // -- external store plumbing ----------------------------------------------
  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getSnapshot = () => this.snapshot;

  private emit() {
    for (const cb of this.listeners) cb();
  }

  private currentViolations(): Violation[] {
    return audit(this.staff, this.shifts);
  }

  private computeVitals(bugs: ReplayBug[], violations: Violation[]): Vitals {
    const open = bugs.filter((b) => b.status === "open" || b.status === "reopened");
    const openScore = open.reduce((s, b) => s + severityWeight(b.severity) * Math.max(1, b.count), 0);
    const health = Math.max(0, Math.round(100 - Math.min(100, openScore * 2.2)));
    const bpm = Math.min(154, 62 + open.length * 11 + (violations.length > 0 ? 6 : 0));
    const rhythm: Vitals["rhythm"] =
      open.length === 0 ? "sinus" : this.phase === "verifying" ? "flatline-recovering" : "arrhythmia";
    return {
      openBugs: open.length,
      criticalBugs: open.filter((b) => b.severity === "critical").length,
      health,
      bpm,
      rhythm,
    };
  }

  private rebuild() {
    const violations = this.currentViolations();
    // The ledger and skills are read from caches refreshed by refreshCaches(),
    // so rebuild() itself stays synchronous and cheap.
    const bugs = this.cachedBugs;
    const skills = this.cachedSkills;
    this.snapshot = {
      mode: sponsorMode(),
      generation: this.generation,
      version: this.cachedVersion,
      phase: this.phase,
      phaseLabel: PHASE_LABELS[this.phase],
      staff: this.staff,
      shifts: this.shifts,
      rules: this.rules,
      violations,
      bugs,
      history: this.history,
      skills,
      memoryPoints: this.cachedMemoryPoints,
      totalReinforcements: this.cachedReinforcements,
      activity: [...this.sponsors.guild.events()].slice(-40).reverse(),
      vitals: this.computeVitals(bugs, violations),
      lastRetrieval: this.lastRetrieval,
      lastPatch: this.lastPatch,
      busy: this.busy,
      currentGuard: this.currentGuard,
    };
    this.emit();
  }

  // Cached async-derived values, refreshed by refreshCaches().
  private cachedBugs: ReplayBug[] = [];
  private cachedSkills: GuildSkill[] = [];
  private cachedVersion = 1;
  private cachedMemoryPoints = 0;
  private cachedReinforcements = 0;

  private async refreshCaches() {
    this.cachedBugs = await this.sponsors.replay.listBugs();
    this.cachedSkills = await this.sponsors.guild.listSkills();
    const status = await this.sponsors.replay.status();
    this.cachedVersion = status.version;
    const points = await this.sponsors.actian.all();
    this.cachedMemoryPoints = points.length;
    this.cachedReinforcements = points.reduce((s, p) => s + p.payload.timesReinforced, 0);
  }

  private async setPhase(phase: Phase, ms = this.stepMs) {
    this.phase = phase;
    await this.refreshCaches();
    this.rebuild();
    if (ms > 0) await delay(ms);
  }

  // -- public actions -------------------------------------------------------

  async sabotage(scenarioId: string) {
    if (this.busy) return;
    const scenario = scenarioById(scenarioId);
    if (!scenario) return;
    this.busy = true;

    this.rules = scenario.apply(this.rules);
    this.shifts = autoSchedule(this.staff, this.rules);

    await this.sponsors.guild.log(
      "trigger.fired",
      `Config change deployed: ${scenario.label}`,
    );
    const { bugs } = await this.sponsors.replay.explore(
      "Regression sweep after config change",
    );
    await this.sponsors.guild.log(
      "task.started",
      `Replay opened ${bugs.filter((b) => b.status !== "fixed").length} finding(s)`,
    );

    this.phase = "sick";
    this.busy = false;
    await this.refreshCaches();
    // Record the spike so the fitness curve shows the regression, not just the recovery.
    const openNow = this.cachedBugs.filter((b) => b.status === "open" || b.status === "reopened");
    this.history = [
      ...this.history,
      {
        generation: this.generation,
        openBugs: openNow.length,
        severity: severityScore(this.currentViolations()),
        version: this.cachedVersion,
        guard: "regression",
        warm: false,
        ms: 0,
      },
    ];
    this.rebuild();
  }

  /** Run exactly one evolution generation against the most severe open bug. */
  async healOnce(): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true;
    const started = Date.now();

    // 1 — Replay explores and files/refreshes findings.
    await this.setPhase("exploring");
    await this.sponsors.guild.fireTrigger("replay.exploration.completed", "new findings available");
    const { bugs } = await this.sponsors.replay.explore("Targeted exploration of failing journeys");
    const open = bugs
      .filter((b) => b.status === "open" || b.status === "reopened")
      .sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity));

    if (open.length === 0) {
      this.phase = "healthy";
      this.busy = false;
      await this.sponsors.guild.log("task.completed", "No open findings — roster is safe");
      await this.refreshCaches();
      this.rebuild();
      return false;
    }

    const bug = open[0];
    this.currentGuard = bug.guard;
    await this.sponsors.guild.log("task.started", `Investigating: ${bug.title}`);

    // 2 — Query Actian: have we seen this failure before?
    await this.setPhase("retrieving");
    const queryVec = embed(`${bug.title} ${bug.actual} ${bug.rootCause}`);
    // Cosine nearest-neighbour over proven fixes decides recall (the score the
    // threshold is defined against). hybridSearch/RRF remains available on the
    // client for multi-vector re-ranking; cosine is the honest recall signal.
    const hits = await this.sponsors.actian.search(queryVec, {
      topK: 4,
      filter: { must: { outcome: "success" } },
    });
    const top = hits[0];
    const warm = !!top && top.score >= RECALL_THRESHOLD && top.payload.guard === bug.guard;
    const skill = await this.sponsors.guild.activateSkill(bug.guard);
    this.lastRetrieval = {
      hit: !!top,
      score: top?.score ?? 0,
      warm: warm && !!skill,
      guard: bug.guard,
      reinforcedTimes: top?.payload.timesReinforced ?? 0,
      hadSkill: !!skill,
      topHits: hits,
    };
    await this.sponsors.guild.log(
      warm && skill ? "skill.activated" : "state.read",
      warm && skill
        ? `Recognized defect class (cosine ${top!.score.toFixed(2)}) — recalling ${skill!.name} v${skill!.version}`
        : `No confident memory match — treating as first encounter`,
    );

    // 3 — Diagnose (cold) or recall (warm). Warm path is faster.
    await this.setPhase("diagnosing", warm && skill ? this.stepMs * 0.4 : this.stepMs);

    // 4 — Patch the rule genome and reschedule.
    await this.setPhase("patching");
    const before = this.rules;
    this.rules = repairForGuard(this.rules, bug.guard);
    this.shifts = autoSchedule(this.staff, this.rules);
    this.lastPatch = describePatch(before, this.rules);
    const { version } = await this.sponsors.replay.recordVersion(`Patch for ${bug.guard}`);
    await this.sponsors.guild.setState(`rules.revision`, this.rules.revision);
    await this.sponsors.guild.log("state.write", `Published app version v${version}`);

    // 5 — Verify: Replay re-tests the patched app.
    await this.setPhase("verifying");
    await this.sponsors.replay.explore("Verification pass after patch");
    const stillOpen = this.currentViolations().some((v) => v.guard === bug.guard);
    const resolved = !stillOpen;

    // 6 — Promote or record the failure.
    await this.setPhase("promoting");
    const memId = `mem:${bug.guard}`;
    const priorPoint = (await this.sponsors.actian.all()).find((p) => p.id === memId);
    if (resolved) {
      await this.sponsors.replay.updateBug(bug.id, "fixed");
      // Also close any secondary bug the same patch cleared.
      for (const other of open.slice(1)) {
        if (!this.currentViolations().some((v) => v.guard === other.guard)) {
          await this.sponsors.replay.updateBug(other.id, "fixed");
        }
      }
      await this.sponsors.actian.upsert([
        {
          id: memId,
          vector: embed(`${bug.title} ${bug.actual} ${bug.rootCause}`),
          payload: {
            guard: bug.guard,
            defectId: bug.fingerprint,
            text: bug.title,
            outcome: "success",
            generation: this.generation + 1,
            skillVersion: (skill?.version ?? 0) + (skill ? 0 : 1),
            timesReinforced: (priorPoint?.payload.timesReinforced ?? 0) + 1,
          },
        },
      ]);
      if (!skill) {
        const published = await this.sponsors.guild.publishSkill({
          guard: bug.guard,
          name: skillName(bug.guard),
          knowledge: `When Replay reports "${bug.title}", restore the ${bug.guard} policy to its signed-off baseline and reset packing to spread.`,
          createdGeneration: this.generation + 1,
        });
        await this.sponsors.guild.log("skill.published", `Learned new skill: ${published.name} v1`);
      } else {
        await this.sponsors.guild.log(
          "skill.activated",
          `Reinforced ${skill.name} → ${skill.applications} applications`,
        );
      }
      await this.sponsors.guild.log("task.completed", `Fix verified — ${bug.title} resolved`);
    } else {
      await this.sponsors.actian.upsert([
        {
          id: `mem:fail:${bug.guard}:${this.generation}`,
          vector: embed(`${bug.title} ${bug.actual}`),
          payload: {
            guard: bug.guard,
            defectId: bug.fingerprint,
            text: bug.title,
            outcome: "fail",
            generation: this.generation + 1,
            timesReinforced: 1,
          },
        },
      ]);
      await this.sponsors.guild.log("task.completed", `Fix did not hold — stored as negative example`);
    }

    // 7 — Close the generation.
    this.generation++;
    await this.refreshCaches();
    const openNow = this.cachedBugs.filter((b) => b.status === "open" || b.status === "reopened");
    this.history = [
      ...this.history,
      {
        generation: this.generation,
        openBugs: openNow.length,
        severity: severityScore(this.currentViolations()),
        version: this.cachedVersion,
        guard: bug.guard,
        warm: warm && !!skill,
        ms: Date.now() - started,
      },
    ];
    this.currentGuard = undefined;
    this.phase = openNow.length === 0 ? "healthy" : "sick";
    this.busy = false;
    this.rebuild();
    return openNow.length > 0;
  }

  async healAll() {
    if (this.busy) return;
    let more = true;
    let guardRail = 0;
    while (more && guardRail < 10) {
      more = await this.healOnce();
      guardRail++;
    }
  }

  reset() {
    if (this.busy) return;
    this.staff = seedStaff();
    this.rules = baselineRules();
    this.shifts = autoSchedule(this.staff, this.rules);
    this.sponsors = createSponsors(() => audit(this.staff, this.shifts));
    this.generation = 0;
    this.phase = "idle";
    this.history = [];
    this.lastRetrieval = undefined;
    this.lastPatch = [];
    this.currentGuard = undefined;
    void this.sponsors.replay.explore("Baseline safety sweep").then(async () => {
      await this.refreshCaches();
      this.rebuild();
    });
    this.rebuild();
  }
}

function describePatch(before: RulesConfig, after: RulesConfig): string[] {
  // Local import avoided to keep this file self-contained in the hot path.
  const lines: string[] = [];
  const b = before.guards;
  const a = after.guards;
  if (b.certification.enabled !== a.certification.enabled)
    lines.push(`certification.enabled: ${b.certification.enabled} → ${a.certification.enabled}`);
  if (b.doubleBooking.enabled !== a.doubleBooking.enabled)
    lines.push(`doubleBooking.enabled: ${b.doubleBooking.enabled} → ${a.doubleBooking.enabled}`);
  if (b.minRest.enabled !== a.minRest.enabled)
    lines.push(`minRest.enabled: ${b.minRest.enabled} → ${a.minRest.enabled}`);
  if (b.maxConsecutiveDays.days !== a.maxConsecutiveDays.days)
    lines.push(`maxConsecutiveDays.days: ${b.maxConsecutiveDays.days} → ${a.maxConsecutiveDays.days}`);
  if (b.maxWeeklyHours.limit !== a.maxWeeklyHours.limit)
    lines.push(`maxWeeklyHours.limit: ${b.maxWeeklyHours.limit} → ${a.maxWeeklyHours.limit}`);
  if (before.scheduling.packing !== after.scheduling.packing)
    lines.push(`scheduling.packing: ${before.scheduling.packing} → ${after.scheduling.packing}`);
  const bm = b.coverageMinimum.minimums.ICU;
  const am = a.coverageMinimum.minimums.ICU;
  if (bm.night !== am.night) lines.push(`coverage.ICU.night: ${bm.night} → ${am.night}`);
  if (bm.swing !== am.swing) lines.push(`coverage.ICU.swing: ${bm.swing} → ${am.swing}`);
  if (lines.length === 0) lines.push("restored guard configuration to baseline");
  return lines;
}

function skillName(guard: string): string {
  const map: Record<string, string> = {
    certification: "Restore Certification Guard",
    doubleBooking: "Resolve Overlap Conflicts",
    minRest: "Enforce Rest Window",
    maxConsecutiveDays: "Cap Consecutive Days",
    maxWeeklyHours: "Enforce Hour Cap",
    coverageMinimum: "Restore Coverage Floor",
  };
  return map[guard] ?? "Restore Policy";
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
