"use client";

import type { GuildSkill } from "@/lib/sponsors/types";

/**
 * The Guild Agent Hub — versioned skills the agent has authored for itself. Each
 * one was learned by successfully repairing a defect class; its application count
 * is how many times that learned fix has since paid off.
 */
export function SkillLibrary({ skills }: { skills: GuildSkill[] }) {
  if (skills.length === 0) {
    return <div className="empty">No skills learned yet. Skills appear as defects are fixed.</div>;
  }
  const sorted = [...skills].sort((a, b) => b.applications - a.applications);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {sorted.map((skill) => (
        <div key={skill.id} className="skill">
          <div className="skill-top">
            <span className="skill-name">{skill.name}</span>
            <span className="skill-ver mono">v{skill.version}</span>
          </div>
          <div className="skill-know">{skill.knowledge}</div>
          <div className="skill-meta">
            guard:{skill.guard} · applied ×{skill.applications} · learned gen {skill.createdGeneration}
          </div>
        </div>
      ))}
    </div>
  );
}
