"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { Wrench } from "lucide-react";

// ── Tool registry ──────────────────────────────────────────
type Tool = {
  href: string;
  name: string;
  desc: string;
  badge: string;
  accent: string;
  glow: string;
  iconFile?: string;
};

const TOOLS: Tool[] = [
  { href: "/transcribe", name: "Transcribe", desc: "Audio → subtitles", badge: "Whisper", accent: "#0ea5e9", glow: "rgba(14,165,233,0.5)" },
];

const TOTAL = TOOLS.length;
const FAN_SPREAD = TOTAL > 1 ? 56 : 0;

function getFanAngle(index: number) {
  if (TOTAL <= 1) return 0;
  return -FAN_SPREAD / 2 + index * (FAN_SPREAD / (TOTAL - 1));
}

// ── Transcribe inline SVG (sound wave bars) ────────────────
function TranscribeIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
      <line x1="3"  y1="11" x2="3"  y2="13" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity="0.55"/>
      <line x1="6"  y1="9"  x2="6"  y2="15" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity="0.8"/>
      <line x1="9"  y1="6"  x2="9"  y2="18" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="12" y1="3.5" x2="12" y2="20.5" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="15" y1="6"  x2="15" y2="18" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="18" y1="9"  x2="18" y2="15" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity="0.8"/>
      <line x1="21" y1="11" x2="21" y2="13" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity="0.55"/>
    </svg>
  );
}

// ── Inner card visual (handles hover) ─────────────────────
function CardVisual({ tool }: { tool: Tool }) {
  return (
    <motion.div
      whileHover={{
        y: -9,
        boxShadow: `0 0 20px ${tool.glow}, 0 8px 32px ${tool.glow}`,
        borderColor: tool.accent,
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
      <div
        style={{
          position: "absolute",
          top: 0, left: "12%", right: "12%",
          height: 1,
          background: "linear-gradient(90deg,transparent,color-mix(in oklab, var(--pixel-accent) 40%, transparent),transparent)",
          zIndex: 2,
        }}
      />

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
            background: tool.accent,
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
            background: tool.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            zIndex: 1,
            boxShadow: `0 4px 20px ${tool.glow}`,
          }}
        >
          {tool.iconFile ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/tools/${tool.iconFile}`}
              alt={tool.name}
              width={30}
              height={30}
              style={{ filter: "brightness(0) invert(1)" }}
            />
          ) : tool.name === "Transcribe" ? (
            <TranscribeIcon />
          ) : null}
        </motion.div>
      </div>

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
          {tool.name}
        </p>
        <p
          className="font-mono"
          style={{ fontSize: 10, color: "var(--pixel-muted)", lineHeight: 1.3, marginBottom: 8 }}
        >
          {tool.desc}
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span
            className="font-mono"
            style={{
              fontSize: 9,
              color: tool.accent,
              border: "1px solid var(--pixel-border)",
              background: "color-mix(in oklab, var(--pixel-accent) 10%, transparent)",
              padding: "1px 6px",
              borderRadius: 4,
              letterSpacing: "0.04em",
            }}
          >
            {tool.badge}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Section ────────────────────────────────────────────────
export default function ToolsSection() {
  const gridRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(gridRef, { once: true, amount: 0.1 });
  const [offsets, setOffsets] = useState<{ x: number; y: number }[] | null>(null);
  const [inFan, setInFan] = useState(true);

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

  useEffect(() => {
    if (isInView && inFan && offsets) {
      const timer = setTimeout(() => setInFan(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isInView, inFan, offsets]);

  return (
    <section id="tools" className="mt-16 sm:mt-24 scroll-mt-8">
      <div className="flex items-center gap-4 mb-10">
        <div className="p-2 rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-bg)] text-[var(--pixel-accent)]">
          <Wrench size={20} />
        </div>
        <h2 className="font-sans text-base md:text-lg font-bold text-[var(--pixel-accent)] tracking-tight uppercase">
          Use Tools
        </h2>
      </div>

      <div
        ref={gridRef}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 justify-items-center"
      >
        {TOOLS.map((tool, i) => (
          <motion.div
            key={tool.href}
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
            <Link href={tool.href} className="block">
              <CardVisual tool={tool} />
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
