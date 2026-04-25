export type Color = "red" | "green" | "blue" | "yellow";
export type GameMode = "menu" | "solo" | "p2p";
export type GameStatus = "idle" | "showing" | "input" | "game_over";

export const COLORS: Color[] = ["red", "green", "blue", "yellow"];

export const COLOR_HEX: Record<Color, string> = {
  red: "#ef4444",
  green: "#22c55e",
  blue: "#3b82f6",
  yellow: "#eab308",
};

export const COLOR_HZ: Record<Color, number> = {
  red: 261.6,
  green: 329.6,
  blue: 392.0,
  yellow: 523.3,
};

export type PatternPacket =
  | { type: "puzzle_sync"; sequence: Color[]; timestamp: number }
  | { type: "round_progress"; round: number; timestamp: number }
  | { type: "game_over"; finalRound: number; timestamp: number }
  | { type: "new_game"; timestamp: number };
