import type { GuardId, Violation } from "@/lib/domain/types";
import { SPONSOR_ENDPOINTS } from "./config";
import type { BugStatus, ReplayBug, ReplayClient, ReplayExploration } from "./types";

/**
 * Bug reports are aggregated one-per-guard: Replay's explorer would file dozens
 * of individual failures, but it clusters them into a single investigated defect
 * with a representative reproduction and a count. That keeps the bug ledger
 * readable while staying faithful to what the real product returns
 * (reproduction steps, expected vs actual, root cause, screenshot chronology).
 */
const BUG_TEMPLATES: Record<
  GuardId,
  {
    title: string;
    severity: ReplayBug["severity"];
    journey: string;
    expected: string;
    steps: string[];
    rootCause: string;
    shots: string[];
  }
> = {
  certification: {
    title: "Uncertified staff assigned to specialty units",
    severity: "critical",
    journey: "Publish weekly ICU roster",
    expected: "Only staff holding the unit certification can be placed in that unit.",
    steps: [
      "Open the Schedule for the current week",
      "Filter to the ICU column",
      "Inspect each assigned staff member's certifications",
    ],
    rootCause:
      "The certification guard is not being evaluated during auto-assignment, so the scheduler treats every staff member as eligible for every unit.",
    shots: [
      "schedule-grid → ICU/night cell highlighted red",
      "staff drawer → certifications list shows no ICU badge",
      "assignment trace → certification check skipped",
    ],
  },
  doubleBooking: {
    title: "Same staff member booked in two units at once",
    severity: "critical",
    journey: "Auto-fill overlapping coverage",
    expected: "A staff member can hold at most one shift in any time window.",
    steps: [
      "Open the Schedule for the current week",
      "Locate a staff member with two cells in the same time slot",
      "Confirm both shifts share the same start hour",
    ],
    rootCause:
      "The overlap guard is disabled, so the packing pass reuses the same person across concurrent unit demands.",
    shots: [
      "schedule-grid → two highlighted cells, same row, same slot",
      "staff timeline → overlapping bars at 07:00",
      "assignment trace → overlap check returned allow",
    ],
  },
  maxWeeklyHours: {
    title: "Staff scheduled beyond the weekly hour cap",
    severity: "serious",
    journey: "Review weekly hour totals",
    expected: "No staff member exceeds their contracted weekly hour cap.",
    steps: [
      "Open the Roster view",
      "Sort by scheduled hours descending",
      "Compare top rows against the 48h cap",
    ],
    rootCause:
      "A cost pass switched to minimize-headcount packing and the hour cap was raised, so shifts pile onto a few people.",
    shots: [
      "roster-table → hours column above cap in red",
      "staff timeline → 6+ shifts in one week",
      "assignment trace → hour cap not enforced",
    ],
  },
  minRest: {
    title: "Insufficient rest between consecutive shifts",
    severity: "serious",
    journey: "Chain evening into morning coverage",
    expected: "At least 10 hours of rest separates any two shifts for one person.",
    steps: [
      "Open a staff member's weekly timeline",
      "Find a night shift followed by a next-day shift",
      "Measure the gap between end and next start",
    ],
    rootCause:
      "The minimum-rest guard is off, allowing back-to-back assignments with less than the required recovery window.",
    shots: [
      "staff timeline → adjacent bars with < 10h gap",
      "shift detail → rest window flagged",
      "assignment trace → rest check skipped",
    ],
  },
  maxConsecutiveDays: {
    title: "Staff working too many consecutive days",
    severity: "warning",
    journey: "Fill a full seven-day week",
    expected: "No staff member works more than 5 consecutive days.",
    steps: [
      "Open a staff member's weekly timeline",
      "Count the unbroken run of worked days",
      "Compare against the 5-day limit",
    ],
    rootCause:
      "The consecutive-day limit was loosened, so the scheduler assigns an unbroken run across the week.",
    shots: [
      "staff timeline → 6-7 filled day columns in a row",
      "roster-table → consecutive-days badge in amber",
      "assignment trace → consecutive limit relaxed",
    ],
  },
  coverageMinimum: {
    title: "Unit understaffed below coverage minimum",
    severity: "serious",
    journey: "Verify overnight coverage",
    expected: "Every unit meets its minimum headcount for every shift.",
    steps: [
      "Open the Schedule for the current week",
      "Read the coverage counter under each unit/slot",
      "Compare the count against the required minimum",
    ],
    rootCause:
      "A unit's coverage minimum was lowered, so the scheduler stops filling seats that patient safety requires.",
    shots: [
      "schedule-grid → coverage counter shows 0/2 in red",
      "unit summary → understaffed slot flagged",
      "assignment trace → demand reduced below policy",
    ],
  },
};

