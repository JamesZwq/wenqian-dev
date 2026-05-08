"use client";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { InitialsAvatar } from "@/components/auth/InitialsAvatar";

export interface ScoreRow {
  userId: string | null;
  username: string | null;
  displayUsername: string | null;
  name: string | null;
  image: string | null;
  value: number;
}

export interface LeaderboardTableProps {
  rows: ScoreRow[];
  format: "time_ms" | "score" | "elo";
  viewerId: string | null;
  emptyText?: string;
}

function formatValue(format: LeaderboardTableProps["format"], v: number): string {
  if (format === "time_ms") {
    const totalSec = v / 1000;
    const m = Math.floor(totalSec / 60);
    const s = (totalSec - m * 60).toFixed(1);
    return m > 0 ? `${m}:${s.padStart(4, "0")}` : `${s}s`;
  }
  return String(v);
}

export function LeaderboardTable({ rows, format, viewerId, emptyText }: LeaderboardTableProps) {
  if (rows.length === 0) {
    return (
      <p className="font-mono text-xs text-center py-8" style={{ color: "var(--pixel-muted)" }}>
        {emptyText ?? "No scores yet — be the first."}
      </p>
    );
  }
  return (
    <ol className="space-y-1">
      {rows.map((row, i) => {
        const isViewer = row.userId !== null && row.userId === viewerId;
        const display = row.displayUsername || row.name || "anonymous";
        const isAnon = row.userId === null;
        return (
          <motion.li
            key={`${row.userId ?? "anon"}-${i}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(i * 0.015, 0.4) }}
            className="flex items-center gap-3 rounded-lg px-3 py-2"
            style={{
              background: isViewer
                ? "color-mix(in oklab, var(--pixel-accent) 14%, transparent)"
                : "transparent",
              border: isViewer ? "1px solid var(--pixel-accent)" : "1px solid transparent",
            }}
          >
            <span
              className="w-8 text-right font-mono text-xs"
              style={{ color: i < 3 ? "var(--pixel-accent)" : "var(--pixel-muted)" }}
            >
              #{i + 1}
            </span>
            {row.image ? (
              <Image src={row.image} alt={display} width={28} height={28} className="rounded-full" />
            ) : (
              <InitialsAvatar name={display} size={28} />
            )}
            <span className="flex-1 font-sans text-sm truncate" style={{ color: "var(--pixel-text)" }}>
              {isAnon ? <em style={{ color: "var(--pixel-muted)" }}>anonymous</em> : (
                <Link href={`/u/${row.username}`} prefetch={false} style={{ color: "var(--pixel-text)" }}>
                  {display}
                </Link>
              )}
            </span>
            <span
              className="font-mono text-sm font-semibold"
              style={{ color: isViewer ? "var(--pixel-accent)" : "var(--pixel-text)" }}
            >
              {formatValue(format, row.value)}
            </span>
          </motion.li>
        );
      })}
    </ol>
  );
}
