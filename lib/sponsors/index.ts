import type { Violation } from "@/lib/domain/types";
import { LiveActianClient, SimActianClient } from "./actian";
import { actianMode, guildMode, replayMode } from "./config";
import { LiveGuildClient, SimGuildClient } from "./guild";
import { LiveReplayClient, SimReplayClient } from "./replay";
import type { ActianClient, GuildClient, ReplayClient } from "./types";

export interface SponsorSuite {
  actian: ActianClient;
  replay: ReplayClient;
  guild: GuildClient;
}

/**
 * Build the sponsor suite for the current mode. The engine holds only these
 * three interfaces, so "sim" vs "live" is invisible above this line — and each
 * sponsor resolves independently, so Actian can be live while Replay and Guild
 * are still simulated.
 */
export function createSponsors(probe: () => Violation[]): SponsorSuite {
  return {
    actian: actianMode() === "live" ? new LiveActianClient() : new SimActianClient(),
    replay: replayMode() === "live" ? new LiveReplayClient() : new SimReplayClient(probe),
    guild: guildMode() === "live" ? new LiveGuildClient() : new SimGuildClient(),
  };
}

export * from "./types";
export { sponsorMode, actianMode, replayMode, guildMode, allLive } from "./config";
