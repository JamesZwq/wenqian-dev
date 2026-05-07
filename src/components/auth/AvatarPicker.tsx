"use client";
import { useRef, useState } from "react";
import Image from "next/image";

interface Props {
  currentUrl: string | null;
  onChanged: () => void;
}

const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const TARGET_BYTES = 50 * 1024;
const SIZE = 256;

async function compress(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not supported");
  // Center-crop, preserve aspect.
  const ratio = Math.min(bmp.width, bmp.height);
  const sx = (bmp.width - ratio) / 2;
  const sy = (bmp.height - ratio) / 2;
  ctx.drawImage(bmp, sx, sy, ratio, ratio, 0, 0, SIZE, SIZE);

  for (const q of [0.85, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", q));
    if (!blob) throw new Error("WebP encoding not supported");
    if (blob.size <= TARGET_BYTES) return blob;
  }
  throw new Error(
    `Image still > ${Math.round(TARGET_BYTES / 1024)} KB at quality 0.55 — try a different image.`,
  );
}

export function AvatarPicker({ currentUrl, onChanged }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > MAX_INPUT_BYTES) {
      setError("File too large (max 5 MB before compression).");
      return;
    }
    setBusy(true);
    try {
      const blob = await compress(file);
      setPreviewUrl(URL.createObjectURL(blob));
      const fd = new FormData();
      fd.append("file", blob, "avatar.webp");
      const res = await fetch("/api/account/avatar", { method: "POST", body: fd });
      if (!res.ok) {
        setError(`Upload failed: ${res.status} ${await res.text()}`);
        return;
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compression failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/avatar", { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError(`Remove failed: ${res.status}`);
      return;
    }
    setPreviewUrl(null);
    onChanged();
  }

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {previewUrl && (
        <Image
          src={previewUrl}
          alt="Avatar"
          width={64}
          height={64}
          className="rounded-full border-2"
          style={{ borderColor: "var(--pixel-border)" }}
        />
      )}
      <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onPick} />
      <button
        type="button"
        disabled={busy}
        onClick={() => fileInput.current?.click()}
        className="rounded-xl border-2 px-4 py-2 font-sans text-xs font-semibold disabled:opacity-60"
        style={{ borderColor: "var(--pixel-accent)", color: "var(--pixel-accent)" }}
      >
        {busy ? "WORKING…" : currentUrl ? "REPLACE" : "UPLOAD"}
      </button>
      {currentUrl && (
        <button
          type="button"
          disabled={busy}
          onClick={remove}
          className="rounded-xl border-2 px-4 py-2 font-sans text-xs font-semibold disabled:opacity-60"
          style={{ borderColor: "var(--pixel-border)", color: "var(--pixel-muted)" }}
        >
          REMOVE
        </button>
      )}
      {error && (
        <span className="font-mono text-xs" style={{ color: "#ef4444" }}>
          {error}
        </span>
      )}
    </div>
  );
}
