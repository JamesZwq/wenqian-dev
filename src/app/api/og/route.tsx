import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "Wenqian Zhang";
  const subtitle = searchParams.get("subtitle") ?? "UNSW CS Ph.D. · Graph Systems · P2P Web Apps";
  const tag = searchParams.get("tag") ?? null;

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
          fontFamily: "system-ui, -apple-system, sans-serif",
          overflow: "hidden",
        }}
      >
        {/* Grid pattern */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(99,102,241,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.06) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Glow blobs */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -80,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(129,140,248,0.18) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -100,
            left: -60,
            width: 320,
            height: 320,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(167,139,250,0.14) 0%, transparent 70%)",
          }}
        />

        {/* Optional tag / badge */}
        {tag && (
          <div
            style={{
              display: "flex",
              marginBottom: 28,
            }}
          >
            <span
              style={{
                background: "rgba(99,102,241,0.18)",
                border: "1px solid rgba(99,102,241,0.35)",
                borderRadius: 8,
                color: "#818cf8",
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: "0.12em",
                padding: "5px 14px",
                fontFamily: "monospace, system-ui",
              }}
            >
              {tag.toUpperCase()}
            </span>
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
            maxWidth: 900,
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
            maxWidth: 820,
            fontFamily: "monospace, system-ui",
          }}
        >
          {subtitle}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #6366f1 100%)",
          }}
        />

        {/* Domain label */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            right: 72,
            color: "rgba(129,140,248,0.7)",
            fontSize: 17,
            fontFamily: "monospace, system-ui",
            fontWeight: 500,
            letterSpacing: "0.08em",
          }}
        >
          wenqianzhang.me
        </div>

        {/* Small dots decoration */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            left: 72,
            display: "flex",
            gap: 8,
          }}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: i === 1 ? "#6366f1" : i === 2 ? "#8b5cf6" : "rgba(99,102,241,0.3)",
              }}
            />
          ))}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
