import { ImageResponse } from "next/og";

export const runtime = "edge";

const interRegularPromise = fetch(
  new URL("./Inter-Regular.ttf", import.meta.url)
).then((r) => r.arrayBuffer());

const interBoldPromise = fetch(
  new URL("./Inter-Bold.ttf", import.meta.url)
).then((r) => r.arrayBuffer());

// ── Per-game visual config ─────────────────────────────────────────

type GameConfig = { accent: string; glow: string; bg: string };

function getConfig(title: string): GameConfig {
  const t = title.toLowerCase();
  if (t.includes("gomoku"))
    return {
      accent: "#818cf8",
      glow: "rgba(129,140,248,0.22)",
      bg: "linear-gradient(135deg, #0c0a1d 0%, #12102a 60%, #0a0820 100%)",
    };
  if (t.includes("texas") || t.includes("hold") || t.includes("poker"))
    return {
      accent: "#22c55e",
      glow: "rgba(34,197,94,0.18)",
      bg: "linear-gradient(135deg, #061409 0%, #0a1e0d 60%, #050f07 100%)",
    };
  if (t.includes("maze"))
    return {
      accent: "#10b981",
      glow: "rgba(16,185,129,0.2)",
      bg: "linear-gradient(135deg, #06101a 0%, #0a1628 60%, #04080f 100%)",
    };
  if (t.includes("math"))
    return {
      accent: "#f59e0b",
      glow: "rgba(245,158,11,0.22)",
      bg: "linear-gradient(135deg, #1a0e00 0%, #201200 60%, #100900 100%)",
    };
  if (t.includes("flash"))
    return {
      accent: "#06b6d4",
      glow: "rgba(6,182,212,0.22)",
      bg: "linear-gradient(135deg, #011825 0%, #022030 60%, #010e18 100%)",
    };
  if (t.includes("halli"))
    return {
      accent: "#eab308",
      glow: "rgba(234,179,8,0.2)",
      bg: "linear-gradient(135deg, #150f00 0%, #1a1200 60%, #0d0900 100%)",
    };
  if (t.includes("sudoku"))
    return {
      accent: "#8b5cf6",
      glow: "rgba(139,92,246,0.25)",
      bg: "linear-gradient(135deg, #0d0a1f 0%, #12102a 60%, #0a0820 100%)",
    };
  if (t.includes("chat") || t.includes("p2p"))
    return {
      accent: "#f97316",
      glow: "rgba(249,115,22,0.22)",
      bg: "linear-gradient(135deg, #1a0d00 0%, #201000 60%, #100800 100%)",
    };
  return {
    accent: "#818cf8",
    glow: "rgba(129,140,248,0.2)",
    bg: "linear-gradient(135deg, #0c0a1d 0%, #13112b 50%, #0e0c22 100%)",
  };
}

// ── Gomoku: 7×7 board with a diagonal 5-in-a-row ──────────────────

const GOMOKU_BOARD = [
  [0, 0, 0, 0, 0, 0, 0],
  [0, 1, 0, 2, 0, 0, 0],
  [0, 2, 1, 0, 2, 0, 0],
  [0, 0, 2, 1, 0, 2, 0],
  [0, 0, 0, 2, 1, 0, 0],
  [0, 0, 0, 0, 2, 1, 0],
  [0, 0, 0, 0, 0, 0, 0],
];
const GOMOKU_WIN = new Set(["1,1", "2,2", "3,3", "4,4", "5,5"]);

