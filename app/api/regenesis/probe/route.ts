import { findings, snapshot } from "@/lib/server/app-state";

/**
 * Run the safety audit against the live schedule and report what is broken.
 *
 * This is the agent's eyes. The oracle audits against the immutable policy, not
 * the current rules, so weakening a rule cannot hide its own violations.
 */
export async function POST() {
  return Response.json({ findings: findings(), state: snapshot() });
}
