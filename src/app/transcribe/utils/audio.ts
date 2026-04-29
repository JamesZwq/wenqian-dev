/**
 * Decode an uploaded audio (or video) file into a 16 kHz mono Float32Array,
 * the input format expected by Whisper.
 *
 * Strategy:
 *   1. Fast path — browser's native decodeAudioData (works for MP3, WAV, OGG,
 *      most M4A/AAC, FLAC). 80%+ of files succeed here.
 *   2. Fallback — lazy-load ffmpeg.wasm, transcode to 16k mono WAV, then decode.
 *      Handles ALAC, weird M4A variants, video files, Opus, AMR, etc.
 *
 * `onStage` is called with human-readable status updates ("Converting via ffmpeg...").
 */

const TARGET_SAMPLE_RATE = 16000;

let ffmpegInstance: import("@ffmpeg/ffmpeg").FFmpeg | null = null;
let ffmpegLoading: Promise<import("@ffmpeg/ffmpeg").FFmpeg> | null = null;

/** Single-threaded ffmpeg core hosted on unpkg — no COOP/COEP setup needed. */
const FFMPEG_CORE_BASE =
  "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";

async function getFFmpeg(): Promise<import("@ffmpeg/ffmpeg").FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoading) return ffmpegLoading;

  ffmpegLoading = (async () => {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { toBlobURL } = await import("@ffmpeg/util");
    const ff = new FFmpeg();
    // Load core from CDN as blob URLs so it works without server-side CORS config.
    await ff.load({
      coreURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegInstance = ff;
    return ff;
  })();

  try {
    return await ffmpegLoading;
  } catch (err) {
    ffmpegLoading = null;
    throw err;
  }
}

async function transcodeToWav(file: File): Promise<ArrayBuffer> {
  const ff = await getFFmpeg();
  const { fetchFile } = await import("@ffmpeg/util");
  const inputName = `input.${(file.name.split(".").pop() ?? "bin").toLowerCase()}`;
  const outputName = "out.wav";
  await ff.writeFile(inputName, await fetchFile(file));
  // Output 16 kHz mono PCM WAV — Whisper-ready, browser-decodable.
  await ff.exec([
    "-i", inputName,
    "-ar", String(TARGET_SAMPLE_RATE),
    "-ac", "1",
    "-c:a", "pcm_s16le",
    "-f", "wav",
    outputName,
  ]);
  const data = await ff.readFile(outputName);
  // Clean up to keep the in-memory FS small for repeated runs.
  try { await ff.deleteFile(inputName); } catch { /* ignore */ }
  try { await ff.deleteFile(outputName); } catch { /* ignore */ }
  // ff.readFile returns Uint8Array (or string for text files).
  if (typeof data === "string") {
    throw new Error("ffmpeg returned text output; expected binary WAV.");
  }
  // Slice into a fresh ArrayBuffer (the underlying buffer may be shared/grown).
  const u8 = data as Uint8Array;
  return u8.slice().buffer;
}

async function decodeArrayBuffer(buf: ArrayBuffer): Promise<Float32Array> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) {
    throw new Error(
      "Your browser doesn't support the Web Audio API. Try a recent Chrome, Edge, Safari, or Firefox.",
    );
  }
  const ctx = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(buf.slice(0));
  } finally {
    await ctx.close().catch(() => undefined);
  }
  if (decoded.duration === 0 || decoded.length === 0) {
    throw new Error("Decoded audio has zero length. The file may be silent or corrupt.");
  }
  // Resample to 16 kHz mono via OfflineAudioContext.
  const targetLength = Math.max(1, Math.ceil(decoded.duration * TARGET_SAMPLE_RATE));
  const offlineCtx = new OfflineAudioContext(1, targetLength, TARGET_SAMPLE_RATE);
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start();
  const rendered = await offlineCtx.startRendering();
  return rendered.getChannelData(0);
}

export interface DecodeOptions {
  /** Called as we move through stages, e.g. "Decoding...", "Converting via ffmpeg...". */
  onStage?: (stage: string) => void;
}

export async function decodeAudioFile(
  file: File,
  opts: DecodeOptions = {},
): Promise<Float32Array> {
  const { onStage } = opts;

  // ── Sanity checks ──────────────────────────────────────────
  if (!file || file.size === 0) {
    throw new Error("File is empty (0 bytes). Please pick a valid audio file.");
  }
  if (file.size > 500 * 1024 * 1024) {
    throw new Error(
      `File is ${(file.size / 1024 / 1024).toFixed(1)} MB. Browser decoding is limited to ~500 MB. Try a shorter clip or convert to MP3.`,
    );
  }

  const arrayBuffer = await file.arrayBuffer();

  // ── Fast path: native decodeAudioData ──────────────────────
  onStage?.("Decoding audio...");
  try {
    return await decodeArrayBuffer(arrayBuffer);
  } catch (nativeErr) {
    // Fall through to ffmpeg fallback below.
    console.warn("[transcribe] Native decodeAudioData failed, falling back to ffmpeg:", nativeErr);
  }

  // ── Slow path: ffmpeg.wasm transcode → WAV → decode ────────
  onStage?.("Format unsupported by browser. Loading ffmpeg (~30 MB, one-time)...");
  let wavBuffer: ArrayBuffer;
  try {
    wavBuffer = await transcodeToWav(file);
  } catch (ffmpegErr) {
    const msg = ffmpegErr instanceof Error ? ffmpegErr.message : String(ffmpegErr);
    throw new Error(
      `Couldn't decode this file even with ffmpeg fallback. The file may be corrupt or use an unusual codec.\n\n(ffmpeg said: ${msg})`,
    );
  }

  onStage?.("Decoding converted WAV...");
  return decodeArrayBuffer(wavBuffer);
}
