"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePeerConnection } from "../../../features/p2p/hooks/usePeerConnection";
import { useP2PChat } from "../../../features/p2p/hooks/useP2PChat";
import { useJoinParam } from "../../../features/p2p/hooks/useJoinParam";
import { P2P_CONNECT_TIMEOUT_MS } from "../../../features/p2p/config";
import { useRoomUrl } from "@/features/p2p/hooks/useRoomUrl";
import {
  GRID_SIZES,
  targetSequence,
  type GameMode,
  type GameStatus,
  type GridSize,
  type TrailPacket,
} from "../types";

const WRONG_FLASH_MS = 500;
const WRONG_PENALTY_MS = 1000;

function loadBestTime(size: GridSize): number | null {
  try {
    const val = localStorage.getItem(`trail_best_${size}`);
    return val ? Number(val) : null;
  } catch {
    return null;
  }
}

function saveBestTime(size: GridSize, time: number): boolean {
  try {
    const current = loadBestTime(size);
    if (current === null || time < current) {
      localStorage.setItem(`trail_best_${size}`, String(time));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centis = Math.floor((ms % 1000) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
}

export function generateShuffled(size: GridSize): string[] {
  const arr = [...targetSequence(size)];
  // Fisher-Yates shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Returns true if the cell's position in the target sequence has already been passed
export function isCleared(cellValue: string, currentIndex: number, size: GridSize): boolean {
  const seq = targetSequence(size);
  const pos = seq.indexOf(cellValue);
  if (pos < 0) return false;
  return pos < currentIndex;
}

export function useTrailGame() {
  const [gameMode, setGameMode] = useState<GameMode>("menu");
  const [size, setSize] = useState<GridSize>(4);
  const [myIndex, setMyIndex] = useState<0 | 1 | null>(null);

  const [cells, setCells] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [status, setStatus] = useState<GameStatus>("idle");
  const [wrongClick, setWrongClick] = useState<{ index: number; expiresAt: number } | null>(null);
  const [penaltyFlash, setPenaltyFlash] = useState<number>(0); // counter to trigger animation

  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [penalty, setPenalty] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const wrongClickTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const [bestTimes, setBestTimes] = useState<Record<GridSize, number | null>>({
    3: null, 4: null, 5: null,
  });
  const [isNewBest, setIsNewBest] = useState(false);

  const [opponentIndex, setOpponentIndex] = useState(0);
  const [opponentComplete, setOpponentComplete] = useState(false);
  const [opponentTime, setOpponentTime] = useState<number | null>(null);

  // Refs to avoid stale closures in callbacks
  const sizeRef = useRef(size);
  const myIndexRef = useRef(myIndex);
  const gameModeRef = useRef(gameMode);
  const startTimeRef = useRef<number | null>(null);
  const cellsRef = useRef<string[]>([]);
  const currentIndexRef = useRef<number>(0);
  const statusRef = useRef<GameStatus>("idle");
  const penaltyRef = useRef(0);
  const sendRef = useRef<((packet: TrailPacket) => boolean) | null>(null);

  useEffect(() => { sizeRef.current = size; }, [size]);
  useEffect(() => { myIndexRef.current = myIndex; }, [myIndex]);
  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);
  useEffect(() => { startTimeRef.current = startTime; }, [startTime]);
  useEffect(() => { cellsRef.current = cells; }, [cells]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { penaltyRef.current = penalty; }, [penalty]);

  const joinPeerId = useJoinParam();
  useEffect(() => { if (joinPeerId) setGameMode("p2p"); }, [joinPeerId]);

  // Load best times on mount
  useEffect(() => {
    setBestTimes(
      GRID_SIZES.reduce(
        (acc, sz) => ({ ...acc, [sz]: loadBestTime(sz) }),
        {} as Record<GridSize, number | null>,
      ),
    );
  }, []);

  // Timer — elapsed includes penalty
  useEffect(() => {
    if (status === "playing" && startTime !== null) {
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const base = now - (startTimeRef.current ?? now);
        setElapsedTime(base + penaltyRef.current);
      }, 50);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [status, startTime]);

  // Clear expired wrongClick flash
  useEffect(() => {
    if (!wrongClick) return;
    const remaining = wrongClick.expiresAt - Date.now();
    if (remaining <= 0) {
      setWrongClick(null);
      return;
    }
    wrongClickTimerRef.current = setTimeout(() => setWrongClick(null), remaining);
    return () => { if (wrongClickTimerRef.current) clearTimeout(wrongClickTimerRef.current); };
  }, [wrongClick]);

  const initGame = useCallback((newCells: string[], sz: GridSize) => {
    setCells(newCells);
    setSize(sz);
    setCurrentIndex(0);
    setStatus("idle");
    setStartTime(null);
    setElapsedTime(0);
    setPenalty(0);
    setWrongClick(null);
    setOpponentIndex(0);
    setOpponentComplete(false);
    setOpponentTime(null);
    setIsNewBest(false);
    // Update refs immediately
    cellsRef.current = newCells;
    sizeRef.current = sz;
    currentIndexRef.current = 0;
    statusRef.current = "idle";
    startTimeRef.current = null;
    penaltyRef.current = 0;
  }, []);

  const handleIncomingData = useCallback((packet: TrailPacket) => {
    if (!packet?.type) return;
    if (packet.type === "puzzle_sync") {
      setMyIndex(1);
      myIndexRef.current = 1;
      setGameMode("p2p");
      gameModeRef.current = "p2p";
      initGame(packet.cells, packet.size);
    } else if (packet.type === "progress") {
      setOpponentIndex(packet.targetIndex);
    } else if (packet.type === "game_complete") {
      setOpponentComplete(true);
      setOpponentTime(packet.time);
    } else if (packet.type === "new_game") {
      if (myIndexRef.current === 0) {
        const sz = sizeRef.current;
        const newCells = generateShuffled(sz);
        initGame(newCells, sz);
        sendRef.current?.({ type: "puzzle_sync", cells: newCells, size: sz, timestamp: Date.now() });
      }
    }
  }, [initGame]);

  const { messages: chatMessages, onChat, addMyMessage } = useP2PChat();

  const { phase, localPeerId, error, isConnected, isReconnecting, reconnectDeadline, connect, send, sendChat, clearError, retryLastConnection, reinitialize, roomCode, connectSubstep } =
    usePeerConnection<TrailPacket>({
      connectTimeoutMs: P2P_CONNECT_TIMEOUT_MS,
      handshake: { site: "wenqian.me", game: "trail" },
      acceptIncomingConnections: true,
      onData: handleIncomingData,
      onChat,
      onConnected: ({ direction, reconnected }) => {
        if (reconnected) return;
        const idx = direction === "outgoing" ? 0 : 1;
        setMyIndex(idx);
        myIndexRef.current = idx;
        if (idx === 0) {
          const sz = sizeRef.current;
          const newCells = generateShuffled(sz);
          initGame(newCells, sz);
          setGameMode("p2p");
          gameModeRef.current = "p2p";
          send({ type: "puzzle_sync", cells: newCells, size: sz, timestamp: Date.now() });
        }
      },
      onDisconnected: () => {
        setMyIndex(null);
        myIndexRef.current = null;
      },
    });

  useEffect(() => { sendRef.current = send; }, [send]);

  const handleClick = useCallback((index: number) => {
    if (statusRef.current === "complete") return;
    const arr = cellsRef.current;
    if (index < 0 || index >= arr.length) return;

    const sz = sizeRef.current;
    const seq = targetSequence(sz);
    const total = seq.length;
    const clickedValue = arr[index];
    const targetIdx = currentIndexRef.current;

    // Already-cleared tiles are inert
    const clickedPos = seq.indexOf(clickedValue);
    if (clickedPos < 0) return;
    if (clickedPos < targetIdx) return;

    // Start timer on very first click (correct or not)
    let startedNow = false;
    if (statusRef.current !== "playing") {
      const now = Date.now();
      setStartTime(now);
      startTimeRef.current = now;
      setStatus("playing");
      statusRef.current = "playing";
      startedNow = true;
    }

    if (clickedPos === targetIdx) {
      // Correct click — advance
      const nextIdx = targetIdx + 1;
      setCurrentIndex(nextIdx);
      currentIndexRef.current = nextIdx;

      // Send progress packet (P2P only)
      if (gameModeRef.current === "p2p") {
        sendRef.current?.({ type: "progress", targetIndex: nextIdx, timestamp: Date.now() });
      }

      // Check completion
      if (nextIdx >= total) {
        const now = Date.now();
        const elapsed = now - (startTimeRef.current ?? now) + penaltyRef.current;
        setStatus("complete");
        statusRef.current = "complete";
        if (timerRef.current) clearInterval(timerRef.current);
        setElapsedTime(elapsed);

        if (gameModeRef.current === "solo") {
          const isNew = saveBestTime(sizeRef.current, elapsed);
          setIsNewBest(isNew);
          setBestTimes(prev => ({
            ...prev,
            [sizeRef.current]: Math.min(elapsed, prev[sizeRef.current] ?? Infinity),
          }));
        } else {
          sendRef.current?.({ type: "game_complete", time: elapsed, timestamp: Date.now() });
        }
      }
    } else {
      // Wrong click — flash + penalty (unless we just started timer on this same click)
      if (!startedNow) {
        const newPenalty = penaltyRef.current + WRONG_PENALTY_MS;
        setPenalty(newPenalty);
        penaltyRef.current = newPenalty;
        setPenaltyFlash(c => c + 1);
      }
      setWrongClick({ index, expiresAt: Date.now() + WRONG_FLASH_MS });
    }
  }, []);

  const startSolo = useCallback((sz: GridSize) => {
    const newCells = generateShuffled(sz);
    setGameMode("solo");
    setMyIndex(null);
    initGame(newCells, sz);
  }, [initGame]);

  const requestNewGame = useCallback(() => {
    if (gameModeRef.current === "solo") {
      const sz = sizeRef.current;
      const newCells = generateShuffled(sz);
      initGame(newCells, sz);
    } else {
      // Only host can start new game in P2P
      if (myIndexRef.current === 0) {
        const sz = sizeRef.current;
        const newCells = generateShuffled(sz);
        initGame(newCells, sz);
        sendRef.current?.({ type: "puzzle_sync", cells: newCells, size: sz, timestamp: Date.now() });
      }
    }
  }, [initGame]);

  const exitToMenu = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (wrongClickTimerRef.current) clearTimeout(wrongClickTimerRef.current);
    setGameMode("menu");
    setStatus("idle");
    statusRef.current = "idle";
    setCells([]);
    cellsRef.current = [];
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    setStartTime(null);
    startTimeRef.current = null;
    setElapsedTime(0);
    setPenalty(0);
    penaltyRef.current = 0;
    setWrongClick(null);
    setMyIndex(null);
    myIndexRef.current = null;
  }, []);

  useRoomUrl(roomCode, phase);

  const seq = targetSequence(size);
  const totalCells = seq.length;
  const currentTarget = currentIndex < seq.length ? seq[currentIndex] : null;
  const nextTarget = currentIndex + 1 < seq.length ? seq[currentIndex + 1] : null;
  const wrongClickIndex = wrongClick?.index ?? null;

  return {
    // State
    gameMode, setGameMode,
    size, setSize,
    myIndex,
    cells, currentIndex, currentTarget, nextTarget, status,
    elapsedTime, penalty, bestTimes, isNewBest,
    wrongClickIndex, penaltyFlash,
    totalCells,
    // Multiplayer
    opponentIndex, opponentComplete, opponentTime,
    // P2P
    phase, localPeerId, error, isConnected, isReconnecting, reconnectDeadline, connect, sendChat, clearError, retryLastConnection, reinitialize, roomCode, connectSubstep,
    joinPeerId,
    // Chat
    chatMessages, addMyMessage,
    // Handlers
    handleClick, startSolo, requestNewGame, exitToMenu,
  };
}
