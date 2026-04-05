"use client";

import { useState } from "react";

// ── Card data — mirrors exactly what each layout.tsx passes to /api/og ─────

type OgCard = {
  label: string;
  route: string;
  ogUrl: string;
  hasVisual: boolean;
};

const CARDS: OgCard[] = [
  {
    label: "Home",
    route: "/",
    ogUrl: "/api/og",
    hasVisual: false,
  },
  {
    label: "Gomoku",
    route: "/gomoku",
    ogUrl: "/api/og?title=Gomoku&subtitle=Five%20in%20a%20Row%20%E2%80%94%20vs%20AI%20or%20P2P%20online&tag=game",
    hasVisual: true,
  },
  {
    label: "Texas Hold'em",
    route: "/poker",
    ogUrl: "/api/og?title=Texas%20Hold'em&subtitle=Heads-up%20No-Limit%20Poker%20%E2%80%94%20P2P%20online&tag=game",
    hasVisual: true,
  },
  {
    label: "Maze Runner",
    route: "/maze",
    ogUrl: "/api/og?title=Maze%20Runner&subtitle=Procedural%20mazes%20with%20power-ups%20%E2%80%94%20solo%20or%20P2P&tag=game",
    hasVisual: true,
  },
  {
    label: "Math Sprint",
    route: "/math",
    ogUrl: "/api/og?title=Math%20Sprint&subtitle=Speed%20arithmetic%20challenge%20%E2%80%94%20solo%20or%20P2P%20race&tag=game",
    hasVisual: true,
  },
  {
    label: "Flash Count",
    route: "/flash-count",
    ogUrl: "/api/og?title=Flash%20Count&subtitle=Count%203D%20blocks%20before%20they%20vanish%20%E2%80%94%20visual%20memory&tag=game",
    hasVisual: true,
  },
  {
    label: "Halli Galli",
    route: "/halli-galli",
    ogUrl: "/api/og?title=Halli%20Galli&subtitle=Ring%20the%20bell%20when%20any%20fruit%20totals%205!&tag=game",
    hasVisual: true,
  },
  {
    label: "Sudoku",
    route: "/sudoku",
    ogUrl: "/api/og?title=Sudoku&subtitle=Solo%20or%20P2P%20race%20%E2%80%94%20same%20puzzle%2C%20fastest%20wins&tag=game",
    hasVisual: true,
  },
  {
    label: "P2P Chat",
    route: "/chat",
    ogUrl: "/api/og?title=P2P%20Chat&subtitle=End-to-end%20encrypted%20browser-to-browser%20messaging&tag=chat",
    hasVisual: true,
  },
];

// ── Single card panel ──────────────────────────────────────────────────────────

function CardPanel({ card }: { card: OgCard }) {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [copied, setCopied] = useState(false);

  const fullUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${card.ogUrl}`
      : card.ogUrl;

  function copyUrl() {
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[var(--pixel-border)] bg-[var(--pixel-bg-alt)]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono font-bold text-sm text-[var(--pixel-text)] shrink-0">
            {card.label}
          </span>
          <a
            href={card.route}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-[var(--pixel-accent)] hover:underline truncate"
          >
            {card.route}
          </a>
          <span
            className={`shrink-0 font-mono text-[9px] font-semibold px-1.5 py-0.5 rounded ${
              card.hasVisual
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-[var(--pixel-muted)]/15 text-[var(--pixel-muted)]"
            }`}
          >
            {card.hasVisual ? "VISUAL" : "DEFAULT"}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Status dot */}
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              status === "loading"
                ? "bg-yellow-400 animate-pulse"
                : status === "ok"
                ? "bg-emerald-400"
                : "bg-red-500"
            }`}
            title={status}
          />
          <a
            href={card.ogUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] text-[var(--pixel-muted)] hover:text-[var(--pixel-accent)] transition-colors"
          >
            open ↗
          </a>
        </div>
      </div>

      {/* Image */}
      <a
        href={card.ogUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block relative bg-[var(--pixel-bg)]"
        style={{ aspectRatio: "1200 / 630" }}
      >
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-red-400">
            <span className="text-2xl">⚠</span>
            <span className="font-mono text-xs">Failed to load</span>
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={card.ogUrl}
          alt={`OG card — ${card.label}`}
          width={1200}
          height={630}
          className="block w-full h-full object-cover transition-opacity"
          style={{ opacity: status === "error" ? 0 : 1 }}
          onLoad={() => setStatus("ok")}
          onError={() => setStatus("error")}
        />
      </a>

      {/* URL row */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-[var(--pixel-border)]">
        <p className="font-mono text-[9px] text-[var(--pixel-muted)] truncate flex-1 leading-relaxed select-all">
          {card.ogUrl}
        </p>
        <button
          type="button"
          onClick={copyUrl}
          className={`shrink-0 font-mono text-[9px] font-semibold px-2 py-1 rounded border transition-all ${
            copied
              ? "border-emerald-500/50 text-emerald-400"
              : "border-[var(--pixel-border)] text-[var(--pixel-muted)] hover:border-[var(--pixel-accent)] hover:text-[var(--pixel-accent)]"
          }`}
        >
          {copied ? "COPIED" : "COPY"}
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OgDebugPage() {
  const gameCards = CARDS.filter((c) => c.hasVisual);
  const defaultCards = CARDS.filter((c) => !c.hasVisual);

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 md:py-10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="font-mono font-bold text-xl tracking-tight text-[var(--pixel-text)]">
              OG Card Debug
            </h1>
            <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded border border-[var(--pixel-border)] text-[var(--pixel-muted)]">
              {CARDS.length} cards
            </span>
          </div>
          <p className="font-mono text-xs text-[var(--pixel-muted)]">
            Each card renders the exact URL from its{" "}
            <code className="text-[var(--pixel-accent)]">layout.tsx</code> metadata.
            Click any image to open at full size (1200×630). Dot = load status.
          </p>
        </div>

        {/* Game cards: 2-col grid */}
        <section>
          <h2 className="font-mono text-xs font-semibold text-[var(--pixel-muted)] uppercase tracking-widest mb-3">
            Game cards ({gameCards.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {gameCards.map((card) => (
              <CardPanel key={card.route} card={card} />
            ))}
          </div>
        </section>

        {/* Default card(s) */}
        <section className="mt-8">
          <h2 className="font-mono text-xs font-semibold text-[var(--pixel-muted)] uppercase tracking-widest mb-3">
            Default card ({defaultCards.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {defaultCards.map((card) => (
              <CardPanel key={card.route} card={card} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
