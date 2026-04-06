"use client";

import { useEffect, useState } from "react";

/**
 * Reads `?join=CODE` or `?room=CODE` from the current URL on mount.
 * - `?join=CODE` is the share link format (auto-connect, then strip)
 * - `?room=CODE` is the persistent URL format (kept across refreshes)
 * Returns the code (or null). `?join` is cleaned from the URL after reading.
 */
export function useJoinParam(): string | null {
  const [peerId, setPeerId] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const join = url.searchParams.get("join");
    const room = url.searchParams.get("room");

    if (join) {
      setPeerId(join.trim().toUpperCase());
      // Convert ?join= to ?room= so refresh re-joins
      url.searchParams.delete("join");
      url.searchParams.set("room", join.trim().toUpperCase());
      window.history.replaceState({}, "", url.toString());
    } else if (room) {
      setPeerId(room.trim().toUpperCase());
      // Keep ?room= in the URL — don't strip it
    }
  }, []);

  return peerId;
}

/** Push or remove `?room=CODE` in the URL bar without navigation. */
export function setRoomInUrl(code: string | null) {
  const url = new URL(window.location.href);
  if (code) {
    url.searchParams.set("room", code);
  } else {
    url.searchParams.delete("room");
  }
  url.searchParams.delete("join");
  window.history.replaceState({}, "", url.toString());
}
