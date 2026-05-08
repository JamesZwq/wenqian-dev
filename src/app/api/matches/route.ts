import { eq, and } from "drizzle-orm";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { getDb } from "@/db/client";
import {
  matches,
  ratings,
  GAME_IDS,
  type GameId,
} from "@/db/schema/leaderboards";
import { user as userTable } from "@/db/schema/auth";
import { reportMatch, type MatchReport } from "@/lib/leaderboards/window";
import { computeElo, STARTING_ELO } from "@/lib/leaderboards/elo";
import { track } from "@/lib/analytics";

interface Body {
  matchId: string;
  game: GameId;
  playerAId: string;
  playerBId: string;
  wasTie: boolean;
  winnerId?: string | null;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if (!session.user.emailVerified) {
    return new Response("Verified email required to rank", { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<Body>;
  if (!body.matchId || typeof body.matchId !== "string") {
    return new Response("Bad matchId", { status: 400 });
  }
  if (!body.game || !GAME_IDS.includes(body.game)) {
    return new Response("Bad game", { status: 400 });
  }
  if (!body.playerAId || !body.playerBId) {
    return new Response("Bad player ids", { status: 400 });
  }
  if (body.playerAId >= body.playerBId) {
    return new Response("Bad player order", { status: 400 });
  }
  if (typeof body.wasTie !== "boolean") {
    return new Response("Bad wasTie", { status: 400 });
  }
  if (!body.wasTie && !body.winnerId) {
    return new Response("winnerId required when not tie", { status: 400 });
  }
  if (!body.wasTie && body.winnerId !== body.playerAId && body.winnerId !== body.playerBId) {
    return new Response("winnerId must be one of the players", { status: 400 });
  }
  if (session.user.id !== body.playerAId && session.user.id !== body.playerBId) {
    return new Response("You are not in this match", { status: 403 });
  }

  const e = env();
  const db = getDb();

  // Both players must be email-verified for the match to count.
  const [otherId] = [body.playerAId, body.playerBId].filter((id) => id !== session.user.id);
  const [other] = await db.select().from(userTable).where(eq(userTable.id, otherId));
  if (!other || !other.emailVerified) {
    return new Response("Opponent must have a verified email to rank", { status: 403 });
  }

  const report: MatchReport = {
    game: body.game,
    playerAId: body.playerAId,
    playerBId: body.playerBId,
    wasTie: body.wasTie,
    winnerId: body.wasTie ? null : (body.winnerId as string),
    reportedAt: Date.now(),
    reportedBy: session.user.id,
  };

  const r = await reportMatch(e.CACHE, body.matchId, report);
  if (r.outcome === "stored") {
    return Response.json({ status: "pending" });
  }
  if (r.outcome === "mismatch") {
    track({ name: "match.dropped", game: body.game, reason: "mismatch" });
    return Response.json({ status: "dropped", reason: "mismatch" });
  }

  const winnerId = report.wasTie ? null : (report.winnerId as string);
  const loserId = report.wasTie
    ? null
    : (winnerId === report.playerAId ? report.playerBId : report.playerAId);

  // For ties, treat playerA as 'winner' and playerB as 'loser' for ELO math
  // arithmetic only — the matches row stores wasTie=true and both nulls.
  const eloSubject = report.wasTie ? report.playerAId : (winnerId as string);
  const eloOpponent = report.wasTie ? report.playerBId : (loserId as string);
  const subjectRating = await getOrCreateRating(db, eloSubject, body.game);
  const opponentRating = await getOrCreateRating(db, eloOpponent, body.game);

  const elo = computeElo({
    winnerElo: subjectRating.elo,
    loserElo: opponentRating.elo,
    winnerMatches: subjectRating.matchesPlayed,
    loserMatches: opponentRating.matchesPlayed,
    wasTie: report.wasTie,
  });

  await db.insert(matches).values({
    id: crypto.randomUUID(),
    game: body.game,
    winnerId,
    loserId,
    wasTie: report.wasTie,
    winnerEloDelta: elo.winnerDelta,
    loserEloDelta: elo.loserDelta,
  });

  await applyRating(db, eloSubject, body.game, elo.winnerDelta, report.wasTie ? "tie" : "win");
  await applyRating(db, eloOpponent, body.game, elo.loserDelta, report.wasTie ? "tie" : "loss");

  track({ name: "match.confirmed", game: body.game });
  return Response.json({
    status: "confirmed",
    matchId: body.matchId,
    selfDelta: session.user.id === eloSubject ? elo.winnerDelta : elo.loserDelta,
  });
}

async function getOrCreateRating(
  db: ReturnType<typeof getDb>,
  userId: string,
  game: GameId,
): Promise<{ elo: number; matchesPlayed: number }> {
  const [row] = await db
    .select()
    .from(ratings)
    .where(and(eq(ratings.userId, userId), eq(ratings.game, game)));
  if (row) return { elo: row.elo, matchesPlayed: row.matchesPlayed };
  await db.insert(ratings).values({
    userId,
    game,
    elo: STARTING_ELO,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    ties: 0,
  });
  return { elo: STARTING_ELO, matchesPlayed: 0 };
}

async function applyRating(
  db: ReturnType<typeof getDb>,
  userId: string,
  game: GameId,
  delta: number,
  outcome: "win" | "loss" | "tie",
) {
  const [row] = await db
    .select()
    .from(ratings)
    .where(and(eq(ratings.userId, userId), eq(ratings.game, game)));
  const next = {
    elo: (row?.elo ?? STARTING_ELO) + delta,
    matchesPlayed: (row?.matchesPlayed ?? 0) + 1,
    wins: (row?.wins ?? 0) + (outcome === "win" ? 1 : 0),
    losses: (row?.losses ?? 0) + (outcome === "loss" ? 1 : 0),
    ties: (row?.ties ?? 0) + (outcome === "tie" ? 1 : 0),
    lastMatchAt: new Date(),
  };
  await db
    .update(ratings)
    .set(next)
    .where(and(eq(ratings.userId, userId), eq(ratings.game, game)));
}
