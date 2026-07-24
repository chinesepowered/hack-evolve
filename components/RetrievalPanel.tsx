"use client";

import type { RetrievalResult } from "@/lib/evolution/engine";

/**
 * The Actian memory lookup — the "have I seen this before?" moment. A warm recall
 * (high cosine + a matching learned skill) is what makes the second encounter of
 * a defect resolve almost instantly.
 */
export function RetrievalPanel({
  retrieval,
  memoryPoints,
  reinforcements,
}: {
  retrieval?: RetrievalResult;
  memoryPoints: number;
  reinforcements: number;
}) {
  if (!retrieval) {
    return (
      <div className="empty">
        {memoryPoints === 0
          ? "Memory empty — the agent has faced no defects yet."
          : `${memoryPoints} defect ${memoryPoints === 1 ? "class" : "classes"} in memory · ${reinforcements} reinforcements.`}
      </div>
    );
  }

  const warm = retrieval.warm;
  const pct = Math.round(Math.max(0, Math.min(1, retrieval.score)) * 100);

  return (
    <div className="retrieval">
      <div className={`recall-banner ${warm ? "warm" : "cold"}`}>
        <div className="recall-score mono">{retrieval.score.toFixed(2)}</div>
        <div>
          <div className="recall-label">
            {warm ? "Recognized from memory" : "First encounter"}
          </div>
          <div className="recall-sub">
            {warm
              ? `Recalled a proven fix (reinforced ×${retrieval.reinforcedTimes}) — applying learned skill.`
              : retrieval.hit
                ? "Nearest memory below recall threshold — diagnosing from root cause."
                : "No prior memory — diagnosing from root cause and learning a new skill."}
          </div>
        </div>
      </div>
      <div className="hitbar">
        <span>cosine</span>
        <div className="hitbar-track">
          <div
            className="hitbar-fill"
            style={{ width: `${pct}%`, background: warm ? "var(--mint)" : "var(--cyan)" }}
          />
        </div>
        <span>{pct}%</span>
      </div>
      <div className="mono" style={{ fontSize: 10, color: "var(--faint)", letterSpacing: "0.04em" }}>
        {memoryPoints} classes in memory · {reinforcements} reinforcements ·{" "}
        {retrieval.hadSkill ? "skill hit" : "no skill yet"}
      </div>
    </div>
  );
}
