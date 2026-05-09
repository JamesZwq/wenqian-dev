"use client";
import { useState } from "react";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@/lib/rooms/codes";

export function JoinByCodeInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (code: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  const sanitize = (s: string) =>
    s
      .toUpperCase()
      .split("")
      .filter((c) => ROOM_CODE_ALPHABET.includes(c))
      .join("")
      .slice(0, ROOM_CODE_LENGTH);

  const isComplete = value.length === ROOM_CODE_LENGTH;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (isComplete) onSubmit(value); }}
      className="flex items-center gap-2"
    >
      <input
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(sanitize(e.target.value))}
        onPaste={(e) => {
          const txt = e.clipboardData.getData("text");
          const clean = sanitize(txt);
          if (clean.length === ROOM_CODE_LENGTH) {
            e.preventDefault();
            setValue(clean);
            onSubmit(clean);
          }
        }}
        placeholder="ENTER 6-CHAR CODE"
        className="font-mono tracking-[0.4em] uppercase rounded-xl border-2 px-4 py-2 text-center"
        style={{
          background: "var(--pixel-card-bg)",
          borderColor: "var(--pixel-border)",
          color: "var(--pixel-text)",
          width: "16rem",
        }}
        maxLength={ROOM_CODE_LENGTH}
        disabled={disabled}
      />
      <button
        type="submit"
        disabled={disabled || !isComplete}
        className="rounded-xl border-2 px-3 py-2 font-mono text-xs font-semibold tracking-widest disabled:opacity-50"
        style={{
          background: "var(--pixel-accent)",
          color: "var(--pixel-bg)",
          borderColor: "var(--pixel-accent)",
        }}
      >
        JOIN
      </button>
    </form>
  );
}
