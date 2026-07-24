import { cloneRules } from "@/lib/domain/rules";
import type { GuardId, RulesConfig } from "@/lib/domain/types";

/**
 * The defect catalog — the "sabotage" menu.
 *
 * Each scenario is a mutation of the rules genome that a plausible bad config
 * push might introduce. None of them inject fake bugs: they weaken the app's
 * real enforcement, and the oracle (which audits against the untouched policy)
 * then surfaces genuine violations. Repair is not scripted here — the agent
 * derives it from which guard the QA bug maps to.
 */
export interface Scenario {
  id: string;
  label: string;
  /** The one-line story a judge reads when they press the button. */
  story: string;
  severity: "critical" | "serious" | "warning";
  /** Guards this mutation is expected to break, for display only. */
  breaks: GuardId[];
  apply(rules: RulesConfig): RulesConfig;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "cert",
    label: "Disable certification check",
    story: "A config push turned off the certification guard during auto-assignment.",
    severity: "critical",
    breaks: ["certification"],
    apply(rules) {
      const r = cloneRules(rules);
      r.guards.certification.enabled = false;
      r.revision++;
      return r;
    },
  },
  {
    id: "double",
    label: "Deploy greedy packing, drop overlap check",
    story: "A cost optimization packed shifts onto fewer staff and skipped the overlap guard.",
    severity: "critical",
    breaks: ["doubleBooking"],
    apply(rules) {
      const r = cloneRules(rules);
      r.scheduling.packing = "minimize-headcount";
      r.guards.doubleBooking.enabled = false;
      r.revision++;
      return r;
    },
  },
  {
    id: "rest",
    label: "Disable rest-window guard",
    story: "The minimum-rest guard was disabled to make overnight coverage easier to fill.",
    severity: "serious",
    breaks: ["minRest"],
    apply(rules) {
      const r = cloneRules(rules);
      r.guards.minRest.enabled = false;
      r.revision++;
      return r;
    },
  },
  {
    id: "consec",
    label: "Relax consecutive-day limit under packing",
    story: "Greedy packing plus a loosened consecutive-day limit stretched staff across the week.",
    severity: "warning",
    breaks: ["maxConsecutiveDays"],
    apply(rules) {
      const r = cloneRules(rules);
      r.scheduling.packing = "minimize-headcount";
      r.guards.maxConsecutiveDays.days = 8;
      r.revision++;
      return r;
    },
  },
  {
    id: "coverage",
    label: "Cut ICU overnight coverage",
    story: "An ICU coverage minimum was lowered, dropping seats patient safety requires.",
    severity: "serious",
    breaks: ["coverageMinimum"],
    apply(rules) {
      const r = cloneRules(rules);
      r.guards.coverageMinimum.minimums.ICU.night = 0;
      r.guards.coverageMinimum.minimums.ICU.swing = 1;
      r.revision++;
      return r;
    },
  },
  {
    id: "badDeploy",
    label: "Bad deploy: certification + coverage",
    story: "One deploy disabled certification AND cut ICU coverage — two defects, one push.",
    severity: "critical",
    breaks: ["certification", "coverageMinimum"],
    apply(rules) {
      const r = cloneRules(rules);
      r.guards.certification.enabled = false;
      r.guards.coverageMinimum.minimums.ICU.night = 0;
      r.revision++;
      return r;
    },
  },
];

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
