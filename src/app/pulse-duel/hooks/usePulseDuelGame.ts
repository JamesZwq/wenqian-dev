"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePeerConnection } from "@/features/p2p/hooks/usePeerConnection";
import { useP2PChat } from "@/features/p2p/hooks/useP2PChat";
import { useJoinParam } from "@/features/p2p/hooks/useJoinParam";
import { P2P_CONNECT_TIMEOUT_MS } from "@/features/p2p/config";
import { useRoomUrl } from "@/features/p2p/hooks/useRoomUrl";
import {
  createClockSyncSample,
  estimatePeerClockMs,
  getLagCompensationWindowMs,
  mergeClockSyncEstimate,
  type ClockSyncEstimate,
} from "@/features/p2p/lib/clockSync";
import type { DuelAction, DuelPacket, DuelView, FullDuelState, GameMode } from "../types";
import { createInitialState, createView, lockAction, resolveRound, startNextRound } from "../gameLogic";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function usePulseDuelGame() {
  const [gameMode, setGameMode] = useState<GameMode>("menu");
  const joinPeerId = useJoinParam();
  const resolvedGameMode: GameMode = joinPeerId ? "p2p" : gameMode;

  const [myIndex, setMyIndex] = useState<0 | 1 | null>(null);
  const [fullState, setFullState] = useState<FullDuelState | null>(null);
  const [guestView, setGuestView] = useState<DuelView | null>(null);
  const [countdownEnd, setCountdownEnd] = useState<number | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastRemoteMessageAt, setLastRemoteMessageAt] = useState<number | null>(null);
  const [clockSync, setClockSync] = useState<ClockSyncEstimate | null>(null);

  const myIndexRef = useRef<0 | 1 | null>(null);
  const fullStateRef = useRef<FullDuelState | null>(null);
  const guestViewRef = useRef<DuelView | null>(null);
  const sendRef = useRef<(packet: DuelPacket) => boolean>(() => false);
  const pingIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const phaseTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const clockSyncRef = useRef<ClockSyncEstimate | null>(null);

  useEffect(() => { myIndexRef.current = myIndex; }, [myIndex]);
  useEffect(() => { fullStateRef.current = fullState; }, [fullState]);
  useEffect(() => { guestViewRef.current = guestView; }, [guestView]);

  const updateClockSync = useCallback((next: ClockSyncEstimate | null) => {
    clockSyncRef.current = next;
    setClockSync(next);
    setLatencyMs(next ? Math.round(next.rttMs) : null);
  }, []);

  const updateFullState = useCallback((next: FullDuelState | null) => {
    fullStateRef.current = next;
    setFullState(next);
  }, []);

  const updateGuestView = useCallback((next: DuelView | null) => {
    guestViewRef.current = next;
    setGuestView(next);
  }, []);

  const syncToGuest = useCallback((state: FullDuelState) => {
    sendRef.current({ type: "sync", view: createView(state, 1), hostSentAt: Date.now() });
  }, []);

  const createNewMatch = useCallback((startAt = Date.now()) => {
    const next = createInitialState(startAt);
    updateFullState(next);
    syncToGuest(next);
  }, [syncToGuest, updateFullState]);

  const getHostNow = useCallback((localNow = Date.now()) => {
    return myIndexRef.current === 0
      ? localNow
      : estimatePeerClockMs(clockSyncRef.current?.offsetMs ?? null, localNow);
  }, []);

  const handleIncomingData = useCallback((payload: DuelPacket) => {
    if (!payload?.type) return;
    setLastRemoteMessageAt(Date.now());

    if (payload.type === "ping") {
      sendRef.current({
        type: "pong",
        echoSentAt: payload.sentAt,
        responderNow: Date.now(),
      });
      return;
    }

    if (payload.type === "pong") {
      const sample = createClockSyncSample(payload.echoSentAt, Date.now(), payload.responderNow);
      updateClockSync(mergeClockSyncEstimate(clockSyncRef.current, sample));
      return;
    }

    if (payload.type === "sync") {
      if (myIndexRef.current === 1) {
        updateGuestView(payload.view);
      }
      return;
    }

    if (myIndexRef.current !== 0) return;

    if (payload.type === "action") {
      const current = fullStateRef.current;
      if (!current || current.phase !== "planning" || payload.roundNumber !== current.roundNumber) return;

      const receivedAtHostTime = Date.now();
      const plausibleLookbackMs = Math.max(450, Math.round((clockSyncRef.current?.rttMs ?? 120) * 1.35));
      const claimedAt = clamp(
        payload.claimedHostPressAt,
        receivedAtHostTime - plausibleLookbackMs,
        receivedAtHostTime + 24,
      );

      if (claimedAt < current.roundStartsAt - 36) return;
      if (claimedAt > current.roundEndsAt + 36) return;

      const next = lockAction(current, 1, payload.action, Math.min(claimedAt, current.roundEndsAt));
      if (next !== current) {
        updateFullState(next);
        syncToGuest(next);
      }
      return;
    }

    if (payload.type === "rematch") {
      createNewMatch(Date.now());
    }
  }, [createNewMatch, syncToGuest, updateClockSync, updateFullState, updateGuestView]);

  const { messages: chatMessages, onChat, addMyMessage } = useP2PChat();

  const {
    phase, localPeerId, error, isConnected, isReconnecting, reconnectDeadline,
    connect, send, sendChat, clearError, retryLastConnection, reinitialize, roomCode, connectSubstep,
  } = usePeerConnection<DuelPacket>({
    connectTimeoutMs: P2P_CONNECT_TIMEOUT_MS,
    handshake: { site: "wenqian.me", game: "pulse-duel" },
    onData: handleIncomingData,
    onChat,
    acceptIncomingConnections: true,
    onConnected: ({ direction, reconnected }) => {
      if (reconnected) {
        if (myIndexRef.current === 0 && fullStateRef.current) {
          setTimeout(() => syncToGuest(fullStateRef.current!), 200);
        }
        return;
      }

      const cdEnd = Date.now() + 3600;
      setCountdownEnd(cdEnd);

      if (direction === "outgoing") {
        setMyIndex(0);
        myIndexRef.current = 0;
        setTimeout(() => createNewMatch(cdEnd), 220);
      } else {
        setMyIndex(1);
        myIndexRef.current = 1;
        updateGuestView(null);
      }
    },
    onDisconnected: () => {
      setMyIndex(null);
      myIndexRef.current = null;
      updateFullState(null);
      updateGuestView(null);
      setCountdownEnd(null);
      setLatencyMs(null);
      setLastRemoteMessageAt(null);
      updateClockSync(null);
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = undefined;
    },
  });

  useEffect(() => { sendRef.current = send; }, [send]);

  useEffect(() => {
    if (!isConnected) {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = undefined;
      return;
    }

    pingIntervalRef.current = setInterval(() => {
      const now = Date.now();
      sendRef.current({
        type: "ping",
        sentAt: now,
        senderNow: now,
      });
    }, 1500);

    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = undefined;
    };
  }, [isConnected]);

  useEffect(() => {
    if (myIndex !== 0 || !isConnected || !fullState) {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = undefined;
      return;
    }

    if (fullState.phase === "planning") {
      const lagWindowMs = getLagCompensationWindowMs(
        clockSyncRef.current?.rttMs ?? null,
        clockSyncRef.current?.jitterMs ?? null,
      );
      const delay = Math.max(16, fullState.roundEndsAt + lagWindowMs - Date.now());

      phaseTimerRef.current = setTimeout(() => {
        const current = fullStateRef.current;
        if (!current || current.phase !== "planning") return;
        const next = resolveRound(current, Date.now());
        updateFullState(next);
        syncToGuest(next);
      }, delay);
    } else if (fullState.phase === "revealing") {
      const delay = Math.max(16, fullState.revealEndsAt - Date.now());

      phaseTimerRef.current = setTimeout(() => {
        const current = fullStateRef.current;
        if (!current || current.phase !== "revealing") return;
        const next = startNextRound(current, Date.now());
        updateFullState(next);
        syncToGuest(next);
      }, delay);
    }

    return () => {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = undefined;
    };
  }, [fullState, isConnected, myIndex, syncToGuest, updateFullState]);

  const displayView = useMemo<DuelView | null>(() => {
    if (myIndex === 0 && fullState) return createView(fullState, 0);
    if (myIndex === 1) return guestView;
    return null;
  }, [fullState, guestView, myIndex]);

  const doAction = useCallback((action: DuelAction) => {
    if (myIndexRef.current === 0) {
      const current = fullStateRef.current;
      if (!current) return;
      const next = lockAction(current, 0, action, Date.now());
      if (next !== current) {
        updateFullState(next);
        syncToGuest(next);
      }
      return;
    }

    if (myIndexRef.current === 1) {
      const view = guestViewRef.current;
      if (!view || view.phase !== "planning" || view.myLockedAction) return;
      const hostNow = getHostNow();
      if (hostNow < view.roundStartsAt || hostNow > view.roundEndsAt) return;

      updateGuestView({ ...view, myLockedAction: action });
      sendRef.current({
        type: "action",
        roundNumber: view.roundNumber,
        action,
        claimedHostPressAt: hostNow,
        sentAt: Date.now(),
      });
    }
  }, [getHostNow, syncToGuest, updateFullState, updateGuestView]);

  const doRematch = useCallback(() => {
    if (myIndexRef.current === 0) {
      createNewMatch(Date.now());
      return;
    }

    if (myIndexRef.current === 1) {
      sendRef.current({ type: "rematch", sentAt: Date.now() });
    }
  }, [createNewMatch]);

  const exitToMenu = useCallback(() => {
    setGameMode("menu");
    setMyIndex(null);
    myIndexRef.current = null;
    updateFullState(null);
    updateGuestView(null);
    setCountdownEnd(null);
    setLatencyMs(null);
    setLastRemoteMessageAt(null);
    updateClockSync(null);
  }, [updateClockSync, updateFullState, updateGuestView]);

  useRoomUrl(roomCode, phase);

  return {
    gameMode: resolvedGameMode,
    setGameMode,
    myIndex,
    view: displayView,
    phase,
    localPeerId,
    error,
    isConnected,
    isReconnecting,
    reconnectDeadline,
    roomCode,
    connectSubstep,
    connect,
    sendChat,
    clearError,
    retryLastConnection,
    reinitialize,
    joinPeerId,
    latencyMs,
    lastRemoteMessageAt,
    clockOffsetMs: clockSync?.offsetMs ?? null,
    countdownEnd,
    chatMessages,
    addMyMessage,
    doAction,
    doRematch,
    exitToMenu,
  };
}
