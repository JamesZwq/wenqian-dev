export type ModelId =
  | "Xenova/whisper-tiny"
  | "Xenova/whisper-base"
  | "Xenova/whisper-small"
  | "onnx-community/whisper-base_timestamped"
  | "onnx-community/whisper-large-v3-turbo"
  | "Xenova/whisper-tiny.en"
  | "Xenova/whisper-base.en";

export interface ModelOption {
  id: ModelId;
  label: string;
  size: string; // human readable
  language: "multi" | "en";
  description: string;
  /** Recommended for Chinese / Japanese / Korean / Arabic / etc. */
  goodForCJK?: boolean;
}

export const MODELS: ModelOption[] = [
  {
    id: "Xenova/whisper-tiny",
    label: "Tiny (multilingual)",
    size: "~80 MB",
    language: "multi",
    description: "Fastest. Decent for English, weak on Chinese/Japanese/Korean.",
  },
  {
    id: "Xenova/whisper-base",
    label: "Base (multilingual)",
    size: "~150 MB",
    language: "multi",
    description: "Better English accuracy. Still weak on CJK languages.",
  },
  {
    id: "Xenova/whisper-small",
    label: "Small (multilingual) — best for Chinese",
    size: "~250 MB",
    language: "multi",
    description: "Recommended for Chinese / Japanese / Korean. Slower but actually usable for CJK.",
    goodForCJK: true,
  },
  {
    id: "onnx-community/whisper-large-v3-turbo",
    label: "Large v3 Turbo — highest accuracy",
    size: "~800 MB",
    language: "multi",
    description: "Best quality across all languages. Heavy download, slower inference, but state-of-the-art for CJK and noisy audio.",
    goodForCJK: true,
  },
  {
    id: "Xenova/whisper-tiny.en",
    label: "Tiny (English only)",
    size: "~80 MB",
    language: "en",
    description: "Fastest English-only model.",
  },
  {
    id: "Xenova/whisper-base.en",
    label: "Base (English only)",
    size: "~150 MB",
    language: "en",
    description: "Best English-only accuracy at small size.",
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
