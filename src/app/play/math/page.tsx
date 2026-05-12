"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { generateQuestionSet, type Question } from "@/app/math/mathEngine";
import { useRoomRaceRelay } from "@/features/rooms/hooks/useRoomRaceRelay";
import { RoomRaceShell } from "@/features/rooms/components/RoomRaceShell";

interface MathPuzzle { questions: Question[] }
const TOTAL_QUESTIONS = 20;

export default function MathPlayPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    const c = params.get("room");
    if (!c) { router.replace("/rooms/math"); return; }
    setCode(c);
  }, [params, router]);

  if (!code) return null;
  return <Play code={code} />;
}

function Play({ code }: { code: string }) {
  const api = useRoomRaceRelay<MathPuzzle>({
    game: "math",
    roomCode: code,
    totalUnits: TOTAL_QUESTIONS,
    generatePuzzle: () => ({
      questions: generateQuestionSet(["add", "sub"], TOTAL_QUESTIONS),
    }),
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [flashColor, setFlashColor] = useState<"green" | "red" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (api.status === "playing") {
      setCurrentIndex(0);
      setInputValue("");
      setFlashColor(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [api.status, api.puzzle]);

  const questions = api.puzzle?.questions ?? [];
  const currentQ = questions[currentIndex];

  const handleInput = (val: string) => {
    setInputValue(val);
    if (!currentQ) return;
    const answerStr = String(currentQ.answer);
    if (val === "-" && currentQ.answer < 0) return;
    if (val === answerStr) {
      setFlashColor("green");
      const next = currentIndex + 1;
      setTimeout(() => {
        setFlashColor(null);
        setInputValue("");
        if (next >= questions.length) {
          api.reportComplete();
        } else {
          setCurrentIndex(next);
          api.reportProgress(next + 1);
        }
      }, 150);
    } else if (val.length >= answerStr.length && val !== answerStr) {
      setFlashColor("red");
      setTimeout(() => { setFlashColor(null); setInputValue(""); }, 350);
    }
  };

  const lobbyHint = useMemo(() => "20 add/sub questions. First to clear them all wins.", []);

  return (
    <RoomRaceShell game="math" title="Math Sprint" code={code} api={api} lobbyHint={lobbyHint}>
      {currentQ && api.status === "playing" && (
        <div className="flex flex-col items-center gap-4 w-full max-w-md">
          <div className="font-mono text-[10px]" style={{ color: "var(--pixel-muted)" }}>
            {currentIndex + 1} / {questions.length}
          </div>
          <div className="font-mono text-4xl md:text-5xl font-bold" style={{ color: "var(--pixel-text)" }}>
            {currentQ.display} = ?
          </div>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoFocus
            value={inputValue}
            onChange={(e) => handleInput(e.target.value)}
            className="w-32 rounded-xl border-2 px-4 py-3 font-mono text-3xl text-center tabular-nums"
            style={{
              background:
                flashColor === "green"
                  ? "color-mix(in oklab, #22c55e 30%, var(--pixel-card-bg))"
                  : flashColor === "red"
                    ? "color-mix(in oklab, #ef4444 30%, var(--pixel-card-bg))"
                    : "var(--pixel-card-bg)",
              borderColor: "var(--pixel-border)",
              color: "var(--pixel-text)",
            }}
          />
        </div>
      )}
    </RoomRaceShell>
  );
}
