"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePeerConnection } from "../../../features/p2p/hooks/usePeerConnection";
import { useP2PChat } from "../../../features/p2p/hooks/useP2PChat";
import { useJoinParam } from "../../../features/p2p/hooks/useJoinParam";
import { P2P_CONNECT_TIMEOUT_MS } from "../../../features/p2p/config";
import { useRoomUrl } from "@/features/p2p/hooks/useRoomUrl";
import {
  FALSE_START_PENALTY_MS,
  LIGHT_INTERVAL_MS,
  MAX_HOLD_MS,
  MIN_HOLD_MS,
  TOTAL_ROUNDS,
  type GameMode,
  type ReactionPacket,
  type RoundStatus,
} from "../types";

const BEST_SINGLE_KEY = "reaction_best_single";
const BEST_AVG_KEY = "reaction_best_avg";

export function randomHold(): number {
  return Math.floor(MIN_HOLD_MS + Math.random() * (MAX_HOLD_MS - MIN_HOLD_MS));
}

export function generateHolds(count = TOTAL_ROUNDS): number[] {
  return Array.from({ length: count }, () => randomHold());
}

export function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return "— —";
  if (ms >= 1000) return `${(ms / 1000).toFixed(3)} s`;
  return `${Math.round(ms)} ms`;
}

