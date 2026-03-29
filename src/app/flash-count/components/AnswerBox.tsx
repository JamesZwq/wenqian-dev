"use client";

import { motion } from "framer-motion";
import type { QuestionResult } from "../types";

export function AnswerBox({
  label,
  submitted,
  result,
  isMe,
}: {
  label: string;
  submitted: boolean;
  result: QuestionResult | null;
  isMe: boolean;
}) {
  const revealed = result !== null;
  const answer = isMe ? result?.myAnswer : result?.opponentAnswer;
  const correct = isMe ? result?.myCorrect : result?.opponentCorrect;

  return (
    <div className="flex flex-col items-center gap-1.5 flex-1">
      <span className="font-mono text-[10px] text-[var(--pixel-muted)] uppercase tracking-wider">{label}</span>
      <motion.div
        animate={revealed ? { scale: [1, 1.08, 1] } : {}}
        transition={{ duration: 0.3 }}
        className={`w-full rounded-xl border-2 px-4 py-3 text-center font-mono text-2xl font-bold transition-all duration-300 ${
          revealed
            ? correct
              ? "border-[#22c55e] bg-[#22c55e]/15 text-[#22c55e]"
              : "border-[#ef4444] bg-[#ef4444]/15 text-[#ef4444]"
            : submitted
              ? "border-[var(--pixel-accent-2)] bg-[var(--pixel-accent-2)]/10 text-[var(--pixel-muted)]"
              : "border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-[var(--pixel-muted)]"
        }`}
      >
        {revealed ? answer : submitted ? "★" : "—"}
      </motion.div>
      {revealed && (
        <span className={`font-mono text-xs font-bold ${correct ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
          {correct ? "✓ CORRECT" : `✗ WAS ${result!.correct}`}
        </span>
      )}
    </div>
  );
}
