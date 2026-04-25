"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { Gamepad2 } from "lucide-react";

// ── Game registry ──────────────────────────────────────────
type Game = {
  href: string;
  name: string;
  desc: string;
  badge: string;
  accent: string;
  glow: string;
  iconFile?: string;
};

const GAMES: Game[] = [
  { href: "/gomoku",      name: "Gomoku",        desc: "Five in a Row",          badge: "P2P",    accent: "#6366f1", glow: "rgba(99,102,241,0.5)"  },
  { href: "/maze",        name: "Maze Runner",   desc: "P2P race + items",       badge: "Race",   accent: "#f97316", glow: "rgba(249,115,22,0.5)",  iconFile: "maze-1-svgrepo-com.svg"     },
  { href: "/math",        name: "Math Sprint",   desc: "Speed arithmetic",       badge: "Solo",   accent: "#10b981", glow: "rgba(16,185,129,0.5)",  iconFile: "math-svgrepo-com.svg"       },
  { href: "/flash-count", name: "Flash Count",   desc: "Count 3D blocks",        badge: "Memory", accent: "#3b82f6", glow: "rgba(59,130,246,0.5)",  iconFile: "cube-svgrepo-com.svg"       },
  { href: "/pulse-duel",  name: "Pulse Duel",    desc: "Lag-aware mind game",    badge: "Duel",   accent: "#ef4444", glow: "rgba(239,68,68,0.45)",  iconFile: "pulse-duel-svgrepo-custom.svg" },
  { href: "/poker",       name: "Texas Hold'em", desc: "P2P poker",              badge: "Poker",  accent: "#ef4444", glow: "rgba(239,68,68,0.5)",   iconFile: "clovers-poker-svgrepo-com.svg" },
  { href: "/sudoku",      name: "Sudoku",        desc: "Solo or P2P race",       badge: "Puzzle", accent: "#8b5cf6", glow: "rgba(139,92,246,0.5)",  iconFile: "sudoku-svgrepo-com.svg"     },
  { href: "/schulte",     name: "Schulte",       desc: "Reaction speed test",    badge: "Speed",  accent: "#ec4899", glow: "rgba(236,72,153,0.5)"  },
  { href: "/trail",       name: "Trail Making",  desc: "1, A, 2, B sequence",    badge: "Focus",  accent: "#22d3ee", glow: "rgba(34,211,238,0.5)"  },
  { href: "/reaction",    name: "Reaction",      desc: "F1-style reaction test", badge: "Reflex", accent: "#84cc16", glow: "rgba(132,204,22,0.5)"  },
  { href: "/pattern",     name: "Pattern",       desc: "Simon Says memory",      badge: "Memory", accent: "#a855f7", glow: "rgba(168,85,247,0.5)"  },
  { href: "/halli-galli", name: "Halli Galli",   desc: "Ring at 5 fruits",       badge: "Party",  accent: "#f59e0b", glow: "rgba(245,158,11,0.5)",  iconFile: "bell-svgrepo-com.svg"       },
  { href: "/chat",        name: "P2P Chat",      desc: "Encrypted, no server",   badge: "Chat",   accent: "#14b8a6", glow: "rgba(20,184,166,0.5)",  iconFile: "chat-round-dots-svgrepo-com.svg" },
];

const TOTAL = GAMES.length;
const FAN_SPREAD = 56;

function getFanAngle(index: number) {
  return -FAN_SPREAD / 2 + index * (FAN_SPREAD / (TOTAL - 1));
}

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

// ── Schulte custom inline SVG ──────────────────────────────
function SchulteIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
      {/* 3x3 grid outline */}
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="white" strokeWidth="1.4" fill="none" opacity="0.4"/>
      <line x1="9" y1="3" x2="9" y2="21" stroke="white" strokeWidth="1" opacity="0.4"/>
      <line x1="15" y1="3" x2="15" y2="21" stroke="white" strokeWidth="1" opacity="0.4"/>
      <line x1="3" y1="9" x2="21" y2="9" stroke="white" strokeWidth="1" opacity="0.4"/>
      <line x1="3" y1="15" x2="21" y2="15" stroke="white" strokeWidth="1" opacity="0.4"/>
      {/* Some highlighted numbers in sequence — shown with scrambled positions */}
      <text x="6" y="8" fontSize="5" fill="white" fontWeight="700" textAnchor="middle" dominantBaseline="central">3</text>
      <text x="12" y="8" fontSize="5" fill="white" fontWeight="700" textAnchor="middle" dominantBaseline="central">7</text>
      <text x="18" y="8" fontSize="5" fill="white" fontWeight="700" textAnchor="middle" dominantBaseline="central">1</text>
      <text x="6" y="14" fontSize="5" fill="white" fontWeight="700" textAnchor="middle" dominantBaseline="central">9</text>
      <text x="12" y="14" fontSize="5" fill="white" fontWeight="700" textAnchor="middle" dominantBaseline="central">2</text>
      <text x="18" y="14" fontSize="5" fill="white" fontWeight="700" textAnchor="middle" dominantBaseline="central">5</text>
      <text x="6" y="20" fontSize="5" fill="white" fontWeight="700" textAnchor="middle" dominantBaseline="central">8</text>
      <text x="12" y="20" fontSize="5" fill="white" fontWeight="700" textAnchor="middle" dominantBaseline="central">4</text>
      <text x="18" y="20" fontSize="5" fill="white" fontWeight="700" textAnchor="middle" dominantBaseline="central">6</text>
    </svg>
  );
}

