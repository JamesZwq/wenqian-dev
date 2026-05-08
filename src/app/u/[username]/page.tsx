import { notFound } from "next/navigation";
import Image from "next/image";
import { and, desc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { user as userTable } from "@/db/schema/auth";
import { ratings, scores, matches, type GameId } from "@/db/schema/leaderboards";
import { GAMES, lowerIsBetter } from "@/lib/leaderboards/games";
import { InitialsAvatar } from "@/components/auth/InitialsAvatar";
import { GameStatsCard, type GameStat } from "@/components/leaderboards/GameStatsCard";
import { MatchHistoryRow } from "@/components/leaderboards/MatchHistoryRow";

export default async function PublicProfilePage({
  params,
}: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const db = getDb();
  const [u] = await db.select().from(userTable).where(eq(userTable.username, username.toLowerCase()));
  if (!u || !u.username) notFound();

  const userScores = await db.select().from(scores).where(eq(scores.userId, u.id));
  const userRatings = await db.select().from(ratings).where(eq(ratings.userId, u.id));
  const recent = await db
    .select()
    .from(matches)
    .where(or(eq(matches.winnerId, u.id), eq(matches.loserId, u.id)))
    .orderBy(desc(matches.playedAt))
    .limit(10);

  const stats: GameStat[] = [];
  for (const meta of Object.values(GAMES)) {
    if (meta.p2pOnly || meta.hybrid) {
      const r = userRatings.find((x) => x.game === meta.id);
      if (r) {
        const [rankRow] = await db
          .select({ rank: sql<number>`count(*) + 1` })
          .from(ratings)
          .where(and(eq(ratings.game, meta.id), gt(ratings.elo, r.elo)));
        stats.push({
          game: meta.id,
          format: "elo",
          bestValue: r.elo,
          rank: rankRow?.rank ?? null,
          totalPlays: r.matchesPlayed,
        });
      }
    }
    if (!meta.p2pOnly) {
      const soloScores = userScores.filter((s) => s.game === meta.id && s.mode === "solo");
      if (soloScores.length > 0) {
        const best = lowerIsBetter(meta.metric)
          ? Math.min(...soloScores.map((s) => s.value))
          : Math.max(...soloScores.map((s) => s.value));
        stats.push({
          game: meta.id,
          format: meta.metric,
          bestValue: best,
          rank: null,
          totalPlays: soloScores.length,
        });
      }
    }
  }

  const opponentIds = recent
    .flatMap((m) => [m.winnerId, m.loserId])
    .filter((x): x is string => !!x && x !== u.id);
  const opponents = opponentIds.length > 0
    ? await db.select().from(userTable).where(inArray(userTable.id, opponentIds))
    : [];
  const oppName = (id: string | null): string =>
    id ? opponents.find((o) => o.id === id)?.displayUsername ?? "anonymous" : "anonymous";

  return (
    <div className="min-h-screen px-4 py-12 flex justify-center">
      <div className="w-full max-w-3xl">
        <header className="flex items-center gap-4 mb-8">
          {u.image ? (
            <Image src={u.image} alt={u.displayUsername ?? u.username} width={72} height={72} className="rounded-full" />
          ) : (
            <InitialsAvatar name={u.displayUsername ?? u.username} size={72} />
          )}
          <div>
            <div className="font-sans text-2xl font-bold" style={{ color: "var(--pixel-text)" }}>
              @{u.username}
            </div>
            <div className="font-mono text-sm" style={{ color: "var(--pixel-muted)" }}>
              {u.displayUsername ?? u.name}
            </div>
          </div>
        </header>

        <h2 className="font-sans text-sm font-semibold tracking-widest mb-3" style={{ color: "var(--pixel-accent)" }}>
          PER-GAME STATS
        </h2>
        {stats.length === 0 ? (
          <p className="font-mono text-xs mb-8" style={{ color: "var(--pixel-muted)" }}>No tracked plays yet.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {stats.map((s) => <li key={s.game}><GameStatsCard stat={s} /></li>)}
          </ul>
        )}

        <h2 className="font-sans text-sm font-semibold tracking-widest mb-3" style={{ color: "var(--pixel-accent)" }}>
          RECENT MATCHES
        </h2>
        {recent.length === 0 ? (
          <p className="font-mono text-xs" style={{ color: "var(--pixel-muted)" }}>No matches yet.</p>
        ) : (
          <ul>
            {recent.map((m) => {
              const won = m.winnerId === u.id;
              const result: "win" | "loss" | "tie" = m.wasTie ? "tie" : won ? "win" : "loss";
              const eloDelta = m.wasTie ? m.winnerEloDelta : (won ? m.winnerEloDelta : m.loserEloDelta);
              const opp = oppName(won ? m.loserId : m.winnerId);
              return (
                <MatchHistoryRow
                  key={m.id}
                  entry={{
                    id: m.id,
                    game: m.game as GameId,
                    result,
                    eloDelta,
                    opponentDisplay: opp,
                    playedAt: m.playedAt,
                  }}
                />
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
