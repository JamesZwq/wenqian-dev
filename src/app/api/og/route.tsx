import { ImageResponse } from "next/og";

export const runtime = "edge";

const interRegularPromise = fetch(
  new URL("./Inter-Regular.ttf", import.meta.url)
).then((r) => r.arrayBuffer());

const interBoldPromise = fetch(
  new URL("./Inter-Bold.ttf", import.meta.url)
).then((r) => r.arrayBuffer());

// ── Game-specific visual themes ──────────────────────────────────

type GameTheme = {
  icons: string[];
  accent: string;
  glow: string;
};

const GAME_THEMES: Record<string, GameTheme> = {
  Gomoku: {
    icons: ["⚫", "⚪", "⚫", "⚪", "⚫"],
    accent: "#818cf8",
    glow: "rgba(129,140,248,0.22)",
  },
  "Texas Hold'em": {
    icons: ["♠", "♥", "♦", "♣"],
    accent: "#ef4444",
    glow: "rgba(239,68,68,0.18)",
  },
  "Maze Runner": {
    icons: ["🏃", "🧱", "🏃", "🧱"],
    accent: "#10b981",
    glow: "rgba(16,185,129,0.18)",
  },
  "Math Sprint": {
    icons: ["+", "−", "×", "÷"],
    accent: "#f59e0b",
    glow: "rgba(245,158,11,0.18)",
  },
  "Flash Count": {
    icons: ["🧊", "🔢", "🧊", "🔢"],
    accent: "#06b6d4",
    glow: "rgba(6,182,212,0.18)",
  },
  "Halli Galli": {
    icons: ["🍓", "🍌", "🍋", "🍇", "🔔"],
    accent: "#eab308",
    glow: "rgba(234,179,8,0.18)",
  },
  Sudoku: {
    icons: ["1", "5", "9", "3", "7"],
    accent: "#8b5cf6",
    glow: "rgba(139,92,246,0.20)",
  },
  "P2P Chat": {
    icons: ["💬", "🔒", "💬", "🔒"],
    accent: "#f97316",
    glow: "rgba(249,115,22,0.18)",
  },
};

function getTheme(title: string): GameTheme | null {
  for (const [key, theme] of Object.entries(GAME_THEMES)) {
    if (title.toLowerCase().includes(key.toLowerCase())) return theme;
  }
  return null;
}

// ── Route handler ────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "Wenqian Zhang";
  const subtitle =
    searchParams.get("subtitle") ??
    "UNSW CS Ph.D. · Graph Systems · P2P Web Apps";
  const tag = searchParams.get("tag") ?? null;

  const [interRegular, interBold] = await Promise.all([
    interRegularPromise,
    interBoldPromise,
  ]);

  const theme = getTheme(title);
  const accent = theme?.accent ?? "#818cf8";
  const glowColor = theme?.glow ?? "rgba(129,140,248,0.18)";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0c0a1d 0%, #13112b 50%, #0e0c22 100%)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "64px 72px",
          position: "relative",
          fontFamily: "Inter, sans-serif",
          overflow: "hidden",
        }}
      >
        {/* Grid lines — horizontal */}
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={`h${i}`}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: i * 48,
              height: 1,
              background: `rgba(99,102,241,0.05)`,
            }}
          />
        ))}
        {/* Grid lines — vertical */}
        {Array.from({ length: 26 }).map((_, i) => (
          <div
            key={`v${i}`}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: i * 48,
              width: 1,
              background: `rgba(99,102,241,0.05)`,
            }}
          />
        ))}

        {/* Glow blob top-right — uses game accent */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -80,
            width: 420,
            height: 420,
            borderRadius: 210,
            background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
          }}
        />
        {/* Glow blob bottom-left */}
        <div
          style={{
            position: "absolute",
            bottom: -100,
            left: -60,
            width: 340,
            height: 340,
            borderRadius: 170,
            background: `radial-gradient(circle, rgba(167,139,250,0.12) 0%, transparent 70%)`,
          }}
        />

        {/* ── Game-specific floating icons ── */}
        {theme && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex" }}>
            {theme.icons.map((icon, i) => {
              // Scatter icons in the right half, varying sizes and opacity
              const positions = [
                { top: 60, right: 80, size: 72, opacity: 0.12 },
                { top: 180, right: 200, size: 56, opacity: 0.08 },
                { top: 100, right: 340, size: 48, opacity: 0.06 },
                { top: 300, right: 120, size: 64, opacity: 0.10 },
                { top: 240, right: 300, size: 44, opacity: 0.07 },
              ];
              const pos = positions[i % positions.length];
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    top: pos.top,
                    right: pos.right,
                    fontSize: pos.size,
                    opacity: pos.opacity,
                    lineHeight: 1,
                  }}
                >
                  {icon}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Large hero icon (game-specific) ── */}
        {theme && (
          <div
            style={{
              position: "absolute",
              top: 40,
              right: 60,
              fontSize: 140,
              opacity: 0.08,
              lineHeight: 1,
            }}
          >
            {theme.icons[0]}
          </div>
        )}

        {/* Tag badge */}
        {tag && (
          <div style={{ display: "flex", marginBottom: 24 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: `${accent}22`,
                border: `1.5px solid ${accent}55`,
                borderRadius: 10,
                color: accent,
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "0.12em",
                padding: "6px 16px",
              }}
            >
              {tag === "game" && "🎮  "}
              {tag === "chat" && "💬  "}
              {tag.toUpperCase()}
            </div>
          </div>
        )}

        {/* Title */}
        <div
          style={{
            color: "#e8e5f5",
            fontSize: title.length > 30 ? 52 : 64,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            marginBottom: 20,
          }}
        >
          {title}
        </div>

        {/* Subtitle */}
        <div
          style={{
            color: "#8b8fa3",
            fontSize: 26,
            fontWeight: 400,
            lineHeight: 1.5,
            letterSpacing: "0.01em",
            maxWidth: 700,
          }}
        >
          {subtitle}
        </div>

        {/* P2P badge for games */}
        {theme && (
          <div style={{ display: "flex", marginTop: 28 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                color: "#a0a4b8",
                fontSize: 14,
                fontWeight: 500,
                padding: "5px 12px",
                letterSpacing: "0.04em",
              }}
            >
              ⚡ P2P — No signup, no server
            </div>
          </div>
        )}

        {/* Bottom accent bar — uses game color */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: `linear-gradient(90deg, ${accent} 0%, #8b5cf6 50%, ${accent} 100%)`,
          }}
        />

        {/* Domain label */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            right: 72,
            color: `${accent}bb`,
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: "0.08em",
          }}
        >
          wenqian.me
        </div>

        {/* Decorative dots — use game accent */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            left: 72,
            display: "flex",
            gap: 8,
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: 4, background: accent }} />
          <div style={{ width: 8, height: 8, borderRadius: 4, background: "#8b5cf6" }} />
          <div style={{ width: 8, height: 8, borderRadius: 4, background: `${accent}55` }} />
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
