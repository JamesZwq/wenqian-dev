import { desc, eq, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { user as userTable } from "@/db/schema/auth";
import { ratings, matches, scores, GAME_IDS } from "@/db/schema/leaderboards";

export async function GET(_req: Request, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  const canonical = username.toLowerCase();
  const db = getDb();

  const [u] = await db.select().from(userTable).where(eq(userTable.username, canonical));
  if (!u) return new Response("Not found", { status: 404 });

  const userRatings = await db.select().from(ratings).where(eq(ratings.userId, u.id));

  // Pull recent solo scores; per-game best gets reduced client-side / on profile page.
  const personalBests = await db
    .select()
    .from(scores)
    .where(eq(scores.userId, u.id))
    .orderBy(desc(scores.playedAt))
    .limit(GAME_IDS.length * 5);

  const recentMatches = await db
    .select()
    .from(matches)
    .where(or(eq(matches.winnerId, u.id), eq(matches.loserId, u.id)))
    .orderBy(desc(matches.playedAt))
    .limit(10);

  return Response.json({
    user: {
      id: u.id,
      username: u.username,
      displayUsername: u.displayUsername,
      name: u.name,
      image: u.image,
      memberSince: u.createdAt,
    },
    ratings: userRatings,
    scores: personalBests,
    recentMatches,
  });
}
