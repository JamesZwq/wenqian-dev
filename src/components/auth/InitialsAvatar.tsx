"use client";

/**
 * Tiny stable hash → 0..2^32. Public-domain cyrb53 trimmed.
 * https://stackoverflow.com/a/52171480
 */
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

interface Props {
  /** Display name or username (any case). */
  name: string;
  /** Pixel size (renders square). */
  size?: number;
}

/**
 * Stateless deterministic avatar. Initials derived from `name`; background hue
 * derived from cyrb53(name) so the palette stays in the pixel-accent family
 * (controlled saturation + lightness). Zero network, zero R2 cost.
 */
export function InitialsAvatar({ name, size = 32 }: Props) {
  const safe = (name || "?").trim() || "?";
  const initials =
    safe
      .split(/\s+|[-_]/)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || safe[0]!.toUpperCase();

  const hue = cyrb53(safe.toLowerCase()) % 360;
  const bg = `hsl(${hue}, 65%, 55%)`;
  const fg = "#ffffff";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label={`Avatar for ${safe}`}
      style={{ borderRadius: "9999px", display: "block" }}
    >
      <rect width="32" height="32" fill={bg} rx="16" ry="16" />
      <text
        x="16"
        y="17"
        dominantBaseline="middle"
        textAnchor="middle"
        fill={fg}
        fontSize="13"
        fontWeight={700}
        fontFamily="Inter, system-ui, sans-serif"
        letterSpacing="0.02em"
      >
        {initials}
      </text>
    </svg>
  );
}
