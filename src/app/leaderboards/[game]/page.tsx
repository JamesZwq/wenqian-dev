"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GAMES } from "@/lib/leaderboards/games";
import type { GameId } from "@/db/schema/leaderboards";
import type { TimeSlice } from "@/lib/leaderboards/time-slice";
import { TimeTabs } from "@/components/leaderboards/TimeTabs";
import { LeaderboardTable, type ScoreRow } from "@/components/leaderboards/LeaderboardTable";

interface ApiResp {
  kind: "score" | "elo";
  rows: (ScoreRow & { elo?: number })[];
  metric?: "time_ms" | "score";
  viewer: string | null;
}

export default function LeaderboardGamePage({ params }: { params: Promise<{ game: string }> }) {
  const router = useRouter();
  const [game, setGame] = useState<GameId | null>(null);
  const [slice, setSlice] = useState<TimeSlice>("week");
  const [data, setData] = useState<ApiResp | null>(null);

  useEffect(() => {
    params.then(({ game }) => {
      if (!(game in GAMES)) {
        router.replace("/leaderboards");
        return;
      }
      setGame(game as GameId);
    });
  }, [params, router]);

  useEffect(() => {
    if (!game) return;
    let cancelled = false;
    fetch(`/api/leaderboard/${game}?slice=${slice}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled) setData(j); });
    return () => { cancelled = true; };
  }, [game, slice]);

  if (!game) return null;
  const meta = GAMES[game];
  const format: "time_ms" | "score" | "elo" =
    data?.kind === "elo" ? "elo" : (data?.metric ?? meta.metric);
  const rows: ScoreRow[] = (data?.rows ?? []).map((r) => ({
    ...r,
    value: data?.kind === "elo" ? (r.elo as number) : r.value,
  }));

  return (
    <div className="min-h-screen px-4 py-12 flex justify-center">
      <div className="w-full max-w-3xl">
        <h1 className="font-sans text-3xl font-bold mb-1" style={{ color: "var(--pixel-text)" }}>
          {meta.label}
        </h1>
        <p className="font-mono text-xs mb-6" style={{ color: "var(--pixel-muted)" }}>
          {data?.kind === "elo" ? "ELO ranking" : `Top by ${format}`}
        </p>
        <div className="mb-4">
          <TimeTabs value={slice} onChange={setSlice} />
        </div>
        <LeaderboardTable rows={rows} format={format} viewerId={data?.viewer ?? null} />
      </div>
    </div>
  );
}
