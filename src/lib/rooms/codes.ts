// Excludes visually ambiguous characters (0/O, 1/I/L) for readability.
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 30 chars
export const ROOM_CODE_LENGTH = 6;

export function generateRoomCode(): string {
  let out = "";
  const buf = new Uint32Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(buf);
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    out += ROOM_CODE_ALPHABET[buf[i] % ROOM_CODE_ALPHABET.length];
  }
  return out;
}
