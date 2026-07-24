import type { Certification, Role, StaffMember } from "./types";

/**
 * A deterministic 26-person roster for Mercy General.
 *
 * Certification pools are sized against the weekly coverage demand in rules.ts
 * so the baseline schedule is genuinely satisfiable — the healthy state has to
 * actually be healthy, or every generation starts dirty.
 *
 * Marcus, Oscar and Quentin hold GEN only. They are qualified hospital staff but
 * carry no unit certification, so they are exactly who a broken certification
 * check will wrongly place in the ICU.
 */
const ROSTER: Array<[string, Role, Certification[], number, number[]]> = [
  ["Amara Osei", "RN", ["ICU", "GEN"], 36, [5]],
  ["Ben Halvorsen", "RN", ["ICU", "ED", "GEN"], 40, []],
  ["Priya Raman", "RN", ["ICU", "GEN"], 40, [2]],
  ["Diego Salazar", "RN", ["ED", "GEN"], 40, []],
  ["Nina Kowalski", "RN", ["ED", "GEN"], 40, [0]],
  ["Tomas Lindqvist", "RN", ["PEDS", "SURG", "GEN"], 40, [4]],
  ["Grace Abiola", "RN", ["PEDS", "GEN"], 40, []],
  ["Hyun-woo Park", "RN", ["SURG", "GEN"], 40, [6]],
  ["Ilana Berger", "RN", ["SURG", "ICU", "GEN"], 40, []],
  ["Jamal Whitfield", "LPN", ["ED", "GEN"], 40, [3]],
  ["Keiko Tanaka", "LPN", ["PEDS", "ICU", "GEN"], 40, []],
  ["Lucia Ferrante", "LPN", ["ED", "GEN"], 40, [1]],
  ["Marcus Bell", "LPN", ["GEN"], 36, []],
  ["Noor Haddad", "RN", ["ICU", "ED", "GEN"], 40, []],
  ["Oscar Mbeki", "TECH", ["GEN"], 36, [6]],
  ["Petra Novak", "TECH", ["SURG", "PEDS", "GEN"], 40, []],
  ["Quentin Doyle", "TECH", ["GEN"], 36, [0]],
  ["Rosa Delgado", "RN", ["ED", "PEDS", "GEN"], 40, []],
  ["Sami Ould", "RN", ["ICU", "GEN"], 40, [4]],
  ["Tara Nguyen", "RN", ["SURG", "GEN"], 40, []],
  ["Uma Krishnan", "MD", ["ICU", "ED", "GEN"], 44, []],
  ["Viktor Petrov", "MD", ["SURG", "GEN"], 44, [5]],
  ["Wren Callahan", "MD", ["ED", "PEDS", "GEN"], 44, []],
  ["Xiomara Reyes", "RN", ["ED", "PEDS", "GEN"], 40, [3]],
  ["Yusuf Demir", "RN", ["PEDS", "GEN"], 40, []],
  ["Zoe Lindgren", "RN", ["ICU", "SURG", "GEN"], 40, [2]],
];

export function seedStaff(): StaffMember[] {
  return ROSTER.map(([name, role, certifications, contractedHours, unavailable], i) => ({
    id: `s${String(i + 1).padStart(2, "0")}`,
    name,
    role,
    certifications,
    contractedHours,
    unavailable,
  }));
}

export function staffInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
