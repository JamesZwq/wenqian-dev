"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const MIN_CAPACITY = 2;

export function CreateRoomModal({
  open,
  onClose,
  onCreate,
  maxCapacity,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (opts: { visibility: "public" | "private"; capacity: number }) => void;
  maxCapacity: number;
}) {
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [capacity, setCapacity] = useState(Math.min(4, maxCapacity));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "color-mix(in oklab, black 60%, transparent)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-sm rounded-2xl border-2 p-6"
            style={{ background: "var(--pixel-card-bg)", borderColor: "var(--pixel-border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-sans text-lg font-bold mb-4" style={{ color: "var(--pixel-text)" }}>
              Create a room
            </h2>

            <label className="block font-mono text-[10px] tracking-widest mb-1" style={{ color: "var(--pixel-muted)" }}>
              VISIBILITY
            </label>
            <div className="flex gap-2 mb-4">
              {(["private", "public"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setVisibility(v)}
                  className="flex-1 rounded-xl border-2 px-3 py-2 font-mono text-xs uppercase"
                  style={{
                    background: visibility === v ? "var(--pixel-accent)" : "transparent",
                    color: visibility === v ? "var(--pixel-bg)" : "var(--pixel-text)",
                    borderColor: "var(--pixel-border)",
                  }}
                >
                  {v}
                </button>
              ))}
            </div>

            <label className="block font-mono text-[10px] tracking-widest mb-1" style={{ color: "var(--pixel-muted)" }}>
              CAPACITY ({capacity})
            </label>
            <input
              type="range"
              min={MIN_CAPACITY}
              max={maxCapacity}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="w-full mb-6"
            />

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border-2 px-3 py-2 font-mono text-xs"
                style={{ borderColor: "var(--pixel-border)", color: "var(--pixel-text)" }}
              >
                CANCEL
              </button>
              <button
                onClick={() => onCreate({ visibility, capacity })}
                className="flex-1 rounded-xl border-2 px-3 py-2 font-mono text-xs font-bold"
                style={{
                  background: "var(--pixel-accent)",
                  color: "var(--pixel-bg)",
                  borderColor: "var(--pixel-accent)",
                }}
              >
                CREATE
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
