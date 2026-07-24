"use client";

import { useEffect, useState } from "react";
import { ActivityLog } from "@/components/ActivityLog";
import { BugLedger } from "@/components/BugLedger";
import { ControlDock } from "@/components/ControlDock";
import { ECGMonitor } from "@/components/ECGMonitor";
import { FitnessSpark } from "@/components/FitnessSpark";
import { PhaseStrip } from "@/components/PhaseStrip";
import { RetrievalPanel } from "@/components/RetrievalPanel";
import { ScheduleGrid } from "@/components/ScheduleGrid";
import { SkillLibrary } from "@/components/SkillLibrary";
import { VitalTiles } from "@/components/VitalTiles";
import { useEngine } from "@/lib/evolution/useEngine";

export default function Page() {
  // The command center is client-only (it owns a live in-browser engine with
  // timers). Render a static shell on the server + first paint, then mount the
  // interactive UI — this is the hydration guard, not derived state.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount flag
    setMounted(true);
  }, []);
  if (!mounted) return <BootScreen />;
  return <CommandCenter />;
}

function BootScreen() {
  return (
    <div className="shell">
      <div className="topbar">
        <div className="wordmark">
          Regenesis<span className="wordmark-dot" />
        </div>
      </div>
      <div className="empty" style={{ marginTop: 60 }}>
        initializing instruments…
      </div>
    </div>
  );
}

function CommandCenter() {
  const { engine, snap } = useEngine();
  const sick = snap.vitals.openBugs > 0;

  return (
    <div className="shell">
      {/* Topbar */}
      <div className="topbar">
        <div>
          <div className="wordmark">
            Regenesis<span className="wordmark-dot" />
          </div>
          <div className="eyebrow" style={{ marginTop: 4 }}>
            self-healing scheduling · the app that fixes its own bugs
          </div>
        </div>
        <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
          <span className={`chip ${snap.mode === "live" ? "live" : "sim"}`}>
            {snap.mode === "live" ? "● live" : "● sim mode"}
          </span>
          <span className="chip">Actian VectorAI</span>
          <span className="chip">Replay QA</span>
          <span className="chip">Guild</span>
        </div>
      </div>

      {/* Signature: the monitor */}
      <div className="ecg-wrap" style={{ ["--trace" as string]: traceColor(snap.vitals.openBugs) }}>
        <div className="ecg-readout">
          <div className="eyebrow">MedShift · vital sign</div>
          <div className="ecg-bpm mono">{snap.vitals.bpm}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            bpm ·{" "}
            <span style={{ color: "var(--trace)", fontWeight: 600 }}>{rhythmLabel(snap.vitals)}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{snap.phaseLabel}</div>
        </div>
        <ECGMonitor vitals={snap.vitals} sick={sick} />
      </div>

      <div style={{ marginTop: 12 }}>
        <PhaseStrip phase={snap.phase} />
      </div>

      <VitalTiles snap={snap} />

      {/* Deck */}
      <div className="deck">
        {/* Left — the patient */}
        <div className="col">
          <ScheduleGrid
            staff={snap.staff}
            shifts={snap.shifts}
            violations={snap.violations}
            version={snap.version}
          />
        </div>

        {/* Right — the clinician */}
        <div className="col">
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">
                <span style={{ color: "var(--violet)" }}>❖</span> Memory recall
              </div>
              <span className="chip">Actian · VectorAI DB</span>
            </div>
            <div className="panel-body">
              <RetrievalPanel
                retrieval={snap.lastRetrieval}
                memoryPoints={snap.memoryPoints}
                reinforcements={snap.totalReinforcements}
              />
              <div style={{ marginTop: 14 }}>
                <div className="eyebrow" style={{ marginBottom: 4 }}>
                  fitness · open findings per generation
                </div>
                <FitnessSpark history={snap.history} />
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">
                <span style={{ color: "var(--cyan)" }}>▤</span> Agent activity
              </div>
              <span className="chip">Guild · task stream</span>
            </div>
            <div className="panel-body">
              <ActivityLog events={snap.activity} />
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">
                <span style={{ color: "var(--mint)" }}>✦</span> Skill library
              </div>
              <span className="chip">Guild · Agent Hub</span>
            </div>
            <div className="panel-body">
              <SkillLibrary skills={snap.skills} />
            </div>
          </div>
        </div>
      </div>

      {/* Evidence — full width so reproduction steps have room */}
      <div className="panel" style={{ marginTop: 14 }}>
        <div className="panel-head">
          <div className="panel-title">
            <span style={{ color: "var(--alarm)" }}>◎</span> QA findings
          </div>
          <span className="chip">Replay · Loop QA</span>
        </div>
        <div className="panel-body">
          <BugLedger bugs={snap.bugs} />
        </div>
      </div>

      <ControlDock engine={engine} snap={snap} />
    </div>
  );
}

function traceColor(open: number): string {
  return open === 0 ? "#2ce0a8" : open >= 2 ? "#ff5c7a" : "#f2b65a";
}

function rhythmLabel(v: { rhythm: string; openBugs: number }): string {
  if (v.openBugs === 0) return "sinus rhythm";
  if (v.rhythm === "flatline-recovering") return "recovering";
  return "arrhythmia";
}
