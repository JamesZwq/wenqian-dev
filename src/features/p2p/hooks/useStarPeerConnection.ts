"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Peer, { type DataConnection } from "peerjs";
import { fetchIceServers } from "../config";

export interface StarMember {
  userId: string;
  peerId: string;
  displayUsername: string | null;
}

export interface StarOptions<TPacket> {
  /** "host" if we created the room; "guest" if we joined. */
  role: "host" | "guest";
  /** When role==="guest", the peerId we should dial. */
  hostPeerId: string | null;
  /** Optional pre-allocated peerId (used after auto-promote to keep reconnects predictable). */
  myPeerId?: string;
  /** Required: a stable room-keyed PeerJS prefix so reconnects work. */
  prefix: string;
  /** Fired when a packet arrives. Sender peerId provided so host can fan-out. */
  onData: (payload: TPacket, fromPeerId: string) => void;
  onPeerConnected?: (peerId: string) => void;
  onPeerDisconnected?: (peerId: string) => void;
  onHostLost?: () => void;
  enabled: boolean;
}

export interface StarApi<TPacket> {
  myPeerId: string | null;
  isReady: boolean;
  /** Send to all connected peers. Host: all guests. Guest: just to host. */
  broadcast: (packet: TPacket) => void;
  /** Send only to a specific peerId. Useful for host-side fan-out skipping the sender. */
  sendTo: (peerId: string, packet: TPacket) => void;
  destroy: () => void;
}

export function useStarPeerConnection<TPacket>(opts: StarOptions<TPacket>): StarApi<TPacket> {
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const peerRef = useRef<Peer | null>(null);
  const channelsRef = useRef<Map<string, DataConnection>>(new Map());
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; }, [opts]);

  const cleanup = useCallback(() => {
    for (const c of channelsRef.current.values()) {
      try { c.close(); } catch {}
    }
    channelsRef.current.clear();
    try { peerRef.current?.destroy(); } catch {}
    peerRef.current = null;
    setMyPeerId(null);
    setIsReady(false);
  }, []);

  useEffect(() => {
    if (!opts.enabled) { cleanup(); return; }
    let cancelled = false;
    (async () => {
      const iceServers = await fetchIceServers();
      const desiredId =
        opts.myPeerId ?? `${opts.prefix}-${Math.random().toString(36).slice(2, 10)}`;
      const peer = new Peer(desiredId, { config: { iceServers } });
      if (cancelled) { peer.destroy(); return; }
      peerRef.current = peer;

      const attachConnection = (conn: DataConnection) => {
        const onOpen = () => {
          channelsRef.current.set(conn.peer, conn);
          if (optsRef.current.role === "guest") setIsReady(true);
          optsRef.current.onPeerConnected?.(conn.peer);
        };
        const onData = (raw: unknown) => {
          optsRef.current.onData(raw as TPacket, conn.peer);
        };
        const onClose = () => {
          channelsRef.current.delete(conn.peer);
          optsRef.current.onPeerDisconnected?.(conn.peer);
          if (optsRef.current.role === "guest" && conn.peer === optsRef.current.hostPeerId) {
            optsRef.current.onHostLost?.();
          }
        };
        conn.on("open", onOpen);
        conn.on("data", onData);
        conn.on("close", onClose);
        conn.on("error", onClose);
        if (conn.open) onOpen();
      };

      peer.on("open", (id) => {
        if (cancelled) return;
        setMyPeerId(id);
        if (optsRef.current.role === "host") {
          setIsReady(true);
        } else {
          const target = optsRef.current.hostPeerId;
          if (!target) return;
          const conn = peer.connect(target, { reliable: true });
          attachConnection(conn);
        }
      });

      peer.on("connection", (conn) => {
        if (optsRef.current.role !== "host") { conn.close(); return; }
        attachConnection(conn);
      });

      peer.on("error", (err) => {
        if (optsRef.current.role === "guest") {
          optsRef.current.onHostLost?.();
        }
        // eslint-disable-next-line no-console
        console.warn("[useStarPeerConnection] peer error:", err);
      });
    })();

    return () => { cancelled = true; cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.enabled, opts.role, opts.hostPeerId, opts.prefix, opts.myPeerId]);

  const broadcast = useCallback((packet: TPacket) => {
    for (const c of channelsRef.current.values()) {
      if (c.open) c.send(packet);
    }
  }, []);

  const sendTo = useCallback((peerId: string, packet: TPacket) => {
    const c = channelsRef.current.get(peerId);
    if (c?.open) c.send(packet);
  }, []);

  const destroy = useCallback(() => cleanup(), [cleanup]);

  return { myPeerId, isReady, broadcast, sendTo, destroy };
}
