"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePeerConnection } from "@/features/p2p/hooks/usePeerConnection";
import { useP2PChat } from "@/features/p2p/hooks/useP2PChat";
import { useJoinParam } from "@/features/p2p/hooks/useJoinParam";
import { P2P_CONNECT_TIMEOUT_MS } from "@/features/p2p/config";
import type { ActionType, FullGameState, GameMode, PlayerView, PokerPacket } from "../types";
import { createNewHand, processAction, createPlayerView } from "../utils";

export function usePokerGame() {
  const [gameMode, setGameMode] = useState<GameMode>("menu");
  const joinPeerId = useJoinParam();
  useEffect(() => { if (joinPeerId) setGameMode("p2p"); }, [joinPeerId]);

  const [myIndex, setMyIndex] = useState<0 | 1 | null>(null);
  const [fullState, setFullState] = useState<FullGameState | null>(null);
  const [guestView, setGuestView] = useState<PlayerView | null>(null);

  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastRemoteMessageAt, setLastRemoteMessageAt] = useState<number | null>(null);

  const myIndexRef = useRef<0 | 1 | null>(null);
  const fullStateRef = useRef<FullGameState | null>(null);
  const sendRef = useRef<(p: PokerPacket) => boolean>(() => false);
  const pingIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => { myIndexRef.current = myIndex; }, [myIndex]);
  useEffect(() => { fullStateRef.current = fullState; }, [fullState]);

  const displayView = useMemo<PlayerView | null>(() => {
    if (myIndex === 0 && fullState) return createPlayerView(fullState, 0);
    if (myIndex === 1 && guestView) return guestView;
    return null;
  }, [myIndex, fullState, guestView]);

  const syncToGuest = useCallback((state: FullGameState) => {
    sendRef.current({ type: "sync", view: createPlayerView(state, 1), timestamp: Date.now() });
  }, []);

  const doStartNewHand = useCallback(() => {
    const prev = fullStateRef.current;
    const hn = prev ? prev.handNumber + 1 : 1;
    const di: 0 | 1 = prev ? ((1 - prev.dealerIndex) as 0 | 1) : 0;
    const chips: [number, number] = prev ? [prev.players[0].chips, prev.players[1].chips] : [500, 500];
    if (chips[0] <= 0 || chips[1] <= 0) return;
    const ns = createNewHand(hn, di, chips);
    setFullState(ns);
    fullStateRef.current = ns;
    syncToGuest(ns);
  }, [syncToGuest]);

  const doProcessAction = useCallback((pi: 0 | 1, action: ActionType, amount: number) => {
    const s = fullStateRef.current;
    if (!s) return;
    const ns = processAction(s, pi, action, amount);
    setFullState(ns);
    fullStateRef.current = ns;
    syncToGuest(ns);
  }, [syncToGuest]);

  const handleIncomingData = useCallback((payload: PokerPacket) => {
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
    switch (payload.type) {
      case "sync":
        if (idx === 1) setGuestView(payload.view);
        break;
      case "action":
        if (idx === 0) doProcessAction(1, payload.action, payload.amount);
        break;
      case "next_hand":
        if (idx === 0) doStartNewHand();
        break;
      case "rematch":
        if (idx === 0) {
          const ns = createNewHand(1, 0, [500, 500]);
          setFullState(ns); fullStateRef.current = ns;
          syncToGuest(ns);
        }
        break;
    }
  }, [doProcessAction, doStartNewHand, syncToGuest]);

  const { messages: chatMessages, onChat, addMyMessage } = useP2PChat();

  const {
    phase, localPeerId, error, isConnected,
    connect, send, sendChat, clearError, retryLastConnection, reinitialize, roomCode,
  } = usePeerConnection<PokerPacket>({
    connectTimeoutMs: P2P_CONNECT_TIMEOUT_MS,
    handshake: { site: "wenqian.me", game: "poker" },
    onData: handleIncomingData,
    onChat,
    acceptIncomingConnections: true,
    onConnected: ({ direction }) => {
      if (direction === "outgoing") {
        setMyIndex(0); myIndexRef.current = 0;
        setTimeout(() => {
          const ns = createNewHand(1, 0, [500, 500]);
          setFullState(ns); fullStateRef.current = ns;
          syncToGuest(ns);
        }, 200);
      } else {
        setMyIndex(1); myIndexRef.current = 1;
      }
    },
    onDisconnected: () => {
      setMyIndex(null); myIndexRef.current = null;
      setLatencyMs(null); setLastRemoteMessageAt(null);
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

  const doAction = useCallback((action: ActionType, amount: number = 0) => {
    if (myIndexRef.current === 0) doProcessAction(0, action, amount);
    else if (myIndexRef.current === 1) sendRef.current({ type: "action", action, amount, timestamp: Date.now() });
  }, [doProcessAction]);

  const requestNextHand = useCallback(() => {
    if (myIndexRef.current === 0) doStartNewHand();
    else sendRef.current({ type: "next_hand", timestamp: Date.now() });
  }, [doStartNewHand]);

  const requestRematch = useCallback(() => {
    if (myIndexRef.current === 0) {
      const ns = createNewHand(1, 0, [500, 500]);
      setFullState(ns); fullStateRef.current = ns;
      syncToGuest(ns);
    } else {
      sendRef.current({ type: "rematch", timestamp: Date.now() });
    }
  }, [syncToGuest]);

  const exitToMenu = useCallback(() => {
    setGameMode("menu"); setFullState(null); setGuestView(null);
    setMyIndex(null); myIndexRef.current = null;
  }, []);

  const isGameOver = !!(displayView && displayView.phase === "showdown" &&
    (displayView.myChips <= 0 || displayView.opponentChips <= 0));

  return {
    gameMode, setGameMode, displayView, myIndex, isGameOver,
    phase, localPeerId, error, isConnected, roomCode,
    connect, sendChat, clearError, retryLastConnection, reinitialize, joinPeerId,
    latencyMs, lastRemoteMessageAt,
    chatMessages, addMyMessage,
    doAction, requestNextHand, requestRematch, exitToMenu,
  };
}
