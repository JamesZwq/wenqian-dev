/**
 * Decode an uploaded audio (or video) file into a 16 kHz mono Float32Array,
 * the input format expected by Whisper.
 */
export async function decodeAudioFile(file: File): Promise<Float32Array> {
  const TARGET_SAMPLE_RATE = 16000;
  const arrayBuffer = await file.arrayBuffer();

  // Decode at original sample rate using a temporary AudioContext.
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const tmpCtx = new AudioCtx();

  let decoded: AudioBuffer;
  try {
    decoded = await tmpCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await tmpCtx.close().catch(() => undefined);
  }

  // Resample to 16 kHz mono via OfflineAudioContext.
  const targetLength = Math.max(1, Math.ceil(decoded.duration * TARGET_SAMPLE_RATE));
  const offlineCtx = new OfflineAudioContext(
    1, // mono
    targetLength,
    TARGET_SAMPLE_RATE,
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start();
  const rendered = await offlineCtx.startRendering();

  // OfflineAudioContext with `numberOfChannels: 1` automatically downmixes.
  return rendered.getChannelData(0);
}
