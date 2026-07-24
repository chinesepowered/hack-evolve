"use client";

import type { Phase } from "@/lib/evolution/engine";

const PIPELINE: { key: Phase; label: string }[] = [
  { key: "exploring", label: "QA scan" },
  { key: "retrieving", label: "Recall" },
  { key: "diagnosing", label: "Diagnose" },
  { key: "patching", label: "Patch" },
  { key: "verifying", label: "Verify" },
  { key: "promoting", label: "Promote" },
];

/** The evolution pipeline, lit up at the agent's current step. */
export function PhaseStrip({ phase }: { phase: Phase }) {
  const activeIdx = PIPELINE.findIndex((p) => p.key === phase);
  return (
    <div className="phasestrip">
      {PIPELINE.map((p, i) => {
        const state =
          activeIdx === -1 ? "" : i === activeIdx ? "active" : i < activeIdx ? "done" : "";
        return (
          <span key={p.key} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {i > 0 && <span className="phase-arrow">›</span>}
            <span className={`phase-node ${state}`}>{p.label}</span>
          </span>
        );
      })}
    </div>
  );
}
