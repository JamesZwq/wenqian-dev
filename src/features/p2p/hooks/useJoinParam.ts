"use client";

import { useEffect, useState } from "react";

/**
 * Reads `?join=PEERID` from the current URL on mount.
 * Returns the peer ID (or null) and clears the param from the URL bar
 * so refreshing doesn't re-trigger auto-connect.
 */
export function useJoinParam(): string | null {
  const [peerId, setPeerId] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const join = url.searchParams.get("join");
    if (join) {
      setPeerId(join.trim().toUpperCase());
      // Clean the URL so a refresh doesn't re-trigger
      url.searchParams.delete("join");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  return peerId;
}
