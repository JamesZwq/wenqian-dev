"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Difficulty } from "./mazeGenerator";
import type { ItemFrequency } from "./items";

export type GameSettings = {
  rows: number;
  cols: number;
  difficulty: Difficulty;
  itemsEnabled: boolean;
  itemFrequency: ItemFrequency;
};

export const DEFAULT_SETTINGS: GameSettings = {
  rows: 15,
  cols: 15,
  difficulty: "normal",
  itemsEnabled: true,
  itemFrequency: "medium",
};

type Props = {
  open: boolean;
  settings: GameSettings;
  onChange: (s: GameSettings) => void;
  onClose: () => void;
};

function ensureOdd(v: number) {
  return v % 2 === 0 ? v + 1 : v;
}

export default function SettingsPanel({ open, settings, onChange, onClose }: Props) {
  const update = (partial: Partial<GameSettings>) =>
    onChange({ ...settings, ...partial });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="settings-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="mx-4 w-full max-w-[420px] rounded-2xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] p-5 shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-sm md:p-6"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-sans font-semibold text-sm tracking-tight text-[var(--pixel-accent)]">
                SETTINGS
              </h2>
              <button
                onClick={onClose}
                className="font-sans font-semibold text-xs text-[var(--pixel-muted)] transition-colors hover:text-[var(--pixel-accent)]"
              >
                X
              </button>
            </div>

            {/* Maze Rows */}
            <div className="mb-4">
              <label className="mb-1 block font-mono text-[11px] text-[var(--pixel-muted)]">
                ROWS: {settings.rows}
              </label>
              <input
                type="range"
                min={7}
                max={31}
                step={2}
                value={settings.rows}
                onChange={(e) => update({ rows: ensureOdd(Number(e.target.value)) })}
                className="w-full accent-[var(--pixel-accent)]"
              />
              <div className="flex justify-between font-mono text-[9px] text-[var(--pixel-muted)]">
                <span>7</span><span>31</span>
              </div>
            </div>

            {/* Maze Cols */}
            <div className="mb-4">
              <label className="mb-1 block font-mono text-[11px] text-[var(--pixel-muted)]">
                COLS: {settings.cols}
              </label>
              <input
                type="range"
                min={7}
                max={31}
                step={2}
                value={settings.cols}
                onChange={(e) => update({ cols: ensureOdd(Number(e.target.value)) })}
                className="w-full accent-[var(--pixel-accent)]"
              />
              <div className="flex justify-between font-mono text-[9px] text-[var(--pixel-muted)]">
                <span>7</span><span>31</span>
              </div>
            </div>

            {/* Difficulty */}
            <div className="mb-4">
              <label className="mb-2 block font-mono text-[11px] text-[var(--pixel-muted)]">
                DIFFICULTY
              </label>
              <div className="flex gap-2">
                {(["easy", "normal", "hard"] as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => update({ difficulty: d })}
                    className={`flex-1 rounded-xl border px-2 py-1.5 font-sans font-semibold text-[9px] uppercase transition-colors ${
                      settings.difficulty === d
                        ? "border-[var(--pixel-accent)] bg-[var(--pixel-accent)] text-[var(--pixel-bg)]"
                        : "border-[var(--pixel-border)] text-[var(--pixel-muted)] hover:border-[var(--pixel-accent)]"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Items Toggle */}
            <div className="mb-4 flex items-center justify-between">
              <label className="font-mono text-[11px] text-[var(--pixel-muted)]">
                ITEMS
              </label>
              <button
                onClick={() => update({ itemsEnabled: !settings.itemsEnabled })}
                className={`rounded-xl border px-3 py-1 font-sans font-semibold text-[9px] transition-colors ${
                  settings.itemsEnabled
                    ? "border-[var(--pixel-accent)] bg-[var(--pixel-accent)] text-[var(--pixel-bg)]"
                    : "border-[var(--pixel-border)] text-[var(--pixel-muted)]"
                }`}
              >
                {settings.itemsEnabled ? "ON" : "OFF"}
              </button>
            </div>

            {/* Item Frequency */}
            {settings.itemsEnabled && (
              <div className="mb-2">
                <label className="mb-2 block font-mono text-[11px] text-[var(--pixel-muted)]">
                  ITEM FREQ
                </label>
                <div className="flex gap-2">
                  {(["low", "medium", "high"] as ItemFrequency[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => update({ itemFrequency: f })}
                      className={`flex-1 rounded-xl border px-2 py-1.5 font-sans font-semibold text-[9px] uppercase transition-colors ${
                        settings.itemFrequency === f
                          ? "border-[var(--pixel-accent-2)] bg-[var(--pixel-accent-2)] text-[var(--pixel-bg)]"
                          : "border-[var(--pixel-border)] text-[var(--pixel-muted)] hover:border-[var(--pixel-accent-2)]"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
