import { baselineRules } from "./rules";
import { longestRun } from "./scheduler";
import {
  DAYS,
  SLOT_HOURS,
  SLOTS,
  UNITS,
  shiftEnd,
  shiftStart,
  type Severity,
  type Shift,
  type StaffMember,
  type Violation,
} from "./types";

/**
 * The oracle.
 *
 * This audits a schedule against the SIGNED-OFF safety spec — never against the
 * app's current (possibly sabotaged) rules config. That asymmetry is the entire
 * point: the app can be talked out of enforcing a rule, but the oracle cannot be
 * talked out of checking it.
 *
 * Nothing here is ever mutated by the agent. It is the fitness function.
 */

const SEVERITY: Record<string, Severity> = {
  certification: "critical",
  doubleBooking: "critical",
  minRest: "serious",
  maxWeeklyHours: "serious",
  coverageMinimum: "serious",
  maxConsecutiveDays: "warning",
};

export function audit(staff: StaffMember[], shifts: Shift[]): Violation[] {
  const spec = baselineRules().guards;
  const violations: Violation[] = [];
  const byStaff = new Map<string, Shift[]>();
  for (const s of shifts) {
    if (!byStaff.has(s.staffId)) byStaff.set(s.staffId, []);
    byStaff.get(s.staffId)!.push(s);
  }
  const nameOf = (id: string) => staff.find((p) => p.id === id)?.name ?? id;

  // --- Certification -------------------------------------------------------
  for (const shift of shifts) {
    const person = staff.find((p) => p.id === shift.staffId);
    if (!person) continue;
    if (!person.certifications.includes(shift.unit)) {
      violations.push({
        guard: "certification",
        severity: SEVERITY.certification,
        key: `cert:${shift.staffId}:${shift.unit}:${shift.day}:${shift.slot}`,
        message: `${person.name} is assigned to ${shift.unit} on ${DAYS[shift.day]} ${shift.slot} without ${shift.unit} certification.`,
        staffId: shift.staffId,
        unit: shift.unit,
        day: shift.day,
        slot: shift.slot,
      });
    }
  }

  // --- Double booking ------------------------------------------------------
  for (const [staffId, list] of byStaff) {
    const sorted = [...list].sort((a, b) => shiftStart(a) - shiftStart(b));
    for (let i = 0; i < sorted.length - 1; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (shiftStart(sorted[j]) >= shiftEnd(sorted[i])) break;
        violations.push({
          guard: "doubleBooking",
          severity: SEVERITY.doubleBooking,
          key: `dbl:${staffId}:${sorted[i].day}:${sorted[i].slot}:${sorted[j].unit}`,
          message: `${nameOf(staffId)} is booked in ${sorted[i].unit} and ${sorted[j].unit} at the same time on ${DAYS[sorted[i].day]} ${sorted[i].slot}.`,
          staffId,
          unit: sorted[i].unit,
          day: sorted[i].day,
          slot: sorted[i].slot,
        });
      }
    }
  }

  // --- Weekly hour cap -----------------------------------------------------
  for (const [staffId, list] of byStaff) {
    const hours = list.reduce((sum, s) => sum + SLOT_HOURS[s.slot].length, 0);
    if (hours > spec.maxWeeklyHours.limit) {
      violations.push({
        guard: "maxWeeklyHours",
        severity: SEVERITY.maxWeeklyHours,
        key: `hours:${staffId}`,
        message: `${nameOf(staffId)} is scheduled ${hours}h this week, over the ${spec.maxWeeklyHours.limit}h cap.`,
        staffId,
      });
    }
  }

  // --- Minimum rest --------------------------------------------------------
  for (const [staffId, list] of byStaff) {
    const sorted = [...list].sort((a, b) => shiftStart(a) - shiftStart(b));
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = shiftStart(sorted[i + 1]) - shiftEnd(sorted[i]);
      if (gap >= 0 && gap < spec.minRest.hours) {
        violations.push({
          guard: "minRest",
          severity: SEVERITY.minRest,
          key: `rest:${staffId}:${sorted[i].day}:${sorted[i].slot}`,
          message: `${nameOf(staffId)} gets only ${gap}h rest between ${DAYS[sorted[i].day]} ${sorted[i].slot} and ${DAYS[sorted[i + 1].day]} ${sorted[i + 1].slot} (${spec.minRest.hours}h required).`,
          staffId,
          day: sorted[i].day,
          slot: sorted[i].slot,
        });
      }
    }
  }

  // --- Consecutive days ----------------------------------------------------
  for (const [staffId, list] of byStaff) {
    const days = new Set(list.map((s) => s.day));
    const run = longestRun(days);
    if (run > spec.maxConsecutiveDays.days) {
      violations.push({
        guard: "maxConsecutiveDays",
        severity: SEVERITY.maxConsecutiveDays,
        key: `consec:${staffId}`,
        message: `${nameOf(staffId)} works ${run} consecutive days, over the ${spec.maxConsecutiveDays.days}-day limit.`,
        staffId,
      });
    }
  }

  // --- Coverage minimums ---------------------------------------------------
  for (let day = 0; day < 7; day++) {
    for (const unit of UNITS) {
      for (const slot of SLOTS) {
        const required = spec.coverageMinimum.minimums[unit][slot];
        const actual = shifts.filter(
          (s) => s.unit === unit && s.day === day && s.slot === slot,
        ).length;
        if (actual < required) {
          violations.push({
            guard: "coverageMinimum",
            severity: SEVERITY.coverageMinimum,
            key: `cover:${unit}:${day}:${slot}`,
            message: `${unit} is staffed ${actual}/${required} on ${DAYS[day]} ${slot}.`,
            unit,
            day,
            slot,
          });
        }
      }
    }
  }

  return violations;
}

export function severityWeight(severity: Severity): number {
  return severity === "critical" ? 5 : severity === "serious" ? 2 : 1;
}

/** Aggregate badness. This is the number the evolution loop is minimising. */
export function severityScore(violations: Violation[]): number {
  return violations.reduce((sum, v) => sum + severityWeight(v.severity), 0);
}
