"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth-client";
import type { GameId } from "@/db/schema/leaderboards";

// Stash a freshly-created room snap so /play/<game>?room=<code> can hydrate
// before its first KV-backed GET returns. Workers KV is eventually consistent
// (writes can take seconds to propagate even within the same edge POP), so a
// GET right after a POST may 404. Local-stash hydration sidesteps that for the
// host's create→play handoff.
const SNAP_PREFIX = "wq-room-snap:";
function stashSnap(code: string, snap: RoomSnapshot) {
  try {
    sessionStorage.setItem(SNAP_PREFIX + code, JSON.stringify(snap));
  } catch { /* private mode etc. */ }
}
function readSnap(code: string): RoomSnapshot | null {
  try {
    const raw = sessionStorage.getItem(SNAP_PREFIX + code);
    return raw ? (JSON.parse(raw) as RoomSnapshot) : null;
  } catch { return null; }
}
function clearSnap(code: string) {
  try { sessionStorage.removeItem(SNAP_PREFIX + code); } catch {}
}

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
    const displayUsername =
      ((session?.user as { displayUsername?: string | null } | undefined)?.displayUsername ?? null);
    const r = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game, visibility: opts.visibility, capacity: opts.capacity, hostPeerId: myPeerId }),
    });
    if (!r.ok) { setError(await r.text()); return null; }
    const j = (await r.json()) as { code: string; role: "host" };
    // Construct the snap locally so we don't depend on KV being globally consistent yet.
    const snap: RoomSnapshot = {
      code: j.code,
      game,
      visibility: opts.visibility,
      capacity: opts.capacity,
      hostUserId: myUserId,
      hostPeerId: myPeerId,
      members: [{ userId: myUserId, peerId: myPeerId, displayUsername, joinedAt: Date.now() }],
      promotionGen: 0,
    };
    codeRef.current = j.code;
    setRoom(snap);
    setRole("host");
    stashSnap(j.code, snap);
    startTimers("host");
    return j.code;
  }, [game, myPeerId, myUserId, session?.user, startTimers]);

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
   * Attach to an existing room: try sessionStorage handoff first (host's
   * create→play case), then GET with retry (handles KV propagation lag for
   * guests joining via lobby/code-share). Adopt role from hostUserId.
   * Falls through to joinRoom if we're not a member.
   */
  const attachRoom = useCallback(async (code: string) => {
    if (!myUserId) { setError("not_signed_in"); return false; }
    setError(null);

    // 1. Local snap stashed by createRoom — instant hydration.
    const stashed = readSnap(code);
    if (stashed && stashed.members.some((m) => m.userId === myUserId)) {
      codeRef.current = code;
      setRoom(stashed);
      const amHost = stashed.hostUserId === myUserId;
      setRole(amHost ? "host" : "guest");
      startTimers(amHost ? "host" : "guest");
      // Background refresh — best-effort, ignore failures here. The first
      // successful refresh poll will reconcile.
      void fetch(`/api/rooms/${code}`).then((r) => r.ok ? r.json() : null).then((j) => {
        if (j) setRoom(j as RoomSnapshot);
      }).catch(() => {});
      return true;
    }

    // 2. GET with retry — first attempt + 4 retries, ~6s budget total.
    const delays = [0, 300, 700, 1500, 3000];
    let snap: RoomSnapshot | null = null;
    let lastStatus = 0;
    for (const delay of delays) {
      if (delay > 0) await new Promise((res) => setTimeout(res, delay));
      const resp = await fetch(`/api/rooms/${code}`);
      lastStatus = resp.status;
      if (resp.ok) { snap = (await resp.json()) as RoomSnapshot; break; }
      if (resp.status !== 404) {
        setError(await resp.text());
        return false;
      }
    }
    if (!snap) {
      setError(lastStatus === 404 ? "Room not found" : `HTTP ${lastStatus}`);
      return false;
    }

    const isMember = snap.members.some((m) => m.userId === myUserId);
    if (!isMember) return joinRoom(code);

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
    clearSnap(code);
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
