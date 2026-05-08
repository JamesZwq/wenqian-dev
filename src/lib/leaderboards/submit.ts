"use client";
import type { GameId, ScoreMetric, ScoreMode } from "@/db/schema/leaderboards";

const TIMEOUT_MS = 5000;

export interface SubmitScoreInput {
  game: GameId;
  mode: ScoreMode;
  metric: ScoreMetric;
  value: number;
}

export interface SubmitMatchInput {
  matchId: string;
  game: GameId;
  /** Both player ids — submit.ts re-sorts before sending. */
  playerAId: string;
  playerBId: string;
  wasTie: boolean;
  /** Required when wasTie === false. */
  winnerId?: string;
}

async function withTimeout<T>(p: Promise<T>): Promise<T | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await p;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Fire-and-forget; never throws; never breaks the game UX. */
export async function submitScore(input: SubmitScoreInput): Promise<void> {
  await withTimeout(
    fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      keepalive: true,
    }),
  );
}

/** Both clients call independently with identical input — server's KV-backed
 *  join window de-duplicates and only commits if both reports agree. */
export async function submitMatch(input: SubmitMatchInput): Promise<void> {
  const [a, b] = [input.playerAId, input.playerBId].sort();
  await withTimeout(
    fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, playerAId: a, playerBId: b }),
      keepalive: true,
    }),
  );
}
