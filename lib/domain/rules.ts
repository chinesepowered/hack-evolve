import type { GuardId, RulesConfig, ShiftSlot, Unit } from "./types";

/**
 * The rules Mercy General signed off on. This is the correct configuration —
 * every defect is a mutation away from this baseline, and every repair is a
 * move back toward it. Minimums are sized to be satisfiable by the seed roster,
 * so the healthy schedule is genuinely violation-free.
 */
export function baselineRules(): RulesConfig {
  return {
    revision: 1,
    scheduling: { packing: "spread" },
    guards: {
      certification: { enabled: true },
      doubleBooking: { enabled: true },
      maxWeeklyHours: { enabled: true, limit: 48 },
      minRest: { enabled: true, hours: 10 },
      maxConsecutiveDays: { enabled: true, days: 5 },
      coverageMinimum: {
        enabled: true,
        minimums: {
          ICU: { day: 2, swing: 2, night: 1 },
          ED: { day: 2, swing: 2, night: 1 },
          PEDS: { day: 1, swing: 1, night: 1 },
          SURG: { day: 1, swing: 1, night: 1 },
        },
      },
    },
  };
}

export function cloneRules(rules: RulesConfig): RulesConfig {
  return {
    revision: rules.revision,
    scheduling: { ...rules.scheduling },
    guards: {
      certification: { ...rules.guards.certification },
      doubleBooking: { ...rules.guards.doubleBooking },
      maxWeeklyHours: { ...rules.guards.maxWeeklyHours },
      minRest: { ...rules.guards.minRest },
      maxConsecutiveDays: { ...rules.guards.maxConsecutiveDays },
      coverageMinimum: {
        enabled: rules.guards.coverageMinimum.enabled,
        minimums: Object.fromEntries(
          Object.entries(rules.guards.coverageMinimum.minimums).map(([unit, slots]) => [
            unit,
            { ...slots },
          ]),
        ) as Record<Unit, Record<ShiftSlot, number>>,
      },
    },
  };
}

export const GUARD_LABELS: Record<GuardId, string> = {
  certification: "Certification check",
  doubleBooking: "Double-booking check",
  maxWeeklyHours: "Weekly hour cap",
  minRest: "Minimum rest between shifts",
  maxConsecutiveDays: "Consecutive-day limit",
  coverageMinimum: "Unit coverage minimum",
};

/**
 * A human-readable diff between two rule revisions. Rendered in the control
 * room as the patch the agent applied.
 */
export function diffRules(before: RulesConfig, after: RulesConfig): string[] {
  const lines: string[] = [];
  const b = before.guards;
  const a = after.guards;

  const flag = (id: GuardId, wasOn: boolean, isOn: boolean) => {
    if (wasOn !== isOn) {
      lines.push(`${GUARD_LABELS[id]}: ${wasOn ? "on" : "off"} → ${isOn ? "on" : "off"}`);
    }
  };

  flag("certification", b.certification.enabled, a.certification.enabled);
  flag("doubleBooking", b.doubleBooking.enabled, a.doubleBooking.enabled);
  flag("maxWeeklyHours", b.maxWeeklyHours.enabled, a.maxWeeklyHours.enabled);
  flag("minRest", b.minRest.enabled, a.minRest.enabled);
  flag("maxConsecutiveDays", b.maxConsecutiveDays.enabled, a.maxConsecutiveDays.enabled);
  flag("coverageMinimum", b.coverageMinimum.enabled, a.coverageMinimum.enabled);

  if (before.scheduling.packing !== after.scheduling.packing) {
    lines.push(`Packing strategy: ${before.scheduling.packing} → ${after.scheduling.packing}`);
  }
  if (b.maxWeeklyHours.limit !== a.maxWeeklyHours.limit) {
    lines.push(`Weekly hour cap: ${b.maxWeeklyHours.limit}h → ${a.maxWeeklyHours.limit}h`);
  }
  if (b.minRest.hours !== a.minRest.hours) {
    lines.push(`Minimum rest: ${b.minRest.hours}h → ${a.minRest.hours}h`);
  }
  if (b.maxConsecutiveDays.days !== a.maxConsecutiveDays.days) {
    lines.push(`Consecutive-day limit: ${b.maxConsecutiveDays.days}d → ${a.maxConsecutiveDays.days}d`);
  }

  for (const unit of Object.keys(a.coverageMinimum.minimums) as Unit[]) {
    for (const slot of Object.keys(a.coverageMinimum.minimums[unit]) as ShiftSlot[]) {
      const bv = b.coverageMinimum.minimums[unit][slot];
      const av = a.coverageMinimum.minimums[unit][slot];
      if (bv !== av) lines.push(`${unit} ${slot} minimum: ${bv} → ${av}`);
    }
  }

  return lines;
}