function loadBestSingle(): number | null {
  try {
    const v = localStorage.getItem(BEST_SINGLE_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

function loadBestAvg(): number | null {
  try {
    const v = localStorage.getItem(BEST_AVG_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

function saveBestSingle(ms: number): boolean {
  try {
    const cur = loadBestSingle();
    if (cur === null || ms < cur) {
      localStorage.setItem(BEST_SINGLE_KEY, String(ms));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function saveBestAvg(ms: number): boolean {
  try {
    const cur = loadBestAvg();
    if (cur === null || ms < cur) {
      localStorage.setItem(BEST_AVG_KEY, String(ms));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function emptyReactions(): (number | null)[] {
  return Array.from({ length: TOTAL_ROUNDS }, () => null);
}

function avgOf(arr: (number | null)[]): number | null {
  const valid = arr.filter((v): v is number => typeof v === "number");
  if (valid.length === 0) return null;
  return valid.reduce((s, v) => s + v, 0) / valid.length;
}

function bestOf(arr: (number | null)[]): number | null {
  const valid = arr.filter((v): v is number => typeof v === "number");
  if (valid.length === 0) return null;
  return Math.min(...valid);
}

export function useReactionGame() {
  const [gameMode, setGameMode] = useState<GameMode>("menu");
  const [myIndex, setMyIndex] = useState<0 | 1 | null>(null);

  // `holds[i]` = how long all 5 lights stay lit before extinguishing on round i
  const [holds, setHolds] = useState<number[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [roundStatus, setRoundStatus] = useState<RoundStatus>("idle");
  const [litCount, setLitCount] = useState(0);
  const [lastReaction, setLastReaction] = useState<number | null>(null);
  const [lastWasFalseStart, setLastWasFalseStart] = useState(false);

  const [myReactions, setMyReactions] = useState<(number | null)[]>(emptyReactions);
  const [oppReactions, setOppReactions] = useState<(number | null)[]>(emptyReactions);

  const [bestSingle, setBestSingle] = useState<number | null>(null);
  const [bestAverage, setBestAverage] = useState<number | null>(null);
  const [isNewBestSingle, setIsNewBestSingle] = useState(false);
  const [isNewBestAverage, setIsNewBestAverage] = useState(false);

  // High-resolution timestamp (performance.now()) of when lights actually went off ON SCREEN
  const goPerfRef = useRef<number | null>(null);

  // All scheduled timeouts during the F1 sequence (so we can cancel cleanly)
  const sequenceTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startScheduleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs for stale closures
  const gameModeRef = useRef(gameMode);
  const myIndexRef = useRef(myIndex);
  const holdsRef = useRef<number[]>([]);
  const roundIndexRef = useRef(0);
  const roundStatusRef = useRef<RoundStatus>("idle");
  const myReactionsRef = useRef<(number | null)[]>(emptyReactions());
  const sendRef = useRef<((p: ReactionPacket) => boolean) | null>(null);

  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);
  useEffect(() => { myIndexRef.current = myIndex; }, [myIndex]);
  useEffect(() => { holdsRef.current = holds; }, [holds]);
  useEffect(() => { roundIndexRef.current = roundIndex; }, [roundIndex]);
  useEffect(() => { roundStatusRef.current = roundStatus; }, [roundStatus]);
  useEffect(() => { myReactionsRef.current = myReactions; }, [myReactions]);

  const joinPeerId = useJoinParam();
  useEffect(() => { if (joinPeerId) setGameMode("p2p"); }, [joinPeerId]);

  // Load best on mount
  useEffect(() => {
    setBestSingle(loadBestSingle());
    setBestAverage(loadBestAvg());
  }, []);

  const clearTimers = useCallback(() => {
    for (const t of sequenceTimersRef.current) clearTimeout(t);
    sequenceTimersRef.current = [];
    if (startScheduleTimerRef.current) {
      clearTimeout(startScheduleTimerRef.current);
      startScheduleTimerRef.current = null;
    }
  }, []);

  const resetSession = useCallback((newHolds: number[]) => {
    clearTimers();
    setHolds(newHolds);
    holdsRef.current = newHolds;
    setRoundIndex(0);
    roundIndexRef.current = 0;
    setRoundStatus("idle");
    roundStatusRef.current = "idle";
    setLitCount(0);
    goPerfRef.current = null;
    setLastReaction(null);
    setLastWasFalseStart(false);
    setMyReactions(emptyReactions());
    myReactionsRef.current = emptyReactions();
    setOppReactions(emptyReactions());
    setIsNewBestSingle(false);
    setIsNewBestAverage(false);
  }, [clearTimers]);

  // Schedule a timeout and track it for cleanup
  const schedule = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      // Remove from list when fired
      sequenceTimersRef.current = sequenceTimersRef.current.filter(x => x !== t);
      fn();
    }, ms);
    sequenceTimersRef.current.push(t);
    return t;
  }, []);

  // Run the F1 light sequence: lights 1..5 turn on at 1s intervals,
  // then after `holdMs`, all lights extinguish — that's the GO signal.
  const beginRoundSequence = useCallback((holdMs: number) => {
    clearTimers();
    setRoundStatus("waiting");
    roundStatusRef.current = "waiting";
    setLitCount(0);
    goPerfRef.current = null;
    setLastReaction(null);
    setLastWasFalseStart(false);

    // Lights 1..5 turn on one at a time, every LIGHT_INTERVAL_MS
    for (let i = 1; i <= 5; i++) {
      schedule(() => {
        if (roundStatusRef.current !== "waiting") return;
        setLitCount(i);
      }, i * LIGHT_INTERVAL_MS);
    }

    // After all 5 are on (5 * LIGHT_INTERVAL_MS) + random hold, extinguish
    const totalDelay = 5 * LIGHT_INTERVAL_MS + holdMs;
    schedule(() => {
      if (roundStatusRef.current !== "waiting") return;
      // Lights off → React state update will cause the visual change in the next paint.
      setLitCount(0);
      setRoundStatus("go");
      roundStatusRef.current = "go";
      // Record the timestamp AFTER the browser commits the paint, so the
      // measured reaction time reflects actual visual perception, not the
      // moment we called setState (which paints ~16ms later).
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          goPerfRef.current = performance.now();
        });
      });
    }, totalDelay);
  }, [clearTimers, schedule]);

  // Begin round (host-driven in P2P, immediate in solo)
  const startRound = useCallback(() => {
    const idx = roundIndexRef.current;
    const hs = holdsRef.current;
    if (idx >= TOTAL_ROUNDS || hs.length === 0) return;
    const holdMs = hs[idx] ?? randomHold();

    if (gameModeRef.current === "p2p" && myIndexRef.current === 0) {
      // Host: announce round_start so guests start their sequence at the same wall-clock instant
      const startAt = Date.now() + 200; // small buffer for network latency
      sendRef.current?.({
        type: "round_start",
        roundIndex: idx,
        startAt,
        timestamp: Date.now(),
      });
      const wait = Math.max(0, startAt - Date.now());
      startScheduleTimerRef.current = setTimeout(() => beginRoundSequence(holdMs), wait);
    } else {
      beginRoundSequence(holdMs);
    }
  }, [beginRoundSequence]);

  // Finalize per-round result + persist + advance
  const recordReaction = useCallback((ms: number, falseStart: boolean) => {
    const idx = roundIndexRef.current;
    const next = [...myReactionsRef.current];
    next[idx] = ms;
    setMyReactions(next);
    myReactionsRef.current = next;
    setLastReaction(ms);
    setLastWasFalseStart(falseStart);
    setRoundStatus("result");
    roundStatusRef.current = "result";

    if (idx >= TOTAL_ROUNDS - 1) {
      const avg = avgOf(next);
      const best = bestOf(next);
      if (gameModeRef.current === "solo") {
        if (best !== null) {
          const isNew = saveBestSingle(best);
          setIsNewBestSingle(isNew);
          if (isNew) setBestSingle(best);
          else setBestSingle(prev => (prev === null ? best : Math.min(prev, best)));
        }
        if (avg !== null) {
          const isNewA = saveBestAvg(avg);
          setIsNewBestAverage(isNewA);
          if (isNewA) setBestAverage(avg);
          else setBestAverage(prev => (prev === null ? avg : Math.min(prev, avg)));
        }
      } else if (gameModeRef.current === "p2p") {
        sendRef.current?.({
          type: "complete",
          avgMs: avg ?? 0,
          bestMs: best ?? 0,
          timestamp: Date.now(),
        });
      }
    }
  }, []);

  // User clicks the light strip
  const handleClick = useCallback(() => {
    const status = roundStatusRef.current;
    if (status === "idle" || status === "result") return;

    if (status === "waiting") {
      // False start — penalty 1000 ms, kill the in-flight sequence
      clearTimers();
      const ms = FALSE_START_PENALTY_MS;
      if (gameModeRef.current === "p2p") {
        sendRef.current?.({
          type: "reaction_time",
          roundIndex: roundIndexRef.current,
          ms,
          timestamp: Date.now(),
        });
      }
      recordReaction(ms, true);
      return;
    }

    if (status === "go") {
      const start = goPerfRef.current;
      if (start === null) {
        // Click happened in the same frame the lights went off, before paint.
        // This is essentially impossible unless the user is bot-fast; record minimum.
        recordReaction(0, false);
        return;
      }
      const ms = Math.max(0, performance.now() - start);
      if (gameModeRef.current === "p2p") {
        sendRef.current?.({
          type: "reaction_time",
          roundIndex: roundIndexRef.current,
          ms,
          timestamp: Date.now(),
        });
      }
      recordReaction(ms, false);
    }
  }, [clearTimers, recordReaction]);

  // Advance to next round (button)
  const advanceRound = useCallback(() => {
    const idx = roundIndexRef.current;
    if (idx >= TOTAL_ROUNDS - 1) return;
    const nextIdx = idx + 1;
    setRoundIndex(nextIdx);
    roundIndexRef.current = nextIdx;
    if (gameModeRef.current === "p2p" && myIndexRef.current !== 0) {
      setRoundStatus("idle");
      roundStatusRef.current = "idle";
      setLitCount(0);
      setLastReaction(null);
      setLastWasFalseStart(false);
      return;
    }
    startRound();
  }, [startRound]);

  // Solo entry
  const startSolo = useCallback(() => {
    setGameMode("solo");
    gameModeRef.current = "solo";
    setMyIndex(null);
    myIndexRef.current = null;
    const hs = generateHolds();
    resetSession(hs);
    startScheduleTimerRef.current = setTimeout(() => {
      beginRoundSequence(hs[0]);
    }, 600);
  }, [beginRoundSequence, resetSession]);

  // New game (solo or P2P host)
  const requestNewGame = useCallback(() => {
    if (gameModeRef.current === "solo") {
      const hs = generateHolds();
      resetSession(hs);
      startScheduleTimerRef.current = setTimeout(() => beginRoundSequence(hs[0]), 600);
    } else if (gameModeRef.current === "p2p") {
      if (myIndexRef.current === 0) {
        const hs = generateHolds();
        resetSession(hs);
        sendRef.current?.({ type: "puzzle_sync", delays: hs, timestamp: Date.now() });
        startScheduleTimerRef.current = setTimeout(() => startRound(), 600);
      } else {
        sendRef.current?.({ type: "new_game", timestamp: Date.now() });
      }
    }
  }, [beginRoundSequence, resetSession, startRound]);

  const exitToMenu = useCallback(() => {
    clearTimers();
    setGameMode("menu");
    gameModeRef.current = "menu";
    setMyIndex(null);
    myIndexRef.current = null;
    setHolds([]);
    holdsRef.current = [];
    setRoundIndex(0);
    roundIndexRef.current = 0;
    setRoundStatus("idle");
    roundStatusRef.current = "idle";
    setLitCount(0);
    goPerfRef.current = null;
    setLastReaction(null);
    setLastWasFalseStart(false);
    setMyReactions(emptyReactions());
    myReactionsRef.current = emptyReactions();
    setOppReactions(emptyReactions());
    setIsNewBestSingle(false);
    setIsNewBestAverage(false);
  }, [clearTimers]);

  // P2P data handler
  const handleIncomingData = useCallback((packet: ReactionPacket) => {
    if (!packet?.type) return;

    if (packet.type === "puzzle_sync") {
      setMyIndex(1);
      myIndexRef.current = 1;
      setGameMode("p2p");
      gameModeRef.current = "p2p";
      resetSession(packet.delays);
    } else if (packet.type === "round_start") {
      const idx = packet.roundIndex;
      setRoundIndex(idx);
      roundIndexRef.current = idx;
      const hs = holdsRef.current;
      const holdMs = hs[idx] ?? randomHold();
      const wait = Math.max(0, packet.startAt - Date.now());
      if (startScheduleTimerRef.current) clearTimeout(startScheduleTimerRef.current);
      startScheduleTimerRef.current = setTimeout(() => beginRoundSequence(holdMs), wait);
    } else if (packet.type === "reaction_time") {
      const next = [...oppReactions];
      next[packet.roundIndex] = packet.ms;
      setOppReactions(next);
    } else if (packet.type === "complete") {
      // No-op
    } else if (packet.type === "new_game") {
      if (myIndexRef.current === 0) {
        const hs = generateHolds();
        resetSession(hs);
        sendRef.current?.({ type: "puzzle_sync", delays: hs, timestamp: Date.now() });
        startScheduleTimerRef.current = setTimeout(() => startRound(), 600);
      }
    }
  }, [beginRoundSequence, oppReactions, resetSession, startRound]);

  const { messages: chatMessages, onChat, addMyMessage } = useP2PChat();

  const {
    phase, localPeerId, error, isConnected, isReconnecting, reconnectDeadline,
    connect, send, sendChat, clearError, retryLastConnection, reinitialize,
    roomCode, connectSubstep,
  } = usePeerConnection<ReactionPacket>({
    connectTimeoutMs: P2P_CONNECT_TIMEOUT_MS,
    handshake: { site: "wenqian.me", game: "reaction" },
    acceptIncomingConnections: true,
    onData: handleIncomingData,
    onChat,
    onConnected: ({ direction, reconnected }) => {
      if (reconnected) return;
      const idx = direction === "outgoing" ? 0 : 1;
      setMyIndex(idx);
      myIndexRef.current = idx;
      if (idx === 0) {
        const hs = generateHolds();
        resetSession(hs);
        setGameMode("p2p");
        gameModeRef.current = "p2p";
        send({ type: "puzzle_sync", delays: hs, timestamp: Date.now() });
        startScheduleTimerRef.current = setTimeout(() => startRound(), 700);
      }
    },
    onDisconnected: () => {
      setMyIndex(null);
      myIndexRef.current = null;
    },
  });

  useEffect(() => { sendRef.current = send; }, [send]);

  useRoomUrl(roomCode, phase);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // Derived
  const isComplete = roundStatus === "result" && roundIndex >= TOTAL_ROUNDS - 1;
  const myAverage = avgOf(myReactions);
  const myBest = bestOf(myReactions);
  const oppAverage = avgOf(oppReactions);
  const oppBest = bestOf(oppReactions);
  const isGoSignal = roundStatus === "go" || roundStatus === "result";

  return {
    // State
    gameMode, setGameMode,
    myIndex,
    holds,
    roundIndex,
    roundStatus,
    litCount,
    isGoSignal,
    lastReaction,
    lastWasFalseStart,
    myReactions, oppReactions,
    bestSingle, bestAverage,
    isNewBestSingle, isNewBestAverage,
    myAverage, myBest, oppAverage, oppBest,
    isComplete,
    // P2P
    phase, localPeerId, error, isConnected, isReconnecting, reconnectDeadline,
    connect, sendChat, clearError, retryLastConnection, reinitialize,
    roomCode, connectSubstep, joinPeerId,
    // Chat
    chatMessages, addMyMessage,
    // Handlers
    handleClick, startSolo, requestNewGame, exitToMenu, advanceRound,
  };
}
