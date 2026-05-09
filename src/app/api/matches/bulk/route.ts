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
import { computeElo, STARTING_ELO } from "@/lib/leaderboards/elo";
import { getRoom, isBanned } from "@/lib/rooms/store";
import { reportCooperative } from "@/lib/rooms/coopReport";
import { track } from "@/lib/analytics";

interface PairInput { winnerId: string; loserId: string; wasTie?: boolean; }
interface Body { matchId: string; game: GameId; results: PairInput[]; roomCode?: string; }

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if (!session.user.emailVerified) return new Response("Verified email required", { status: 403 });

  const e = env();
  if (await isBanned(e.CACHE, session.user.id)) return new Response("Banned", { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Partial<Body>;
  if (!body.matchId || typeof body.matchId !== "string") {
    return new Response("Bad matchId", { status: 400 });
  }
  if (!body.game || !GAME_IDS.includes(body.game)) {
    return new Response("Bad game", { status: 400 });
  }
  if (!Array.isArray(body.results) || body.results.length === 0) {
    return new Response("Bad results", { status: 400 });
  }

  const callerInResults = body.results.some(
    (p) => p.winnerId === session.user.id || p.loserId === session.user.id,
  );
  if (!callerInResults) {
    return new Response("Not a participant", { status: 403 });
  }

  const userIds = new Set<string>();
  for (const p of body.results) {
    if (typeof p.winnerId !== "string" || typeof p.loserId !== "string") {
      return new Response("Bad pair shape", { status: 400 });
    }
    userIds.add(p.winnerId);
    userIds.add(p.loserId);
  }
  const N = userIds.size;
  if (body.results.length !== (N * (N - 1)) / 2) {
    return new Response(
      `Expected ${(N * (N - 1)) / 2} pairs for N=${N}, got ${body.results.length}`,
      { status: 400 },
    );
  }

  let isPrivateHost = false;
  if (body.roomCode) {
    const room = await getRoom(e.CACHE, body.roomCode);
    if (!room) return new Response("Room not found", { status: 404 });
    if (room.visibility === "private") {
      if (room.hostUserId !== session.user.id) {
        return new Response("Only host reports private rooms", { status: 403 });
      }
      isPrivateHost = true;
    }
    const memberIds = new Set(room.slots.map((s) => s.userId));
    for (const id of userIds) {
      if (!memberIds.has(id)) return new Response("Non-member in results", { status: 400 });
    }
  }

  if (body.roomCode && !isPrivateHost) {
    const outcome = await reportCooperative(
      e.CACHE,
      body.roomCode,
      body.matchId,
      session.user.id,
      body.results,
    );
    if (outcome === "stored") return Response.json({ status: "pending" });
    if (outcome === "mismatch") {
      track({ name: "match.bulk_dropped", game: body.game, reason: "mismatch" });
      return Response.json({ status: "dropped", reason: "mismatch" });
    }
    if (outcome === "timeout") {
      track({ name: "match.bulk_dropped", game: body.game, reason: "timeout" });
      return Response.json({ status: "dropped", reason: "timeout" });
    }
    // outcome === "confirmed" → fall through to commit
  }

  const db = getDb();
  for (const id of userIds) {
    const [u] = await db.select().from(userTable).where(eq(userTable.id, id));
    if (!u || !u.emailVerified) {
      return new Response(`User ${id} must be email-verified to rank`, { status: 403 });
    }
  }

  for (const pair of body.results) {
    const winnerRating = await getOrCreateRating(db, pair.winnerId, body.game);
    const loserRating = await getOrCreateRating(db, pair.loserId, body.game);
    const elo = computeElo({
      winnerElo: winnerRating.elo,
      loserElo: loserRating.elo,
      winnerMatches: winnerRating.matchesPlayed,
      loserMatches: loserRating.matchesPlayed,
      wasTie: !!pair.wasTie,
    });

    await db.insert(matches).values({
      id: crypto.randomUUID(),
      game: body.game,
      winnerId: pair.wasTie ? null : pair.winnerId,
      loserId: pair.wasTie ? null : pair.loserId,
      wasTie: !!pair.wasTie,
      winnerEloDelta: elo.winnerDelta,
      loserEloDelta: elo.loserDelta,
    });

    await db
      .update(ratings)
      .set({
        elo: winnerRating.elo + elo.winnerDelta,
        matchesPlayed: winnerRating.matchesPlayed + 1,
        wins: (winnerRating.wins ?? 0) + (pair.wasTie ? 0 : 1),
        ties: (winnerRating.ties ?? 0) + (pair.wasTie ? 1 : 0),
        lastMatchAt: new Date(),
      })
      .where(and(eq(ratings.userId, pair.winnerId), eq(ratings.game, body.game)));

    await db
      .update(ratings)
      .set({
        elo: loserRating.elo + elo.loserDelta,
        matchesPlayed: loserRating.matchesPlayed + 1,
        losses: (loserRating.losses ?? 0) + (pair.wasTie ? 0 : 1),
        ties: (loserRating.ties ?? 0) + (pair.wasTie ? 1 : 0),
        lastMatchAt: new Date(),
      })
      .where(and(eq(ratings.userId, pair.loserId), eq(ratings.game, body.game)));
  }

  track({ name: "room.match_complete", game: body.game, n: N });
  return Response.json({ status: "confirmed", n: N });
}

async function getOrCreateRating(
  db: ReturnType<typeof getDb>,
  userId: string,
  game: GameId,
): Promise<{ elo: number; matchesPlayed: number; wins: number; losses: number; ties: number }> {
  const [row] = await db
    .select()
    .from(ratings)
    .where(and(eq(ratings.userId, userId), eq(ratings.game, game)));
  if (row) return row;
  await db.insert(ratings).values({
    userId, game, elo: STARTING_ELO,
    matchesPlayed: 0, wins: 0, losses: 0, ties: 0,
  });
  return { elo: STARTING_ELO, matchesPlayed: 0, wins: 0, losses: 0, ties: 0 };
}
