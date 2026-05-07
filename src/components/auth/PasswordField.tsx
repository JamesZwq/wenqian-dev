"use client";
import { useState } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  name?: string;
  required?: boolean;
  autoComplete?: string;
}

export function PasswordField({
  value,
  onChange,
  label = "Password",
  name = "password",
  required = true,
  autoComplete = "current-password",
}: Props) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="font-mono text-[10px] tracking-widest" style={{ color: "var(--pixel-muted)" }}>
        {label.toUpperCase()}
      </span>
      <div className="relative mt-1">
        <input
          type={show ? "text" : "password"}
          name={name}
          autoComplete={autoComplete}
          required={required}
          minLength={8}
          maxLength={100}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border-2 px-3 py-2 pr-16 font-mono text-sm outline-none transition-colors focus:border-[var(--pixel-accent)]"
          style={{
            background: "var(--pixel-bg-alt)",
            borderColor: "var(--pixel-border)",
            color: "var(--pixel-text)",
          }}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 font-mono text-[10px]"
          style={{ color: "var(--pixel-muted)" }}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? "HIDE" : "SHOW"}
        </button>
      </div>
    </label>
  );
}
