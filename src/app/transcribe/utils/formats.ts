import type { ExportFormat, TranscriptChunk, TranscriptResult } from "../types";

// ── Time formatting helpers ──────────────────────────────────────────────────

function pad(n: number, width = 2): string {
  return n.toString().padStart(width, "0");
}

/**
 * Format seconds as `HH:MM:SS{sep}mmm` (sep typically `,` for SRT, `.` for VTT).
 */
export function formatHMS(seconds: number, sep: "," | "." = ","): string {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const millis = Math.floor((safe - Math.floor(safe)) * 1000);
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}${sep}${pad(millis, 3)}`;
}

/**
 * Format seconds as `mm:ss.xx` (LRC time tag).
 */
export function formatMS(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const hundredths = Math.floor((safe - Math.floor(safe)) * 100);
  return `${pad(minutes)}:${pad(secs)}.${pad(hundredths)}`;
}

/**
 * Resolve the [start, end] timestamps for a chunk, falling back to a 2-second
 * window when the end is missing (Whisper streaming may emit an open-ended last chunk).
 */
function resolveTimestamp(chunk: TranscriptChunk): [number, number] {
  const [start, end] = chunk.timestamp;
  const safeStart = typeof start === "number" && Number.isFinite(start) ? start : 0;
  const resolvedEnd =
    typeof end === "number" && Number.isFinite(end) ? end : safeStart + 2;
  return [safeStart, Math.max(resolvedEnd, safeStart + 0.001)];
}

// ── Export converters ────────────────────────────────────────────────────────

export function toSRT(chunks: TranscriptChunk[]): string {
  return (
    chunks
      .map((chunk, i) => {
        const [start, end] = resolveTimestamp(chunk);
        return `${i + 1}\n${formatHMS(start, ",")} --> ${formatHMS(end, ",")}\n${chunk.text.trim()}`;
      })
      .join("\n\n") + "\n"
  );
}

export function toVTT(chunks: TranscriptChunk[]): string {
  const body = chunks
    .map((chunk) => {
      const [start, end] = resolveTimestamp(chunk);
      return `${formatHMS(start, ".")} --> ${formatHMS(end, ".")}\n${chunk.text.trim()}`;
    })
    .join("\n\n");
  return `WEBVTT\n\n${body}\n`;
}

export function toLRC(chunks: TranscriptChunk[]): string {
  return (
    chunks
      .map((chunk) => {
        const [start] = resolveTimestamp(chunk);
        return `[${formatMS(start)}]${chunk.text.trim()}`;
      })
      .join("\n") + "\n"
  );
}

export function toTXT(chunks: TranscriptChunk[]): string {
  return chunks.map((c) => c.text.trim()).join(" ").replace(/\s+/g, " ").trim() + "\n";
}

export function toJSON(chunks: TranscriptChunk[], full: TranscriptResult): string {
  // Use the full result to preserve original `text` field exactly.
  const payload = {
    text: full.text,
    chunks: chunks.map((c) => ({ text: c.text, timestamp: c.timestamp })),
  };
  return JSON.stringify(payload, null, 2);
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

export function exportTranscript(
  format: ExportFormat,
  result: TranscriptResult,
): { content: string; filename: string; mime: string } {
  switch (format) {
    case "srt":
      return {
        content: toSRT(result.chunks),
        filename: "transcript.srt",
        mime: "application/x-subrip",
      };
    case "vtt":
      return {
        content: toVTT(result.chunks),
        filename: "transcript.vtt",
        mime: "text/vtt",
      };
    case "lrc":
      return {
        content: toLRC(result.chunks),
        filename: "transcript.lrc",
        mime: "application/x-lrc",
      };
    case "txt":
      return {
        content: result.text?.trim() ? result.text.trim() + "\n" : toTXT(result.chunks),
        filename: "transcript.txt",
        mime: "text/plain",
      };
    case "json":
      return {
        content: toJSON(result.chunks, result),
        filename: "transcript.json",
        mime: "application/json",
      };
  }
}
