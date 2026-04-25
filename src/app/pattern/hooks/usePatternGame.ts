"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePeerConnection } from "../../../features/p2p/hooks/usePeerConnection";
import { useP2PChat } from "../../../features/p2p/hooks/useP2PChat";
import { useJoinParam } from "../../../features/p2p/hooks/useJoinParam";
import { P2P_CONNECT_TIMEOUT_MS } from "../../../features/p2p/config";
import { useRoomUrl } from "@/features/p2p/hooks/useRoomUrl";
import { COLORS, COLOR_HZ, type Color, type GameMode, type GameStatus, type PatternPacket } from "../types";

const SHOW_DURATION_MS = 500;
const SHOW_GAP_MS = 200;
const TONE_DURATION_MS = 300;
const SEQUENCE_LENGTH = 50;

function loadBestRound(): number | null {
  try {
    const val = localStorage.getItem("pattern_best_round");
    return val ? Number(val) : null;
  } catch {
    return null;
  }
}

function saveBestRound(round: number): boolean {
  try {
    const current = loadBestRound();
    if (current === null || round > current) {
      localStorage.setItem("pattern_best_round", String(round));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function generateLongSequence(): Color[] {
  const seq: Color[] = [];
  for (let i = 0; i < SEQUENCE_LENGTH; i++) {
    seq.push(COLORS[Math.floor(Math.random() * COLORS.length)]);
  }
  return seq;
}

export function usePatternGame() {
  const [gameMode, setGameMode] = useState<GameMode>("menu");
  const [myIndex, setMyIndex] = useState<0 | 1 | null>(null);

  const [sequence, setSequence] = useState<Color[]>([]);
  const [round, setRound] = useState<number>(1);
  const [status, setStatus] = useState<GameStatus>("idle");
  const [playerInputIndex, setPlayerInputIndex] = useState<number>(0);
  const [activeColor, setActiveColor] = useState<Color | null>(null);

  const [bestRound, setBestRound] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);

  const [oppRound, setOppRound] = useState<number>(1);
  const [oppGameOver, setOppGameOver] = useState<boolean>(false);
  const [oppFinalRound, setOppFinalRound] = useState<number | null>(null);

  // Refs to avoid stale closures
  const myIndexRef = useRef(myIndex);
  const gameModeRef = useRef(gameMode);
  const sequenceRef = useRef<Color[]>([]);
  const roundRef = useRef<number>(1);
  const statusRef = useRef<GameStatus>("idle");
  const playerInputIndexRef = useRef<number>(0);
  const sendRef = useRef<((packet: PatternPacket) => boolean) | null>(null);
  const showTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Audio context (lazy init on first user interaction)
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => { myIndexRef.current = myIndex; }, [myIndex]);
  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);
  useEffect(() => { sequenceRef.current = sequence; }, [sequence]);
  useEffect(() => { roundRef.current = round; }, [round]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { playerInputIndexRef.current = playerInputIndex; }, [playerInputIndex]);

  const joinPeerId = useJoinParam();
  useEffect(() => { if (joinPeerId) setGameMode("p2p"); }, [joinPeerId]);

  // Load best round on mount
  useEffect(() => {
    setBestRound(loadBestRound());
  }, []);

  // Cleanup show timers on unmount
  useEffect(() => {
    return () => {
      showTimersRef.current.forEach(clearTimeout);
      showTimersRef.current = [];
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch { /* ignore */ }
        audioCtxRef.current = null;
      }
    };
  }, []);

  const ensureAudioCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!audioCtxRef.current) {
      try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        audioCtxRef.current = new Ctor();
      } catch {
        return null;
      }
    }
    // Resume if suspended (Safari/iOS quirk)
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => { /* ignore */ });
    }
    return ctx;
  }, []);

  const playTone = useCallback((color: Color) => {
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    const freq = COLOR_HZ[color];
    const now = ctx.currentTime;
    const dur = TONE_DURATION_MS / 1000;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);

      // Quick fade in/out to prevent clicks
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
      gain.gain.setValueAtTime(0.25, now + dur - 0.04);
      gain.gain.linearRampToValueAtTime(0, now + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    } catch {
      // ignore audio failures
    }
  }, [ensureAudioCtx]);

  const clearShowTimers = useCallback(() => {
    showTimersRef.current.forEach(clearTimeout);
    showTimersRef.current = [];
  }, []);

  const showSequence = useCallback(() => {
    clearShowTimers();
    const seq = sequenceRef.current;
    const r = roundRef.current;
    const subSeq = seq.slice(0, r);

    setStatus("showing");
    statusRef.current = "showing";
    setActiveColor(null);
    setPlayerInputIndex(0);
    playerInputIndexRef.current = 0;

    // Small initial delay before showing first color
    const stepMs = SHOW_DURATION_MS + SHOW_GAP_MS;

    subSeq.forEach((color, i) => {
      const startAt = 400 + i * stepMs;
      const onTimer = setTimeout(() => {
        if (statusRef.current !== "showing") return;
        setActiveColor(color);
        playTone(color);
      }, startAt);
      const offTimer = setTimeout(() => {
        if (statusRef.current !== "showing") return;
        setActiveColor(null);
      }, startAt + SHOW_DURATION_MS);
      showTimersRef.current.push(onTimer, offTimer);
    });

    // After last color, switch to input phase
    const endTimer = setTimeout(() => {
      if (statusRef.current !== "showing") return;
      setActiveColor(null);
      setStatus("input");
      statusRef.current = "input";
    }, 400 + subSeq.length * stepMs);
    showTimersRef.current.push(endTimer);
  }, [clearShowTimers, playTone]);

  const initGame = useCallback((seq: Color[]) => {
    clearShowTimers();
    setSequence(seq);
    setRound(1);
    setStatus("idle");
    setPlayerInputIndex(0);
    setActiveColor(null);
    setIsNewBest(false);
    setOppRound(1);
    setOppGameOver(false);
    setOppFinalRound(null);
    sequenceRef.current = seq;
    roundRef.current = 1;
    statusRef.current = "idle";
    playerInputIndexRef.current = 0;
  }, [clearShowTimers]);

  const handleIncomingData = useCallback((packet: PatternPacket) => {
    if (!packet?.type) return;
    if (packet.type === "puzzle_sync") {
      setMyIndex(1);
      myIndexRef.current = 1;
      setGameMode("p2p");
      gameModeRef.current = "p2p";
      initGame(packet.sequence);
    } else if (packet.type === "round_progress") {
      setOppRound(packet.round);
    } else if (packet.type === "game_over") {
      setOppGameOver(true);
      setOppFinalRound(packet.finalRound);
    } else if (packet.type === "new_game") {
      if (myIndexRef.current === 0) {
        const seq = generateLongSequence();
        initGame(seq);
        sendRef.current?.({ type: "puzzle_sync", sequence: seq, timestamp: Date.now() });
      }
    }
  }, [initGame]);

  const { messages: chatMessages, onChat, addMyMessage } = useP2PChat();

  const { phase, localPeerId, error, isConnected, isReconnecting, reconnectDeadline, connect, send, sendChat, clearError, retryLastConnection, reinitialize, roomCode, connectSubstep } =
    usePeerConnection<PatternPacket>({
      connectTimeoutMs: P2P_CONNECT_TIMEOUT_MS,
      handshake: { site: "wenqian.me", game: "pattern" },
      acceptIncomingConnections: true,
      onData: handleIncomingData,
      onChat,
      onConnected: ({ direction, reconnected }) => {
        if (reconnected) return;
        const idx = direction === "outgoing" ? 0 : 1;
        setMyIndex(idx);
        myIndexRef.current = idx;
        if (idx === 0) {
          const seq = generateLongSequence();
          initGame(seq);
          setGameMode("p2p");
          gameModeRef.current = "p2p";
          send({ type: "puzzle_sync", sequence: seq, timestamp: Date.now() });
        }
      },
      onDisconnected: () => {
        setMyIndex(null);
        myIndexRef.current = null;
      },
    });

  useEffect(() => { sendRef.current = send; }, [send]);

  // Auto-start showing sequence when sequence is loaded and we haven't started yet
  // (P2P only — solo waits for explicit START click)
  // We handle this through requestStartRound below.

  const requestStartRound = useCallback(() => {
    // Initialize audio context on this user gesture
    ensureAudioCtx();
    if (sequenceRef.current.length === 0) return;
    showSequence();
  }, [ensureAudioCtx, showSequence]);

  const handleClick = useCallback((color: Color) => {
    if (statusRef.current !== "input") return;
    // Init audio on click as well
    ensureAudioCtx();
    playTone(color);

    const seq = sequenceRef.current;
    const r = roundRef.current;
    const idx = playerInputIndexRef.current;
    const expected = seq[idx];

    if (color === expected) {
      // Correct
      const nextIdx = idx + 1;
      setPlayerInputIndex(nextIdx);
      playerInputIndexRef.current = nextIdx;

      if (nextIdx >= r) {
        // Round complete — advance
        const nextRound = r + 1;

        // Safety: if we somehow exceed sequence length, just keep going as best round
        if (nextRound > seq.length) {
          // Ran out of sequence — treat as max round reached
          setStatus("game_over");
          statusRef.current = "game_over";
          if (gameModeRef.current === "solo") {
            const isNew = saveBestRound(r);
            setIsNewBest(isNew);
            setBestRound(prev => (prev === null ? r : Math.max(prev, r)));
          } else {
            sendRef.current?.({ type: "game_over", finalRound: r, timestamp: Date.now() });
          }
          return;
        }

        setRound(nextRound);
        roundRef.current = nextRound;

        if (gameModeRef.current === "p2p") {
          sendRef.current?.({ type: "round_progress", round: nextRound, timestamp: Date.now() });
        }

        // Start next round after a short pause
        const t = setTimeout(() => {
          if (statusRef.current === "input" || statusRef.current === "showing") {
            // status changes inside showSequence; just call it
          }
          showSequence();
        }, 600);
        showTimersRef.current.push(t);
      }
    } else {
      // Wrong — game over
      const finalRound = r - 1; // last fully-completed round
      setStatus("game_over");
      statusRef.current = "game_over";
      setActiveColor(null);

      if (gameModeRef.current === "solo") {
        if (finalRound > 0) {
          const isNew = saveBestRound(finalRound);
          setIsNewBest(isNew);
          setBestRound(prev => (prev === null ? finalRound : Math.max(prev, finalRound)));
        }
      } else {
        sendRef.current?.({ type: "game_over", finalRound: Math.max(0, finalRound), timestamp: Date.now() });
      }
    }
  }, [ensureAudioCtx, playTone, showSequence]);

  const startSolo = useCallback(() => {
    const seq = generateLongSequence();
    setGameMode("solo");
    setMyIndex(null);
    initGame(seq);
    // Auto-start the first round after a brief delay so the UI can mount
    const t = setTimeout(() => {
      ensureAudioCtx();
      showSequence();
    }, 500);
    showTimersRef.current.push(t);
  }, [ensureAudioCtx, initGame, showSequence]);

  const requestNewGame = useCallback(() => {
    if (gameModeRef.current === "solo") {
      const seq = generateLongSequence();
      initGame(seq);
      const t = setTimeout(() => {
        ensureAudioCtx();
        showSequence();
      }, 500);
      showTimersRef.current.push(t);
    } else {
      // Only host starts new P2P game
      if (myIndexRef.current === 0) {
        const seq = generateLongSequence();
        initGame(seq);
        sendRef.current?.({ type: "puzzle_sync", sequence: seq, timestamp: Date.now() });
        const t = setTimeout(() => {
          ensureAudioCtx();
          showSequence();
        }, 500);
        showTimersRef.current.push(t);
      }
    }
  }, [ensureAudioCtx, initGame, showSequence]);

  // For P2P guest: when puzzle_sync arrives, auto-start showing
  useEffect(() => {
    if (gameMode === "p2p" && sequence.length > 0 && status === "idle") {
      const t = setTimeout(() => {
        ensureAudioCtx();
        showSequence();
      }, 600);
      showTimersRef.current.push(t);
      return () => clearTimeout(t);
    }
  }, [gameMode, sequence, status, ensureAudioCtx, showSequence]);

  const exitToMenu = useCallback(() => {
    clearShowTimers();
    setGameMode("menu");
    setStatus("idle");
    statusRef.current = "idle";
    setSequence([]);
    sequenceRef.current = [];
    setRound(1);
    roundRef.current = 1;
    setPlayerInputIndex(0);
    playerInputIndexRef.current = 0;
    setActiveColor(null);
    setMyIndex(null);
    myIndexRef.current = null;
    setOppRound(1);
    setOppGameOver(false);
    setOppFinalRound(null);
  }, [clearShowTimers]);

  useRoomUrl(roomCode, phase);

  return {
    // State
    gameMode, setGameMode,
    myIndex,
    sequence, round, status, playerInputIndex, activeColor,
    bestRound, isNewBest,
    // Multiplayer
    oppRound, oppGameOver, oppFinalRound,
    // P2P
    phase, localPeerId, error, isConnected, isReconnecting, reconnectDeadline, connect, sendChat, clearError, retryLastConnection, reinitialize, roomCode, connectSubstep,
    joinPeerId,
    // Chat
    chatMessages, addMyMessage,
    // Handlers
    handleClick, startSolo, requestNewGame, requestStartRound, exitToMenu,
  };
}
