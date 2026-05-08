import type { GameId, ScoreMetric } from "@/db/schema/leaderboards";

export interface GameMeta {
  id: GameId;
  label: string;
  metric: ScoreMetric;
  hybrid: boolean;
  p2pOnly: boolean;
}

export const GAMES: Record<GameId, GameMeta> = {
  "schulte":     { id: "schulte",     label: "Schulte",        metric: "time_ms", hybrid: false, p2pOnly: false },
  "reaction":    { id: "reaction",    label: "Reaction",       metric: "time_ms", hybrid: false, p2pOnly: false },
  "math":        { id: "math",        label: "Math Sprint",    metric: "score",   hybrid: false, p2pOnly: false },
  "flash-count": { id: "flash-count", label: "Flash Count",    metric: "score",   hybrid: false, p2pOnly: false },
  "trail":       { id: "trail",       label: "Trail Making",   metric: "time_ms", hybrid: false, p2pOnly: false },
  "pattern":     { id: "pattern",     label: "Pattern",        metric: "score",   hybrid: false, p2pOnly: false },
  "sudoku":      { id: "sudoku",      label: "Sudoku",         metric: "time_ms", hybrid: true,  p2pOnly: false },
  "maze":        { id: "maze",        label: "Maze Runner",    metric: "time_ms", hybrid: true,  p2pOnly: false },
  "poker":       { id: "poker",       label: "Texas Hold'em",  metric: "time_ms", hybrid: false, p2pOnly: true },
  "halli-galli": { id: "halli-galli", label: "Halli Galli",    metric: "time_ms", hybrid: false, p2pOnly: true },
  "gomoku":      { id: "gomoku",      label: "Gomoku",         metric: "time_ms", hybrid: false, p2pOnly: true },
  "pulse-duel":  { id: "pulse-duel",  label: "Pulse Duel",     metric: "time_ms", hybrid: false, p2pOnly: true },
};

export function lowerIsBetter(metric: ScoreMetric): boolean {
  return metric === "time_ms";
}
