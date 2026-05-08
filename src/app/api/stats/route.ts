import { desc, eq, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { getSession } from "@/lib/session";
import { ratings, matches, scores } from "@/db/schema/leaderboards";

export async function GET() {
  const session = await getSession();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const userId = session.user.id;
  const db = getDb();

  const [userRatings, userScores, recentMatches] = await Promise.all([
    db.select().from(ratings).where(eq(ratings.userId, userId)),
    db.select().from(scores).where(eq(scores.userId, userId)).orderBy(desc(scores.playedAt)).limit(100),
    db
      .select()
      .from(matches)
      .where(or(eq(matches.winnerId, userId), eq(matches.loserId, userId)))
      .orderBy(desc(matches.playedAt))
      .limit(10),
  ]);

  return Response.json({ ratings: userRatings, scores: userScores, recentMatches });
}
