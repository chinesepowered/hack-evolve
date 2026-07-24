"use client";

import { useEffect, useState } from "react";

interface RawBug {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  severity?: string;
  status?: string;
}

interface Exploration {
  id: string;
  status: string;
  journeys_created: number;
  prompt: string;
}

interface QAState {
  configured: boolean;
  bugs?: RawBug[];
  openCount?: number;
  resolvedCount?: number;
  totalBugs?: number;
  explorations?: Exploration[];
  error?: string;
}

/**
 * Live findings from Replay Loop QA.
 *
 * This is the external quality gate: a hosted service exploring the deployed
 * app on its own and filing what it finds. Distinct from the in-app oracle,
 * which checks safety invariants — this one checks the product.
 */
export function LiveQAPanel() {
  const [qa, setQa] = useState<QAState | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/qa", { cache: "no-store" });
        const json = (await res.json()) as QAState;
        if (alive) setQa(json);
      } catch {
        if (alive) setQa({ configured: false, error: "unreachable" });
      }
    };
    load();
    const timer = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (!qa) return <div className="empty">connecting to Replay Loop QA…</div>;
  if (!qa.configured) {
    return <div className="empty">Replay Loop QA not configured{qa.error ? ` — ${qa.error}` : ""}</div>;
  }

  const running = (qa.explorations ?? []).filter((e) => e.status === "in-progress");
  const bugs = qa.bugs ?? [];

  return (
    <div>
      <div style={{ display: "flex", gap: 18, marginBottom: 12, flexWrap: "wrap" }}>
        <Stat label="explorations" value={String((qa.explorations ?? []).length)} />
        <Stat label="running" value={String(running.length)} tone={running.length ? "amber" : undefined} />
        <Stat label="bugs filed" value={String(qa.totalBugs ?? 0)} tone={qa.openCount ? "alarm" : "mint"} />
        <Stat label="resolved" value={String(qa.resolvedCount ?? 0)} tone="mint" />
      </div>

      {running.length > 0 && (
        <div className="empty" style={{ marginBottom: 10 }}>
          exploring the deployment… {running[0].journeys_created} journeys discovered
        </div>
      )}

      {bugs.length === 0 ? (
        <div className="empty">No bugs filed yet by Loop QA.</div>
      ) : (
        bugs.map((b) => (
          <div key={b.id} className={`bug ${b.status === "resolved" ? "resolved" : "unresolved"}`}>
            <div className="bug-row">
              <span className={`bug-sev sev-${severityClass(b.severity)}`} />
              <span className="bug-title">{b.title ?? b.name ?? b.id}</span>
              <span className="bug-status">{b.status ?? "open"}</span>
            </div>
            {b.description && (
              <div className="bug-detail">
                <dd>{b.description.slice(0, 240)}</dd>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function severityClass(severity?: string): string {
  const s = (severity ?? "").toLowerCase();
  if (s.includes("crit") || s.includes("high")) return "critical";
  if (s.includes("serious") || s.includes("med")) return "serious";
  return "warning";
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const color =
    tone === "alarm" ? "var(--alarm)" : tone === "mint" ? "var(--mint)" : tone === "amber" ? "var(--amber)" : "var(--ink)";
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="mono" style={{ fontSize: 20, color, fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}
