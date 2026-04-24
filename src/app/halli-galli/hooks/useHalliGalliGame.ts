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
import type { FullHalliState, GameMode, HalliPacket, HalliView } from "../types";
import { advanceStateToTime, applyBell, createInitialState, createView } from "../gameLogic";

type BellClaim = {
  player: 0 | 1;
  boardVersion: number;
  pressedAtHostTime: number;
  receivedAtHostTime: number;
};

type BellContest = {
  boardVersion: number;
  claims: BellClaim[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function useHalliGalliGame() {
  const [gameMode, setGameMode] = useState<GameMode>("menu");
  const joinPeerId = useJoinParam();
  const resolvedGameMode: GameMode = joinPeerId ? "p2p" : gameMode;

  const [myIndex, setMyIndex] = useState<0 | 1 | null>(null);
  const [fullState, setFullState] = useState<FullHalliState | null>(null);
  const [countdownEnd, setCountdownEnd] = useState<number | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastRemoteMessageAt, setLastRemoteMessageAt] = useState<number | null>(null);
  const [clockSync, setClockSync] = useState<ClockSyncEstimate | null>(null);

  const myIndexRef = useRef<0 | 1 | null>(null);
  const fullStateRef = useRef<FullHalliState | null>(null);
  const sendRef = useRef<(p: HalliPacket) => boolean>(() => false);
  const pingIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const autoFlipRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const bellResolveRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const bellContestRef = useRef<BellContest | null>(null);
  const clockSyncRef = useRef<ClockSyncEstimate | null>(null);

  useEffect(() => { myIndexRef.current = myIndex; }, [myIndex]);
  useEffect(() => { fullStateRef.current = fullState; }, [fullState]);

  const updateClockSync = useCallback((next: ClockSyncEstimate | null) => {
    clockSyncRef.current = next;
    setClockSync(next);
    setLatencyMs(next ? Math.round(next.rttMs) : null);
  }, []);

  const updateFullState = useCallback((next: FullHalliState | null) => {
    fullStateRef.current = next;
    setFullState(next);
  }, []);

  const clearBellContest = useCallback(() => {
    if (bellResolveRef.current) clearTimeout(bellResolveRef.current);
    bellResolveRef.current = undefined;
    bellContestRef.current = null;
  }, []);

  const syncFullState = useCallback((state: FullHalliState) => {
    sendRef.current({ type: "sync", state, hostSentAt: Date.now() });
  }, []);

  const createNewMatch = useCallback((targetScore: number, startAt = Date.now()) => {
    const next = createInitialState(targetScore, startAt);
    updateFullState(next);
    clearBellContest();
    syncFullState(next);
  }, [clearBellContest, syncFullState, updateFullState]);

  const resolveBellContest = useCallback((expectedBoardVersion: number) => {
    const contest = bellContestRef.current;
    clearBellContest();

    const current = fullStateRef.current;
    if (!contest || !current || current.phase !== "playing") return;
    if (contest.boardVersion !== expectedBoardVersion || current.boardVersion !== expectedBoardVersion) return;

    const winner = [...contest.claims].sort((a, b) => {
      if (a.pressedAtHostTime !== b.pressedAtHostTime) {
        return a.pressedAtHostTime - b.pressedAtHostTime;
      }
      return a.receivedAtHostTime - b.receivedAtHostTime;
    })[0];

    if (!winner) return;

    const resolvedAt = Math.max(Date.now(), winner.pressedAtHostTime);
    const next = applyBell(current, winner.player, resolvedAt);
    updateFullState(next);
    syncFullState(next);
  }, [clearBellContest, syncFullState, updateFullState]);

  const registerBellClaim = useCallback((claim: BellClaim) => {
    const current = fullStateRef.current;
    if (!current || current.phase !== "playing") return;
    if (claim.boardVersion !== current.boardVersion) return;

    let contest = bellContestRef.current;
    if (!contest || contest.boardVersion !== claim.boardVersion) {
      clearBellContest();
      contest = { boardVersion: claim.boardVersion, claims: [] };
      bellContestRef.current = contest;
    }

    const existing = contest.claims.find((entry) => entry.player === claim.player);
    if (existing) {
      if (claim.pressedAtHostTime < existing.pressedAtHostTime) {
        existing.pressedAtHostTime = claim.pressedAtHostTime;
        existing.receivedAtHostTime = claim.receivedAtHostTime;
      }
    } else {
      contest.claims.push(claim);
    }

    if (contest.claims.length >= 2) {
      resolveBellContest(claim.boardVersion);
      return;
    }

    const waitMs = getLagCompensationWindowMs(
      clockSyncRef.current?.rttMs ?? null,
      clockSyncRef.current?.jitterMs ?? null,
    );

    bellResolveRef.current = setTimeout(() => {
      resolveBellContest(claim.boardVersion);
    }, waitMs);
  }, [clearBellContest, resolveBellContest]);

  const getHostNow = useCallback((localNow = Date.now()) => {
    return myIndexRef.current === 0
      ? localNow
      : estimatePeerClockMs(clockSyncRef.current?.offsetMs ?? null, localNow);
  }, []);

  const handleIncomingData = useCallback((payload: HalliPacket) => {
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
      clearBellContest();
      updateFullState(payload.state);
      return;
    }

    const idx = myIndexRef.current;

    if (idx === 0) {
      if (payload.type === "bell") {
        const receivedAtHostTime = Date.now();
        const plausibleLookbackMs = Math.max(450, Math.round((clockSyncRef.current?.rttMs ?? 120) * 1.35));

        registerBellClaim({
          player: 1,
          boardVersion: payload.boardVersion,
          pressedAtHostTime: clamp(
            payload.claimedHostPressAt,
            receivedAtHostTime - plausibleLookbackMs,
            receivedAtHostTime + 24,
          ),
          receivedAtHostTime,
        });
        return;
      }

      if (payload.type === "rematch") {
        const targetScore = fullStateRef.current?.targetScore ?? 50;
        createNewMatch(targetScore, Date.now());
        return;
      }

      if (payload.type === "settings") {
        const current = fullStateRef.current;
        if (!current) return;
        const next = { ...current, targetScore: payload.targetScore };
        updateFullState(next);
        syncFullState(next);
      }
    }
  }, [clearBellContest, createNewMatch, registerBellClaim, syncFullState, updateClockSync, updateFullState]);

  const { messages: chatMessages, onChat, addMyMessage } = useP2PChat();

  const {
    phase, localPeerId, error, isConnected, isReconnecting, reconnectDeadline,
    connect, send, sendChat, clearError, retryLastConnection, reinitialize, roomCode, connectSubstep,
  } = usePeerConnection<HalliPacket>({
    connectTimeoutMs: P2P_CONNECT_TIMEOUT_MS,
    handshake: { site: "wenqian.me", game: "halli-galli" },
    onData: handleIncomingData,
    onChat,
    acceptIncomingConnections: true,
    onConnected: ({ direction, reconnected }) => {
      if (reconnected) {
        clearBellContest();
        if (myIndexRef.current === 0 && fullStateRef.current) {
          setTimeout(() => syncFullState(fullStateRef.current!), 200);
        }
        return;
      }

      const cdEnd = Date.now() + 3800;
      setCountdownEnd(cdEnd);

      if (direction === "outgoing") {
        setMyIndex(0);
        myIndexRef.current = 0;
        setTimeout(() => {
          createNewMatch(50, cdEnd);
        }, 200);
      } else {
        setMyIndex(1);
        myIndexRef.current = 1;
      }
    },
    onDisconnected: () => {
      setMyIndex(null);
      myIndexRef.current = null;
      updateFullState(null);
      setLatencyMs(null);
      setLastRemoteMessageAt(null);
      setCountdownEnd(null);
      updateClockSync(null);
      clearBellContest();
      if (autoFlipRef.current) clearTimeout(autoFlipRef.current);
      autoFlipRef.current = undefined;
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
      sendRef.current({
        type: "ping",
        sentAt: Date.now(),
        senderNow: Date.now(),
      });
    }, 1500);

    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = undefined;
    };
  }, [isConnected, updateClockSync]);

  useEffect(() => {
    if (!isConnected || !fullState || fullState.phase !== "playing" || myIndex === null) {
      if (autoFlipRef.current) clearTimeout(autoFlipRef.current);
      autoFlipRef.current = undefined;
      return;
    }

    const scheduleTick = () => {
      const current = fullStateRef.current;
      if (!current || current.phase !== "playing") return;

      if (myIndexRef.current === 0 && bellContestRef.current) {
        autoFlipRef.current = setTimeout(scheduleTick, 24);
        return;
      }

      const hostNow = getHostNow();
      const advanced = advanceStateToTime(current, hostNow);

      if (advanced !== current) {
        updateFullState(advanced);
        if (myIndexRef.current === 0) {
          syncFullState(advanced);
        }
      }

      const next = fullStateRef.current;
      if (!next || next.phase !== "playing") return;

      const delay = Math.max(16, next.nextFlipAt - getHostNow() + 18);
      autoFlipRef.current = setTimeout(scheduleTick, delay);
    };

    scheduleTick();

    return () => {
      if (autoFlipRef.current) clearTimeout(autoFlipRef.current);
      autoFlipRef.current = undefined;
    };
  }, [fullState, fullState?.nextFlipAt, fullState?.phase, getHostNow, isConnected, myIndex, syncFullState, updateFullState]);

  const myView = useMemo<HalliView | null>(() => {
    if (myIndex === null || !fullState) return null;
    return createView(fullState, myIndex);
  }, [fullState, myIndex]);

  const doBell = useCallback(() => {
    const current = fullStateRef.current;
    if (!current || current.phase !== "playing") return;

    if (myIndexRef.current === 0) {
      registerBellClaim({
        player: 0,
        boardVersion: current.boardVersion,
        pressedAtHostTime: Date.now(),
        receivedAtHostTime: Date.now(),
      });
      return;
    }

    if (myIndexRef.current === 1) {
      sendRef.current({
        type: "bell",
        boardVersion: current.boardVersion,
        claimedHostPressAt: getHostNow(),
        sentAt: Date.now(),
      });
    }
  }, [getHostNow, registerBellClaim]);

  const doRematch = useCallback(() => {
    if (myIndex === 0) {
      const targetScore = fullStateRef.current?.targetScore ?? 50;
      createNewMatch(targetScore, Date.now());
    } else {
      sendRef.current({ type: "rematch", sentAt: Date.now() });
    }
  }, [createNewMatch, myIndex]);

  useRoomUrl(roomCode, phase);

  const exitToMenu = useCallback(() => {
    setGameMode("menu");
    updateFullState(null);
    setMyIndex(null);
    myIndexRef.current = null;
    setCountdownEnd(null);
    setLatencyMs(null);
    setLastRemoteMessageAt(null);
    updateClockSync(null);
    clearBellContest();
  }, [clearBellContest, updateClockSync, updateFullState]);

  return {
    gameMode: resolvedGameMode, setGameMode, myIndex, myView,
    phase, localPeerId, error, isConnected, isReconnecting, reconnectDeadline, roomCode, connectSubstep,
    connect, sendChat, clearError, retryLastConnection, reinitialize, joinPeerId,
    latencyMs, lastRemoteMessageAt, clockOffsetMs: clockSync?.offsetMs ?? null,
    chatMessages, addMyMessage,
    doBell, doRematch, exitToMenu, countdownEnd,
  };
}
