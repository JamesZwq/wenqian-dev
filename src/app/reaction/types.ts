export type GameMode = "menu" | "solo" | "p2p";
export type RoundStatus = "idle" | "waiting" | "go" | "result";
export const TOTAL_ROUNDS = 5;
export const MIN_DELAY_MS = 1000;
export const MAX_DELAY_MS = 3000;
export const FALSE_START_PENALTY_MS = 1000;

export type ReactionPacket =
  | { type: "puzzle_sync"; delays: number[]; timestamp: number }
  | { type: "round_start"; roundIndex: number; startAt: number; timestamp: number }
  | { type: "reaction_time"; roundIndex: number; ms: number; timestamp: number }
  | { type: "complete"; avgMs: number; bestMs: number; timestamp: number }
  | { type: "new_game"; timestamp: number };
