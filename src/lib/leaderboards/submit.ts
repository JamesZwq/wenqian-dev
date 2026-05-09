"use client";
import type { GameId, ScoreMetric, ScoreMode } from "@/db/schema/leaderboards";
import { positionsToPairs, type Pair } from "@/lib/leaderboards/pairwise";

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

export interface SubmitMatchBulkInput {
  matchId: string;
  game: GameId;
  /** positions[0] = 1st place; positions[N-1] = last place. */
  positions: string[];
  /** Optional: pairs (a,b) where the result was a tie (poker split-pot etc). */
  ties?: { aId: string; bId: string }[];
  roomCode?: string;
}

/** Round-robin pairwise N-player match report. Server enforces N(N-1)/2 pair count. */
export async function submitMatchBulk(input: SubmitMatchBulkInput): Promise<void> {
  const pairs: Pair[] = positionsToPairs(input.positions);
  if (input.ties?.length) {
    const tieKey = (a: string, b: string) => `${a}|${b}`;
    const tieSet = new Set<string>();
    for (const t of input.ties) {
      const [x, y] = [t.aId, t.bId].sort();
      tieSet.add(tieKey(x, y));
    }
    for (const p of pairs) {
      const [x, y] = [p.winnerId, p.loserId].sort();
      if (tieSet.has(tieKey(x, y))) p.wasTie = true;
    }
  }
  await withTimeout(
    fetch("/api/matches/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: input.matchId,
        game: input.game,
        results: pairs,
        roomCode: input.roomCode,
      }),
      keepalive: true,
    }),
  );
}
