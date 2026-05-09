import type { KVNamespace } from "@cloudflare/workers-types";

interface PairInput { winnerId: string; loserId: string; wasTie?: boolean; }
interface CoopReport {
  matchId: string;
  reports: { userId: string; results: PairInput[]; reportedAt: number }[];
  expectedN: number;
}

const TTL_SEC = 60;

function key(roomCode: string, matchId: string): string {
  return `room:${roomCode}:report:${matchId}`;
}

function pairsEqual(a: PairInput[], b: PairInput[]): boolean {
  if (a.length !== b.length) return false;
  const norm = (p: PairInput) => `${p.winnerId}|${p.loserId}|${p.wasTie ? "T" : "F"}`;
  const setA = new Set(a.map(norm));
  for (const p of b) if (!setA.has(norm(p))) return false;
  return true;
}

/**
 * Returns:
 *   "stored"    — first / additional report stored, waiting for more
 *   "confirmed" — all N reports in, all agree → caller commits
 *   "mismatch"  — a report disagrees → caller drops
 *   "timeout"   — reserved (KV TTL handles it on its own)
 */
export async function reportCooperative(
  kv: KVNamespace,
  roomCode: string,
  matchId: string,
  userId: string,
  results: PairInput[],
): Promise<"stored" | "confirmed" | "mismatch" | "timeout"> {
  const userIds = new Set<string>();
  for (const p of results) { userIds.add(p.winnerId); userIds.add(p.loserId); }
  const expectedN = userIds.size;

  const raw = await kv.get(key(roomCode, matchId));
  let state: CoopReport;
  if (!raw) {
    state = { matchId, reports: [{ userId, results, reportedAt: Date.now() }], expectedN };
    await kv.put(key(roomCode, matchId), JSON.stringify(state), { expirationTtl: TTL_SEC });
    return "stored";
  }
  state = JSON.parse(raw) as CoopReport;
  if (state.reports.some((r) => r.userId === userId)) {
    return state.reports.length >= state.expectedN ? "confirmed" : "stored";
  }
  if (!pairsEqual(state.reports[0].results, results)) {
    await kv.delete(key(roomCode, matchId));
    return "mismatch";
  }
  state.reports.push({ userId, results, reportedAt: Date.now() });
  if (state.reports.length >= state.expectedN) {
    await kv.delete(key(roomCode, matchId));
    return "confirmed";
  }
  await kv.put(key(roomCode, matchId), JSON.stringify(state), { expirationTtl: TTL_SEC });
  return "stored";
}
