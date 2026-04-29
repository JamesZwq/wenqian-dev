"use client";

import { exportTranscript } from "../utils/formats";
import type { ExportFormat, TranscriptResult } from "../types";

interface Props {
  result: TranscriptResult;
  /** From audio file, e.g., "meeting" — extension is appended. */
  baseFilename: string;
}

const FORMATS: { id: ExportFormat; label: string; desc: string }[] = [
  { id: "srt", label: "SRT", desc: "SubRip — videos, Premiere, YouTube" },
  { id: "vtt", label: "VTT", desc: "WebVTT — HTML5 video, browsers" },
  { id: "lrc", label: "LRC", desc: "Lyrics — synced karaoke format" },
  { id: "txt", label: "TXT", desc: "Plain text, no timestamps" },
  { id: "json", label: "JSON", desc: "Full structured data" },
];

export function ExportPanel({ result, baseFilename }: Props) {
  const handleExport = (format: ExportFormat) => {
    const { content, mime } = exportTranscript(format, result);
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseFilename || "transcript"}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
      {FORMATS.map((f) => (
        <button
          key={f.id}
          onClick={() => handleExport(f.id)}
          className="group flex flex-col items-start rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-3 text-left transition-colors hover:border-[var(--pixel-accent)] hover:bg-[var(--pixel-bg-alt)]"
        >
          <span className="font-mono font-bold text-sm text-[var(--pixel-accent)] mb-1">
            {f.label}
          </span>
          <span className="font-mono text-[9px] text-[var(--pixel-muted)] leading-snug">
            {f.desc}
          </span>
        </button>
      ))}
    </div>
  );
}