// ── Trail Making custom inline SVG (numbers + letters mixed) ──
function TrailIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="white" strokeWidth="1.2" fill="none" opacity="0.4"/>
      <line x1="9" y1="3" x2="9" y2="21" stroke="white" strokeWidth="0.8" opacity="0.4"/>
      <line x1="15" y1="3" x2="15" y2="21" stroke="white" strokeWidth="0.8" opacity="0.4"/>
      <line x1="3" y1="9" x2="21" y2="9" stroke="white" strokeWidth="0.8" opacity="0.4"/>
      <line x1="3" y1="15" x2="21" y2="15" stroke="white" strokeWidth="0.8" opacity="0.4"/>
      <text x="6"  y="6.5"  fontSize="4.5" fill="white" fontWeight="700" textAnchor="middle" dominantBaseline="central">1</text>
      <text x="12" y="6.5"  fontSize="4.5" fill="white" fontWeight="700" textAnchor="middle" dominantBaseline="central">B</text>
      <text x="18" y="6.5"  fontSize="4.5" fill="white" fontWeight="700" textAnchor="middle" dominantBaseline="central">3</text>
      <text x="6"  y="12"   fontSize="4.5" fill="white" fontWeight="700" textAnchor="middle" dominantBaseline="central">A</text>
      <text x="12" y="12"   fontSize="4.5" fill="white" fontWeight="700" textAnchor="middle" dominantBaseline="central">2</text>
      <text x="18" y="12"   fontSize="4.5" fill="white" fontWeight="700" textAnchor="middle" dominantBaseline="central">D</text>
      <text x="6"  y="17.5" fontSize="4.5" fill="white" fontWeight="700" textAnchor="middle" dominantBaseline="central">C</text>
      <text x="12" y="17.5" fontSize="4.5" fill="white" fontWeight="700" textAnchor="middle" dominantBaseline="central">4</text>
      <text x="18" y="17.5" fontSize="4.5" fill="white" fontWeight="700" textAnchor="middle" dominantBaseline="central">5</text>
    </svg>
  );
}

// ── Reaction Light custom inline SVG (5 horizontal lights) ───
function ReactionIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
      <circle cx="3.5"  cy="10" r="1.7" fill="white" opacity="0.95"/>
      <circle cx="8.25" cy="10" r="1.7" fill="white" opacity="0.95"/>
      <circle cx="13"   cy="10" r="1.7" fill="white" opacity="0.95"/>
      <circle cx="17.75" cy="10" r="1.7" fill="white" opacity="0.55"/>
      <circle cx="22.5" cy="10" r="1.7" fill="none" stroke="white" strokeWidth="0.8" opacity="0.5"/>
      <path d="M5 17 L19 17" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity="0.7"/>
      <path d="M16 14.5 L19 17 L16 19.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" fill="none"/>
    </svg>
  );
}

// ── Pattern Memory custom inline SVG (2x2 quadrants) ─────────
function PatternIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
      <rect x="3"  y="3"  width="8" height="8" rx="1.6" fill="white" opacity="0.95"/>
      <rect x="13" y="3"  width="8" height="8" rx="1.6" fill="white" opacity="0.4"/>
      <rect x="3"  y="13" width="8" height="8" rx="1.6" fill="white" opacity="0.4"/>
      <rect x="13" y="13" width="8" height="8" rx="1.6" fill="white" opacity="0.95"/>
    </svg>
  );
}

