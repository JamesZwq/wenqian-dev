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

const INITIAL_STATE: P2PState = {
  phase: "initializing",
  localPeerId: "",
  remotePeerId: null,
  error: null,
  lastConnectedPeerId: null,
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

  useEffect(() => {
    setState(INITIAL_STATE);
    latestRemotePeerIdRef.current = null;

    const localPeerId = options.peerId ?? generateShortPeerId();
    const peer = new Peer(localPeerId, options.peerOptions);
    peerRef.current = peer;

    const handleOpen = (openedPeerId: string) => {
      setState((prev) => ({
        ...prev,
        phase: "ready",
        localPeerId: openedPeerId,
        error: null,
      }));
    };

    const handleIncomingConnection = (connection: DataConnection) => {
      if (optionsRef.current.acceptIncomingConnections === false) {
        connection.close();
        return;
      }

      // Reject if already have an open connection (prevents link-sharing collisions)
      if (connectionRef.current?.open) {
        connection.close();
        return;
      }

      // Validate handshake metadata
      const expectedHandshake = optionsRef.current.handshake;
      if (expectedHandshake) {
        const meta = connection.metadata as Record<string, string> | undefined;
        const valid = meta != null &&
          Object.entries(expectedHandshake).every(([k, v]) => meta[k] === v);
        if (!valid) {
          connection.close();
          return;
        }
      }

      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      lastAttemptedPeerIdRef.current = connection.peer;
      latestRemotePeerIdRef.current = connection.peer;
      setState((prev) => ({
        ...prev,
        phase: "connecting",
        remotePeerId: connection.peer,
        error: null,
      }));
      attachConnection(connection, "incoming");
    };

    const handlePeerError = (rawError: unknown) => {
      const normalized = normalizePeerError(rawError);
      emitError(normalized);
    };

    const handlePeerDisconnected = () => {
      emitError(createPeerServerDisconnectedError());
    };

    peer.on("open", handleOpen);
    peer.on("connection", handleIncomingConnection);
    peer.on("error", handlePeerError);
    peer.on("disconnected", handlePeerDisconnected);

    return () => {
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
          // ignore close failures during teardown
        }
      }

      try {
        peer.off?.("open", handleOpen);
        peer.off?.("connection", handleIncomingConnection);
        peer.off?.("error", handlePeerError);
        peer.off?.("disconnected", handlePeerDisconnected);
      } catch {
        // ignore listener cleanup failures
      }

      try {
        peer.destroy();
      } catch {
        // ignore destroy failures
      }

      peerRef.current = null;
      latestRemotePeerIdRef.current = null;
    };
  }, [
    attachConnection,
    instanceNonce,
    options.peerId,
    options.peerOptions,
  ]);

  const connect = useCallback(
    (targetPeerId: string) => {
      const peer = peerRef.current;
      const sanitizedTarget = sanitizePeerId(targetPeerId);

      if (!peer || peer.destroyed) {
        emitError({
          code: "unknown",
          title: "PEER NOT READY",
          message: "The local peer is not ready yet. Please wait a moment and try again.",
          recoverable: true,
        });
        return false;
      }

      if (!sanitizedTarget) {
        emitError({
          code: "invalid-id",
          title: "INVALID PEER ID",
          message: "Please enter a valid peer code before connecting.",
          recoverable: true,
        });
        return false;
      }

      if (state.phase === "connecting") {
        return false;
      }

      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      lastAttemptedPeerIdRef.current = sanitizedTarget;
      latestRemotePeerIdRef.current = sanitizedTarget;
      setState((prev) => ({
        ...prev,
        phase: "connecting",
        remotePeerId: sanitizedTarget,
        error: null,
      }));

      try {
        const connection = peer.connect(sanitizedTarget, {
          reliable: true,
          metadata: optionsRef.current.handshake,
        });
        attachConnection(connection, "outgoing");

        const timeoutMs =
          optionsRef.current.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;

        connectTimeoutRef.current = setTimeout(() => {
          if (connectionRef.current !== connection) return;

          const timeoutError = createTimeoutError(timeoutMs);
          
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
            remotePeerId: sanitizedTarget,
            error: timeoutError,
          }));
          optionsRef.current.onError?.(timeoutError);
          optionsRef.current.onDisconnected?.({
            peerId: sanitizedTarget,
            reason: "timeout",
          });
        }, timeoutMs);

        return true;
      } catch (rawError) {
        const normalized = normalizePeerError(rawError);
        setState((prev) => ({
          ...prev,
          phase: "error",
          remotePeerId: sanitizedTarget,
          error: normalized,
        }));
        optionsRef.current.onError?.(normalized);
        return false;
      }
    },
    [attachConnection, state.phase],
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
