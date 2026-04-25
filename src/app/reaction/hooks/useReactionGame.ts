"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePeerConnection } from "../../../features/p2p/hooks/usePeerConnection";
import { useP2PChat } from "../../../features/p2p/hooks/useP2PChat";
import { useJoinParam } from "../../../features/p2p/hooks/useJoinParam";
import { P2P_CONNECT_TIMEOUT_MS } from "../../../features/p2p/config";
import { useRoomUrl } from "@/features/p2p/hooks/useRoomUrl";
import {
  FALSE_START_PENALTY_MS,
  MAX_DELAY_MS,
  MIN_DELAY_MS,
  TOTAL_ROUNDS,
  type GameMode,
  type ReactionPacket,
  type RoundStatus,
} from "../types";

const BEST_SINGLE_KEY = "reaction_best_single";
const BEST_AVG_KEY = "reaction_best_avg";

export function randomDelay(): number {
  return Math.floor(MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));
}

export function generateDelays(count = TOTAL_ROUNDS): number[] {
  return Array.from({ length: count }, () => randomDelay());
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

  const [delays, setDelays] = useState<number[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [roundStatus, setRoundStatus] = useState<RoundStatus>("idle");
  const [goTimestamp, setGoTimestamp] = useState<number | null>(null);
  const [lastReaction, setLastReaction] = useState<number | null>(null);
  const [lastWasFalseStart, setLastWasFalseStart] = useState(false);

  const [myReactions, setMyReactions] = useState<(number | null)[]>(emptyReactions);
  const [oppReactions, setOppReactions] = useState<(number | null)[]>(emptyReactions);

  const [bestSingle, setBestSingle] = useState<number | null>(null);
  const [bestAverage, setBestAverage] = useState<number | null>(null);
  const [isNewBestSingle, setIsNewBestSingle] = useState(false);
  const [isNewBestAverage, setIsNewBestAverage] = useState(false);

  const lightsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startScheduleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs for stale closures
  const gameModeRef = useRef(gameMode);
  const myIndexRef = useRef(myIndex);
  const delaysRef = useRef<number[]>([]);
  const roundIndexRef = useRef(0);
  const roundStatusRef = useRef<RoundStatus>("idle");
  const goTimestampRef = useRef<number | null>(null);
  const myReactionsRef = useRef<(number | null)[]>(emptyReactions());
  const sendRef = useRef<((p: ReactionPacket) => boolean) | null>(null);

  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);
  useEffect(() => { myIndexRef.current = myIndex; }, [myIndex]);
  useEffect(() => { delaysRef.current = delays; }, [delays]);
  useEffect(() => { roundIndexRef.current = roundIndex; }, [roundIndex]);
  useEffect(() => { roundStatusRef.current = roundStatus; }, [roundStatus]);
  useEffect(() => { goTimestampRef.current = goTimestamp; }, [goTimestamp]);
  useEffect(() => { myReactionsRef.current = myReactions; }, [myReactions]);

  const joinPeerId = useJoinParam();
  useEffect(() => { if (joinPeerId) setGameMode("p2p"); }, [joinPeerId]);

  // Load best on mount
  useEffect(() => {
    setBestSingle(loadBestSingle());
    setBestAverage(loadBestAvg());
  }, []);

  const clearTimers = useCallback(() => {
    if (lightsTimerRef.current) {
      clearTimeout(lightsTimerRef.current);
      lightsTimerRef.current = null;
    }
    if (startScheduleTimerRef.current) {
      clearTimeout(startScheduleTimerRef.current);
      startScheduleTimerRef.current = null;
    }
  }, []);

  const resetSession = useCallback((newDelays: number[]) => {
    clearTimers();
    setDelays(newDelays);
    delaysRef.current = newDelays;
    setRoundIndex(0);
    roundIndexRef.current = 0;
    setRoundStatus("idle");
    roundStatusRef.current = "idle";
    setGoTimestamp(null);
    goTimestampRef.current = null;
    setLastReaction(null);
    setLastWasFalseStart(false);
    setMyReactions(emptyReactions());
    myReactionsRef.current = emptyReactions();
    setOppReactions(emptyReactions());
    setIsNewBestSingle(false);
    setIsNewBestAverage(false);
  }, [clearTimers]);

  // ── Internal: actually start the red-lights phase for current round ──
  const beginRoundFromDelay = useCallback((delayMs: number) => {
    clearTimers();
    setRoundStatus("waiting");
    roundStatusRef.current = "waiting";
    setGoTimestamp(null);
    goTimestampRef.current = null;
    setLastReaction(null);
    setLastWasFalseStart(false);

    lightsTimerRef.current = setTimeout(() => {
      // If user already false-started, bail (status would have changed to result)
      if (roundStatusRef.current !== "waiting") return;
      const now = Date.now();
      setGoTimestamp(now);
      goTimestampRef.current = now;
      setRoundStatus("go");
      roundStatusRef.current = "go";
    }, delayMs);
  }, [clearTimers]);

  // ── Begin round (host-driven in P2P, immediate in solo) ──
  const startRound = useCallback(() => {
    const idx = roundIndexRef.current;
    const ds = delaysRef.current;
    if (idx >= TOTAL_ROUNDS || ds.length === 0) return;
    const delayMs = ds[idx] ?? randomDelay();

    if (gameModeRef.current === "p2p" && myIndexRef.current === 0) {
      // Host: announce round_start to keep both clients in sync
      const startAt = Date.now() + 200; // small buffer for network latency
      sendRef.current?.({
        type: "round_start",
        roundIndex: idx,
        startAt,
        timestamp: Date.now(),
      });
      const wait = Math.max(0, startAt - Date.now());
      startScheduleTimerRef.current = setTimeout(() => beginRoundFromDelay(delayMs), wait);
    } else {
      beginRoundFromDelay(delayMs);
    }
  }, [beginRoundFromDelay]);

  // ── Finalize per-round result + persist + advance ──
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

    // If this was the final round → finalize stats
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

  // ── User clicks the light strip ──
  const handleClick = useCallback(() => {
    const status = roundStatusRef.current;
    if (status === "idle" || status === "result") return;

    if (status === "waiting") {
      // False start — penalty 1000 ms
      clearTimers();
      const ms = FALSE_START_PENALTY_MS;
      // Send reaction time to opponent
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
      const now = Date.now();
      const start = goTimestampRef.current ?? now;
      const ms = Math.max(0, now - start);
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

  // ── Advance to next round (button) ──
  const advanceRound = useCallback(() => {
    const idx = roundIndexRef.current;
    if (idx >= TOTAL_ROUNDS - 1) return;
    const nextIdx = idx + 1;
    setRoundIndex(nextIdx);
    roundIndexRef.current = nextIdx;
    // In P2P, only host triggers round_start. Guests wait.
    if (gameModeRef.current === "p2p" && myIndexRef.current !== 0) {
      setRoundStatus("idle");
      roundStatusRef.current = "idle";
      setLastReaction(null);
      setLastWasFalseStart(false);
      return;
    }
    startRound();
  }, [startRound]);

  // ── Solo entry ──
  const startSolo = useCallback(() => {
    setGameMode("solo");
    gameModeRef.current = "solo";
    setMyIndex(null);
    myIndexRef.current = null;
    const ds = generateDelays();
    resetSession(ds);
    // Schedule the first round shortly after mount/animation
    startScheduleTimerRef.current = setTimeout(() => {
      beginRoundFromDelay(ds[0]);
    }, 600);
  }, [beginRoundFromDelay, resetSession]);

  // ── New game (solo or P2P host) ──
  const requestNewGame = useCallback(() => {
    if (gameModeRef.current === "solo") {
      const ds = generateDelays();
      resetSession(ds);
      startScheduleTimerRef.current = setTimeout(() => beginRoundFromDelay(ds[0]), 600);
    } else if (gameModeRef.current === "p2p") {
      if (myIndexRef.current === 0) {
        const ds = generateDelays();
        resetSession(ds);
        sendRef.current?.({ type: "puzzle_sync", delays: ds, timestamp: Date.now() });
        // Schedule first round
        startScheduleTimerRef.current = setTimeout(() => startRound(), 600);
      } else {
        // guest: ask host for a new game
        sendRef.current?.({ type: "new_game", timestamp: Date.now() });
      }
    }
  }, [beginRoundFromDelay, resetSession, startRound]);

  const exitToMenu = useCallback(() => {
    clearTimers();
    setGameMode("menu");
    gameModeRef.current = "menu";
    setMyIndex(null);
    myIndexRef.current = null;
    setDelays([]);
    delaysRef.current = [];
    setRoundIndex(0);
    roundIndexRef.current = 0;
    setRoundStatus("idle");
    roundStatusRef.current = "idle";
    setGoTimestamp(null);
    goTimestampRef.current = null;
    setLastReaction(null);
    setLastWasFalseStart(false);
    setMyReactions(emptyReactions());
    myReactionsRef.current = emptyReactions();
    setOppReactions(emptyReactions());
    setIsNewBestSingle(false);
    setIsNewBestAverage(false);
  }, [clearTimers]);

  // ── P2P data handler ──
  const handleIncomingData = useCallback((packet: ReactionPacket) => {
    if (!packet?.type) return;

    if (packet.type === "puzzle_sync") {
      // Guest receives delays from host
      setMyIndex(1);
      myIndexRef.current = 1;
      setGameMode("p2p");
      gameModeRef.current = "p2p";
      resetSession(packet.delays);
    } else if (packet.type === "round_start") {
      // Guest aligns with host on round start
      const idx = packet.roundIndex;
      setRoundIndex(idx);
      roundIndexRef.current = idx;
      const ds = delaysRef.current;
      const delayMs = ds[idx] ?? randomDelay();
      const wait = Math.max(0, packet.startAt - Date.now());
      if (startScheduleTimerRef.current) clearTimeout(startScheduleTimerRef.current);
      startScheduleTimerRef.current = setTimeout(() => beginRoundFromDelay(delayMs), wait);
    } else if (packet.type === "reaction_time") {
      const next = [...oppReactions];
      next[packet.roundIndex] = packet.ms;
      setOppReactions(next);
    } else if (packet.type === "complete") {
      // No-op; per-round reaction_time already filled in oppReactions
    } else if (packet.type === "new_game") {
      if (myIndexRef.current === 0) {
        const ds = generateDelays();
        resetSession(ds);
        sendRef.current?.({ type: "puzzle_sync", delays: ds, timestamp: Date.now() });
        startScheduleTimerRef.current = setTimeout(() => startRound(), 600);
      }
    }
  }, [beginRoundFromDelay, oppReactions, resetSession, startRound]);

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
        const ds = generateDelays();
        resetSession(ds);
        setGameMode("p2p");
        gameModeRef.current = "p2p";
        send({ type: "puzzle_sync", delays: ds, timestamp: Date.now() });
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

  // Cleanup on unmount
  useEffect(() => () => clearTimers(), [clearTimers]);

  // Derived
  const isComplete = roundStatus === "result" && roundIndex >= TOTAL_ROUNDS - 1;
  const myAverage = avgOf(myReactions);
  const myBest = bestOf(myReactions);
  const oppAverage = avgOf(oppReactions);
  const oppBest = bestOf(oppReactions);

  return {
    // State
    gameMode, setGameMode,
    myIndex,
    delays,
    roundIndex,
    roundStatus,
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
