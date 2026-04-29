/**
 * Decode an uploaded audio (or video) file into a 16 kHz mono Float32Array,
 * the input format expected by Whisper.
 *
 * Throws a friendly Error when decoding fails (typically because the browser
 * doesn't support the codec/container).
 */
export async function decodeAudioFile(file: File): Promise<Float32Array> {
  const TARGET_SAMPLE_RATE = 16000;

  // ── Sanity checks ──────────────────────────────────────────
  if (!file || file.size === 0) {
    throw new Error("File is empty (0 bytes). Please pick a valid audio file.");
  }
  // 500 MB upper bound — beyond this most browsers will OOM during decode anyway.
  if (file.size > 500 * 1024 * 1024) {
    throw new Error(
      `File is ${(file.size / 1024 / 1024).toFixed(1)} MB. Browser decoding is limited to ~500 MB. Try a shorter clip or convert to MP3.`,
    );
  }

  const arrayBuffer = await file.arrayBuffer();

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) {
    throw new Error(
      "Your browser doesn't support the Web Audio API. Try a recent Chrome, Edge, Safari, or Firefox.",
    );
  }

  const tmpCtx = new AudioCtx();

  let decoded: AudioBuffer;
  try {
    // Pass a fresh copy — some browsers detach the original buffer on failure.
    decoded = await tmpCtx.decodeAudioData(arrayBuffer.slice(0));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    const type = file.type || "unknown";
    // Build a helpful error based on what we know.
    const supported = "MP3, WAV, FLAC, OGG/Vorbis, M4A/AAC";
    let hint = `Browser can't decode this file. Detected: ${type || `.${ext}`}. Most browsers support: ${supported}.`;
    if (ext === "opus" || /opus/i.test(type)) {
      hint += "\n\nOpus inside Ogg works; raw .opus files often don't. Try re-saving as .ogg or convert to MP3.";
    } else if (ext === "webm" || /webm/i.test(type)) {
      hint += "\n\nWebM container support varies by browser. Try converting to MP3 or WAV.";
    } else if (ext === "amr" || /amr/i.test(type)) {
      hint += "\n\nAMR (some voice-memo formats) is not supported. Convert to MP3 or M4A.";
    } else if (/video/i.test(type) || ["mov", "mp4", "mkv", "avi"].includes(ext)) {
      hint += "\n\nFor video files, try extracting just the audio track (e.g. with QuickTime → Export Audio Only, or FFmpeg).";
    } else {
      hint += "\n\nIf the file plays in your browser elsewhere, this could be a codec quirk — converting to MP3 or WAV almost always fixes it.";
    }
    if (detail && detail !== "Unable to decode audio data") {
      hint += `\n\n(Browser said: ${detail})`;
    }
    throw new Error(hint);
  } finally {
    await tmpCtx.close().catch(() => undefined);
  }

  if (decoded.duration === 0 || decoded.length === 0) {
    throw new Error("Decoded audio has zero length. The file may be silent or corrupt.");
  }

  // Resample to 16 kHz mono via OfflineAudioContext.
  const targetLength = Math.max(1, Math.ceil(decoded.duration * TARGET_SAMPLE_RATE));
  const offlineCtx = new OfflineAudioContext(
    1, // mono — auto-downmix from any source channel count
    targetLength,
    TARGET_SAMPLE_RATE,
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start();
  const rendered = await offlineCtx.startRendering();

  return rendered.getChannelData(0);
}
