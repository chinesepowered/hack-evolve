import {
  SLOT_HOURS,
  SLOTS,
  UNITS,
  shiftEnd,
  shiftStart,
  type RulesConfig,
  type Shift,
  type ShiftSlot,
  type StaffMember,
  type Unit,
} from "./types";

/**
 * Deterministic PRNG (mulberry32). The auto-scheduler must produce byte-identical
 * output for identical inputs — the whole demo depends on being able to re-run a
 * generation and get the same schedule back.
 */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Assignment {
  hours: number;
  shifts: Shift[];
  daysWorked: Set<number>;
}

/**
 * Fills the week's roster.
 *
 * Critically: this honours only the guards that are ENABLED in `rules`. Turn a
 * guard off and the scheduler genuinely stops respecting that constraint, which
 * is how sabotage produces real defects rather than cosmetic ones.
 */
export function autoSchedule(
  staff: StaffMember[],
  rules: RulesConfig,
  seed = 20260724,
): Shift[] {
  const rand = mulberry32(seed);
  const shifts: Shift[] = [];
  const state = new Map<string, Assignment>();
  for (const person of staff) {
    state.set(person.id, { hours: 0, shifts: [], daysWorked: new Set() });
  }

  const g = rules.guards;
  let counter = 0;

  for (let day = 0; day < 7; day++) {
    for (const unit of UNITS) {
      for (const slot of SLOTS) {
        const needed = g.coverageMinimum.enabled
          ? g.coverageMinimum.minimums[unit][slot]
          : Math.max(0, g.coverageMinimum.minimums[unit][slot] - 1);

        for (let n = 0; n < needed; n++) {
          const candidate: Shift = {
            id: `sh${counter}`,
            staffId: "",
            unit,
            day,
            slot,
          };

          const pick = chooseStaff(staff, state, candidate, rules, rand);
          if (!pick) continue;

          const shift: Shift = { ...candidate, id: `sh${counter++}`, staffId: pick.id };
          shifts.push(shift);

          const entry = state.get(pick.id)!;
          entry.hours += SLOT_HOURS[slot].length;
          entry.shifts.push(shift);
          entry.daysWorked.add(day);
        }
      }
    }
  }

  return shifts;
}

function chooseStaff(
  staff: StaffMember[],
  state: Map<string, Assignment>,
  slotToFill: Shift,
  rules: RulesConfig,
  rand: () => number,
): StaffMember | null {
  const g = rules.guards;
  const eligible: Array<{ person: StaffMember; cost: number }> = [];

  for (const person of staff) {
    const entry = state.get(person.id)!;

    // Declared unavailability is contractual, not a configurable guard —
    // the scheduler never violates it.
    if (person.unavailable.includes(slotToFill.day)) continue;

    // Never assign the same person the same unit+slot twice.
    if (
      entry.shifts.some(
        (s) => s.day === slotToFill.day && s.slot === slotToFill.slot && s.unit === slotToFill.unit,
      )
    ) {
      continue;
    }

    if (g.certification.enabled) {
      if (!person.certifications.includes(slotToFill.unit)) continue;
    }

    if (g.doubleBooking.enabled) {
      const start = shiftStart(slotToFill);
      const end = shiftEnd(slotToFill);
      const overlaps = entry.shifts.some((s) => shiftStart(s) < end && start < shiftEnd(s));
      if (overlaps) continue;
    }

    if (g.maxWeeklyHours.enabled) {
      if (entry.hours + SLOT_HOURS[slotToFill.slot].length > g.maxWeeklyHours.limit) continue;
    }

    if (g.minRest.enabled) {
      const start = shiftStart(slotToFill);
      const end = shiftEnd(slotToFill);
      const tooClose = entry.shifts.some((s) => {
        const gapAfter = start - shiftEnd(s);
        const gapBefore = shiftStart(s) - end;
        const gap = gapAfter >= 0 ? gapAfter : gapBefore;
        return gap >= 0 && gap < g.minRest.hours;
      });
      if (tooClose) continue;
    }

    if (g.maxConsecutiveDays.enabled) {
      const days = new Set(entry.daysWorked);
      days.add(slotToFill.day);
      if (longestRun(days) > g.maxConsecutiveDays.days) continue;
    }

    // Soft cost governs *who* fills an eligible slot; it never overrides a guard.
    //   spread            → prefer whoever is furthest below contracted hours.
    //   minimize-headcount→ prefer whoever is already working most, packing the
    //                       roster onto fewer people (cheaper on paper, brutal in
    //                       practice once the hour cap or rest rule slips).
    const utilisation = entry.hours / Math.max(1, person.contractedHours);
    const certBonus = person.certifications.includes(slotToFill.unit) ? 0 : 0.15;
    const cost =
      rules.scheduling.packing === "minimize-headcount"
        ? (entry.hours > 0 ? -entry.hours / 100 : 1) + rand() * 0.02
        : utilisation + certBonus + rand() * 0.02;
    eligible.push({ person, cost });
  }

  if (eligible.length === 0) return null;
  eligible.sort((a, b) => a.cost - b.cost);
  return eligible[0].person;
}

/** Longest run of consecutive day indices in the set. */
export function longestRun(days: Set<number>): number {
  const sorted = [...days].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev = -99;
  for (const d of sorted) {
    run = d === prev + 1 ? run + 1 : 1;
    prev = d;
    if (run > best) best = run;
  }
  return best;
}

export function hoursFor(staffId: string, shifts: Shift[]): number {
  return shifts
    .filter((s) => s.staffId === staffId)
    .reduce((sum, s) => sum + SLOT_HOURS[s.slot].length, 0);
}

export function coverageFor(
  shifts: Shift[],
  unit: Unit,
  day: number,
  slot: ShiftSlot,
): Shift[] {
  return shifts.filter((s) => s.unit === unit && s.day === day && s.slot === slot);
}
