"use client";

import type { GuildEvent, GuildEventKind } from "@/lib/sponsors/types";

const ICON: Record<GuildEventKind, string> = {
  "trigger.fired": "⚡",
  "task.started": "▶",
  "state.read": "◈",
  "state.write": "✎",
  "skill.activated": "✦",
  "skill.published": "★",
  "task.completed": "✓",
};

function klass(kind: GuildEventKind): string {
  if (kind.startsWith("trigger")) return "log-k-trigger";
  if (kind.startsWith("skill")) return "log-k-skill";
  if (kind.startsWith("state")) return "log-k-state";
  return "log-k-task";
}

/** The Guild task's event stream — the agent narrating its own run. */
export function ActivityLog({ events }: { events: GuildEvent[] }) {
  if (events.length === 0) {
    return <div className="empty">Agent idle.</div>;
  }
  return (
    <div className="log">
      {events.map((e, i) => (
        <div key={`${e.at}-${i}`} className={`log-line ${klass(e.kind)}`}>
          <span className="log-ico">{ICON[e.kind]}</span>
          <span dangerouslySetInnerHTML={{ __html: highlight(e.message) }} />
        </div>
      ))}
    </div>
  );
}

// Bold quoted phrases and skill/version tokens for scannability.
function highlight(msg: string): string {
  const esc = msg
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc
    .replace(/"([^"]+)"/g, '<b>$1</b>')
    .replace(/\b(v\d+)\b/g, '<b>$1</b>')
    .replace(/(cosine \d\.\d+)/g, '<b>$1</b>');
}
