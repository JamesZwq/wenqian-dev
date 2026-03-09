const rawTimeout = Number(process.env.NEXT_PUBLIC_P2P_CONNECT_TIMEOUT_MS);
const FALLBACK_TIMEOUT_MS = 5_000;

export const P2P_CONNECT_TIMEOUT_MS = Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : FALLBACK_TIMEOUT_MS;
