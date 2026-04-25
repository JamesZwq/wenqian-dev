export type GameMode = "menu" | "solo" | "p2p";
// "waiting" covers both "lights turning on one by one" AND "all lit, holding"
export type RoundStatus = "idle" | "waiting" | "go" | "result";
export const TOTAL_ROUNDS = 5;
// Hold time (after all 5 lights are lit, before they extinguish)
export const MIN_HOLD_MS = 200;
export const MAX_HOLD_MS = 3000;
// Time between each of the 5 lights turning on (F1 standard ≈ 1s)
export const LIGHT_INTERVAL_MS = 1000;
export const FALSE_START_PENALTY_MS = 1000;

export type ReactionPacket =
  | { type: "puzzle_sync"; delays: number[]; timestamp: number }
  | { type: "round_start"; roundIndex: number; startAt: number; timestamp: number }
  | { type: "reaction_time"; roundIndex: number; ms: number; timestamp: number }
  | { type: "complete"; avgMs: number; bestMs: number; timestamp: number }
  | { type: "new_game"; timestamp: number };
