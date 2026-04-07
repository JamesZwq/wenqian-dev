const rawTimeout = Number(process.env.NEXT_PUBLIC_P2P_CONNECT_TIMEOUT_MS);
const FALLBACK_TIMEOUT_MS = 5_000;

export const P2P_CONNECT_TIMEOUT_MS = Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : FALLBACK_TIMEOUT_MS;

const METERED_API_URL =
  "https://wenqian_dev.metered.live/api/v1/turn/credentials?apiKey=af07ddedc0afea4aa7a78d0e3753c46b81dd";

// Fallback ICE servers in case the Metered API is unreachable
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.relay.metered.ca:80" },
  { urls: "stun:stun.l.google.com:19302" },
];

/**
 * Fetch fresh TURN credentials from Metered.ca.
 * Returns fallback STUN-only servers if the fetch fails.
 */
export async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch(METERED_API_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Metered API ${res.status}`);
    const servers: RTCIceServer[] = await res.json();
    return servers;
  } catch {
    console.warn("[P2P] Failed to fetch TURN credentials, using STUN-only fallback");
    return FALLBACK_ICE_SERVERS;
  }
}

// Keep the old static export for backward compatibility during transition.
// New code should call fetchIceServers() instead.
export const ICE_SERVERS: RTCIceServer[] = FALLBACK_ICE_SERVERS;