// ── Inner card visual (handles hover) ─────────────────────
function CardVisual({ game }: { game: Game }) {
  return (
    <motion.div
      whileHover={{
        y: -9,
        boxShadow: `0 0 20px ${game.glow}, 0 8px 32px ${game.glow}`,
        borderColor: game.accent,
      }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      style={{
        width: 152,
        height: 241,
        borderRadius: 18,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        border: `1px solid var(--pixel-border)`,
        background: "var(--pixel-card-bg)",
        backdropFilter: "blur(12px) saturate(140%)",
        WebkitBackdropFilter: "blur(12px) saturate(140%)",
        position: "relative",
        boxShadow: "none",
      }}
    >
      {/* shimmer top line */}
      <div
        style={{
          position: "absolute",
          top: 0, left: "12%", right: "12%",
          height: 1,
          background: "linear-gradient(90deg,transparent,color-mix(in oklab, var(--pixel-accent) 40%, transparent),transparent)",
          zIndex: 2,
        }}
      />

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
        <motion.div
          whileHover={{ scale: 1.12, rotate: -5 }}
          transition={{ type: "spring", stiffness: 320, damping: 20 }}
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
          ) : game.name === "Schulte" ? (
            <SchulteIcon />
          ) : game.name === "Trail Making" ? (
            <TrailIcon />
          ) : game.name === "Reaction" ? (
            <ReactionIcon />
          ) : game.name === "Pattern" ? (
            <PatternIcon />
          ) : (
            <GomokuIcon />
          )}
        </motion.div>
      </div>

      {/* info zone */}
      <div
        style={{
          padding: "12px 14px 13px",
          borderTop: "1px solid var(--pixel-border)",
          background: "color-mix(in oklab, var(--pixel-bg) 20%, transparent)",
        }}
      >
        <p
          className="font-sans font-bold"
          style={{ fontSize: 12, color: "var(--pixel-text)", marginBottom: 4, lineHeight: 1.2 }}
        >
          {game.name}
        </p>
        <p
          className="font-mono"
          style={{ fontSize: 10, color: "var(--pixel-muted)", lineHeight: 1.3, marginBottom: 8 }}
        >
          {game.desc}
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span
            className="font-mono"
            style={{
              fontSize: 9,
              color: game.accent,
              border: "1px solid var(--pixel-border)",
              background: "color-mix(in oklab, var(--pixel-accent) 10%, transparent)",
              padding: "1px 6px",
              borderRadius: 4,
              letterSpacing: "0.04em",
            }}
          >
            {game.badge}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Section ────────────────────────────────────────────────
export default function GamesSection() {
  const gridRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(gridRef, { once: true, amount: 0.1 });
  const [offsets, setOffsets] = useState<{ x: number; y: number }[] | null>(null);
  const [inFan, setInFan] = useState(true);

  // Measure grid cell positions → compute offsets to bring every card's
  // bottom-center to the grid's horizontal center / bottom edge.
  // useLayoutEffect fires before paint, so cards appear in fan on first frame.
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const cx = rect.width / 2;
    const cards = Array.from(grid.children) as HTMLElement[];
    setOffsets(
      cards.map((card) => {
        const cr = card.getBoundingClientRect();
        const cardCx = cr.left - rect.left + cr.width / 2;
        const cardBottom = cr.top - rect.top + cr.height;
        return {
          x: cx - cardCx,
          y: rect.height - cardBottom,
        };
      }),
    );
  }, []);

  // After scroll into view, wait 0.5s then scatter to grid
  useEffect(() => {
    if (isInView && inFan && offsets) {
      const timer = setTimeout(() => setInFan(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isInView, inFan, offsets]);

  return (
    <section id="games" className="mt-16 sm:mt-24 scroll-mt-8">
      {/* Section header */}
      <div className="flex items-center gap-4 mb-10">
        <div className="p-2 rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-bg)] text-[var(--pixel-accent)]">
          <Gamepad2 size={20} />
        </div>
        <h2 className="font-sans text-base md:text-lg font-bold text-[var(--pixel-accent)] tracking-tight uppercase">
          Play Games
        </h2>
      </div>

      {/* Grid is ALWAYS a grid — fan is achieved purely via transforms */}
      <div
        ref={gridRef}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 justify-items-center"
      >
        {GAMES.map((game, i) => (
          <motion.div
            key={game.href}
            animate={{
              x: inFan && offsets ? offsets[i].x : 0,
              y: inFan && offsets ? offsets[i].y : 0,
              rotate: inFan ? getFanAngle(i) : 0,
              scale: inFan ? 0.82 : 1,
            }}
            transition={{
              type: "spring",
              stiffness: 160,
              damping: 22,
              delay: inFan ? 0 : i * 0.06 + 0.08,
            }}
            style={{
              transformOrigin: "center bottom",
              zIndex: inFan ? i : undefined,
              visibility: offsets ? "visible" : "hidden",
            }}
          >
            <Link href={game.href} className="block">
              <CardVisual game={game} />
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
