"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePeerConnection } from "@/features/p2p/hooks/usePeerConnection";
import { useP2PChat } from "@/features/p2p/hooks/useP2PChat";
import { useJoinParam } from "@/features/p2p/hooks/useJoinParam";
import { P2P_CONNECT_TIMEOUT_MS } from "@/features/p2p/config";
import { useRoomUrl } from "@/features/p2p/hooks/useRoomUrl";
import type { FullHalliState, GameMode, HalliPacket, HalliView } from "../types";
import { applyBell, applyAutoFlip, createInitialState, createView } from "../gameLogic";

export function useHalliGalliGame() {
  const [gameMode, setGameMode] = useState<GameMode>("menu");
  const joinPeerId = useJoinParam();
  useEffect(() => { if (joinPeerId) setGameMode("p2p"); }, [joinPeerId]);

  const [myIndex, setMyIndex] = useState<0 | 1 | null>(null);
  const [fullState, setFullState] = useState<FullHalliState | null>(null);
  const [guestView, setGuestView] = useState<HalliView | null>(null);
  const [countdownEnd, setCountdownEnd] = useState<number | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastRemoteMessageAt, setLastRemoteMessageAt] = useState<number | null>(null);

  const myIndexRef = useRef<0 | 1 | null>(null);
  const fullStateRef = useRef<FullHalliState | null>(null);
  const sendRef = useRef<(p: HalliPacket) => boolean>(() => false);
  const pingIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const autoFlipRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const bellLockRef = useRef(false);

  useEffect(() => { myIndexRef.current = myIndex; }, [myIndex]);
  useEffect(() => { fullStateRef.current = fullState; }, [fullState]);

  const syncToGuest = useCallback((state: FullHalliState) => {
    sendRef.current({ type: "sync", view: createView(state, 1), timestamp: Date.now() });
  }, []);

  const processHostBell = useCallback((ringer: 0 | 1) => {
    if (bellLockRef.current) return;
    const s = fullStateRef.current;
    if (!s || s.phase !== "playing") return;
    bellLockRef.current = true;

    const ns = applyBell(s, ringer);
    setFullState(ns);
    fullStateRef.current = ns;
    syncToGuest(ns);

    setTimeout(() => { bellLockRef.current = false; }, 800);
  }, [syncToGuest]);

  const handleIncomingData = useCallback((payload: HalliPacket) => {
    if (!payload?.type) return;
    setLastRemoteMessageAt(Date.now());

    if (payload.type === "ping") {
      sendRef.current({ type: "pong", sentAt: payload.sentAt });
      return;
    }
    if (payload.type === "pong") {
      setLatencyMs(Math.max(0, Date.now() - payload.sentAt));
      return;
    }

    const idx = myIndexRef.current;

    if (payload.type === "sync" && idx === 1) {
      setGuestView(payload.view);
      return;
    }

    if (idx === 0) {
      if (payload.type === "bell") {
        processHostBell(1);
        return;
      }
      if (payload.type === "rematch") {
        const s = fullStateRef.current;
        const ts = s?.targetScore ?? 50;
        const ns = createInitialState(ts);
        setFullState(ns); fullStateRef.current = ns;
        syncToGuest(ns);
        return;
      }
      if (payload.type === "settings") {
        const s = fullStateRef.current;
        if (s) {
          const ns = { ...s, targetScore: payload.targetScore };
          setFullState(ns); fullStateRef.current = ns;
          syncToGuest(ns);
        }
        return;
      }
    }
  }, [processHostBell, syncToGuest]);

  const { messages: chatMessages, onChat, addMyMessage } = useP2PChat();

  const { phase, localPeerId, error, isConnected, isReconnecting, reconnectDeadline, connect, send, sendChat, clearError, retryLastConnection, reinitialize, roomCode, connectSubstep } =
    usePeerConnection<HalliPacket>({
      connectTimeoutMs: P2P_CONNECT_TIMEOUT_MS,
      handshake: { site: "wenqian.me", game: "halli-galli" },
      onData: handleIncomingData,
      onChat,
      acceptIncomingConnections: true,
      onConnected: ({ direction, reconnected }) => {
        if (reconnected) {
          // Host resends current game state on reconnection
          if (myIndexRef.current === 0 && fullStateRef.current) {
            setTimeout(() => syncToGuest(fullStateRef.current!), 200);
          }
          return;
        }
        const cdEnd = Date.now() + 3800; // 3-2-1-GO countdown
        setCountdownEnd(cdEnd);
        if (direction === "outgoing") {
          setMyIndex(0); myIndexRef.current = 0;
          setTimeout(() => {
            const ns = createInitialState(50);
            // First flip happens after countdown + random 3-5s
            ns.nextFlipAt = cdEnd + 3000 + Math.floor(Math.random() * 2001);
            setFullState(ns); fullStateRef.current = ns;
            syncToGuest(ns);
          }, 200);
        } else {
          setMyIndex(1); myIndexRef.current = 1;
        }
      },
      onDisconnected: () => {
        setMyIndex(null); myIndexRef.current = null;
        setFullState(null); setGuestView(null);
        setLatencyMs(null); setLastRemoteMessageAt(null);
        bellLockRef.current = false;
        if (autoFlipRef.current) clearTimeout(autoFlipRef.current);
        autoFlipRef.current = undefined;
      },
    });

  useEffect(() => { sendRef.current = send; }, [send]);

  useEffect(() => {
    if (!isConnected) {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = undefined;
      setLatencyMs(null);
      return;
    }
    pingIntervalRef.current = setInterval(() => {
      sendRef.current({ type: "ping", sentAt: Date.now() });
    }, 2000);
    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = undefined;
    };
  }, [isConnected]);

  // Auto-flip timer (host only) — single setTimeout, not polling interval
  useEffect(() => {
    if (myIndex !== 0 || !fullState || fullState.phase !== "playing" || !isConnected) {
      if (autoFlipRef.current) clearTimeout(autoFlipRef.current);
      autoFlipRef.current = undefined;
      return;
    }

    const delay = Math.max(0, fullState.nextFlipAt - Date.now());
    autoFlipRef.current = setTimeout(() => {
      const s = fullStateRef.current;
      if (!s || s.phase !== "playing") return;

      const ns = applyAutoFlip(s);
      setFullState(ns);
      fullStateRef.current = ns;
      syncToGuest(ns);
    }, delay);

    return () => {
      if (autoFlipRef.current) clearTimeout(autoFlipRef.current);
      autoFlipRef.current = undefined;
    };
  }, [myIndex, fullState?.phase, fullState?.nextFlipAt, isConnected, syncToGuest]);

  const myView = useMemo<HalliView | null>(() => {
    if (myIndex === 0 && fullState) return createView(fullState, 0);
    if (myIndex === 1) return guestView;
    return null;
  }, [myIndex, fullState, guestView]);

  const doBell = useCallback(() => {
    if (myIndex === 0) {
      processHostBell(0);
    } else if (myIndex === 1) {
      sendRef.current({ type: "bell", sentAt: Date.now() });
    }
  }, [myIndex, processHostBell]);

  const doRematch = useCallback(() => {
    if (myIndex === 0) {
      const s = fullStateRef.current;
      const ts = s?.targetScore ?? 50;
      const ns = createInitialState(ts);
      setFullState(ns); fullStateRef.current = ns;
      syncToGuest(ns);
    } else {
      sendRef.current({ type: "rematch", sentAt: Date.now() });
    }
  }, [myIndex, syncToGuest]);

  useRoomUrl(roomCode, phase);

  const exitToMenu = useCallback(() => {
    setGameMode("menu");
    setFullState(null); setGuestView(null);
    setMyIndex(null); myIndexRef.current = null;
  }, []);

  return {
    gameMode, setGameMode, myIndex, myView,
    phase, localPeerId, error, isConnected, isReconnecting, reconnectDeadline, roomCode, connectSubstep,
    connect, sendChat, clearError, retryLastConnection, reinitialize, joinPeerId,
    latencyMs, lastRemoteMessageAt,
    chatMessages, addMyMessage,
    doBell, doRematch, exitToMenu, countdownEnd,
  };
}
