import type { GameId, ScoreMetric } from "@/db/schema/leaderboards";

interface Range { min: number; max: number; }

const BOUNDS: Partial<Record<GameId, Partial<Record<ScoreMetric, Range>>>> = {
  "schulte":     { time_ms: { min: 3000,  max: 600000  } },
  "reaction":    { time_ms: { min: 100,   max: 5000    } },
  "math":        { score:   { min: 0,     max: 500     } },
  "flash-count": { score:   { min: 0,     max: 100     } },
  "trail":       { time_ms: { min: 5000,  max: 600000  } },
  "pattern":     { score:   { min: 1,     max: 30      } },
  "sudoku":      { time_ms: { min: 30000, max: 7200000 } },
  "maze":        { time_ms: { min: 5000,  max: 1800000 } },
  // P2P games — bounds permissive (real validation is via cooperative reporting)
  "poker":       { time_ms: { min: 0,     max: 86400000 } },
  "halli-galli": { time_ms: { min: 0,     max: 86400000 } },
  "gomoku":      { time_ms: { min: 0,     max: 86400000 } },
  "pulse-duel":  { time_ms: { min: 0,     max: 86400000 } },
};

export function withinBounds(game: GameId, metric: ScoreMetric, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const range = BOUNDS[game]?.[metric];
  if (!range) return false;
  return value >= range.min && value <= range.max;
}
