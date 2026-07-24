"use client";

import { useEffect, useRef, useState } from "react";
import type { RegenesisEngine, EngineSnapshot } from "@/lib/evolution/engine";
import { SCENARIOS } from "@/lib/evolution/scenarios";

const SEV_COLOR: Record<string, string> = {
  critical: "var(--alarm)",
  serious: "var(--amber)",
  warning: "var(--cyan)",
};

/**
 * The judge's console. Sabotage injects a real regression; Heal runs one
 * generation; Auto-heal runs to green. This is the hand-the-judge-the-button
 * moment — detect, recall, patch, verify happen live.
 */
export function ControlDock({ engine, snap }: { engine: RegenesisEngine; snap: EngineSnapshot }) {
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const busy = snap.busy;
  const hasOpen = snap.vitals.openBugs > 0;

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="dock">
      <div className="sab" ref={ref}>
        <button className="btn danger" disabled={busy} onClick={() => setMenu((m) => !m)}>
          ⚡ Sabotage
        </button>
        {menu && (
          <div className="sab-menu">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                className="sab-item"
                onClick={() => {
                  setMenu(false);
                  void engine.sabotage(s.id);
                }}
              >
                <div className="sab-item-top">
                  <span
                    className="bug-sev"
                    style={{ background: SEV_COLOR[s.severity], width: 7, height: 7, borderRadius: 999 }}
                  />
                  {s.label}
                </div>
                <div className="sab-item-story">{s.story}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="dock-sep" />

      <button className="btn primary" disabled={busy || !hasOpen} onClick={() => void engine.healOnce()}>
        {busy ? "Working…" : "Heal one generation"}
      </button>
      <button className="btn" disabled={busy || !hasOpen} onClick={() => void engine.healAll()}>
        Auto-heal ⇉
      </button>

      <div className="dock-sep" />

      <button className="btn ghost" disabled={busy} onClick={() => engine.reset()}>
        Reset
      </button>
    </div>
  );
}
