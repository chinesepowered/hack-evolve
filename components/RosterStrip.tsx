"use client";

import { baselineRules } from "@/lib/domain/rules";
import { hoursFor } from "@/lib/domain/scheduler";
import { staffInitials } from "@/lib/domain/seed";
import type { Shift, StaffMember } from "@/lib/domain/types";

/**
 * Weekly hours per staff member — the surface where hour-cap and consecutive-day
 * defects show up. Anyone over the signed-off cap is flagged.
 */
export function RosterStrip({ staff, shifts }: { staff: StaffMember[]; shifts: Shift[] }) {
  const cap = baselineRules().guards.maxWeeklyHours.limit;
  const rows = staff
    .map((s) => ({ s, hours: hoursFor(s.id, shifts) }))
    .filter((r) => r.hours > 0)
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 12);

  return (
    <div className="roster">
      {rows.map(({ s, hours }) => (
        <div key={s.id} className={`rchip ${hours > cap ? "over" : ""}`} title={`${s.name} · ${s.role}`}>
          <span>{staffInitials(s.name)}</span>
          <span className="rh">{hours}h</span>
        </div>
      ))}
    </div>
  );
}
