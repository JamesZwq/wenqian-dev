import { ImageResponse } from "next/og";

export const runtime = "edge";

const interRegularPromise = fetch(
  new URL("./Inter-Regular.ttf", import.meta.url)
).then((r) => r.arrayBuffer());

const interBoldPromise = fetch(
  new URL("./Inter-Bold.ttf", import.meta.url)
).then((r) => r.arrayBuffer());

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
              background: "rgba(99,102,241,0.06)",
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
              background: "rgba(99,102,241,0.06)",
            }}
          />
        ))}

        {/* Glow blob top-right */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -80,
            width: 400,
            height: 400,
            borderRadius: 200,
            background: "radial-gradient(circle, rgba(129,140,248,0.18) 0%, transparent 70%)",
          }}
        />
        {/* Glow blob bottom-left */}
        <div
          style={{
            position: "absolute",
            bottom: -100,
            left: -60,
            width: 320,
            height: 320,
            borderRadius: 160,
            background: "radial-gradient(circle, rgba(167,139,250,0.14) 0%, transparent 70%)",
          }}
        />

        {/* Tag badge */}
        {tag && (
          <div style={{ display: "flex", marginBottom: 28 }}>
            <div
              style={{
                display: "flex",
                background: "rgba(99,102,241,0.18)",
                border: "1px solid rgba(99,102,241,0.35)",
                borderRadius: 8,
                color: "#818cf8",
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "0.12em",
                padding: "5px 14px",
              }}
            >
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
          }}
        >
          {subtitle}
        </div>

        {/* Bottom accent bar */}
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
            fontWeight: 500,
            letterSpacing: "0.08em",
          }}
        >
          wenqian.dev
        </div>

        {/* Decorative dots */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            left: 72,
            display: "flex",
            gap: 8,
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: 4, background: "#6366f1" }} />
          <div style={{ width: 8, height: 8, borderRadius: 4, background: "#8b5cf6" }} />
          <div style={{ width: 8, height: 8, borderRadius: 4, background: "rgba(99,102,241,0.3)" }} />
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
