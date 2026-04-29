"use client";

import { useEffect, useRef } from "react";
import { formatMS } from "../utils/formats";
import type { TranscriptResult } from "../types";

interface Props {
  result: TranscriptResult;
  onSeek?: (timestamp: number) => void;
  /** Optional — highlight current segment based on audio playback time. */
  currentTime?: number;
}

export function TranscriptDisplay({ result, onSeek, currentTime }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  // Determine active chunk index.
  const activeIndex =
    typeof currentTime === "number"
      ? result.chunks.findIndex(
          (c) => {
            const start = c.timestamp[0] ?? 0;
            const end = c.timestamp[1] ?? start + 2;
            return currentTime >= start && currentTime < end;
          },
        )
      : -1;

  // Auto-scroll active row into view.
  useEffect(() => {
    if (activeIndex < 0 || !activeRef.current || !containerRef.current) return;
    const row = activeRef.current;
    const container = containerRef.current;
    const rowTop = row.offsetTop;
    const rowBottom = rowTop + row.offsetHeight;
    const visibleTop = container.scrollTop;
    const visibleBottom = visibleTop + container.clientHeight;
    if (rowTop < visibleTop || rowBottom > visibleBottom) {
      container.scrollTo({
        top: rowTop - container.clientHeight / 2 + row.offsetHeight / 2,
        behavior: "smooth",
      });
    }
  }, [activeIndex]);

  if (!result.chunks.length) {
    return (
      <div className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-4 font-mono text-xs text-[var(--pixel-muted)]">
        {result.text || "(no segments)"}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="max-h-[420px] overflow-y-auto rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] divide-y divide-[var(--pixel-border)]"
    >
      {result.chunks.map((chunk, i) => {
        const start = chunk.timestamp[0] ?? 0;
        const isActive = i === activeIndex;
        return (
          <div
            key={i}
            ref={isActive ? activeRef : undefined}
            className={[
              "flex items-start gap-3 px-3 md:px-4 py-2 transition-colors",
              isActive
                ? "bg-[color-mix(in_oklab,var(--pixel-accent)_14%,transparent)]"
                : "hover:bg-[var(--pixel-bg-alt)]",
            ].join(" ")}
          >
            <button
              type="button"
              onClick={() => onSeek?.(start)}
              className={[
                "shrink-0 font-mono text-[10px] md:text-xs tabular-nums rounded-md px-1.5 py-0.5 transition-colors",
                isActive
                  ? "text-[var(--pixel-accent)] bg-[color-mix(in_oklab,var(--pixel-accent)_18%,transparent)]"
                  : "text-[var(--pixel-muted)] hover:text-[var(--pixel-accent)] hover:bg-[var(--pixel-bg-alt)]",
              ].join(" ")}
              title="Jump to this timestamp"
            >
              {formatMS(start)}
            </button>
            <p
              className={[
                "font-mono text-xs md:text-sm leading-relaxed",
                isActive ? "text-[var(--pixel-text)]" : "text-[var(--pixel-text)]",
              ].join(" ")}
            >
              {chunk.text.trim()}
            </p>
          </div>
        );
      })}
    </div>
  );
}
