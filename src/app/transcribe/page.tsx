"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import ShareButton from "../components/ShareButton";
import { AudioUploader } from "./components/AudioUploader";
import { TranscriptDisplay } from "./components/TranscriptDisplay";
import { ExportPanel } from "./components/ExportPanel";
import { useTranscriber } from "./hooks/useTranscriber";
import { MODELS, type ModelId } from "./types";

const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "auto", label: "Auto-detect" },
  { value: "english", label: "English" },
  { value: "chinese", label: "Chinese (中文)" },
  { value: "spanish", label: "Spanish" },
  { value: "french", label: "French" },
  { value: "german", label: "German" },
  { value: "italian", label: "Italian" },
  { value: "portuguese", label: "Portuguese" },
  { value: "japanese", label: "Japanese" },
  { value: "korean", label: "Korean" },
  { value: "russian", label: "Russian" },
  { value: "arabic", label: "Arabic" },
  { value: "hindi", label: "Hindi" },
  { value: "dutch", label: "Dutch" },
  { value: "turkish", label: "Turkish" },
];

function formatSeconds(s: number): string {
  if (!Number.isFinite(s)) return "—";
  if (s < 1) return `${Math.round(s * 1000)} ms`;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}m ${sec}s`;
}

export default function TranscribePage() {
  const {
    status,
    model,
    setModel,
    language,
    setLanguage,
    progress,
    progressLabel,
    result,
    error,
    audioFile,
    audioDuration,
    elapsed,
    transcribe,
    reset,
  } = useTranscriber();

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [hasWebGPU, setHasWebGPU] = useState<boolean | null>(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Detect WebGPU.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        if ("gpu" in navigator) {
          const gpu = (
            navigator as unknown as {
              gpu: { requestAdapter: () => Promise<unknown> };
            }
          ).gpu;
          const adapter = await gpu.requestAdapter();
          if (!cancelled) setHasWebGPU(adapter != null);
        } else if (!cancelled) {
          setHasWebGPU(false);
        }
      } catch {
        if (!cancelled) setHasWebGPU(false);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  // Build a stable object URL for audio playback.
  const audioObjectUrl = useMemo(() => {
    if (!audioFile) return null;
    return URL.createObjectURL(audioFile);
  }, [audioFile]);

  useEffect(() => {
    if (!audioObjectUrl) return;
    return () => URL.revokeObjectURL(audioObjectUrl);
  }, [audioObjectUrl]);

  const baseFilename = useMemo(() => {
    if (!audioFile) return "transcript";
    return audioFile.name.replace(/\.[^.]+$/, "") || "transcript";
  }, [audioFile]);

  const handleSeek = (timestamp: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = timestamp;
    el.play().catch(() => undefined);
  };

  const handleStart = () => {
    if (pendingFile) {
      transcribe(pendingFile);
    }
  };

  const handleReset = () => {
    setPendingFile(null);
    setAudioCurrentTime(0);
    if (audioRef.current) audioRef.current.pause();
    reset();
  };

  const isBusy =
    status === "decoding" || status === "loading" || status === "transcribing";

  const realtimeFactor =
    audioDuration && elapsed
      ? audioDuration / (elapsed / 1000)
      : null;

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Back button */}
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed left-4 top-4 z-50 md:left-6 md:top-6"
      >
        <Link
          href="/"
          className="inline-flex rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2 font-sans font-semibold text-[10px] tracking-tight text-[var(--pixel-accent)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-md transition-colors hover:bg-[var(--pixel-bg-alt)] md:text-xs"
        >
          ← BACK
        </Link>
      </motion.div>

      {/* Share button */}
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed right-4 top-4 z-50 md:right-6 md:top-6"
      >
        <ShareButton
          title="Transcribe — Audio to subtitles in your browser"
          text="Convert audio to timestamped subtitles entirely in your browser. Whisper + WebGPU. Audio never leaves your device."
        />
      </motion.div>

      <div className="relative z-10 container mx-auto px-3 md:px-4 py-16 md:py-12 min-h-screen flex flex-col items-center">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="mb-6 text-center md:mb-8"
        >
          <h1 className="mb-1 font-sans font-semibold text-2xl tracking-tight text-[var(--pixel-accent)] md:text-5xl">
            TRANSCRIBE
          </h1>
          <p className="font-mono text-xs text-[var(--pixel-muted)] md:text-sm">
            &gt; Audio → timestamped subtitles, runs entirely in your browser
          </p>
        </motion.div>

        <div className="w-full max-w-3xl space-y-4 md:space-y-5">
          {/* Privacy notice */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-xl border border-[#22c55e] bg-[color-mix(in_oklab,#22c55e_10%,transparent)] px-4 py-2.5 font-mono text-[11px] text-[#16a34a] dark:text-[#4ade80]"
          >
            🔒 Your audio never leaves this device — model runs locally in your
            browser via WebAssembly / WebGPU.
          </motion.div>

          {/* WebGPU notice */}
          {hasWebGPU === false && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-[var(--pixel-warn)] bg-[color-mix(in_oklab,var(--pixel-warn)_10%,transparent)] px-4 py-2.5 font-mono text-[11px] text-[var(--pixel-warn)]"
            >
              ⚠ WebGPU not available — transcription will be 5–10× slower (CPU
              only). Use Chrome, Edge, or a recent Safari for best speed.
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {/* ─── Setup stage ─── */}
            {(status === "idle" || status === "error") && (
              <motion.div
                key="setup"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className="space-y-4 md:space-y-5"
              >
                {/* Uploader */}
                <AudioUploader
                  onFileSelected={setPendingFile}
                  currentFile={pendingFile}
                />

                {/* Model picker */}
                <div className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-4">
                  <h3 className="mb-3 font-sans font-semibold text-xs text-[var(--pixel-accent)]">
                    MODEL
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {MODELS.map((m) => {
                      const active = model === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setModel(m.id as ModelId)}
                          className={`group flex flex-col items-start rounded-xl border px-3 py-2.5 text-left transition-colors ${
                            active
                              ? "border-[var(--pixel-accent)] bg-[color-mix(in_oklab,var(--pixel-accent)_10%,transparent)]"
                              : "border-[var(--pixel-border)] hover:border-[var(--pixel-accent)] hover:bg-[var(--pixel-bg-alt)]"
                          }`}
                        >
                          <div className="flex w-full items-center justify-between">
                            <span
                              className={`font-sans font-semibold text-xs ${
                                active
                                  ? "text-[var(--pixel-accent)]"
                                  : "text-[var(--pixel-text)]"
                              }`}
                            >
                              {m.label}
                            </span>
                            <span className="font-mono text-[9px] text-[var(--pixel-muted)]">
                              {m.size}
                            </span>
                          </div>
                          <span className="mt-1 font-mono text-[10px] text-[var(--pixel-muted)] leading-snug">
                            {m.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Language selector */}
                <div className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-4">
                  <h3 className="mb-2 font-sans font-semibold text-xs text-[var(--pixel-accent)]">
                    LANGUAGE
                  </h3>
                  <p className="mb-3 font-mono text-[10px] text-[var(--pixel-muted)]">
                    &gt;{" "}
                    {model.endsWith(".en")
                      ? "English-only model — language is fixed to English."
                      : "Specify the source language to skip auto-detection (faster)."}
                  </p>
                  <select
                    value={language ?? "auto"}
                    onChange={(e) =>
                      setLanguage(
                        e.target.value === "auto" ? null : e.target.value,
                      )
                    }
                    disabled={model.endsWith(".en")}
                    className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-bg-alt)] px-3 py-2 font-mono text-xs text-[var(--pixel-text)] focus:border-[var(--pixel-accent)] focus:outline-none disabled:opacity-50"
                  >
                    {LANGUAGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {error && (
                  <div className="rounded-xl border border-[var(--pixel-warn)] bg-[color-mix(in_oklab,var(--pixel-warn)_10%,transparent)] px-4 py-3 font-mono text-xs text-[var(--pixel-warn)]">
                    Error: {error}
                  </div>
                )}

                {/* Start button */}
                <motion.button
                  whileTap={{ scale: pendingFile ? 0.98 : 1 }}
                  disabled={!pendingFile}
                  onClick={handleStart}
                  className={`w-full rounded-xl border px-6 py-3 font-sans font-semibold text-sm tracking-tight transition-all ${
                    pendingFile
                      ? "border-[var(--pixel-accent)] bg-[var(--pixel-accent)] text-[var(--pixel-bg)] shadow-xl shadow-[var(--pixel-glow)] hover:scale-[1.01]"
                      : "border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-[var(--pixel-muted)] cursor-not-allowed"
                  }`}
                >
                  {pendingFile ? "TRANSCRIBE →" : "Pick a file to start"}
                </motion.button>
              </motion.div>
            )}

            {/* ─── Progress stage ─── */}
            {isBusy && (
              <motion.div
                key="progress"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-5 md:p-6"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-sans font-semibold text-sm text-[var(--pixel-accent)]">
                    {status === "decoding" && "Decoding audio..."}
                    {status === "loading" && "Loading model..."}
                    {status === "transcribing" && "Transcribing..."}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--pixel-muted)]">
                    {progressLabel}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--pixel-border)]">
                  <motion.div
                    className="h-full rounded-full bg-[var(--pixel-accent)]"
                    initial={false}
                    animate={{
                      width:
                        status === "transcribing"
                          ? "100%"
                          : `${Math.round(progress * 100)}%`,
                    }}
                    transition={{
                      duration: status === "transcribing" ? 30 : 0.3,
                      ease: status === "transcribing" ? "linear" : "easeOut",
                    }}
                  />
                </div>
                <p className="mt-3 font-mono text-[10px] text-[var(--pixel-muted)]">
                  &gt;{" "}
                  {status === "loading"
                    ? "First run downloads the model (~40–80 MB) and caches it for next time."
                    : status === "transcribing"
                      ? "Whisper is transcribing — this can take a while for long audio."
                      : "Resampling to 16 kHz mono..."}
                </p>
              </motion.div>
            )}

            {/* ─── Result stage ─── */}
            {status === "done" && result && audioFile && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className="space-y-4 md:space-y-5"
              >
                {/* Audio player */}
                {audioObjectUrl && (
                  <div className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-3">
                    <audio
                      ref={audioRef}
                      src={audioObjectUrl}
                      controls
                      className="w-full"
                      onTimeUpdate={(e) =>
                        setAudioCurrentTime(
                          (e.target as HTMLAudioElement).currentTime,
                        )
                      }
                    />
                  </div>
                )}

                {/* Transcript */}
                <TranscriptDisplay
                  result={result}
                  onSeek={handleSeek}
                  currentTime={audioCurrentTime}
                />

                {/* Stats */}
                {audioDuration !== null && elapsed !== null && (
                  <div className="rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-3 font-mono text-[11px] text-[var(--pixel-muted)]">
                    Transcribed{" "}
                    <span className="text-[var(--pixel-text)]">
                      {formatSeconds(audioDuration)}
                    </span>{" "}
                    of audio in{" "}
                    <span className="text-[var(--pixel-text)]">
                      {formatSeconds(elapsed / 1000)}
                    </span>
                    {realtimeFactor !== null && (
                      <>
                        {" — "}
                        <span className="text-[var(--pixel-accent)]">
                          {realtimeFactor.toFixed(1)}× realtime
                        </span>
                      </>
                    )}
                    .
                  </div>
                )}

                {/* Export */}
                <div>
                  <h3 className="mb-2 font-sans font-semibold text-xs text-[var(--pixel-accent)]">
                    EXPORT
                  </h3>
                  <ExportPanel result={result} baseFilename={baseFilename} />
                </div>

                {/* Reset */}
                <button
                  onClick={handleReset}
                  className="w-full rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-2.5 font-sans font-semibold text-xs text-[var(--pixel-muted)] transition-colors hover:text-[var(--pixel-accent)] hover:border-[var(--pixel-accent)]"
                >
                  ↺ TRANSCRIBE ANOTHER FILE
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
