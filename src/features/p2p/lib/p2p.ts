import type { PeerJSOption } from "peerjs";

export type P2PPhase =
  | "initializing"
  | "ready"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export type P2PErrorCode =
  | "peer-unavailable"
  | "network"
  | "server-error"
  | "timeout"
  | "unavailable-id"
  | "invalid-id"
  | "connection-closed"
  | "send-failed"
  | "disconnected"
  | "unknown";

export interface P2PErrorState {
  code: P2PErrorCode;
  title: string;
  message: string;
  recoverable: boolean;
}

export interface P2PState {
  phase: P2PPhase;
  localPeerId: string;
  remotePeerId: string | null;
  error: P2PErrorState | null;
  lastConnectedPeerId: string | null;
  roomCode: string | null;
  /** Epoch ms when reconnection window expires (0 = not reconnecting) */
  reconnectDeadline: number;
}

export interface UsePeerConnectionOptions<TData = unknown> {
  peerId?: string;
  peerOptions?: PeerJSOption;
  connectTimeoutMs?: number;
  acceptIncomingConnections?: boolean;
  /** Key-value pairs sent as PeerJS connection metadata and validated on incoming connections */
  handshake?: Record<string, string>;
  onChat?: (text: string) => void;
  onData?: (data: TData, meta: { peerId: string; receivedAt: number }) => void;
  onConnected?: (meta: {
    peerId: string;
    direction: "incoming" | "outgoing";
    reconnected: boolean;
  }) => void;
  onDisconnected?: (meta: {
    peerId: string | null;
    reason: "manual" | "closed" | "error" | "destroyed" | "timeout";
  }) => void;
  onError?: (error: P2PErrorState) => void;
}

export const DEFAULT_CONNECT_TIMEOUT_MS = 8_000;
export const RECONNECT_WINDOW_MS = 3 * 60 * 1000; // 3 minutes

const SHORT_ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateShortPeerId(length = 6): string {
  return Array.from({ length }, () => {
    const index = Math.floor(Math.random() * SHORT_ID_CHARS.length);
    return SHORT_ID_CHARS[index];
  }).join("");
}

export function sanitizePeerId(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

export function normalizePeerError(error: unknown): P2PErrorState {
  const raw = error as { type?: string; message?: string } | null;
  const type = raw?.type;
  const message = raw?.message ?? "Unknown peer-to-peer error.";

  if (type === "peer-unavailable" || /could not connect to peer/i.test(message)) {
    return {
      code: "peer-unavailable",
      title: "PEER NOT FOUND",
      message: "The target peer is offline or the code is incorrect.",
      recoverable: true,
    };
  }

  if (type === "network" || /lost connection/i.test(message)) {
    return {
      code: "network",
      title: "NETWORK ISSUE",
      message: "The network became unstable while trying to establish the connection.",
      recoverable: true,
    };
  }

  if (type === "server-error") {
    return {
      code: "server-error",
      title: "SIGNAL SERVER ERROR",
      message: "The signaling server failed to complete the handshake. Please try again.",
      recoverable: true,
    };
  }

  if (type === "unavailable-id") {
    return {
      code: "unavailable-id",
      title: "LOCAL ID COLLISION",
      message: "This local peer ID is already in use. Recreate the peer and try again.",
      recoverable: true,
    };
  }

  if (type === "invalid-id" || /invalid id/i.test(message)) {
    return {
      code: "invalid-id",
      title: "INVALID PEER ID",
      message: "The target peer ID format is invalid.",
      recoverable: true,
    };
  }

  return {
    code: "unknown",
    title: "CONNECTION ERROR",
    message,
    recoverable: true,
  };
}

export function createTimeoutError(timeoutMs: number): P2PErrorState {
  const seconds = Math.max(1, Math.round(timeoutMs / 1000));

  return {
    code: "timeout",
    title: "CONNECTION TIMEOUT",
    message: `No response was received within ${seconds} seconds.`,
    recoverable: true,
  };
}

export function createConnectionClosedError(): P2PErrorState {
  return {
    code: "connection-closed",
    title: "CONNECTION CLOSED",
    message: "The remote peer closed the connection or became unavailable.",
    recoverable: true,
  };
}

export function createSendFailedError(): P2PErrorState {
  return {
    code: "send-failed",
    title: "SEND FAILED",
    message: "The message could not be sent because the peer connection is not open.",
    recoverable: true,
  };
}

export function createPeerServerDisconnectedError(): P2PErrorState {
  return {
    code: "disconnected",
    title: "SERVER DISCONNECTED",
    message: "The local peer lost contact with the signaling server.",
    recoverable: true,
  };
}

export function getPhaseLabel(phase: P2PPhase): string {
  switch (phase) {
    case "initializing":
      return "INITIALIZING";
    case "ready":
      return "READY";
    case "connecting":
      return "CONNECTING";
    case "connected":
      return "CONNECTED";
    case "reconnecting":
      return "RECONNECTING";
    case "disconnected":
      return "DISCONNECTED";
    case "error":
      return "ERROR";
    default:
      return "UNKNOWN";
  }
}

export function formatClockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
