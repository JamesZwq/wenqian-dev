const rawTimeout = Number(process.env.NEXT_PUBLIC_P2P_CONNECT_TIMEOUT_MS);
const FALLBACK_TIMEOUT_MS = 5_000;

export const P2P_CONNECT_TIMEOUT_MS = Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : FALLBACK_TIMEOUT_MS;

// ICE servers for WebRTC — STUN for discovery, TURN for NAT traversal fallback
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  // Free open TURN relay (metered.ca open relay project)
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];
