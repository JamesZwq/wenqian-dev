"use client";
import type { TimeSlice } from "@/lib/leaderboards/time-slice";

const SLICES: { id: TimeSlice; label: string }[] = [
  { id: "today", label: "TODAY" },
  { id: "week",  label: "WEEK"  },
  { id: "month", label: "MONTH" },
  { id: "all",   label: "ALL"   },
];

export function TimeTabs({ value, onChange }: { value: TimeSlice; onChange: (s: TimeSlice) => void }) {
  return (
    <div
      className="inline-flex rounded-xl border-2 p-1 gap-1"
      style={{ borderColor: "var(--pixel-border)", background: "var(--pixel-bg-alt)" }}
      role="tablist"
    >
      {SLICES.map((s) => {
        const active = s.id === value;
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(s.id)}
            className="px-3 py-1.5 rounded-lg font-mono text-[10px] font-semibold tracking-widest transition-colors"
            style={{
              background: active ? "var(--pixel-accent)" : "transparent",
              color: active ? "var(--pixel-bg)" : "var(--pixel-muted)",
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
