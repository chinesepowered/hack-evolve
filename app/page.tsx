"use client";

import { useEffect, useState } from "react";
import { ActivityLog } from "@/components/ActivityLog";
import { BugLedger } from "@/components/BugLedger";
import { ControlDock } from "@/components/ControlDock";
import { ECGMonitor } from "@/components/ECGMonitor";
import { FitnessSpark } from "@/components/FitnessSpark";
import { LiveQAPanel } from "@/components/LiveQAPanel";
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

/**
 * Server-rendered shell shown before hydration.
 *
 * Crawlers and QA agents can capture this frame, so it carries the real
 * heading structure and a description of the product rather than a bare
 * spinner — a Replay Loop QA exploration caught the earlier version and
 * correctly filed it as a WCAG 1.3.1 violation (no heading elements).
 */
function BootScreen() {
  return (
    <main className="shell">
      <div className="topbar">
        <div>
          <h1 className="wordmark">
            Regenesis<span className="wordmark-dot" />
          </h1>
          <div className="eyebrow" style={{ marginTop: 4 }}>
            self-healing scheduling · the app that fixes its own bugs
          </div>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 24 }}>
        <div className="panel-head">
          <h2 className="panel-title">MedShift · shift safety command center</h2>
        </div>
        <div className="panel-body">
          <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, maxWidth: "62ch" }}>
            MedShift schedules hospital staff against certification, rest-window, overtime,
            consecutive-day, and unit-coverage rules. Regenesis watches those rules for
            regressions, repairs them, and remembers each fix.
          </p>
          <div className="empty" style={{ marginTop: 16 }}>
            initializing instruments…
          </div>
        </div>
      </div>
    </main>
  );
}

function CommandCenter() {
  const { engine, snap } = useEngine();
  const sick = snap.vitals.openBugs > 0;

  return (
    <main className="shell">
      {/* Topbar */}
      <div className="topbar">
        <div>
          <h1 className="wordmark">
            Regenesis<span className="wordmark-dot" />
          </h1>
          <div className="eyebrow" style={{ marginTop: 4 }}>
            self-healing scheduling · the app that fixes its own bugs
          </div>
        </div>
        <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
          <SponsorChip label="Actian VectorAI" mode={snap.modes.actian} />
          <SponsorChip label="Replay QA" mode={snap.modes.replay} />
          <SponsorChip label="Guild" mode={snap.modes.guild} />
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
              <h2 className="panel-title">
                <span style={{ color: "var(--violet)" }}>❖</span> Memory recall
              </h2>
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
              <h2 className="panel-title">
                <span style={{ color: "var(--cyan)" }}>▤</span> Agent activity
              </h2>
              <span className="chip">Guild · task stream</span>
            </div>
            <div className="panel-body">
              <ActivityLog events={snap.activity} />
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2 className="panel-title">
                <span style={{ color: "var(--mint)" }}>✦</span> Skill library
              </h2>
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
          <h2 className="panel-title">
            <span style={{ color: "var(--alarm)" }}>◎</span> Safety findings
          </h2>
          <span className="chip">in-app oracle · invariant audit</span>
        </div>
        <div className="panel-body">
          <BugLedger bugs={snap.bugs} />
        </div>
      </div>

      {/* The external quality gate, reporting on the real deployment. */}
      <div className="panel" style={{ marginTop: 14 }}>
        <div className="panel-head">
          <h2 className="panel-title">
            <span style={{ color: "var(--cyan)" }}>◈</span> Autonomous QA
          </h2>
          <span className="chip live">Replay · Loop QA · live</span>
        </div>
        <div className="panel-body">
          <LiveQAPanel />
        </div>
      </div>

      <ControlDock engine={engine} snap={snap} />
    </main>
  );
}

/** A sponsor's name plus whether it is talking to the real service right now. */
function SponsorChip({ label, mode }: { label: string; mode: "sim" | "live" }) {
  return (
    <span className={`chip ${mode}`} title={mode === "live" ? `${label} — live service` : `${label} — simulated`}>
      ● {label}
      <span style={{ opacity: 0.65, marginLeft: 5 }}>{mode}</span>
    </span>
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
