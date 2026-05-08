import type { KVNamespace } from "@cloudflare/workers-types";

export interface MatchReport {
  game: string;
  playerAId: string;
  playerBId: string;
  wasTie: boolean;
  winnerId: string | null;
  reportedAt: number;
  reportedBy: string;
}

const TTL_SECONDS = 30;

function key(matchId: string): string {
  return `match:${matchId}`;
}

export type WindowOutcome =
  | { outcome: "stored" }
  | { outcome: "match"; previous: MatchReport }
  | { outcome: "mismatch"; previous: MatchReport };

/**
 * "stored": first report for matchId — caller should respond pending.
 * "match":  second report agrees with stored one (everything except
 *           reportedAt/reportedBy) — caller should commit the result.
 * "mismatch": second report disagrees — both clients dropped on the floor.
 */
export async function reportMatch(
  kv: KVNamespace,
  matchId: string,
  report: MatchReport,
): Promise<WindowOutcome> {
  const existing = await kv.get(key(matchId));
  if (!existing) {
    await kv.put(key(matchId), JSON.stringify(report), { expirationTtl: TTL_SECONDS });
    return { outcome: "stored" };
  }
  const prev = JSON.parse(existing) as MatchReport;
  const agrees =
    prev.game === report.game &&
    prev.playerAId === report.playerAId &&
    prev.playerBId === report.playerBId &&
    prev.wasTie === report.wasTie &&
    prev.winnerId === report.winnerId;
  await kv.delete(key(matchId));
  return agrees
    ? { outcome: "match", previous: prev }
    : { outcome: "mismatch", previous: prev };
}
