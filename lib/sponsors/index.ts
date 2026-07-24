import type { Violation } from "@/lib/domain/types";
import { LiveActianClient, SimActianClient } from "./actian";
import { sponsorMode } from "./config";
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
 * three interfaces, so "sim" vs "live" is invisible above this line.
 */
export function createSponsors(probe: () => Violation[]): SponsorSuite {
  if (sponsorMode() === "live") {
    return {
      actian: new LiveActianClient(),
      replay: new LiveReplayClient(),
      guild: new LiveGuildClient(),
    };
  }
  return {
    actian: new SimActianClient(),
    replay: new SimReplayClient(probe),
    guild: new SimGuildClient(),
  };
}

export * from "./types";
export { sponsorMode } from "./config";
