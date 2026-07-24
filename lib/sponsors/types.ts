import type { GuardId } from "@/lib/domain/types";

// ===========================================================================
// Actian VectorAI DB — agent memory
// ===========================================================================

export interface VectorPoint {
  id: string;
  vector: number[];
  payload: MemoryPayload;
}

/** What we remember about each defect the agent has faced. */
export interface MemoryPayload {
  guard: GuardId;
  defectId: string;
  /** The bug text that was embedded — kept for display + re-ranking. */
  text: string;
  /** "success" if the recalled fix resolved the bug on verification. */
  outcome: "success" | "fail";
  /** Skill version that resolved it, if any. */
  skillVersion?: number;
  generation: number;
  timesReinforced: number;
}

export interface VectorFilter {
  must?: Partial<Pick<MemoryPayload, "guard" | "outcome" | "defectId">>;
  mustNot?: Partial<Pick<MemoryPayload, "guard" | "outcome" | "defectId">>;
}

export interface VectorHit {
  id: string;
  score: number;
  payload: MemoryPayload;
}

export interface ActianClient {
  readonly kind: SponsorKind;
  upsert(points: VectorPoint[]): Promise<void>;
  /** Single-vector approximate nearest neighbour with metadata filtering. */
  search(vector: number[], opts?: { topK?: number; filter?: VectorFilter }): Promise<VectorHit[]>;
  /**
   * Hybrid retrieval: fuse two query vectors with Reciprocal Rank Fusion.
   * Used to blend "what does this bug look like" with "what has worked before".
   */
  hybridSearch(
    vectors: number[][],
    opts?: { topK?: number; filter?: VectorFilter },
  ): Promise<VectorHit[]>;
  all(): Promise<VectorPoint[]>;
  count(): Promise<number>;
}

// ===========================================================================
// Replay Loop QA — autonomous QA as a fitness function
// ===========================================================================

export type BugStatus = "open" | "reopened" | "fixed" | "wontfix" | "invalid";

export interface ReplayBug {
  id: string;
  guard: GuardId;
  title: string;
  severity: "critical" | "serious" | "warning";
  status: BugStatus;
  /** Stable across generations so a reappearing bug is recognisably the same. */
  fingerprint: string;
  reproductionSteps: string[];
  expected: string;
  actual: string;
  rootCause: string;
  /** Textual stand-in for Replay's screenshot chronology. */
  screenshots: string[];
  foundInVersion: number;
  count: number;
}

export interface ReplayExploration {
  id: string;
  prompt: string;
  startedVersion: number;
  bugsFound: number;
  journeysCovered: string[];
}

export interface ReplayClient {
  readonly kind: SponsorKind;
  /** Run an AI exploration against the current app state; files bugs. */
  explore(prompt?: string): Promise<{ exploration: ReplayExploration; bugs: ReplayBug[] }>;
  listBugs(status?: BugStatus): Promise<ReplayBug[]>;
  getBug(id: string): Promise<ReplayBug | undefined>;
  updateBug(id: string, status: BugStatus): Promise<ReplayBug>;
  recordVersion(note: string): Promise<{ version: number }>;
  status(): Promise<{ open: number; fixed: number; version: number; explorations: number }>;
}

// ===========================================================================
// Guild — agent runtime, skills, triggers
// ===========================================================================

export interface GuildSkill {
  id: string;
  guard: GuardId;
  name: string;
  version: number;
  /** Human-readable knowledge the skill encodes. */
  knowledge: string;
  /** How many times this skill has been applied successfully. */
  applications: number;
  createdGeneration: number;
}

export type GuildEventKind =
  | "trigger.fired"
  | "task.started"
  | "state.read"
  | "state.write"
  | "skill.activated"
  | "skill.published"
  | "task.completed";

export interface GuildEvent {
  kind: GuildEventKind;
  message: string;
  at: number;
}

export interface GuildClient {
  readonly kind: SponsorKind;
  fireTrigger(name: string, detail: string): Promise<void>;
  log(kind: GuildEventKind, message: string): Promise<void>;
  events(): GuildEvent[];
  getState<T>(key: string): T | undefined;
  setState<T>(key: string, value: T): Promise<void>;
  publishSkill(skill: Omit<GuildSkill, "id" | "version" | "applications">): Promise<GuildSkill>;
  /** Find the newest skill that handles a guard, if the agent has learned one. */
  activateSkill(guard: GuardId): Promise<GuildSkill | undefined>;
  listSkills(): Promise<GuildSkill[]>;
}

export type SponsorKind = "sim" | "live";
