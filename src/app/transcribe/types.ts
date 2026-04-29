export type ModelId =
  | "Xenova/whisper-tiny"
  | "Xenova/whisper-base"
  | "onnx-community/whisper-base_timestamped"
  | "Xenova/whisper-tiny.en"
  | "Xenova/whisper-base.en";

export interface ModelOption {
  id: ModelId;
  label: string;
  size: string; // human readable, e.g. "39 MB"
  language: "multi" | "en";
  description: string;
}

export const MODELS: ModelOption[] = [
  {
    id: "Xenova/whisper-tiny",
    label: "Tiny (multilingual)",
    size: "~39 MB",
    language: "multi",
    description: "Fastest. OK for clean audio in any language.",
  },
  {
    id: "Xenova/whisper-base",
    label: "Base (multilingual)",
    size: "~74 MB",
    language: "multi",
    description: "Recommended. Better accuracy.",
  },
  {
    id: "Xenova/whisper-tiny.en",
    label: "Tiny (English only)",
    size: "~39 MB",
    language: "en",
    description: "Fastest English-only model.",
  },
  {
    id: "Xenova/whisper-base.en",
    label: "Base (English only)",
    size: "~74 MB",
    language: "en",
    description: "Better English accuracy.",
  },
];

export interface TranscriptChunk {
  text: string;
  // [start, end] in seconds. `end` may be null for the last chunk while streaming.
  timestamp: [number, number | null];
}

export interface TranscriptResult {
  text: string;
  chunks: TranscriptChunk[];
}

// Worker message protocol
export type WorkerInbound =
  | { type: "load"; model: ModelId }
  | { type: "transcribe"; audio: Float32Array; language: string | null };

export type WorkerOutbound =
  | { type: "loading"; progress: number; status: string } // model download
  | { type: "ready" }
  | { type: "transcribing-progress"; progress: number } // optional, may not always be available
  | { type: "result"; result: TranscriptResult }
  | { type: "error"; message: string };

export type Status =
  | "idle"
  | "decoding"
  | "loading"
  | "ready"
  | "transcribing"
  | "done"
  | "error";

export type ExportFormat = "srt" | "vtt" | "lrc" | "txt" | "json";
