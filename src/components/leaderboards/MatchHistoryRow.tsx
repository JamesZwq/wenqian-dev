import { GAMES } from "@/lib/leaderboards/games";
import type { GameId } from "@/db/schema/leaderboards";

export interface MatchHistoryEntry {
  id: string;
  game: GameId;
  result: "win" | "loss" | "tie";
  eloDelta: number;
  opponentDisplay: string;
  playedAt: Date | string;
}

const COLOR = { win: "#22c55e", loss: "#ef4444", tie: "var(--pixel-muted)" } as const;

export function MatchHistoryRow({ entry }: { entry: MatchHistoryEntry }) {
  const when = new Date(entry.playedAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" });
  const sign = entry.eloDelta > 0 ? "+" : "";
  return (
    <li
      className="flex items-center gap-3 px-3 py-2 border-b font-mono text-xs"
      style={{ borderColor: "var(--pixel-border)" }}
    >
      <span className="w-12 font-semibold" style={{ color: COLOR[entry.result] }}>
        {entry.result.toUpperCase()}
      </span>
      <span className="flex-1" style={{ color: "var(--pixel-text)" }}>
        {GAMES[entry.game].label} <span style={{ color: "var(--pixel-muted)" }}>vs {entry.opponentDisplay}</span>
      </span>
      <span style={{ color: COLOR[entry.result] }}>
        {sign}
        {entry.eloDelta}
      </span>
      <span className="w-32 text-right" style={{ color: "var(--pixel-muted)" }}>
        {when}
      </span>
    </li>
  );
}
