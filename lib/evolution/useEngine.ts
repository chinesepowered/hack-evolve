"use client";

import { useSyncExternalStore } from "react";
import { RegenesisEngine, type EngineSnapshot } from "./engine";

/**
 * One engine instance, shared across every component and route on the client.
 * Created lazily so it never runs during server rendering.
 */
let singleton: RegenesisEngine | null = null;

export function getEngine(): RegenesisEngine {
  if (!singleton) {
    singleton = new RegenesisEngine();
    // Handy for demos, scripted screenshots, and console tinkering.
    if (typeof window !== "undefined") {
      (window as unknown as { __regenesis?: RegenesisEngine }).__regenesis = singleton;
    }
  }
  return singleton;
}

const SERVER_SNAPSHOT: EngineSnapshot | null = null;

export function useEngine(): { engine: RegenesisEngine; snap: EngineSnapshot } {
  const engine = getEngine();
  const snap = useSyncExternalStore(
    engine.subscribe,
    engine.getSnapshot,
    () => SERVER_SNAPSHOT as unknown as EngineSnapshot,
  );
  return { engine, snap };
}
