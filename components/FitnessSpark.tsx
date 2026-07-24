"use client";

import type { GenerationRecord } from "@/lib/evolution/engine";

/**
 * Open findings over the run — the fitness curve the agent is minimising.
 * Single series, so no legend; the trailing point is labelled directly and warm
 * (memory-recall) generations are marked to show learning paying off.
 */
export function FitnessSpark({ history }: { history: GenerationRecord[] }) {
  if (history.length < 1) {
    return <div className="empty">Fitness curve appears once the first regression lands.</div>;
  }

  const W = 520;
  const H = 72;
  const pad = { l: 6, r: 22, t: 10, b: 14 };
  const pts = history.map((h, i) => ({ ...h, i }));
  const maxOpen = Math.max(2, ...pts.map((p) => p.openBugs));
  const n = pts.length;

  const x = (i: number) => pad.l + (n === 1 ? 0 : (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / maxOpen) * (H - pad.t - pad.b);

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.i).toFixed(1)} ${y(p.openBugs).toFixed(1)}`).join(" ");
  const area = `${line} L ${x(pts[n - 1].i).toFixed(1)} ${(H - pad.b).toFixed(1)} L ${x(0).toFixed(1)} ${(H - pad.b).toFixed(1)} Z`;
  const last = pts[n - 1];

  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Open findings over generations">
      <defs>
        <linearGradient id="fitfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2ce0a8" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#2ce0a8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="rgba(150,200,210,0.12)" strokeWidth="1" />
      <path d={area} fill="url(#fitfill)" />
      <path d={line} fill="none" stroke="#2ce0a8" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p) => (
        <circle
          key={p.i}
          cx={x(p.i)}
          cy={y(p.openBugs)}
          r={p.warm ? 3.6 : 2.6}
          fill={p.guard === "regression" ? "#ff5c7a" : p.warm ? "#2ce0a8" : "#0b1215"}
          stroke={p.guard === "regression" ? "#ff5c7a" : "#2ce0a8"}
          strokeWidth="1.5"
        >
          <title>{`gen ${p.generation}: ${p.openBugs} open${p.warm ? " · warm recall" : ""}`}</title>
        </circle>
      ))}
      <text
        x={x(last.i) + 6}
        y={y(last.openBugs) + 3}
        fill="var(--muted)"
        fontSize="10"
        fontFamily="var(--font-mono)"
      >
        {last.openBugs}
      </text>
    </svg>
  );
}
