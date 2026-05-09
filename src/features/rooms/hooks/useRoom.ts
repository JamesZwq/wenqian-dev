"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth-client";
import type { GameId } from "@/db/schema/leaderboards";

export interface RoomMember {
  userId: string;
  peerId: string;
  displayUsername: string | null;
  joinedAt: number;
}

export interface RoomSnapshot {
  code: string;
  game: GameId;
  visibility: "public" | "private";
  capacity: number;
  hostUserId: string;
  hostPeerId: string;
  members: RoomMember[];
  promotionGen: number;
}

export interface UseRoomOptions {
  game: GameId;
  /** Caller-provided peerId (assigned before the hook is called). */
  myPeerId: string;
}

export interface UseRoomApi {
  room: RoomSnapshot | null;
  role: "host" | "guest" | null;
  isHost: boolean;
  error: string | null;
  createRoom: (opts: { visibility: "public" | "private"; capacity: number }) => Promise<string | null>;
  joinRoom: (code: string) => Promise<boolean>;
  /** GET-then-decide: attach to an existing room and infer role from hostUserId. */
  attachRoom: (code: string) => Promise<boolean>;
  leaveRoom: () => Promise<void>;
  refresh: () => Promise<void>;
  acceptPromotion: (newPeerId: string) => Promise<boolean>;
}

const HEARTBEAT_INTERVAL_MS = 60_000;
const REFRESH_INTERVAL_MS = 5_000;

export function useRoom({ game, myPeerId }: UseRoomOptions): UseRoomApi {
  const { data: session } = useSession();
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [role, setRole] = useState<"host" | "guest" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const myUserId = session?.user?.id ?? null;
  const isHost = role === "host";

  const refresh = useCallback(async () => {
    if (!codeRef.current) return;
    try {
      const r = await fetch(`/api/rooms/${codeRef.current}`);
      if (!r.ok) {
        if (r.status === 404) {
          setRoom(null);
          setError("room_gone");
        }
        return;
      }
      const j = (await r.json()) as RoomSnapshot;
      setRoom(j);
    } catch { /* network */ }
  }, []);

  const startTimers = useCallback((roleHint: "host" | "guest") => {
    if (refreshRef.current) clearInterval(refreshRef.current);
    refreshRef.current = setInterval(() => { refresh(); }, REFRESH_INTERVAL_MS);
    if (roleHint === "host") {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = setInterval(() => {
        if (codeRef.current) {
          fetch(`/api/rooms/${codeRef.current}/heartbeat`, { method: "POST" }).catch(() => {});
        }
      }, HEARTBEAT_INTERVAL_MS);
    }
  }, [refresh]);

  const stopTimers = useCallback(() => {
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    if (refreshRef.current) { clearInterval(refreshRef.current); refreshRef.current = null; }
  }, []);

  const createRoom = useCallback(async (opts: { visibility: "public" | "private"; capacity: number }) => {
    if (!myUserId) { setError("not_signed_in"); return null; }
    setError(null);
    const r = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game, visibility: opts.visibility, capacity: opts.capacity, hostPeerId: myPeerId }),
    });
    if (!r.ok) { setError(await r.text()); return null; }
    const j = (await r.json()) as { code: string; role: "host" };
    codeRef.current = j.code;
    setRole("host");
    await refresh();
    startTimers("host");
    return j.code;
  }, [game, myPeerId, myUserId, refresh, startTimers]);

  const joinRoom = useCallback(async (code: string) => {
    if (!myUserId) { setError("not_signed_in"); return false; }
    setError(null);
    const r = await fetch(`/api/rooms/${code}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ peerId: myPeerId }),
    });
    if (!r.ok) { setError(await r.text()); return false; }
    codeRef.current = code;
    setRole("guest");
    await refresh();
    startTimers("guest");
    return true;
  }, [myPeerId, myUserId, refresh, startTimers]);

  /**
   * Attach to an existing room: GET state first, infer role from hostUserId.
   * - If already a host: adopt host role (start heartbeat).
   * - If already a guest: adopt guest role.
   * - If not yet a member: fall through to joinRoom (POST).
   *
   * Use this when a page lands on /play/<game>?room=<code> after navigating
   * from /rooms/<game> — the host has already created the room, so a blind
   * joinRoom() would mis-flag them as a guest.
   */
  const attachRoom = useCallback(async (code: string) => {
    if (!myUserId) { setError("not_signed_in"); return false; }
    setError(null);
    const r = await fetch(`/api/rooms/${code}`);
    if (!r.ok) {
      if (r.status === 404) { setError("Room not found"); return false; }
      setError(await r.text());
      return false;
    }
    const snap = (await r.json()) as RoomSnapshot;
    const isMember = snap.members.some((m) => m.userId === myUserId);
    if (!isMember) {
      // Not yet a member — go through the normal join path.
      return joinRoom(code);
    }
    codeRef.current = code;
    setRoom(snap);
    const amHost = snap.hostUserId === myUserId;
    setRole(amHost ? "host" : "guest");
    startTimers(amHost ? "host" : "guest");
    return true;
  }, [joinRoom, myUserId, startTimers]);

  const leaveRoom = useCallback(async () => {
    if (!codeRef.current) return;
    const code = codeRef.current;
    stopTimers();
    await fetch(`/api/rooms/${code}/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "voluntary", game }),
    }).catch(() => {});
    codeRef.current = null;
    setRoom(null);
    setRole(null);
  }, [game, stopTimers]);

  const acceptPromotion = useCallback(async (newPeerId: string) => {
    if (!codeRef.current || !room) return false;
    const r = await fetch(`/api/rooms/${codeRef.current}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newHostPeerId: newPeerId,
        expectedOldHostPeerId: room.hostPeerId,
        game,
      }),
    });
    if (!r.ok) return false;
    setRole("host");
    startTimers("host");
    await refresh();
    return true;
  }, [room, game, refresh, startTimers]);

  // Tab close / page refresh — fire the leave beacon. We attach to
  // `beforeunload` (NOT React unmount) so SPA navigations between
  // /rooms/<game> and /play/<game>?room=<code> don't tear the room down
  // mid-flight.
  useEffect(() => {
    const onUnload = () => {
      if (codeRef.current) {
        navigator.sendBeacon?.(
          `/api/rooms/${codeRef.current}/leave`,
          new Blob([JSON.stringify({ reason: "disconnect", game })], { type: "application/json" }),
        );
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      stopTimers();
    };
  }, [game, stopTimers]);

  return { room, role, isHost, error, createRoom, joinRoom, attachRoom, leaveRoom, refresh, acceptPromotion };
}
