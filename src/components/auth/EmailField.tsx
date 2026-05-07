"use client";

interface Props {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoFocus?: boolean;
  label?: string;
  name?: string;
  autoComplete?: string;
}

export function EmailField({
  value,
  onChange,
  required = true,
  autoFocus,
  label = "Email",
  name = "email",
  autoComplete = "email",
}: Props) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] tracking-widest" style={{ color: "var(--pixel-muted)" }}>
        {label.toUpperCase()}
      </span>
      <input
        type="email"
        name={name}
        autoComplete={autoComplete}
        required={required}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border-2 px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-[var(--pixel-accent)]"
        style={{
          background: "var(--pixel-bg-alt)",
          borderColor: "var(--pixel-border)",
          color: "var(--pixel-text)",
        }}
      />
    </label>
  );
}
