import { and, asc, desc, eq, gte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { getSession } from "@/lib/session";
import {
  scores,
  ratings,
  GAME_IDS,
  type GameId,
} from "@/db/schema/leaderboards";
import { user as userTable } from "@/db/schema/auth";
import { GAMES, lowerIsBetter } from "@/lib/leaderboards/games";
import { sliceStart, type TimeSlice } from "@/lib/leaderboards/time-slice";
import { track } from "@/lib/analytics";

const VALID_SLICES = ["today", "week", "month", "all"] as const;

export async function GET(req: Request, ctx: { params: Promise<{ game: string }> }) {
  const { game: gameRaw } = await ctx.params;
  if (!GAME_IDS.includes(gameRaw as GameId)) {
    return new Response("Unknown game", { status: 404 });
  }
  const game = gameRaw as GameId;
  const meta = GAMES[game];

  const url = new URL(req.url);
  const sliceRaw = (url.searchParams.get("slice") ?? "week") as TimeSlice;
  const mode = (url.searchParams.get("mode") ?? "solo") as "solo" | "p2p";
  if (!VALID_SLICES.includes(sliceRaw)) {
    return new Response("Bad slice", { status: 400 });
  }

  const session = await getSession();
  const db = getDb();
  const since = sliceStart(sliceRaw, Date.now());

  // ELO leaderboard for P2P-only games and hybrid p2p mode.
  const useElo = meta.p2pOnly || (meta.hybrid && mode === "p2p");

  if (useElo) {
    const rows = await db
      .select({
        userId: ratings.userId,
        elo: ratings.elo,
        matchesPlayed: ratings.matchesPlayed,
        wins: ratings.wins,
        losses: ratings.losses,
        ties: ratings.ties,
        username: userTable.username,
        displayUsername: userTable.displayUsername,
        image: userTable.image,
        name: userTable.name,
      })
      .from(ratings)
      .leftJoin(userTable, eq(userTable.id, ratings.userId))
      .where(eq(ratings.game, game))
      .orderBy(desc(ratings.elo))
      .limit(100);
    track({ name: "leaderboard.view", game, slice: sliceRaw });
    return Response.json({
      kind: "elo",
      game,
      slice: sliceRaw,
      mode,
      rows,
      viewer: session?.user?.id ?? null,
    });
  }

  const order = lowerIsBetter(meta.metric) ? asc(scores.value) : desc(scores.value);
  const rows = await db
    .select({
      userId: scores.userId,
      value: scores.value,
      playedAt: scores.playedAt,
      username: userTable.username,
      displayUsername: userTable.displayUsername,
      image: userTable.image,
      name: userTable.name,
    })
    .from(scores)
    .leftJoin(userTable, eq(userTable.id, scores.userId))
    .where(and(eq(scores.game, game), eq(scores.mode, mode), gte(scores.playedAt, new Date(since))))
    .orderBy(order)
    .limit(100);

  track({ name: "leaderboard.view", game, slice: sliceRaw });
  return Response.json({
    kind: "score",
    game,
    slice: sliceRaw,
    mode,
    metric: meta.metric,
    rows,
    viewer: session?.user?.id ?? null,
  });
}
