"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { useRoom, type RoomMember } from "@/features/rooms/hooks/useRoom";
import { useStarPeerConnection } from "@/features/p2p/hooks/useStarPeerConnection";
import { submitMatchBulk } from "@/lib/leaderboards/submit";
import type { GridSize } from "@/app/schulte/types";
import { ROOM_GRID_SIZE, type SchulteRoomPacket, type RoomMemberInfo } from "./types";

const WRONG_PENALTY_MS = 1000;

type Status = "lobby" | "playing" | "complete" | "race_done";

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function useSchulteRoomGame(roomCode: string) {
  const { data: session } = useSession();
  const myUserId = session?.user?.id ?? null;

  // Stable peerId per mount.
  const myPeerId = useMemo(
    () => `wq-schulte-${roomCode}-${Math.random().toString(36).slice(2, 10)}`,
    [roomCode],
  );
  const room = useRoom({ game: "schulte", myPeerId });

  // Auto-attach on mount: GET the room and infer role from hostUserId.
  // If we're not yet a member, attachRoom falls through to joinRoom.
  const joinAttemptedRef = useRef(false);
  useEffect(() => {
    if (!myUserId || joinAttemptedRef.current) return;
    if (room.room) return;
    joinAttemptedRef.current = true;
    room.attachRoom(roomCode);
  }, [myUserId, room, roomCode]);

  const isHost = room.role === "host";
  const hostPeerId = room.room?.hostPeerId ?? null;

  // Game state
  const [status, setStatus] = useState<Status>("lobby");
  const [size, setSize] = useState<GridSize>(ROOM_GRID_SIZE);
  const [numbers, setNumbers] = useState<number[]>([]);
  const [currentTarget, setCurrentTarget] = useState(1);
  const [wrongClickIndex, setWrongClickIndex] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [penaltyMs, setPenaltyMs] = useState<number>(0);
  // userId → highest target reached (number-they-just-cleared + 1, i.e., next-to-click)
  const [progressByUser, setProgressByUser] = useState<Record<string, number>>({});
  // userId → completion ms (relative to startedAt)
  const [completionByUser, setCompletionByUser] = useState<Record<string, number>>({});
  const [results, setResults] = useState<{ userId: string; timeMs: number }[] | null>(null);

  const statusRef = useRef(status);
  const startedAtRef = useRef<number | null>(null);
  const penaltyRef = useRef(0);
  const completionRef = useRef(completionByUser);
  const numbersRef = useRef<number[]>([]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { startedAtRef.current = startedAt; }, [startedAt]);
  useEffect(() => { penaltyRef.current = penaltyMs; }, [penaltyMs]);
  useEffect(() => { completionRef.current = completionByUser; }, [completionByUser]);
  useEffect(() => { numbersRef.current = numbers; }, [numbers]);

  // Track expected member count for race-end detection (host only).
  const expectedNRef = useRef(0);
  useEffect(() => {
    if (room.room) expectedNRef.current = room.room.members.length;
  }, [room.room]);

  // ─── Star peer connection ───
  // Host: ready as soon as room is loaded. Guest: needs hostPeerId.
  const peerEnabled = !!room.room && (room.role === "host" || !!hostPeerId);

  const handleData = useCallback(
    (payload: SchulteRoomPacket, fromPeerId: string) => {
      if (!payload?.type) return;
      switch (payload.type) {
        case "puzzle_sync":
          // Guest receives the host's puzzle.
          setNumbers(payload.numbers);
          setSize(payload.size);
          setCurrentTarget(1);
          setWrongClickIndex(null);
          setPenaltyMs(0);
          setProgressByUser({});
          setCompletionByUser({});
          setResults(null);
          setStartedAt(payload.startedAt);
          setStatus("playing");
          break;
        case "progress":
          // Host receives a guest's progress; fan out as progress_relay.
          if (isHost) {
            setProgressByUser((p) => ({ ...p, [payload.userId]: payload.target }));
            const relay: SchulteRoomPacket = {
              type: "progress_relay",
              userId: payload.userId,
              target: payload.target,
              timestamp: payload.timestamp,
            };
            // sendTo handles all guests except the original sender (we'll iterate below).
            for (const m of room.room?.members ?? []) {
              if (m.peerId !== fromPeerId && m.peerId !== myPeerId) {
                sendToRef.current?.(m.peerId, relay);
              }
            }
          }
          break;
        case "progress_relay":
          // Guest receives another guest's progress (relayed by host).
          setProgressByUser((p) => ({ ...p, [payload.userId]: payload.target }));
          break;
        case "game_complete":
          // Host tracks completions; guests track for display.
          setCompletionByUser((c) => ({ ...c, [payload.userId]: payload.timeMs }));
          break;
        case "race_results":
          setResults(payload.positions);
          setStatus("race_done");
          // Cooperative report — every client submits.
          if (myUserId) {
            const positions = payload.positions.map((p) => p.userId);
            submitMatchBulk({
              matchId: payload.matchId,
              game: "schulte",
              positions,
              roomCode,
            });
          }
          break;
        case "members_sync":
          // Currently no-op (we use room.room.members from API). Reserved.
          break;
      }
    },
    // We rely on isHost / room.room through stale-tolerant refs; keeping deps minimal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isHost, myUserId, roomCode, myPeerId],
  );

  const peer = useStarPeerConnection<SchulteRoomPacket>({
    role: room.role === "host" ? "host" : "guest",
    hostPeerId,
    myPeerId,
    prefix: `wq-schulte-${roomCode}`,
    enabled: peerEnabled,
    onData: handleData,
  });

  // Capture sendTo in a ref so handleData can access it without re-deriving the callback.
  const sendToRef = useRef(peer.sendTo);
  useEffect(() => { sendToRef.current = peer.sendTo; }, [peer.sendTo]);

  // ─── Host-only: detect race end (every member has completed) ───
  useEffect(() => {
    if (!isHost) return;
    if (statusRef.current !== "playing" && statusRef.current !== "complete") return;
    const members = room.room?.members ?? [];
    if (members.length === 0) return;
    const allDone = members.every((m) => completionByUser[m.userId] !== undefined);
    if (!allDone) return;
    // Compute positions sorted by completion time ascending.
    const sorted = members
      .map((m) => ({ userId: m.userId, timeMs: completionByUser[m.userId] }))
      .sort((a, b) => a.timeMs - b.timeMs);
    const matchId = `${roomCode}:race-${Date.now()}`;
    const packet: SchulteRoomPacket = { type: "race_results", matchId, positions: sorted };
    peer.broadcast(packet);
    setResults(sorted);
    setStatus("race_done");
    if (myUserId) {
      submitMatchBulk({
        matchId,
        game: "schulte",
        positions: sorted.map((s) => s.userId),
        roomCode,
      });
    }
  }, [isHost, completionByUser, room.room, peer, roomCode, myUserId]);

  // ─── Actions ───

  const startRace = useCallback(() => {
    if (!isHost) return;
    const N = size * size;
    const nums = shuffle(Array.from({ length: N }, (_, i) => i + 1));
    const start = Date.now();
    const packet: SchulteRoomPacket = {
      type: "puzzle_sync",
      numbers: nums,
      size,
      startedAt: start,
    };
    peer.broadcast(packet);
    // Apply locally.
    setNumbers(nums);
    setCurrentTarget(1);
    setWrongClickIndex(null);
    setPenaltyMs(0);
    setProgressByUser({});
    setCompletionByUser({});
    setResults(null);
    setStartedAt(start);
    setStatus("playing");
  }, [isHost, peer, size]);

  const handleCellClick = useCallback(
    (index: number) => {
      if (statusRef.current !== "playing") return;
      const n = numbersRef.current[index];
      if (n === undefined) return;
      const target = currentTarget;
      if (n === target) {
        const next = target + 1;
        setCurrentTarget(next);
        // Send progress to host (as guest) or apply directly + relay-broadcast (as host).
        if (myUserId) {
          if (isHost) {
            // Host broadcasts its own progress to all guests as relay.
            setProgressByUser((p) => ({ ...p, [myUserId]: next }));
            const relay: SchulteRoomPacket = {
              type: "progress_relay",
              userId: myUserId,
              target: next,
              timestamp: Date.now(),
            };
            peer.broadcast(relay);
          } else {
            const pkt: SchulteRoomPacket = {
              type: "progress",
              userId: myUserId,
              target: next,
              timestamp: Date.now(),
            };
            peer.broadcast(pkt); // single channel to host
          }
        }

        // Check completion locally.
        if (next > numbersRef.current.length) {
          const now = Date.now();
          const timeMs = (now - (startedAtRef.current ?? now)) + penaltyRef.current;
          setElapsedMs(timeMs);
          setStatus("complete");
          if (myUserId) {
            setCompletionByUser((c) => ({ ...c, [myUserId]: timeMs }));
            const pkt: SchulteRoomPacket = {
              type: "game_complete",
              userId: myUserId,
              timeMs,
              timestamp: now,
            };
            peer.broadcast(pkt);
          }
        }
      } else {
        // Wrong click → flash + penalty.
        setWrongClickIndex(index);
        setPenaltyMs((p) => p + WRONG_PENALTY_MS);
        setTimeout(() => setWrongClickIndex(null), 500);
      }
    },
    [currentTarget, isHost, myUserId, peer],
  );

  // Update elapsedMs while playing (display only).
  useEffect(() => {
    if (status !== "playing") return;
    const id = setInterval(() => {
      const now = Date.now();
      setElapsedMs((now - (startedAtRef.current ?? now)) + penaltyRef.current);
    }, 100);
    return () => clearInterval(id);
  }, [status]);

  // Combined view: members + each member's progress %, finished flag, completion time.
  const memberView = useMemo(() => {
    const members: RoomMember[] = room.room?.members ?? [];
    const total = numbers.length || size * size;
    return members.map((m) => {
      const target = progressByUser[m.userId] ?? 1;
      const completed = completionByUser[m.userId] !== undefined;
      const completionMs = completionByUser[m.userId] ?? null;
      return {
        ...m,
        progressPct: completed ? 100 : Math.min(100, ((target - 1) / total) * 100),
        completed,
        completionMs,
      };
    });
  }, [room.room, progressByUser, completionByUser, numbers.length, size]);

  return {
    // Room
    room: room.room,
    role: room.role,
    isHost,
    error: room.error,
    leaveRoom: room.leaveRoom,

    // Game
    status,
    size,
    numbers,
    currentTarget,
    wrongClickIndex,
    elapsedMs,
    results,

    // Members + progress
    members: memberView,

    // Actions
    startRace,
    handleCellClick,

    // Raw values for UI
    myUserId,
  };
}
