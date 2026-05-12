// Run: node scripts/generate-og.mjs
// Generates /public/og/default.png at build time — no runtime WASM in the Worker bundle.
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Load Inter font from public/fonts/ so satori renders it correctly.
const fontRegular = readFileSync(resolve(root, "public/fonts/Inter-Regular.ttf"));
const fontBold = readFileSync(resolve(root, "public/fonts/Inter-Bold.ttf"));

const svg = await satori(
  {
    type: "div",
    props: {
      style: {
        background: "linear-gradient(135deg, #0b0d1e 0%, #131629 60%, #0e1020 100%)",
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        padding: "80px",
        position: "relative",
        fontFamily: "Inter",
      },
      children: [
        // Glow
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              top: 0,
              right: 0,
              width: "520px",
              height: "520px",
              background:
                "radial-gradient(circle at 80% 20%, rgba(99,102,241,0.18) 0%, transparent 65%)",
            },
          },
        },
        // Main content
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", flex: 1 },
            children: [
              {
                type: "div",
                props: {
                  style: { fontSize: 72, fontWeight: 700, color: "white", lineHeight: 1.1 },
                  children: "Wenqian Zhang",
                },
              },
              // Accent divider
              {
                type: "div",
                props: {
                  style: {
                    width: 60,
                    height: 3,
                    background: "rgba(99,102,241,0.85)",
                    marginTop: 20,
                    marginBottom: 28,
                  },
                },
              },
              {
                type: "div",
                props: {
                  style: { fontSize: 28, color: "rgba(148,163,184,0.9)", lineHeight: 1.5 },
                  children: "UNSW CS Ph.D. · Graph Systems · P2P Web Apps",
                },
              },
              // CTA badge
              {
                type: "div",
                props: {
                  style: { marginTop: "auto", display: "flex" },
                  children: {
                    type: "div",
                    props: {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        background: "rgba(99,102,241,0.15)",
                        border: "1px solid rgba(99,102,241,0.35)",
                        borderRadius: 8,
                        padding: "14px 28px",
                        color: "rgba(165,180,252,1)",
                        fontSize: 24,
                      },
                      children: "Explore research & projects →",
                    },
                  },
                },
              },
            ],
          },
        },
        // Footer row
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 40,
            },
            children: [
              {
                type: "div",
                props: {
                  style: { display: "flex", gap: 8 },
                  children: [
                    { type: "div", props: { style: { width: 8, height: 8, borderRadius: 4, background: "rgba(99,102,241,0.65)" } } },
                    { type: "div", props: { style: { width: 8, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.2)" } } },
                    { type: "div", props: { style: { width: 8, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.2)" } } },
                  ],
                },
              },
              {
                type: "div",
                props: {
                  style: { fontSize: 20, color: "rgba(148,163,184,0.45)" },
                  children: "wenqian.dev",
                },
              },
            ],
          },
        },
      ],
    },
  },
  {
    width: 1200,
    height: 630,
    fonts: [
      { name: "Inter", data: fontRegular, weight: 400, style: "normal" },
      { name: "Inter", data: fontBold, weight: 700, style: "normal" },
    ],
  }
);

const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
const png = resvg.render().asPng();
writeFileSync(resolve(root, "public/og/default.png"), png);
console.log("✓ Generated public/og/default.png");
