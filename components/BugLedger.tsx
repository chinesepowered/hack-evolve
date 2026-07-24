"use client";

import { useState } from "react";
import type { ReplayBug } from "@/lib/sponsors/types";

/**
 * The Replay findings ledger. Each row is an investigated defect with the full
 * reproduction, expected-vs-actual, root cause, and screenshot chronology the
 * real product returns. Rows drain from open (magenta) to fixed (mint) as the
 * agent works.
 */
export function BugLedger({ bugs }: { bugs: ReplayBug[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const sorted = [...bugs].sort((a, b) => {
    const rank = (s: string) => (s === "fixed" ? 1 : 0);
    return rank(a.status) - rank(b.status);
  });

  if (bugs.length === 0) {
    return (
      <div className="empty">
        No open findings — the roster is safe. Press <b style={{ color: "var(--alarm)" }}>Sabotage</b> to
        inject a real defect and watch Regenesis detect, diagnose, and repair it.
      </div>
    );
  }

  return (
    <div>
      {sorted.map((bug) => {
        const isOpen = open === bug.id;
        const closed = bug.status === "fixed";
        return (
          <div key={bug.id} className={`bug ${closed ? "resolved" : "unresolved"}`}>
            <div className="bug-row" onClick={() => setOpen(isOpen ? null : bug.id)}>
              <span className={`bug-sev sev-${bug.severity}`} />
              <span className="bug-title">{bug.title}</span>
              {!closed && bug.count > 0 && (
                <span className="mono" style={{ fontSize: 10, color: "var(--faint)" }}>
                  ×{bug.count}
                </span>
              )}
              <span className={`bug-status status-${bug.status}`}>{bug.status}</span>
            </div>
            {isOpen && (
              <dl className="bug-detail">
                <dt>Expected</dt>
                <dd>{bug.expected}</dd>
                <dt>Actual</dt>
                <dd>{bug.actual}</dd>
                <dt>Reproduction</dt>
                <dd>
                  <ol>
                    {bug.reproductionSteps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </dd>
                <dt>Root cause</dt>
                <dd>{bug.rootCause}</dd>
                <dt>Screenshot chronology</dt>
                <dd>
                  <ul style={{ listStyle: "none", paddingLeft: 0 }}>
                    {bug.screenshots.map((s, i) => (
                      <li key={i} className="shot">
                        ▸ {s}
                      </li>
                    ))}
                  </ul>
                </dd>
              </dl>
            )}
          </div>
        );
      })}
    </div>
  );
}
