"use client";

import type { EngineSnapshot } from "@/lib/evolution/engine";

/** The instrument readout row: the numbers a judge should be able to read at a glance. */
export function VitalTiles({ snap }: { snap: EngineSnapshot }) {
  const { vitals } = snap;
  const tiles: {
    label: string;
    value: string | number;
    sub?: string;
    accent: string;
  }[] = [
    {
      label: "Health",
      value: `${vitals.health}%`,
      sub: vitals.rhythm === "sinus" ? "sinus rhythm" : "arrhythmia",
      accent: vitals.health > 80 ? "accent-mint" : vitals.health > 40 ? "accent-amber" : "accent-alarm",
    },
    {
      label: "Open findings",
      value: vitals.openBugs,
      sub: vitals.criticalBugs > 0 ? `${vitals.criticalBugs} critical` : "none critical",
      accent: vitals.openBugs === 0 ? "accent-mint" : "accent-alarm",
    },
    { label: "Generation", value: snap.generation, sub: `app v${snap.version}`, accent: "accent-cyan" },
    {
      label: "Skills learned",
      value: snap.skills.length,
      sub: "on Guild Hub",
      accent: "accent-mint",
    },
    {
      label: "Memory",
      value: snap.memoryPoints,
      sub: `${snap.totalReinforcements} reinforced`,
      accent: "accent-violet",
    },
    {
      label: "Heart rate",
      value: vitals.bpm,
      sub: "bpm",
      accent: vitals.bpm > 100 ? "accent-alarm" : "accent-mint",
    },
  ];

  return (
    <div className="tiles">
      {tiles.map((t) => (
        <div key={t.label} className={`tile ${t.accent}`}>
          <div className="tile-label">{t.label}</div>
          <div className="tile-value mono">{t.value}</div>
          {t.sub && <div className="tile-sub">{t.sub}</div>}
        </div>
      ))}
    </div>
  );
}
