import "server-only";

import { audit, severityScore } from "@/lib/domain/oracle";
import { baselineRules, diffRules, GUARD_LABELS } from "@/lib/domain/rules";
import { autoSchedule } from "@/lib/domain/scheduler";
import { seedStaff } from "@/lib/domain/seed";
import type { GuardId, RulesConfig, Violation } from "@/lib/domain/types";
import { repairForGuard } from "@/lib/evolution/repair";
import { scenarioById } from "@/lib/evolution/scenarios";

/**
 * Server-side MedShift state.
 *
 * Only the rules genome is stored. Everything else — the roster, the schedule,
 * the violations — is a deterministic function of it (`autoSchedule` is seeded,
 * `audit` is pure), so a single small object is the whole app state. That is
 * what lets a Guild agent running off-machine drive the real application:
 * it mutates rules and reads back genuinely recomputed consequences.
 */
const staff = seedStaff();
let rules: RulesConfig = baselineRules();
let revisionLog: string[] = [];

export function getRules(): RulesConfig {
  return rules;
}

export function setRules(next: RulesConfig, note: string): void {
  revisionLog = [...revisionLog.slice(-19), note];
  rules = next;
}

export function currentViolations(): Violation[] {
  return audit(staff, autoSchedule(staff, rules));
}

/** Violations rolled up per guard — the shape an agent (or QA) reasons about. */
export interface Finding {
  guard: GuardId;
  label: string;
  severity: Violation["severity"];
  count: number;
  example: string;
}

export function findings(): Finding[] {
  const byGuard = new Map<GuardId, Violation[]>();
  for (const v of currentViolations()) {
    if (!byGuard.has(v.guard)) byGuard.set(v.guard, []);
    byGuard.get(v.guard)!.push(v);
  }
  return [...byGuard.entries()].map(([guard, list]) => ({
    guard,
    label: GUARD_LABELS[guard],
    severity: list[0].severity,
    count: list.length,
    example: list[0].message,
  }));
}

export function snapshot() {
  const violations = currentViolations();
  return {
    revision: rules.revision,
    packing: rules.scheduling.packing,
    guards: Object.fromEntries(
      Object.entries(rules.guards).map(([k, v]) => [k, { enabled: (v as { enabled: boolean }).enabled }]),
    ),
    openFindings: findings().length,
    totalViolations: violations.length,
    severityScore: severityScore(violations),
    healthy: violations.length === 0,
    recentChanges: revisionLog,
  };
}

export function applySabotage(scenarioId: string) {
  const scenario = scenarioById(scenarioId);
  if (!scenario) throw new Error(`Unknown scenario "${scenarioId}"`);
  const before = rules;
  setRules(scenario.apply(rules), `sabotage:${scenario.id}`);
  return { scenario, changes: diffRules(before, rules) };
}

/**
 * The repair the agent asks for. Deliberately general: it restores whichever
 * guard the finding maps to, with no knowledge of what broke it.
 */
export function applyPatch(guard: GuardId) {
  const before = rules;
  const beforeCount = currentViolations().length;
  setRules(repairForGuard(rules, guard), `patch:${guard}`);
  const afterCount = currentViolations().length;
  return {
    guard,
    changes: diffRules(before, rules),
    violationsBefore: beforeCount,
    violationsAfter: afterCount,
    resolved: afterCount < beforeCount,
  };
}

export function resetToBaseline() {
  rules = baselineRules();
  revisionLog = [];
}
