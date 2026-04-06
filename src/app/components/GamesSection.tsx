"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Gamepad2 } from "lucide-react";

// ── Game registry ──────────────────────────────────────────
type Game = {
  href: string;
  name: string;
  desc: string;
  badge: string;
  accent: string;
  glow: string;
  iconFile?: string; // filename inside /public/games/
};

const GAMES: Game[] = [
  { href: "/gomoku",      name: "Gomoku",        desc: "Five in a Row",          badge: "P2P",    accent: "#6366f1", glow: "rgba(99,102,241,0.5)"  },
  { href: "/maze",        name: "Maze Runner",   desc: "P2P race + items",       badge: "Race",   accent: "#f97316", glow: "rgba(249,115,22,0.5)",  iconFile: "maze-1-svgrepo-com.svg"     },
  { href: "/math",        name: "Math Sprint",   desc: "Speed arithmetic",       badge: "Solo",   accent: "#10b981", glow: "rgba(16,185,129,0.5)",  iconFile: "math-svgrepo-com.svg"       },
  { href: "/flash-count", name: "Flash Count",   desc: "Count 3D blocks",        badge: "Memory", accent: "#3b82f6", glow: "rgba(59,130,246,0.5)",  iconFile: "cube-svgrepo-com.svg"       },
  { href: "/poker",       name: "Texas Hold'em", desc: "P2P poker",              badge: "Poker",  accent: "#ef4444", glow: "rgba(239,68,68,0.5)",   iconFile: "clovers-poker-svgrepo-com.svg" },
  { href: "/sudoku",      name: "Sudoku",        desc: "Solo or P2P race",       badge: "Puzzle", accent: "#8b5cf6", glow: "rgba(139,92,246,0.5)",  iconFile: "sudoku-svgrepo-com.svg"     },
  { href: "/halli-galli", name: "Halli Galli",   desc: "Ring at 5 fruits",       badge: "Party",  accent: "#f59e0b", glow: "rgba(245,158,11,0.5)",  iconFile: "bell-svgrepo-com.svg"       },
  { href: "/chat",        name: "P2P Chat",      desc: "Encrypted, no server",   badge: "Chat",   accent: "#14b8a6", glow: "rgba(20,184,166,0.5)",  iconFile: "chat-round-dots-svgrepo-com.svg" },
];

// ── Gomoku custom inline SVG ───────────────────────────────
function GomokuIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
      <line x1="4"  y1="4"  x2="4"  y2="20" stroke="white" strokeWidth="1" opacity="0.4" />
      <line x1="9"  y1="4"  x2="9"  y2="20" stroke="white" strokeWidth="1" opacity="0.4" />
      <line x1="14" y1="4"  x2="14" y2="20" stroke="white" strokeWidth="1" opacity="0.4" />
      <line x1="19" y1="4"  x2="19" y2="20" stroke="white" strokeWidth="1" opacity="0.4" />
      <line x1="4"  y1="7"  x2="20" y2="7"  stroke="white" strokeWidth="1" opacity="0.4" />
      <line x1="4"  y1="12" x2="20" y2="12" stroke="white" strokeWidth="1" opacity="0.4" />
      <line x1="4"  y1="17" x2="20" y2="17" stroke="white" strokeWidth="1" opacity="0.4" />
      <circle cx="4"  cy="17" r="2.2" fill="white" />
      <circle cx="9"  cy="12" r="2.2" fill="white" />
      <circle cx="14" cy="7"  r="2.2" fill="white" />
      <circle cx="9"  cy="17" r="2.2" fill="none" stroke="white" strokeWidth="1.4" />
      <circle cx="14" cy="12" r="2.2" fill="none" stroke="white" strokeWidth="1.4" />
      <circle cx="4"  cy="12" r="2.2" fill="none" stroke="white" strokeWidth="1.4" />
    </svg>
  );
}

// ── Card component (no animation yet) ─────────────────────
function GameCard({ game, index: _index }: { game: Game; index: number }) {
  return (
    <Link href={game.href} className="block" style={{ width: 152, flexShrink: 0 }}>
      <div
        style={{
          width: 152,
          height: 241,
          borderRadius: 18,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
        }}
      >
        {/* icon zone */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* glow orb */}
          <div
            style={{
              position: "absolute",
              width: 90, height: 90,
              borderRadius: "50%",
              background: game.accent,
              filter: "blur(28px)",
              opacity: 0.25,
              pointerEvents: "none",
            }}
          />
          {/* icon box */}
          <div
            style={{
              width: 62, height: 62,
              borderRadius: 16,
              background: game.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              zIndex: 1,
              boxShadow: `0 4px 20px ${game.glow}`,
            }}
          >
            {game.iconFile ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/games/${game.iconFile}`}
                alt={game.name}
                width={30}
                height={30}
                style={{ filter: "brightness(0) invert(1)" }}
              />
            ) : (
              <GomokuIcon />
            )}
          </div>
        </div>

        {/* info zone */}
        <div
          style={{
            padding: "12px 14px 13px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(0,0,0,0.20)",
          }}
        >
          <p
            className="font-sans font-bold"
            style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", marginBottom: 4, lineHeight: 1.2 }}
          >
            {game.name}
          </p>
          <p
            className="font-mono"
            style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", lineHeight: 1.3, marginBottom: 8 }}
          >
            {game.desc}
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              className="font-mono"
              style={{
                fontSize: 9,
                color: game.accent,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.04)",
                padding: "1px 6px",
                borderRadius: 4,
                letterSpacing: "0.04em",
              }}
            >
              {game.badge}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Section ────────────────────────────────────────────────
export default function GamesSection() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="mb-16 sm:mb-24"
    >
      {/* Section header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="flex items-center gap-4 mb-10"
      >
        <div className="p-2 rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-bg)] text-[var(--pixel-accent)]">
          <Gamepad2 size={20} />
        </div>
        <h2 className="font-sans text-base md:text-lg font-bold text-[var(--pixel-accent)] tracking-tight uppercase">
          Play Games
        </h2>
      </motion.div>

      {/* Card grid */}
      <div className="flex flex-wrap gap-3 sm:gap-4">
        {GAMES.map((game, i) => (
          <GameCard key={game.href} game={game} index={i} />
        ))}
      </div>
    </motion.section>
  );
}
