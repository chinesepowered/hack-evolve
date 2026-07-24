import { baselineRules, cloneRules } from "@/lib/domain/rules";
import type { GuardId, RulesConfig } from "@/lib/domain/types";

/**
 * The repair strategy.
 *
 * Given the guard a QA bug maps to, restore that guard's configuration to the
 * signed-off policy — and reset the packing strategy, which is never allowed to
 * drift from the safe default. This is deliberately general: it has no knowledge
 * of which scenario caused the bug. Any weakening of a guard is undone by copying
 * that guard's baseline back over the live config.
 *
 * Guards whose consequences depend on the scheduler's packing choice.
 */
const PACKING_SENSITIVE: GuardId[] = [
  "doubleBooking",
  "minRest",
  "maxConsecutiveDays",
  "maxWeeklyHours",
];

export function repairForGuard(current: RulesConfig, guard: GuardId): RulesConfig {
  const base = baselineRules();
  const next = cloneRules(current);

  // Restore the implicated guard to policy.
  switch (guard) {
    case "certification":
      next.guards.certification = { ...base.guards.certification };
      break;
    case "doubleBooking":
      next.guards.doubleBooking = { ...base.guards.doubleBooking };
      break;
    case "maxWeeklyHours":
      next.guards.maxWeeklyHours = { ...base.guards.maxWeeklyHours };
      break;
    case "minRest":
      next.guards.minRest = { ...base.guards.minRest };
      break;
    case "maxConsecutiveDays":
      next.guards.maxConsecutiveDays = { ...base.guards.maxConsecutiveDays };
      break;
    case "coverageMinimum":
      next.guards.coverageMinimum = {
        enabled: base.guards.coverageMinimum.enabled,
        minimums: base.guards.coverageMinimum.minimums,
      };
      break;
  }

  // Packing never legitimately deviates from baseline; restoring it is always
  // safe and undoes the "greedy optimizer" half of a compound defect.
  if (PACKING_SENSITIVE.includes(guard)) {
    next.scheduling.packing = base.scheduling.packing;
  }

  next.revision = current.revision + 1;
  return next;
}