function GomokuVisual() {
  const SZ = 50;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "radial-gradient(ellipse at 35% 40%, #4a2f0a 0%, #2a1a06 100%)",
        borderRadius: 12,
        padding: 8,
        border: "2px solid rgba(160,120,20,0.4)",
      }}
    >
      {GOMOKU_BOARD.map((row, ri) => (
        <div key={ri} style={{ display: "flex" }}>
          {row.map((cell, ci) => {
            const isWin = GOMOKU_WIN.has(`${ri},${ci}`);
            return (
              <div
                key={ci}
                style={{
                  width: SZ,
                  height: SZ,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: "50%",
                    height: 1,
                    background: "rgba(160,120,20,0.55)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: "50%",
                    width: 1,
                    background: "rgba(160,120,20,0.55)",
                  }}
                />
                {cell !== 0 && (
                  <div
                    style={{
                      position: "relative",
                      zIndex: 1,
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      background:
                        cell === 1
                          ? "radial-gradient(circle at 32% 28%, #666, #0d0d0d)"
                          : "radial-gradient(circle at 32% 28%, #ffffff, #cccccc)",
                      border: isWin
                        ? "2px solid #ef4444"
                        : cell === 2
                        ? "1.5px solid #bbb"
                        : "none",
                    }}
                  />
                )}
                {isWin && (
                  <div
                    style={{
                      position: "absolute",
                      zIndex: 2,
                      width: 46,
                      height: 46,
                      borderRadius: 23,
                      border: "2px solid rgba(239,68,68,0.55)",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Poker: 2 hole cards + 3-card flop on casino felt ──────────────

function PokerCard({
  rank,
  suit,
  red,
  w = 82,
  h = 118,
}: {
  rank: string;
  suit: string;
  red: boolean;
  w?: number;
  h?: number;
}) {
  const color = red ? "#dc2626" : "#111827";
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 8,
        background: "linear-gradient(145deg, #fffef8, #f0ebe0)",
        border: "1px solid rgba(0,0,0,0.18)",
        display: "flex",
        flexDirection: "column",
        padding: "6px 8px",
        position: "relative",
      }}
    >
      <div style={{ color, fontSize: Math.round(w * 0.23), fontWeight: 700, lineHeight: 1 }}>
        {rank}
      </div>
      <div style={{ color, fontSize: Math.round(w * 0.2), lineHeight: 1 }}>{suit}</div>
      <div
        style={{
          position: "absolute",
          bottom: 6,
          right: 7,
          color,
          fontSize: Math.round(h * 0.22),
          lineHeight: 1,
          fontWeight: 700,
        }}
      >
        {suit}
      </div>
    </div>
  );
}

const HOLE_CARDS = [
  { rank: "A", suit: "♠", red: false },
  { rank: "K", suit: "♥", red: true },
];
const FLOP_CARDS = [
  { rank: "Q", suit: "♦", red: true },
  { rank: "7", suit: "♣", red: false },
  { rank: "J", suit: "♥", red: true },
];

function PokerVisual() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        background: "rgba(0,60,15,0.35)",
        border: "2px solid rgba(34,197,94,0.18)",
        borderRadius: 20,
        padding: "22px 26px",
      }}
    >
      <div
        style={{
          color: "rgba(255,255,255,0.35)",
          fontSize: 11,
          letterSpacing: "0.2em",
        }}
      >
        YOUR HAND
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        {HOLE_CARDS.map((c, i) => (
          <PokerCard key={i} rank={c.rank} suit={c.suit} red={c.red} w={90} h={130} />
        ))}
      </div>
      <div
        style={{
          width: "100%",
          height: 1,
          background: "rgba(34,197,94,0.15)",
          margin: "2px 0",
        }}
      />
      <div
        style={{
          color: "rgba(255,255,255,0.35)",
          fontSize: 11,
          letterSpacing: "0.2em",
        }}
      >
        THE FLOP
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {FLOP_CARDS.map((c, i) => (
          <PokerCard key={i} rank={c.rank} suit={c.suit} red={c.red} w={74} h={106} />
        ))}
      </div>
    </div>
  );
}

// ── Maze Runner: 9×9 top-down maze with highlighted path ───────────

const MAZE_GRID = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 1, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 1, 0, 0, 0, 1],
  [1, 1, 1, 0, 1, 0, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1, 0, 1],
  [1, 0, 0, 0, 1, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1],
];
const MAZE_PATH = new Set([
  "1,1","2,1","3,1","3,2","3,3","4,3","5,3","5,4","5,5","6,5","7,5","7,6","7,7",
]);

function MazeVisual() {
  const CELL = 34;
  return (
    <div style={{ display: "flex", flexDirection: "column", borderRadius: 6, overflow: "hidden" }}>
      {MAZE_GRID.map((row, ri) => (
        <div key={ri} style={{ display: "flex" }}>
          {row.map((cell, ci) => {
            const isPath = MAZE_PATH.has(`${ri},${ci}`);
            const isStart = ri === 1 && ci === 1;
            const isExit = ri === 7 && ci === 7;
            let bg = "transparent";
            if (cell === 1) bg = "#0d2540";
            else if (isExit) bg = "rgba(16,185,129,0.65)";
            else if (isStart) bg = "rgba(16,185,129,0.35)";
            else if (isPath) bg = "rgba(16,185,129,0.18)";
            return (
              <div
                key={ci}
                style={{
                  width: CELL,
                  height: CELL,
                  background: bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: isStart || isExit ? 16 : 0,
                  color: "#fff",
                }}
              >
                {isStart ? "▶" : isExit ? "★" : ""}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Math Sprint: equation display with timer bar ───────────────────

function MathSprintVisual() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          background: "rgba(245,158,11,0.07)",
          border: "1.5px solid rgba(245,158,11,0.32)",
          borderRadius: 16,
          padding: "18px 28px",
        }}
      >
        <div style={{ fontSize: 68, fontWeight: 700, color: "#fde68a", letterSpacing: "-0.03em" }}>
          47
        </div>
        <div style={{ fontSize: 58, fontWeight: 700, color: "#f59e0b" }}>+</div>
        <div style={{ fontSize: 68, fontWeight: 700, color: "#fde68a", letterSpacing: "-0.03em" }}>
          38
        </div>
        <div style={{ fontSize: 58, fontWeight: 700, color: "#f59e0b" }}>=</div>
        <div style={{ fontSize: 68, fontWeight: 700, color: "#fb923c" }}>?</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div
          style={{
            width: 250,
            height: 8,
            background: "rgba(245,158,11,0.15)",
            borderRadius: 4,
            display: "flex",
          }}
        >
          <div
            style={{ width: "62%", height: "100%", background: "#f59e0b", borderRadius: 4 }}
          />
        </div>
        <div
          style={{ color: "rgba(245,158,11,0.45)", fontSize: 11, letterSpacing: "0.18em" }}
        >
          TIME PRESSURE
        </div>
      </div>
      <div style={{ display: "flex", gap: 22, opacity: 0.25 }}>
        {["+", "−", "×", "÷"].map((op, i) => (
          <div key={i} style={{ color: "#f59e0b", fontSize: 28, fontWeight: 700 }}>
            {op}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Flash Count: stacked 3D-style block columns ────────────────────

const FC_STACKS = [3, 5, 2, 4, 6];
const FC_COLORS = ["#22d3ee", "#06b6d4", "#0891b2", "#0e7490", "#155e75"];

function FlashCountVisual() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        {FC_STACKS.map((height, si) => (
          <div
            key={si}
            style={{ display: "flex", flexDirection: "column-reverse", gap: 3 }}
          >
            {Array.from({ length: height }).map((_, bi) => (
              <div
                key={bi}
                style={{
                  width: 38,
                  height: 38,
                  background: FC_COLORS[si % FC_COLORS.length],
                  borderRadius: 4,
                  borderTop: "3px solid rgba(255,255,255,0.32)",
                  borderLeft: "3px solid rgba(255,255,255,0.14)",
                  borderRight: "3px solid rgba(0,0,0,0.22)",
                  borderBottom: "3px solid rgba(0,0,0,0.28)",
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "rgba(6,182,212,0.4)",
          fontSize: 12,
          letterSpacing: "0.16em",
        }}
      >
        <div style={{ width: 48, height: 1, background: "rgba(6,182,212,0.3)" }} />
        HOW MANY?
        <div style={{ width: 48, height: 1, background: "rgba(6,182,212,0.3)" }} />
      </div>
    </div>
  );
}

// ── Halli Galli: fruit cards + bell ───────────────────────────────

const HG_CARDS = [
  { fruit: "🍓", count: 3, bg: "#fff1f2" },
  { fruit: "🍌", count: 2, bg: "#fefce8" },
  { fruit: "🍋", count: 5, bg: "#fefce8" },
  { fruit: "🍇", count: 1, bg: "#faf5ff" },
];

function HalliGalliVisual() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ display: "flex", gap: 8 }}>
        {HG_CARDS.map((card, i) => {
          const isWinner = i === 2;
          return (
            <div
              key={i}
              style={{
                width: 70,
                height: 98,
                borderRadius: 10,
                background: card.bg,
                border: isWinner ? "2px solid #eab308" : "1px solid rgba(0,0,0,0.1)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              <div style={{ fontSize: 26 }}>{card.fruit}</div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: isWinner ? "#ca8a04" : "#374151",
                }}
              >
                ×{card.count}
              </div>
              {isWinner && (
                <div
                  style={{
                    fontSize: 9,
                    color: "#ca8a04",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                  }}
                >
                  RING!
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        <div style={{ fontSize: 50 }}>🔔</div>
        <div
          style={{
            color: "#eab308",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
          }}
        >
          DING!
        </div>
      </div>
    </div>
  );
}

// ── Sudoku: 9×9 grid with given numbers and a few filled cells ─────

const SUDOKU_BOARD = [
  [5, 3, 0, 0, 7, 0, 0, 0, 0],
  [6, 0, 0, 1, 9, 5, 0, 0, 0],
  [0, 9, 8, 0, 0, 0, 0, 6, 0],
  [8, 0, 0, 0, 6, 0, 0, 0, 3],
  [4, 0, 0, 8, 0, 3, 0, 0, 1],
  [7, 0, 0, 0, 2, 0, 0, 0, 6],
  [0, 6, 0, 0, 0, 0, 2, 8, 0],
  [0, 0, 0, 4, 1, 9, 0, 0, 5],
  [0, 0, 0, 0, 8, 0, 0, 7, 9],
];
// Cells "filled in" by the player (accent-highlighted)
const SUDOKU_PLAYER = new Set(["0,2", "0,3", "1,1", "1,2", "2,0", "2,3"]);

function SudokuVisual() {
  const CELL = 31;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        border: "2.5px solid rgba(139,92,246,0.55)",
        borderRadius: 4,
      }}
    >
      {SUDOKU_BOARD.map((row, ri) => (
        <div
          key={ri}
          style={{
            display: "flex",
            borderBottom:
              ri === 8
                ? "0"
                : [2, 5].includes(ri)
                ? "2.5px solid rgba(139,92,246,0.45)"
                : "1px solid rgba(139,92,246,0.18)",
          }}
        >
          {row.map((val, ci) => {
            const isPlayer = SUDOKU_PLAYER.has(`${ri},${ci}`) && val === 0;
            const thickRight = [2, 5].includes(ci);
            return (
              <div
                key={ci}
                style={{
                  width: CELL,
                  height: CELL,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRight:
                    ci === 8
                      ? "0"
                      : thickRight
                      ? "2.5px solid rgba(139,92,246,0.45)"
                      : "1px solid rgba(139,92,246,0.18)",
                  background: isPlayer ? "rgba(139,92,246,0.16)" : "transparent",
                  fontSize: 13,
                  fontWeight: val !== 0 ? 700 : 500,
                  color: val !== 0 ? "#e8e5f5" : "#a78bfa",
                }}
              >
                {val !== 0 ? val : isPlayer ? "4" : ""}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── P2P Chat: conversation bubbles with encryption badge ──────────

const CHAT_MSGS = [
  { text: "Hey, want to play?", own: false },
  { text: "Sure! Dealing cards...", own: true },
  { text: "All in! Ready?", own: false },
  { text: "Challenge accepted", own: true },
];

function P2PChatVisual() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        width: 340,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          background: "rgba(249,115,22,0.1)",
          border: "1px solid rgba(249,115,22,0.28)",
          borderRadius: 8,
          padding: "5px 12px",
          alignSelf: "center",
          marginBottom: 4,
        }}
      >
        <div style={{ fontSize: 13 }}>🔒</div>
        <div
          style={{
            color: "#fb923c",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.09em",
          }}
        >
          END-TO-END ENCRYPTED
        </div>
      </div>
      {CHAT_MSGS.map((msg, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: msg.own ? "flex-end" : "flex-start",
          }}
        >
          <div
            style={{
              maxWidth: 230,
              padding: "9px 14px",
              borderRadius: msg.own ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              background: msg.own ? "rgba(249,115,22,0.22)" : "rgba(255,255,255,0.07)",
              border: msg.own
                ? "1px solid rgba(249,115,22,0.38)"
                : "1px solid rgba(255,255,255,0.1)",
              color: msg.own ? "#fed7aa" : "#d1d5db",
              fontSize: 14,
              lineHeight: 1.4,
            }}
          >
            {msg.text}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Visual selector ────────────────────────────────────────────────

function renderVisual(title: string) {
  const t = title.toLowerCase();
  if (t.includes("gomoku")) return <GomokuVisual />;
  if (t.includes("texas") || t.includes("hold") || t.includes("poker"))
    return <PokerVisual />;
  if (t.includes("maze")) return <MazeVisual />;
  if (t.includes("math")) return <MathSprintVisual />;
  if (t.includes("flash")) return <FlashCountVisual />;
  if (t.includes("halli")) return <HalliGalliVisual />;
  if (t.includes("sudoku")) return <SudokuVisual />;
  if (t.includes("chat") || t.includes("p2p")) return <P2PChatVisual />;
  return null;
}

// ── Route handler ─────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "Wenqian Zhang";
  const subtitle =
    searchParams.get("subtitle") ?? "UNSW CS Ph.D. · Graph Systems · P2P Web Apps";
  const tag = searchParams.get("tag") ?? null;

  const [interRegular, interBold] = await Promise.all([
    interRegularPromise,
    interBoldPromise,
  ]);

  const { accent, glow, bg } = getConfig(title);
  const visual = renderVisual(title);
  const hasGame = visual !== null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: bg,
          display: "flex",
          position: "relative",
          fontFamily: "Inter, sans-serif",
          overflow: "hidden",
        }}
      >
        {/* Subtle grid */}
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={`h${i}`}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: i * 48,
              height: 1,
              background: "rgba(255,255,255,0.022)",
            }}
          />
        ))}
        {Array.from({ length: 26 }).map((_, i) => (
          <div
            key={`v${i}`}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: i * 48,
              width: 1,
              background: "rgba(255,255,255,0.022)",
            }}
          />
        ))}

        {/* Glow blobs */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -80,
            width: 420,
            height: 420,
            borderRadius: 210,
            background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -100,
            left: -60,
            width: 320,
            height: 320,
            borderRadius: 160,
            background: "radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)",
          }}
        />

        {/* Main layout */}
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            padding: "54px 72px 68px 72px",
            alignItems: "center",
          }}
        >
          {/* Left: text */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: hasGame ? "0 0 460px" : "1",
              justifyContent: "center",
            }}
          >
            {/* Tag badge */}
            {tag && (
              <div style={{ display: "flex", marginBottom: 22 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    background: `${accent}1e`,
                    border: `1.5px solid ${accent}50`,
                    borderRadius: 10,
                    color: accent,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    padding: "5px 14px",
                  }}
                >
                  {tag === "game" ? "🎮  GAME" : tag === "chat" ? "💬  CHAT" : tag.toUpperCase()}
                </div>
              </div>
            )}

            {/* Title */}
            <div
              style={{
                color: "#e8e5f5",
                fontSize: title.length > 20 ? 56 : 66,
                fontWeight: 700,
                lineHeight: 1.1,
                letterSpacing: "-0.025em",
                marginBottom: 14,
              }}
            >
              {title}
            </div>

            {/* Accent underline */}
            <div
              style={{
                width: 56,
                height: 3,
                background: `linear-gradient(90deg, ${accent}, transparent)`,
                borderRadius: 2,
                marginBottom: 18,
              }}
            />

            {/* Subtitle */}
            <div
              style={{
                color: "#8b8fa3",
                fontSize: 21,
                fontWeight: 400,
                lineHeight: 1.55,
                letterSpacing: "0.004em",
                maxWidth: 400,
              }}
            >
              {subtitle}
            </div>

            {/* P2P badge (games only) */}
            {hasGame && (
              <div style={{ display: "flex", marginTop: 26 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.09)",
                    borderRadius: 8,
                    color: "#9ca3af",
                    fontSize: 13,
                    fontWeight: 500,
                    padding: "5px 12px",
                    letterSpacing: "0.04em",
                  }}
                >
                  ⚡ No signup · No server · Browser P2P
                </div>
              </div>
            )}
          </div>

          {/* Right: game visual */}
          {hasGame && (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {visual}
            </div>
          )}
        </div>

        {/* Bottom accent bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            background: `linear-gradient(90deg, ${accent} 0%, #8b5cf6 50%, ${accent} 100%)`,
          }}
        />

        {/* Domain */}
        <div
          style={{
            position: "absolute",
            bottom: 22,
            right: 72,
            color: `${accent}bb`,
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "0.1em",
          }}
        >
          wenqian.dev
        </div>

        {/* Decorative dots */}
        <div
          style={{
            position: "absolute",
            bottom: 26,
            left: 72,
            display: "flex",
            gap: 7,
          }}
        >
          <div style={{ width: 7, height: 7, borderRadius: 4, background: accent }} />
          <div style={{ width: 7, height: 7, borderRadius: 4, background: "#8b5cf6" }} />
          <div style={{ width: 7, height: 7, borderRadius: 4, background: `${accent}44` }} />
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Inter", data: interBold, weight: 700 as const, style: "normal" as const },
        { name: "Inter", data: interRegular, weight: 400 as const, style: "normal" as const },
      ],
    }
  );
}
