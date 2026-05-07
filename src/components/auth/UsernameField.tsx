"use client";
import { validateUsername } from "@/lib/username";

interface Props {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}

export function UsernameField({ value, onChange, required = true }: Props) {
  const v = validateUsername(value);
  const showError = value.length > 0 && !v.ok;
  const errorReason = !v.ok ? v.reason : "";
  return (
    <label className="block">
      <span className="font-mono text-[10px] tracking-widest" style={{ color: "var(--pixel-muted)" }}>
        USERNAME
      </span>
      <input
        type="text"
        name="username"
        autoComplete="username"
        required={required}
        minLength={3}
        maxLength={20}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border-2 px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-[var(--pixel-accent)]"
        style={{
          background: "var(--pixel-bg-alt)",
          borderColor: showError ? "#ef4444" : "var(--pixel-border)",
          color: "var(--pixel-text)",
        }}
      />
      <span
        className="block mt-1 font-mono text-[10px]"
        style={{ color: showError ? "#ef4444" : "var(--pixel-muted)" }}
      >
        {showError ? errorReason : "3–20 chars: a–z, A–Z, 0–9, _, -"}
      </span>
    </label>
  );
}
