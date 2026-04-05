"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Peer, { type DataConnection } from "peerjs";
import {
  createConnectionClosedError,
  createPeerServerDisconnectedError,
  createSendFailedError,
  createTimeoutError,
  DEFAULT_CONNECT_TIMEOUT_MS,
  generateShortPeerId,
  normalizePeerError,
  sanitizePeerId,
  type P2PErrorState,
  type P2PState,
  type UsePeerConnectionOptions,
} from "../lib/p2p";
import { ICE_SERVERS } from "../config";

function peerOpts(custom?: import("peerjs").PeerJSOption) {
  return { ...custom, config: { ...custom?.config, iceServers: ICE_SERVERS } };
}

const INITIAL_STATE: P2PState = {
  phase: "initializing",
  localPeerId: "",
  remotePeerId: null,
  error: null,
  lastConnectedPeerId: null,
  roomCode: null,
};

export function usePeerConnection<TData = unknown>(
  options: UsePeerConnectionOptions<TData> = {},
) {
  const [state, setState] = useState<P2PState>(INITIAL_STATE);
  const [instanceNonce, setInstanceNonce] = useState(0);

  const peerRef = useRef<Peer | null>(null);
  const connectionRef = useRef<DataConnection | null>(null);
  const connectionCleanupRef = useRef<(() => void) | null>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAttemptedPeerIdRef = useRef<string | null>(null);
  const latestRemotePeerIdRef = useRef<string | null>(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    latestRemotePeerIdRef.current = state.remotePeerId;
  }, [state.remotePeerId]);

  const clearConnectTimeout = useCallback(() => {
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
  }, []);

  const emitError = useCallback((error: P2PErrorState) => {
    setState((prev) => ({
      ...prev,
      phase: "error",
      error,
    }));
    optionsRef.current.onError?.(error);
  }, []);

  const detachCurrentConnection = useCallback(
    (shouldClose = true) => {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      connectionCleanupRef.current?.();
      connectionCleanupRef.current = null;

      const current = connectionRef.current;
      connectionRef.current = null;

      if (current && shouldClose) {
        try {
          current.close();
        } catch {
          // ignore close failures during teardown
        }
      }
    },
    [],
  );

  const clearError = useCallback(() => {
    setState((prev) => ({
      ...prev,
      error: null,
      phase:
        prev.phase === "error" || prev.phase === "disconnected"
          ? "ready"
          : prev.phase,
    }));
  }, []);

  const attachConnection = useCallback(
    (connection: DataConnection, direction: "incoming" | "outgoing") => {
      // Inline detachCurrentConnection to avoid dependency
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      connectionCleanupRef.current?.();
      connectionCleanupRef.current = null;

      const oldConnection = connectionRef.current;
      connectionRef.current = connection;

      if (oldConnection && oldConnection !== connection) {
        try {
          oldConnection.close();
        } catch {
          // ignore close failures
        }
      }

      const handleOpen = () => {
        if (connectionRef.current !== connection) return;

        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        latestRemotePeerIdRef.current = connection.peer;
        setState((prev) => ({
          ...prev,
          phase: "connected",
          remotePeerId: connection.peer,
          lastConnectedPeerId: connection.peer,
          error: null,
        }));
        optionsRef.current.onConnected?.({
          peerId: connection.peer,
          direction,
        });
      };

      const handleData = (payload: unknown) => {
        if (connectionRef.current !== connection) return;

        // Intercept chat packets — don't pass to game onData
        if (
          payload !== null &&
          typeof payload === "object" &&
          (payload as Record<string, unknown>).__chat === true
        ) {
          const text = (payload as Record<string, unknown>).text;
          if (typeof text === "string") {
            optionsRef.current.onChat?.(text);
          }
          return;
        }

        optionsRef.current.onData?.(payload as TData, {
          peerId: connection.peer,
          receivedAt: Date.now(),
        });
      };

      const handleError = (rawError: unknown) => {
        if (connectionRef.current !== connection) return;

        const normalized = normalizePeerError(rawError);
        const peerId =
          connection.peer ||
          lastAttemptedPeerIdRef.current ||
          latestRemotePeerIdRef.current;

        latestRemotePeerIdRef.current = peerId ?? null;
        
        // Inline detachCurrentConnection
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        connectionCleanupRef.current?.();
        connectionCleanupRef.current = null;
        connectionRef.current = null;
        
        setState((prev) => ({
          ...prev,
          phase: "error",
          remotePeerId: peerId ?? null,
          error: normalized,
        }));
        optionsRef.current.onError?.(normalized);
        optionsRef.current.onDisconnected?.({
          peerId: peerId ?? null,
          reason: "error",
        });
      };

      const handleClose = () => {
        if (connectionRef.current !== connection) return;

        const peerId =
          connection.peer ||
          latestRemotePeerIdRef.current ||
          lastAttemptedPeerIdRef.current;
        const normalized = createConnectionClosedError();

        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        connectionCleanupRef.current?.();
        connectionCleanupRef.current = null;
        connectionRef.current = null;
        latestRemotePeerIdRef.current = null;

        setState((prev) => ({
          ...prev,
          phase: "disconnected",
          remotePeerId: null,
          error: normalized,
        }));
        optionsRef.current.onError?.(normalized);
        optionsRef.current.onDisconnected?.({
          peerId: peerId ?? null,
          reason: "closed",
        });
      };

      connection.on("open", handleOpen);
      connection.on("data", handleData);
      connection.on("error", handleError);
      connection.on("close", handleClose);

      // Incoming connections may already be open before listeners are attached
      if (connection.open) {
        handleOpen();
      }

      connectionCleanupRef.current = () => {
        const conn = connection as DataConnection & {
          off?: (event: string, handler: (...args: unknown[]) => void) => void;
        };

        conn.off?.("open", handleOpen);
        conn.off?.("data", handleData);
        conn.off?.("error", handleError);
        conn.off?.("close", handleClose);
      };
    },
    [],
  );

  // Helper: attach standard peer-level event listeners
  const setupPeerListeners = useCallback(
    (peer: Peer) => {
      const handleIncoming = (connection: DataConnection) => {
        if (optionsRef.current.acceptIncomingConnections === false) { connection.close(); return; }
        if (connectionRef.current?.open) { connection.close(); return; }
        const expected = optionsRef.current.handshake;
        if (expected) {
          const meta = connection.metadata as Record<string, string> | undefined;
          if (!meta || !Object.entries(expected).every(([k, v]) => meta[k] === v)) { connection.close(); return; }
        }
        if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null; }
        lastAttemptedPeerIdRef.current = connection.peer;
        latestRemotePeerIdRef.current = connection.peer;
        setState((prev) => ({ ...prev, phase: "connecting", remotePeerId: connection.peer, error: null }));
        attachConnection(connection, "incoming");
      };
      const handleErr = (raw: unknown) => emitError(normalizePeerError(raw));
      const handleDisc = () => {
        // Auto-reconnect to the signaling server (WebRTC data channel may still be alive)
        try { peer.reconnect(); } catch { emitError(createPeerServerDisconnectedError()); }
      };
      peer.on("connection", handleIncoming);
      peer.on("error", handleErr);
      peer.on("disconnected", handleDisc);
      return { handleIncoming, handleErr, handleDisc };
    },
    [attachConnection, emitError],
  );

  // Helper: full teardown of a peer + connection
  const teardown = useCallback(() => {
    if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null; }
    connectionCleanupRef.current?.();
    connectionCleanupRef.current = null;
    const conn = connectionRef.current; connectionRef.current = null;
    if (conn) { try { conn.close(); } catch {} }
    try { peerRef.current?.destroy(); } catch {}
    peerRef.current = null;
    latestRemotePeerIdRef.current = null;
  }, []);

  useEffect(() => {
    setState(INITIAL_STATE);
    latestRemotePeerIdRef.current = null;

    // Room mode: don't auto-create peer — wait for connect(code)
    if (optionsRef.current.handshake) {
      setState((prev) => ({ ...prev, phase: "ready" }));
      return () => teardown();
    }

    // Classic mode: create peer on mount
    const localPeerId = options.peerId ?? generateShortPeerId();
    const peer = new Peer(localPeerId, peerOpts(options.peerOptions));
    peerRef.current = peer;

    const handleOpen = (openedPeerId: string) => {
      setState((prev) => ({ ...prev, phase: "ready", localPeerId: openedPeerId, error: null }));
    };
    peer.on("open", handleOpen);
    const listeners = setupPeerListeners(peer);

    return () => {
      teardown();
      try {
        peer.off?.("open", handleOpen);
        peer.off?.("connection", listeners.handleIncoming);
        peer.off?.("error", listeners.handleErr);
        peer.off?.("disconnected", listeners.handleDisc);
      } catch {}
    };
  }, [
    attachConnection,
    instanceNonce,
    options.peerId,
    options.peerOptions,
    setupPeerListeners,
    teardown,
  ]);

  // Helper: connect to a known peer ID (used in both classic and room-guest mode)
  const connectToPeer = useCallback(
    (peer: Peer, targetId: string) => {
      try {
        const connection = peer.connect(targetId, {
          reliable: true,
          metadata: optionsRef.current.handshake,
        });
        attachConnection(connection, "outgoing");

        const timeoutMs = optionsRef.current.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
        connectTimeoutRef.current = setTimeout(() => {
          if (connectionRef.current !== connection) return;
          const err = createTimeoutError(timeoutMs);
          if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null; }
          connectionCleanupRef.current?.(); connectionCleanupRef.current = null; connectionRef.current = null;
          setState((prev) => ({ ...prev, phase: "error", error: err }));
          optionsRef.current.onError?.(err);
          optionsRef.current.onDisconnected?.({ peerId: targetId, reason: "timeout" });
        }, timeoutMs);
      } catch (raw) {
        emitError(normalizePeerError(raw));
      }
    },
    [attachConnection, emitError],
  );

  const connect = useCallback(
    (code: string) => {
      const sanitized = sanitizePeerId(code);
      if (!sanitized) {
        emitError({ code: "invalid-id", title: "INVALID CODE", message: "Please enter a valid code.", recoverable: true });
        return false;
      }
      if (state.phase === "connecting") return false;

      const handshake = optionsRef.current.handshake;
      const prefix = handshake ? `wq-${handshake.game}` : null;

      // ── Classic mode (no handshake) ──
      if (!prefix) {
        const peer = peerRef.current;
        if (!peer || peer.destroyed) {
          emitError({ code: "unknown", title: "PEER NOT READY", message: "Please wait a moment and try again.", recoverable: true });
          return false;
        }
        lastAttemptedPeerIdRef.current = sanitized;
        latestRemotePeerIdRef.current = sanitized;
        setState((prev) => ({ ...prev, phase: "connecting", remotePeerId: sanitized, error: null }));
        connectToPeer(peer, sanitized);
        return true;
      }

      // ── Room mode ──
      const roomId = `${prefix}-${sanitized}`;
      setState((prev) => ({ ...prev, phase: "connecting", roomCode: sanitized, error: null }));

      // Tear down any existing peer
      teardown();

      // Attempt 1: register as host with roomId
      const hostPeer = new Peer(roomId, peerOpts(optionsRef.current.peerOptions));
      let hostHandled = false;

      hostPeer.on("open", () => {
        // We are the host — wait for opponent
        peerRef.current = hostPeer;
        setState((prev) => ({ ...prev, phase: "ready", localPeerId: roomId, roomCode: sanitized }));
      });

      // Auto-reconnect host peer on signaling disconnect
      hostPeer.on("disconnected", () => {
        if (hostHandled) return;
        try { hostPeer.reconnect(); } catch { emitError(createPeerServerDisconnectedError()); }
      });

      // Incoming connection handler for host
      hostPeer.on("connection", (conn: DataConnection) => {
        if (optionsRef.current.acceptIncomingConnections === false) { conn.close(); return; }
        if (connectionRef.current?.open) { conn.close(); return; }
        const expected = optionsRef.current.handshake;
        if (expected) {
          const meta = conn.metadata as Record<string, string> | undefined;
          if (!meta || !Object.entries(expected).every(([k, v]) => meta[k] === v)) { conn.close(); return; }
        }
        setState((prev) => ({ ...prev, phase: "connecting", remotePeerId: conn.peer, error: null }));
        attachConnection(conn, "incoming");
      });

      hostPeer.on("error", (err) => {
        const raw = err as { type?: string };
        if (raw.type === "unavailable-id") {
          // Room already exists → join as guest
          hostHandled = true;
          try { hostPeer.destroy(); } catch {}

          const guestPeer = new Peer(generateShortPeerId(), peerOpts(optionsRef.current.peerOptions));
          guestPeer.on("open", () => {
            peerRef.current = guestPeer;
            setState((prev) => ({ ...prev, roomCode: sanitized }));
            connectToPeer(guestPeer, roomId);
          });
          guestPeer.on("error", (e) => emitError(normalizePeerError(e)));
          guestPeer.on("disconnected", () => {
            try { guestPeer.reconnect(); } catch { emitError(createPeerServerDisconnectedError()); }
          });
          return;
        }
        // Other error
        hostHandled = true;
        try { hostPeer.destroy(); } catch {}
        emitError(normalizePeerError(err));
      });

      return true;
    },
    [state.phase, emitError, teardown, attachConnection, connectToPeer],
  );

  const retryLastConnection = useCallback(() => {
    const target = lastAttemptedPeerIdRef.current;
    if (!target) return false;
    return connect(target);
  }, [connect]);

  const disconnect = useCallback(() => {
    const peerId = connectionRef.current?.peer ?? latestRemotePeerIdRef.current ?? null;
    latestRemotePeerIdRef.current = null;
    
    // Inline detachCurrentConnection
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    connectionCleanupRef.current?.();
    connectionCleanupRef.current = null;

    const current = connectionRef.current;
    connectionRef.current = null;

    if (current) {
      try {
        current.close();
      } catch {
        // ignore close failures
      }
    }
    
    setState((prev) => ({
      ...prev,
      phase: "ready",
      remotePeerId: null,
      error: null,
    }));
    optionsRef.current.onDisconnected?.({
      peerId,
      reason: "manual",
    });
  }, []);

  const send = useCallback(
    (payload: TData) => {
      const connection = connectionRef.current;
      if (!connection || !connection.open) {
        emitError(createSendFailedError());
        return false;
      }

      try {
        connection.send(payload);
        return true;
      } catch {
        emitError(createSendFailedError());
        return false;
      }
    },
    [emitError],
  );

  const sendChat = useCallback(
    (text: string): boolean => {
      const connection = connectionRef.current;
      if (!connection || !connection.open) return false;
      try {
        connection.send({ __chat: true, text, timestamp: Date.now() });
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  const reinitialize = useCallback(() => {
    // Inline detachCurrentConnection
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    connectionCleanupRef.current?.();
    connectionCleanupRef.current = null;

    const current = connectionRef.current;
    connectionRef.current = null;

    if (current) {
      try {
        current.close();
      } catch {
        // ignore close failures
      }
    }
    
    try {
      peerRef.current?.destroy();
    } catch {
      // ignore destroy failures
    }
    peerRef.current = null;
    latestRemotePeerIdRef.current = null;
    setInstanceNonce((value) => value + 1);
  }, []);

  const helpers = useMemo(
    () => ({
      isReady: state.phase === "ready",
      isConnecting: state.phase === "connecting",
      isConnected: state.phase === "connected",
      hasError: Boolean(state.error),
    }),
    [state.error, state.phase],
  );

  return {
    ...state,
    ...helpers,
    peer: peerRef.current,
    connection: connectionRef.current,
    connect,
    disconnect,
    send,
    sendChat,
    clearError,
    retryLastConnection,
    reinitialize,
  };
}
