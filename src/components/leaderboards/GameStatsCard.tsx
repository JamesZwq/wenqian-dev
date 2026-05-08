import Link from "next/link";
import { GAMES } from "@/lib/leaderboards/games";
import type { GameId } from "@/db/schema/leaderboards";

export interface GameStat {
  game: GameId;
  bestValue: number | null;
  format: "time_ms" | "score" | "elo";
  rank: number | null;
  totalPlays: number;
}

function fmt(format: GameStat["format"], v: number | null): string {
  if (v === null) return "—";
  if (format === "time_ms") {
    const totalSec = v / 1000;
    const m = Math.floor(totalSec / 60);
    const s = (totalSec - m * 60).toFixed(1);
    return m > 0 ? `${m}:${s.padStart(4, "0")}` : `${s}s`;
  }
  return String(v);
}

export function GameStatsCard({ stat }: { stat: GameStat }) {
  return (
    <Link
      href={`/leaderboards/${stat.game}`}
      prefetch={false}
      className="block rounded-xl border-2 p-3 transition-transform hover:scale-[1.02]"
      style={{ background: "var(--pixel-card-bg)", borderColor: "var(--pixel-border)" }}
    >
      <div className="font-sans text-sm font-semibold" style={{ color: "var(--pixel-text)" }}>
        {GAMES[stat.game].label}
      </div>
      <div className="mt-2 flex items-baseline justify-between font-mono text-xs">
        <span style={{ color: "var(--pixel-muted)" }}>BEST</span>
        <span style={{ color: "var(--pixel-accent)" }}>{fmt(stat.format, stat.bestValue)}</span>
      </div>
      <div className="flex items-baseline justify-between font-mono text-xs">
        <span style={{ color: "var(--pixel-muted)" }}>RANK</span>
        <span style={{ color: "var(--pixel-text)" }}>
          {stat.rank ? `#${stat.rank}` : "—"}
        </span>
      </div>
      <div className="flex items-baseline justify-between font-mono text-xs">
        <span style={{ color: "var(--pixel-muted)" }}>PLAYS</span>
        <span style={{ color: "var(--pixel-text)" }}>{stat.totalPlays}</span>
      </div>
    </Link>
  );
}
