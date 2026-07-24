/**
 * MedShift domain types.
 *
 * Two things are deliberately kept apart in this codebase:
 *
 *   RULES      — what the running app actually enforces. Mutable. This is the
 *                "genome" the Regenesis agent edits.
 *   INVARIANTS — the ground-truth safety spec the hospital signed off on.
 *                Immutable, lives in oracle.ts, and is what QA audits against.
 *
 * Sabotage weakens RULES. The oracle keeps checking INVARIANTS. That gap is
 * where real, non-scripted bugs come from.
 */

export type Unit = "ICU" | "ED" | "PEDS" | "SURG";
export type ShiftSlot = "day" | "swing" | "night";
export type Role = "RN" | "LPN" | "MD" | "TECH";
export type Certification = "ICU" | "ED" | "PEDS" | "SURG" | "GEN";

export const UNITS: Unit[] = ["ICU", "ED", "PEDS", "SURG"];
export const SLOTS: ShiftSlot[] = ["day", "swing", "night"];
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const SLOT_HOURS: Record<ShiftSlot, { start: number; length: number }> = {
  day: { start: 7, length: 8 },
  swing: { start: 15, length: 8 },
  night: { start: 23, length: 8 },
};

export interface StaffMember {
  id: string;
  name: string;
  role: Role;
  certifications: Certification[];
  contractedHours: number;
  /** Days (0-6) this person has declared unavailable. */
  unavailable: number[];
}

export interface Shift {
  id: string;
  staffId: string;
  unit: Unit;
  /** 0 = Mon … 6 = Sun */
  day: number;
  slot: ShiftSlot;
}

/** Absolute hour offset from Monday 00:00, used for overlap + rest math. */
export function shiftStart(shift: Shift): number {
  return shift.day * 24 + SLOT_HOURS[shift.slot].start;
}

export function shiftEnd(shift: Shift): number {
  return shiftStart(shift) + SLOT_HOURS[shift.slot].length;
}

// ---------------------------------------------------------------------------
// Rules — the mutable genome
// ---------------------------------------------------------------------------

export type GuardId =
  | "certification"
  | "doubleBooking"
  | "maxWeeklyHours"
  | "minRest"
  | "maxConsecutiveDays"
  | "coverageMinimum";

export const GUARD_IDS: GuardId[] = [
  "certification",
  "doubleBooking",
  "maxWeeklyHours",
  "minRest",
  "maxConsecutiveDays",
  "coverageMinimum",
];

/**
 * How the auto-scheduler distributes load. "spread" balances against contracted
 * hours; "minimize-headcount" packs shifts onto as few people as possible — a
 * legitimate-sounding cost optimisation that becomes dangerous the moment the
 * weekly hour cap stops being enforced.
 */
export type PackingStrategy = "spread" | "minimize-headcount";

export interface RulesConfig {
  revision: number;
  scheduling: { packing: PackingStrategy };
  guards: {
    certification: { enabled: boolean };
    doubleBooking: { enabled: boolean };
    maxWeeklyHours: { enabled: boolean; limit: number };
    minRest: { enabled: boolean; hours: number };
    maxConsecutiveDays: { enabled: boolean; days: number };
    coverageMinimum: {
      enabled: boolean;
      minimums: Record<Unit, Record<ShiftSlot, number>>;
    };
  };
}

// ---------------------------------------------------------------------------
// Violations — what the oracle emits
// ---------------------------------------------------------------------------

export type Severity = "critical" | "serious" | "warning";

export interface Violation {
  /** Maps 1:1 to the guard that should have prevented it. */
  guard: GuardId;
  severity: Severity;
  /** Human-readable, and also the text that gets embedded for retrieval. */
  message: string;
  /** Stable key so the same violation across generations is recognisable. */
  key: string;
  staffId?: string;
  unit?: Unit;
  day?: number;
  slot?: ShiftSlot;
}

export interface ScheduleState {
  staff: StaffMember[];
  shifts: Shift[];
  rules: RulesConfig;
}
