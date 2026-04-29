/// <reference lib="webworker" />

import { pipeline } from "@huggingface/transformers";
import type { ModelId, WorkerInbound, WorkerOutbound } from "../types";

// `pipeline` returns a callable instance whose generic shape varies by task.
// We type it loosely here and rely on the worker protocol contract instead.
type AsrPipeline = ((
  audio: Float32Array,
  opts: Record<string, unknown>,
) => Promise<{
  text: string;
  chunks?: { text: string; timestamp: [number, number | null] }[];
}>) & { dispose?: () => Promise<void> };

let pipe: AsrPipeline | null = null;
let loadedModel: ModelId | null = null;

function send(msg: WorkerOutbound) {
  (self as unknown as Worker).postMessage(msg);
}

self.addEventListener("message", async (e: MessageEvent<WorkerInbound>) => {
  try {
    const data = e.data;
    if (data.type === "load") {
      if (loadedModel !== data.model || !pipe) {
        // If switching models, dispose the old pipeline to free memory.
        if (pipe?.dispose) {
          try {
            await pipe.dispose();
          } catch {
            // ignore
          }
        }
        pipe = null;

        const created = (await pipeline("automatic-speech-recognition", data.model, {
          // fp32 unquantized is the only Whisper variant that consistently
          // works across browsers / ONNX Runtime web versions. The q4 path
          // has a broken scale tensor (`TransposeDQWeightsForMatMulNBits
          // Missing required scale`) and per-component dtype overrides are
          // silently ignored on some setups.
          // Bigger download (~80 MB tiny / ~200 MB base) but bullet-proof.
          dtype: "fp32",
          // Force WASM. WebGPU only saves time once the model loads, and
          // pulling MatMulNBits / DequantizeLinear paths into the Web Worker
          // is what triggers the scale-missing error on Chrome.
          device: "wasm",
          progress_callback: (p: unknown) => {
            const info = p as { status?: string; progress?: number; file?: string };
            send({
              type: "loading",
              progress: typeof info.progress === "number" ? info.progress / 100 : 0,
              status: info.status ?? "loading",
            });
          },
        })) as unknown as AsrPipeline;

        pipe = created;
        loadedModel = data.model;
      }
      send({ type: "ready" });
    } else if (data.type === "transcribe") {
      if (!pipe) {
        send({ type: "error", message: "Model not loaded" });
        return;
      }

      const result = await pipe(data.audio, {
        language: data.language ?? undefined,
        task: "transcribe",
        return_timestamps: true,
        chunk_length_s: 30,
        stride_length_s: 5,
      });

      send({
        type: "result",
        result: {
          text: typeof result?.text === "string" ? result.text : "",
          chunks: Array.isArray(result?.chunks)
            ? result.chunks.map((c) => ({
                text: String(c.text ?? ""),
                timestamp: [
                  Number(c.timestamp?.[0] ?? 0),
                  c.timestamp?.[1] == null ? null : Number(c.timestamp[1]),
                ] as [number, number | null],
              }))
            : [],
        },
      });
    }
  } catch (err) {
    send({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

export {};
