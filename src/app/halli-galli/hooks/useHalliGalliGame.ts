"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePeerConnection } from "@/features/p2p/hooks/usePeerConnection";
import { useP2PChat } from "@/features/p2p/hooks/useP2PChat";
import { useJoinParam } from "@/features/p2p/hooks/useJoinParam";
import { P2P_CONNECT_TIMEOUT_MS } from "@/features/p2p/config";
import type { FullHalliState, GameMode, HalliPacket, HalliView } from "../types";
import { applyBell, applyFlip, createInitialState, createView } from "../gameLogic";

export function useHalliGalliGame() {
  const [gameMode, setGameMode] = useState<GameMode>("menu");
  const joinPeerId = useJoinParam();
  useEffect(() => { if (joinPeerId) setGameMode("p2p"); }, [joinPeerId]);

  const [myIndex, setMyIndex] = useState<0 | 1 | null>(null);
  const [fullState, setFullState] = useState<FullHalliState | null>(null);
  const [guestView, setGuestView] = useState<HalliView | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastRemoteMessageAt, setLastRemoteMessageAt] = useState<number | null>(null);

  const myIndexRef = useRef<0 | 1 | null>(null);
  const fullStateRef = useRef<FullHalliState | null>(null);
  const sendRef = useRef<(p: HalliPacket) => boolean>(() => false);
  const pingIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
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
      const s = fullStateRef.current;
      if (payload.type === "flip") {
        if (!s) return;
        const ns = applyFlip(s, 1);
        setFullState(ns); fullStateRef.current = ns;
        syncToGuest(ns);
        return;
      }
      if (payload.type === "bell") {
        processHostBell(1);
        return;
      }
      if (payload.type === "rematch") {
        const ns = createInitialState();
        setFullState(ns); fullStateRef.current = ns;
        syncToGuest(ns);
        return;
      }
    }
  }, [processHostBell, syncToGuest]);

  const { messages: chatMessages, onChat, addMyMessage } = useP2PChat();

  const { phase, localPeerId, error, isConnected, connect, send, sendChat, clearError, retryLastConnection, reinitialize } =
    usePeerConnection<HalliPacket>({
      connectTimeoutMs: P2P_CONNECT_TIMEOUT_MS,
      handshake: { site: "wenqian.me", game: "halli-galli" },
      onData: handleIncomingData,
      onChat,
      acceptIncomingConnections: true,
      onConnected: ({ direction }) => {
        if (direction === "outgoing") {
          setMyIndex(0); myIndexRef.current = 0;
          setTimeout(() => {
            const ns = createInitialState();
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

  const myView = useMemo<HalliView | null>(() => {
    if (myIndex === 0 && fullState) return createView(fullState, 0);
    if (myIndex === 1) return guestView;
    return null;
  }, [myIndex, fullState, guestView]);

  const doFlip = useCallback(() => {
    if (myIndex === 0) {
      const s = fullStateRef.current;
      if (!s) return;
      const ns = applyFlip(s, 0);
      setFullState(ns); fullStateRef.current = ns;
      syncToGuest(ns);
    } else if (myIndex === 1) {
      sendRef.current({ type: "flip", sentAt: Date.now() });
    }
  }, [myIndex, syncToGuest]);

  const doBell = useCallback(() => {
    if (myIndex === 0) {
      processHostBell(0);
    } else if (myIndex === 1) {
      sendRef.current({ type: "bell", sentAt: Date.now() });
    }
  }, [myIndex, processHostBell]);

  const doRematch = useCallback(() => {
    if (myIndex === 0) {
      const ns = createInitialState();
      setFullState(ns); fullStateRef.current = ns;
      syncToGuest(ns);
    } else {
      sendRef.current({ type: "rematch", sentAt: Date.now() });
    }
  }, [myIndex, syncToGuest]);

  const exitToMenu = useCallback(() => {
    setGameMode("menu");
    setFullState(null); setGuestView(null);
    setMyIndex(null); myIndexRef.current = null;
  }, []);

  return {
    gameMode, setGameMode, myIndex, myView,
    phase, localPeerId, error, isConnected,
    connect, sendChat, clearError, retryLastConnection, reinitialize, joinPeerId,
    latencyMs, lastRemoteMessageAt,
    chatMessages, addMyMessage,
    doFlip, doBell, doRematch, exitToMenu,
  };
}
