"use client";

import { useCallback, useRef, useState } from "react";

interface Props {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
  currentFile?: File | null;
}

export function AudioUploader({ onFileSelected, disabled, currentFile }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      // Some browsers report empty MIME — let it through anyway and let decode fail later.
      onFileSelected(file);
    },
    [onFileSelected],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      onClick={() => {
        if (!disabled) inputRef.current?.click();
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={[
        "w-full rounded-2xl border-2 border-dashed p-8 md:p-12 text-center cursor-pointer select-none transition-colors",
        disabled ? "opacity-50 cursor-default" : "",
        isDragging
          ? "border-[var(--pixel-accent)] bg-[color-mix(in_oklab,var(--pixel-accent)_15%,transparent)]"
          : "border-[var(--pixel-border)] hover:border-[var(--pixel-accent)] hover:bg-[var(--pixel-bg-alt)]",
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,video/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="font-sans font-semibold text-sm md:text-base text-[var(--pixel-accent)] mb-2">
        {currentFile ? currentFile.name : "Drop audio here or click to upload"}
      </div>
      <div className="font-mono text-[10px] md:text-xs text-[var(--pixel-muted)]">
        {currentFile
          ? `${(currentFile.size / 1024 / 1024).toFixed(2)} MB · ${currentFile.type || "audio file"}`
          : "Supports MP3, WAV, M4A, OGG, MP4 video, etc. Audio never leaves your device."}
      </div>
    </div>
  );
}
