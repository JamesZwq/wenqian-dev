"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TrailGrid } from "@/app/trail/components/TrailGrid";
import { targetSequence, type GridSize } from "@/app/trail/types";
import { useRoomRaceRelay } from "@/features/rooms/hooks/useRoomRaceRelay";
import { RoomRaceShell } from "@/features/rooms/components/RoomRaceShell";

interface TrailPuzzle { cells: string[]; size: GridSize }
const SIZE: GridSize = 5;
const SEQ = targetSequence(SIZE);
const TOTAL = SEQ.length;

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function TrailPlayPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    const c = params.get("room");
    if (!c) { router.replace("/rooms/trail"); return; }
    setCode(c);
  }, [params, router]);

  if (!code) return null;
  return <Play code={code} />;
}

function Play({ code }: { code: string }) {
  const api = useRoomRaceRelay<TrailPuzzle>({
    game: "trail",
    roomCode: code,
    totalUnits: TOTAL,
    generatePuzzle: () => ({ cells: shuffle(SEQ), size: SIZE }),
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [wrongClickIndex, setWrongClickIndex] = useState<number | null>(null);

  useEffect(() => {
    if (api.status === "playing") {
      setCurrentIndex(0);
      setWrongClickIndex(null);
    }
  }, [api.status, api.puzzle]);

  const cells = api.puzzle?.cells ?? [];
  const lobbyHint = useMemo(() => `${SIZE}×${SIZE} trail — click 1, A, 2, B, … in order. Fastest wins.`, []);

  const handleCellClick = (index: number) => {
    if (api.status !== "playing") return;
    const cell = cells[index];
    if (cell === SEQ[currentIndex]) {
      const next = currentIndex + 1;
      setCurrentIndex(next);
      api.reportProgress(next + 1); // 1-based for UI consistency with shell
      if (next >= SEQ.length) {
        api.reportComplete();
      }
    } else {
      setWrongClickIndex(index);
      setTimeout(() => setWrongClickIndex(null), 500);
    }
  };

  return (
    <RoomRaceShell game="trail" title="Trail Making" code={code} api={api} lobbyHint={lobbyHint}>
      <TrailGrid
        cells={cells}
        size={SIZE}
        currentIndex={currentIndex}
        wrongClickIndex={wrongClickIndex}
        onCellClick={handleCellClick}
        disabled={api.status !== "playing"}
      />
      <p className="font-mono text-xs" style={{ color: "var(--pixel-muted)" }}>
        next: {SEQ[currentIndex] ?? "—"}
      </p>
    </RoomRaceShell>
  );
}
