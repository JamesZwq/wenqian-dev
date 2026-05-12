"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SudokuBoard } from "@/app/sudoku/components/SudokuBoard";
import { generatePuzzle as genSudokuPuzzle } from "@/app/sudoku/sudokuGenerator";
import type { CellPos } from "@/app/sudoku/types";
import { useRoomRaceRelay } from "@/features/rooms/hooks/useRoomRaceRelay";
import { RoomRaceShell } from "@/features/rooms/components/RoomRaceShell";

interface SudokuPuzzle { puzzle: number[][]; solution: number[][] }
const TOTAL = 81;

export default function SudokuPlayPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    const c = params.get("room");
    if (!c) { router.replace("/rooms/sudoku"); return; }
    setCode(c);
  }, [params, router]);

  if (!code) return null;
  return <Play code={code} />;
}

function emptyBoard9x9(): number[][] {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}
function falseBoard9x9(): boolean[][] {
  return Array.from({ length: 9 }, () => Array(9).fill(false));
}

function Play({ code }: { code: string }) {
  const api = useRoomRaceRelay<SudokuPuzzle>({
    game: "sudoku",
    roomCode: code,
    totalUnits: TOTAL,
    generatePuzzle: () => genSudokuPuzzle("medium"),
  });

  const [board, setBoard] = useState<number[][]>(emptyBoard9x9);
  const [locked, setLocked] = useState<boolean[][]>(falseBoard9x9);
  const [selected, setSelected] = useState<CellPos | null>(null);

  // Initialise board from puzzle when a new race starts.
  useEffect(() => {
    if (!api.puzzle) return;
    setBoard(api.puzzle.puzzle.map((r) => [...r]));
    setLocked(api.puzzle.puzzle.map((r) => r.map((v) => v !== 0)));
    setSelected(null);
  }, [api.puzzle]);

  const solution = api.puzzle?.solution ?? emptyBoard9x9();

  // Conflicts: cell value duplicates another in same row/col/box.
  const conflicts = useMemo<boolean[][]>(() => {
    const out = falseBoard9x9();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const v = board[r]?.[c] ?? 0;
        if (!v) continue;
        for (let i = 0; i < 9; i++) {
          if (i !== c && board[r][i] === v) { out[r][c] = true; out[r][i] = true; }
          if (i !== r && board[i][c] === v) { out[r][c] = true; out[i][c] = true; }
        }
        const br = Math.floor(r / 3) * 3;
        const bc = Math.floor(c / 3) * 3;
        for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) {
          const rr = br + dr; const cc = bc + dc;
          if (rr === r && cc === c) continue;
          if (board[rr][cc] === v) { out[r][c] = true; out[rr][cc] = true; }
        }
      }
    }
    return out;
  }, [board]);

  const isComplete = useMemo(() => {
    if (!api.puzzle) return false;
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      if (board[r][c] !== solution[r][c]) return false;
    }
    return true;
  }, [board, solution, api.puzzle]);

  const filledCount = useMemo(() => {
    let n = 0;
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (board[r][c] !== 0) n++;
    return n;
  }, [board]);

  // Report progress when filled count changes.
  useEffect(() => {
    if (api.status === "playing") api.reportProgress(filledCount + 1);
  }, [filledCount, api]);

  // Report completion when solved.
  useEffect(() => {
    if (api.status === "playing" && isComplete) api.reportComplete();
  }, [isComplete, api]);

  const onCellSelect = (row: number, col: number) => {
    if (api.status !== "playing") return;
    if (locked[row]?.[col]) return;
    setSelected({ row, col });
  };

  const onNumberInput = (value: number) => {
    if (api.status !== "playing" || !selected) return;
    const { row, col } = selected;
    if (locked[row]?.[col]) return;
    setBoard((b) => {
      const next = b.map((r) => [...r]);
      next[row][col] = value;
      return next;
    });
  };

  const lobbyHint = useMemo(() => "Medium sudoku race. First to solve wins.", []);

  return (
    <RoomRaceShell game="sudoku" title="Sudoku" code={code} api={api} lobbyHint={lobbyHint}>
      <SudokuBoard
        board={board}
        locked={locked}
        conflicts={conflicts}
        solution={solution}
        selectedCell={selected}
        onCellSelect={onCellSelect}
        onNumberInput={onNumberInput}
      />
    </RoomRaceShell>
  );
}
