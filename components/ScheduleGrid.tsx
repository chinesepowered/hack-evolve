"use client";

import { baselineRules } from "@/lib/domain/rules";
import { staffInitials } from "@/lib/domain/seed";
import { RosterStrip } from "./RosterStrip";
import {
  DAYS,
  SLOTS,
  UNITS,
  type Shift,
  type ShiftSlot,
  type StaffMember,
  type Unit,
  type Violation,
} from "@/lib/domain/types";

const SLOT_LABEL: Record<ShiftSlot, string> = { day: "Day", swing: "Swg", night: "Ngt" };

/**
 * MedShift — the live product. A unit×slot grid over the week, showing coverage
 * counts. Cells turn red the moment the oracle finds any safety violation that
 * touches them (understaffing, an uncertified placement, a double-booking).
 */
export function ScheduleGrid({
  staff,
  shifts,
  violations,
  version,
}: {
  staff: StaffMember[];
  shifts: Shift[];
  violations: Violation[];
  version: number;
}) {
  const req = baselineRules().guards.coverageMinimum.minimums;
  const nameOf = (id: string) => staff.find((s) => s.id === id)?.name ?? id;

  const cellState = (unit: Unit, day: number, slot: ShiftSlot) => {
    const assigned = shifts.filter((s) => s.unit === unit && s.day === day && s.slot === slot);
    const required = req[unit][slot];
    const cellViolations = violations.filter(
      (v) => v.unit === unit && v.day === day && v.slot === slot,
    );
    const understaffed = assigned.length < required;
    const hasCritical = cellViolations.some((v) => v.severity === "critical");
    let status: "ok" | "violation" | "warn" = "ok";
    if (understaffed || hasCritical) status = "violation";
    else if (cellViolations.length > 0) status = "warn";
    return { assigned, required, status, cellViolations };
  };

  return (
    <div className="product">
      <div className="product-head">
        <div className="product-brand">
          <span className="mark">M</span>
          MedShift
          <span className="product-tag">· Mercy General · Week 30</span>
        </div>
        <span className="product-tag mono">v{version}</span>
      </div>
      <div className="product-body">
        <div style={{ overflowX: "auto" }}>
          <table className="sched">
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Unit / Shift</th>
                {DAYS.map((d) => (
                  <th key={d}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {UNITS.map((unit) =>
                SLOTS.map((slot, si) => (
                  <tr key={`${unit}-${slot}`}>
                    <td className="unit">
                      {si === 0 ? unit : ""}
                      <small>{SLOT_LABEL[slot]}</small>
                    </td>
                    {DAYS.map((_, day) => {
                      const c = cellState(unit, day, slot);
                      const title =
                        c.cellViolations.map((v) => v.message).join("\n") ||
                        c.assigned.map((a) => nameOf(a.staffId)).join(", ") ||
                        "unstaffed";
                      return (
                        <td className="cell" key={day}>
                          <div className={`cellbox ${c.status}`} title={title}>
                            <div className="cov">
                              {c.assigned.length}
                              <span style={{ opacity: 0.5 }}>/{c.required}</span>
                            </div>
                            <div className="slot">
                              {c.assigned.slice(0, 2).map((a) => staffInitials(nameOf(a.staffId))).join(" ") || "—"}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <div className="legend">
          <span>
            <i className="swatch" style={{ background: "color-mix(in srgb, #0e8f6f 22%, white)", border: "1px solid #0e8f6f" }} />
            staffed to policy
          </span>
          <span>
            <i className="swatch" style={{ background: "color-mix(in srgb, #c4335a 30%, white)", border: "1px solid #c4335a" }} />
            safety violation
          </span>
          <span className="mono">count / required</span>
        </div>
        <div
          className="product-tag mono"
          style={{ margin: "14px 0 6px", letterSpacing: "0.1em", textTransform: "uppercase", fontSize: 9 }}
        >
          Weekly hours · cap {baselineRules().guards.maxWeeklyHours.limit}h
        </div>
        <RosterStrip staff={staff} shifts={shifts} />
      </div>
    </div>
  );
}
