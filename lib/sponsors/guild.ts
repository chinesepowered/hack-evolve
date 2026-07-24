import type { GuardId } from "@/lib/domain/types";
import { SPONSOR_ENDPOINTS } from "./config";
import type { GuildClient, GuildEvent, GuildEventKind, GuildSkill } from "./types";

/**
 * Simulated Guild runtime.
 *
 * Models the Guild primitives the agent actually uses: Triggers (the QA webhook
 * that wakes the agent), Task state (persistent memory across steps), the event
 * stream, and versioned Skills published to the Agent Hub. When the agent learns
 * to repair a defect class, it publishes a Skill; the next time that defect
 * appears, the Skill is already on the Hub and activates instantly.
 */
export class SimGuildClient implements GuildClient {
  readonly kind = "sim" as const;
  private eventLog: GuildEvent[] = [];
  private state = new Map<string, unknown>();
  private skills: GuildSkill[] = [];
  private skillSeq = 0;

  async fireTrigger(name: string, detail: string): Promise<void> {
    await this.log("trigger.fired", `Trigger '${name}' fired — ${detail}`);
  }

  async log(kind: GuildEventKind, message: string): Promise<void> {
    this.eventLog.push({ kind, message, at: Date.now() });
    if (this.eventLog.length > 200) this.eventLog.shift();
  }

  events(): GuildEvent[] {
    return this.eventLog;
  }

  getState<T>(key: string): T | undefined {
    return this.state.get(key) as T | undefined;
  }

  async setState<T>(key: string, value: T): Promise<void> {
    this.state.set(key, value);
    await this.log("state.write", `state[${key}] updated`);
  }

  async publishSkill(
    skill: Omit<GuildSkill, "id" | "version" | "applications">,
  ): Promise<GuildSkill> {
    const prior = this.skills.filter((s) => s.guard === skill.guard);
    const version = prior.length + 1;
    const published: GuildSkill = {
      ...skill,
      id: `skill_${skill.guard}_v${version}_${this.skillSeq++}`,
      version,
      applications: 0,
    };
    this.skills.push(published);
    await this.log(
      "skill.published",
      `Published ${published.name} v${version} to Agent Hub`,
    );
    return published;
  }

  async activateSkill(guard: GuardId): Promise<GuildSkill | undefined> {
    const matches = this.skills.filter((s) => s.guard === guard);
    if (matches.length === 0) return undefined;
    const newest = matches.reduce((a, b) => (b.version > a.version ? b : a));
    newest.applications++;
    await this.log("skill.activated", `Activated ${newest.name} v${newest.version}`);
    return newest;
  }

  async listSkills(): Promise<GuildSkill[]> {
    return [...this.skills];
  }
}

/** Live Guild client — mirrors the @guildai/agents-sdk surface. Enable at hackathon. */
export class LiveGuildClient implements GuildClient {
  readonly kind = "sim" as const;
  constructor(
    private readonly base = SPONSOR_ENDPOINTS.guild,
    private readonly token = (typeof process !== "undefined" && process.env?.GUILD_API_KEY) || "",
  ) {}
  private nyi(what: string): never {
    throw new Error(
      `LiveGuildClient not enabled. ${what} via @guildai/agents-sdk against ${this.base} (token ${this.token ? "set" : "unset"}).`,
    );
  }
  async fireTrigger(): Promise<void> {
    this.nyi("Register a Trigger");
  }
  async log(): Promise<void> {
    /* live logs stream from the Guild task runtime */
  }
  events(): GuildEvent[] {
    return [];
  }
  getState<T>(): T | undefined {
    return undefined;
  }
  async setState(): Promise<void> {
    this.nyi("Persist task State");
  }
  async publishSkill(): Promise<GuildSkill> {
    this.nyi("Publish a Skill to the Agent Hub");
  }
  async activateSkill(): Promise<GuildSkill | undefined> {
    this.nyi("Activate a Skill");
  }
  async listSkills(): Promise<GuildSkill[]> {
    return [];
  }
}
