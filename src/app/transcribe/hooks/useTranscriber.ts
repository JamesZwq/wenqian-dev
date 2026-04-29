"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ModelId,
  Status,
  TranscriptResult,
  WorkerInbound,
  WorkerOutbound,
} from "../types";
import { decodeAudioFile } from "../utils/audio";

export function useTranscriber() {
  const [status, setStatus] = useState<Status>("idle");
  const [model, setModel] = useState<ModelId>("Xenova/whisper-base");
  const [language, setLanguage] = useState<string | null>(null); // null = autodetect
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState<string>("");
  const [result, setResult] = useState<TranscriptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const loadedModelRef = useRef<ModelId | null>(null);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(
      new URL("../workers/transcriber.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.addEventListener("message", (e: MessageEvent<WorkerOutbound>) => {
      const msg = e.data;
      if (msg.type === "loading") {
        setProgress(Math.max(0, Math.min(1, msg.progress)));
        setProgressLabel(msg.status);
      } else if (msg.type === "ready") {
        setProgress(1);
        setProgressLabel("Ready");
      } else if (msg.type === "result") {
        setResult(msg.result);
        if (startedAtRef.current !== null) {
          setElapsed(performance.now() - startedAtRef.current);
        }
        setStatus("done");
      } else if (msg.type === "error") {
        setError(msg.message);
        setStatus("error");
      }
    });
    workerRef.current = worker;
    return worker;
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setProgress(0);
    setProgressLabel("");
    setResult(null);
    setError(null);
    setElapsed(null);
    startedAtRef.current = null;
  }, []);

  const transcribe = useCallback(
    async (file: File) => {
      try {
        // Reset transient state but keep loaded model in worker.
        setStatus("idle");
        setProgress(0);
        setProgressLabel("");
        setResult(null);
        setError(null);
        setElapsed(null);
        startedAtRef.current = null;

        setAudioFile(file);
        setStatus("decoding");
        setProgressLabel("Decoding audio...");

        // Decode audio (resample to 16 kHz mono).
        const audio = await decodeAudioFile(file, {
          onStage: (stage) => setProgressLabel(stage),
        });
        setAudioDuration(audio.length / 16000);

        // Ensure model loaded.
        const worker = ensureWorker();
        if (loadedModelRef.current !== model) {
          setStatus("loading");
          setProgressLabel("Loading model...");
          worker.postMessage({ type: "load", model } satisfies WorkerInbound);

          await new Promise<void>((resolve, reject) => {
            const onMsg = (e: MessageEvent<WorkerOutbound>) => {
              if (e.data.type === "ready") {
                loadedModelRef.current = model;
                worker.removeEventListener("message", onMsg);
                resolve();
              } else if (e.data.type === "error") {
                worker.removeEventListener("message", onMsg);
                reject(new Error(e.data.message));
              }
            };
            worker.addEventListener("message", onMsg);
          });
        }

        setStatus("transcribing");
        setProgress(0);
        setProgressLabel("Transcribing...");
        startedAtRef.current = performance.now();
        worker.postMessage({
          type: "transcribe",
          audio,
          language,
        } satisfies WorkerInbound);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    },
    [ensureWorker, model, language],
  );

  return {
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
  };
}
