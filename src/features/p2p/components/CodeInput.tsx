"use client";

import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface CodeInputProps {
  length?: number;
  label?: string;
  disabled?: boolean;
  status?: "idle" | "connecting" | "error" | "success";
  resetSignal?: number;
  onComplete: (code: string) => void;
}

const STATUS_TONE: Record<NonNullable<CodeInputProps["status"]>, string> = {
  idle: "border-[var(--pixel-border)]",
  connecting: "border-[var(--pixel-accent-2)]",
  error: "border-[var(--pixel-warn)]",
  success: "border-[var(--pixel-accent)]",
};

export default function CodeInput({
  length = 6,
  label = "CONNECT_TO_PEER",
  disabled = false,
  status = "idle",
  resetSignal = 0,
  onComplete,
}: CodeInputProps) {
  const [chars, setChars] = useState<string[]>(() => Array(length).fill(""));
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const isFilled = useMemo(() => chars.every(Boolean), [chars]);

  useEffect(() => {
    // 只在 error 状态且 resetSignal 变化时才清空
    if (status === "error" && resetSignal > 0) {
      setChars(Array(length).fill(""));
      setFocusedIndex(0);

      requestAnimationFrame(() => {
        inputRefs.current[0]?.focus();
      });
    }
  }, [length, resetSignal, status]);

  useEffect(() => {
    if (disabled) return;
    requestAnimationFrame(() => {
      inputRefs.current[Math.min(focusedIndex, length - 1)]?.focus();
    });
  }, [disabled, focusedIndex, length]);

  useEffect(() => {
    if (!isFilled) return;
    onComplete(chars.join(""));
  }, [chars, isFilled, onComplete]);

  const writeChar = (index: number, rawValue: string) => {
    if (disabled) return;

    const nextValue = rawValue.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-1);
    const nextChars = [...chars];
    nextChars[index] = nextValue;
    setChars(nextChars);

    if (nextValue && index < length - 1) {
      setFocusedIndex(index + 1);
    }
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (event.key === "Backspace") {
      event.preventDefault();
      if (chars[index]) {
        const nextChars = [...chars];
        nextChars[index] = "";
        setChars(nextChars);
        return;
      }

      if (index > 0) {
        const nextChars = [...chars];
        nextChars[index - 1] = "";
        setChars(nextChars);
        setFocusedIndex(index - 1);
      }
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      setFocusedIndex(index - 1);
      return;
    }

    if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault();
      setFocusedIndex(index + 1);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    event.preventDefault();
    const normalized = event.clipboardData
      .getData("text")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, length);

    if (!normalized) return;

    const nextChars = Array(length).fill("");
    normalized.split("").forEach((char, index) => {
      nextChars[index] = char;
    });

    setChars(nextChars);
    setFocusedIndex(Math.min(normalized.length, length - 1));
  };

  const connectingWave =
    status === "connecting"
      ? {
          y: [0, -8, 0],
          transition: {
            duration: 0.8,
            repeat: Infinity,
            ease: "easeInOut" as const,
          },
        }
      : { y: 0 };

  return (
    <div className="w-full">
      <label className="mb-3 block font-sans font-semibold text-[10px] tracking-tight text-[var(--pixel-accent)] md:text-xs">
        {label}
      </label>

      <div className="flex justify-center gap-1.5 md:gap-3">
        {chars.map((char, index) => {
          const isFocused = focusedIndex === index;

          return (
            <motion.div
              key={index}
              animate={connectingWave}
              transition={{ delay: index * 0.08 }}
              className="relative"
            >
              <input
                ref={(node) => {
                  inputRefs.current[index] = node;
                }}
                value={char}
                inputMode="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={1}
                disabled={disabled}
                onChange={(event) => writeChar(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                onPaste={handlePaste}
                onFocus={() => setFocusedIndex(index)}
                className={`
                  h-12 w-10 rounded-xl border bg-[var(--pixel-bg)] text-center
                  font-sans font-bold text-xl text-transparent
                  caret-transparent transition-all duration-200 focus:outline-none
                  md:h-16 md:w-14 md:text-3xl
                  ${STATUS_TONE[status]}
                  ${disabled ? "cursor-not-allowed opacity-70" : "cursor-text"}
                  ${char ? "shadow-xl shadow-[var(--pixel-glow)]" : "shadow-none"}
                `}
              />

              {isFocused && !disabled && !char && status === "idle" && (
                <motion.div
                  className="pointer-events-none absolute inset-0 rounded-xl border border-[var(--pixel-accent-2)]"
                  animate={{ opacity: [0.25, 1, 0.25] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
              )}

              <AnimatePresence initial={false}>
                {char && (
                  <motion.div
                    key={`${index}-${char}`}
                    initial={{ scale: 0.7, opacity: 0, rotate: -8 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0.7, opacity: 0, rotate: 8 }}
                    transition={{ duration: 0.15 }}
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                  >
                    <span className="font-sans font-bold text-xl text-[var(--pixel-accent)] md:text-3xl">
                      {char}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