export class SimReplayClient implements ReplayClient {
  readonly kind = "sim" as const;
  private bugs = new Map<GuardId, ReplayBug>();
  private version = 1;
  private explorationCount = 0;

  /** `probe` is the exploration itself: it audits the live app and returns findings. */
  constructor(private readonly probe: () => Violation[]) {}

  async explore(
    prompt = "Explore the scheduling app and report any unsafe rosters",
  ): Promise<{ exploration: ReplayExploration; bugs: ReplayBug[] }> {
    this.explorationCount++;
    const violations = this.probe();
    const byGuard = new Map<GuardId, Violation[]>();
    for (const v of violations) {
      if (!byGuard.has(v.guard)) byGuard.set(v.guard, []);
      byGuard.get(v.guard)!.push(v);
    }

    const found: ReplayBug[] = [];
    const journeys = new Set<string>();

    for (const [guard, list] of byGuard) {
      const t = BUG_TEMPLATES[guard];
      journeys.add(t.journey);
      const example = list[0];
      const existing = this.bugs.get(guard);
      const bug: ReplayBug = existing
        ? { ...existing, status: existing.status === "fixed" ? "reopened" : "open", count: list.length }
        : {
            id: `bug_${guard}_${this.version}`,
            guard,
            title: t.title,
            severity: t.severity,
            status: "open",
            fingerprint: `fp:${guard}`,
            reproductionSteps: t.steps,
            expected: t.expected,
            actual: example.message,
            rootCause: t.rootCause,
            screenshots: t.shots,
            foundInVersion: this.version,
            count: list.length,
          };
      // Refresh the representative "actual" line each exploration.
      bug.actual = example.message;
      bug.count = list.length;
      this.bugs.set(guard, bug);
      found.push(bug);
    }

    const exploration: ReplayExploration = {
      id: `exp_${this.explorationCount}`,
      prompt,
      startedVersion: this.version,
      bugsFound: found.length,
      journeysCovered: [...journeys],
    };
    return { exploration, bugs: found };
  }

  async listBugs(status?: BugStatus): Promise<ReplayBug[]> {
    const all = [...this.bugs.values()];
    return status ? all.filter((b) => b.status === status) : all;
  }

  async getBug(id: string): Promise<ReplayBug | undefined> {
    return [...this.bugs.values()].find((b) => b.id === id);
  }

  async updateBug(id: string, status: BugStatus): Promise<ReplayBug> {
    const bug = [...this.bugs.values()].find((b) => b.id === id);
    if (!bug) throw new Error(`Unknown bug ${id}`);
    bug.status = status;
    if (status === "fixed") bug.count = 0;
    this.bugs.set(bug.guard, bug);
    return bug;
  }

  async recordVersion(): Promise<{ version: number }> {
    this.version++;
    return { version: this.version };
  }

  async status(): Promise<{ open: number; fixed: number; version: number; explorations: number }> {
    const all = [...this.bugs.values()];
    return {
      open: all.filter((b) => b.status === "open" || b.status === "reopened").length,
      fixed: all.filter((b) => b.status === "fixed").length,
      version: this.version,
      explorations: this.explorationCount,
    };
  }
}

/** Live Replay client — mirrors loop-qa.replay.io/api/v1. Enable at hackathon. */
export class LiveReplayClient implements ReplayClient {
  readonly kind = "sim" as const;
  constructor(
    private readonly projectId = "",
    private readonly base = SPONSOR_ENDPOINTS.replay,
    private readonly token = (typeof process !== "undefined" && process.env?.REPLAY_QA_TOKEN) || "",
  ) {}
  private nyi(ep: string): never {
    throw new Error(
      `LiveReplayClient not enabled. Call ${ep} on ${this.base} with 'Authorization: Bearer ${this.token || "lqa_…"}'.`,
    );
  }
  async explore(): Promise<{ exploration: ReplayExploration; bugs: ReplayBug[] }> {
    this.nyi(`POST /projects/${this.projectId}/explorations`);
  }
  async listBugs(): Promise<ReplayBug[]> {
    this.nyi(`GET /projects/${this.projectId}/bugs`);
  }
  async getBug(id: string): Promise<ReplayBug | undefined> {
    this.nyi(`GET /bugs/${id}`);
  }
  async updateBug(id: string): Promise<ReplayBug> {
    this.nyi(`PATCH /bugs/${id}`);
  }
  async recordVersion(): Promise<{ version: number }> {
    this.nyi(`POST /projects/${this.projectId}/versions`);
  }
  async status(): Promise<{ open: number; fixed: number; version: number; explorations: number }> {
    this.nyi(`GET /projects/${this.projectId}/status`);
  }
}
