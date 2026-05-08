import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { getDb } from "@/db/client";
import {
  scores,
  GAME_IDS,
  SCORE_METRICS,
  SCORE_MODES,
  type GameId,
  type ScoreMetric,
  type ScoreMode,
} from "@/db/schema/leaderboards";
import { withinBounds } from "@/lib/leaderboards/bounds";
import { track } from "@/lib/analytics";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if (!session.user.emailVerified) {
    return new Response("Verified email required", { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    game: GameId;
    mode: ScoreMode;
    metric: ScoreMetric;
    value: number;
  }>;

  if (!body.game || !GAME_IDS.includes(body.game)) {
    return new Response("Bad game", { status: 400 });
  }
  if (!body.mode || !SCORE_MODES.includes(body.mode)) {
    return new Response("Bad mode", { status: 400 });
  }
  if (!body.metric || !SCORE_METRICS.includes(body.metric)) {
    return new Response("Bad metric", { status: 400 });
  }
  if (typeof body.value !== "number") {
    return new Response("Bad value", { status: 400 });
  }

  if (!withinBounds(body.game, body.metric, body.value)) {
    track({ name: "score.rejected", game: body.game, reason: "bounds" });
    return new Response("Out of bounds", { status: 400 });
  }

  const limit = await rateLimit(env().CACHE, {
    key: `score:${session.user.id}:${body.game}`,
    limit: 3,
    windowSec: 60,
  });
  if (!limit.ok) {
    track({ name: "score.rejected", game: body.game, reason: "rate-limit" });
    return new Response("Rate limit", { status: 429 });
  }

  await getDb().insert(scores).values({
    id: crypto.randomUUID(),
    userId: session.user.id,
    game: body.game,
    mode: body.mode,
    metric: body.metric,
    value: body.value,
  });

  track({ name: "score.submit", game: body.game, mode: body.mode });
  return new Response(null, { status: 204 });
}
