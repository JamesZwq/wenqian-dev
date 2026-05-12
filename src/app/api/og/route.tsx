import { ImageResponse } from "next/og";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          background:
            "linear-gradient(135deg, #0b0d1e 0%, #131629 60%, #0e1020 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "80px",
          position: "relative",
        }}
      >
        {/* Radial glow top-right */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "520px",
            height: "520px",
            background:
              "radial-gradient(circle at 80% 20%, rgba(99,102,241,0.18) 0%, transparent 65%)",
          }}
        />

        {/* Main content */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: "white",
              lineHeight: 1.1,
            }}
          >
            Wenqian Zhang
          </div>

          {/* Accent divider */}
          <div
            style={{
              width: 60,
              height: 3,
              background: "rgba(99,102,241,0.85)",
              marginTop: 20,
              marginBottom: 28,
            }}
          />

          <div
            style={{
              fontSize: 28,
              color: "rgba(148,163,184,0.9)",
              lineHeight: 1.5,
            }}
          >
            UNSW CS Ph.D. · Graph Systems · P2P Web Apps
          </div>

          {/* CTA badge */}
          <div style={{ marginTop: "auto", display: "flex" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "rgba(99,102,241,0.15)",
                border: "1px solid rgba(99,102,241,0.35)",
                borderRadius: 8,
                padding: "14px 28px",
                color: "rgba(165,180,252,1)",
                fontSize: 24,
              }}
            >
              Explore research &amp; projects →
            </div>
          </div>
        </div>

        {/* Footer row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 40,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: "rgba(99,102,241,0.65)",
              }}
            />
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: "rgba(255,255,255,0.2)",
              }}
            />
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: "rgba(255,255,255,0.2)",
              }}
            />
          </div>
          <div style={{ fontSize: 20, color: "rgba(148,163,184,0.45)" }}>
            wenqian.dev
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
