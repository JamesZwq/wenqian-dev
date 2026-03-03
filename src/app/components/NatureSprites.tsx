"use client";

import React from "react";

type SpriteProps = {
  className?: string;
};

export function TreeTall({ className }: SpriteProps) {
  return (
    <svg viewBox="0 0 40 80" className={className}>
      <defs>
        <linearGradient id="treeTallLeaves" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#bbf7d0" />
          <stop offset="100%" stopColor="#4ade80" />
        </linearGradient>
      </defs>
      <rect x="17" y="42" width="6" height="20" fill="#78350f" rx="2" />
      <path
        d="M20 2 L6 34 L34 34 Z"
        fill="url(#treeTallLeaves)"
        stroke="#16a34a"
        strokeWidth="1"
      />
      <path
        d="M20 14 L10 40 L30 40 Z"
        fill="#4ade80"
        opacity={0.8}
      />
    </svg>
  );
}

export function TreeRound({ className }: SpriteProps) {
  return (
    <svg viewBox="0 0 40 60" className={className}>
      <defs>
        <radialGradient id="treeRoundLeaves" cx="50%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#bbf7d0" />
          <stop offset="100%" stopColor="#22c55e" />
        </radialGradient>
      </defs>
      <rect x="17" y="32" width="6" height="18" fill="#854d0e" rx="2" />
      <circle cx="20" cy="24" r="15" fill="url(#treeRoundLeaves)" />
      <circle cx="12" cy="22" r="8" fill="#4ade80" opacity={0.65} />
      <circle cx="27" cy="20" r="7" fill="#bbf7d0" opacity={0.8} />
    </svg>
  );
}

export function TreeBlossom({ className }: SpriteProps) {
  return (
    <svg viewBox="0 0 40 60" className={className}>
      <rect x="18" y="34" width="4" height="18" fill="#713f12" rx="2" />
      <circle cx="20" cy="22" r="13" fill="#fecaca" />
      <circle cx="12" cy="20" r="7" fill="#f9a8d4" />
      <circle cx="26" cy="18" r="6" fill="#fecaca" />
      <circle cx="18" cy="30" r="6" fill="#f97373" opacity={0.4} />
    </svg>
  );
}

export function BushRound({ className }: SpriteProps) {
  return (
    <svg viewBox="0 0 40 30" className={className}>
      <defs>
        <radialGradient id="bushRound" cx="50%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#bbf7d0" />
          <stop offset="100%" stopColor="#22c55e" />
        </radialGradient>
      </defs>
      <circle cx="10" cy="18" r="8" fill="url(#bushRound)" />
      <circle cx="20" cy="16" r="9" fill="#22c55e" />
      <circle cx="30" cy="18" r="7" fill="#4ade80" />
    </svg>
  );
}

export function BushTall({ className }: SpriteProps) {
  return (
    <svg viewBox="0 0 30 40" className={className}>
      <path
        d="M4 36 C4 22, 10 10, 15 10 C20 10, 26 22, 26 36 Z"
        fill="#16a34a"
      />
      <path
        d="M7 34 C7 23, 12 15, 16 14 C20 15, 23 23, 23 34 Z"
        fill="#4ade80"
      />
    </svg>
  );
}

export function GrassTuft({ className }: SpriteProps) {
  return (
    <svg viewBox="0 0 30 20" className={className}>
      <path
        d="M2 18 L8 6 L10 18 M8 18 L14 4 L16 18 M14 18 L22 5 L24 18"
        stroke="#16a34a"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function GrassWide({ className }: SpriteProps) {
  return (
    <svg viewBox="0 0 50 18" className={className}>
      <path
        d="M2 16 L6 4 L8 16 M8 16 L12 3 L14 16 M14 16 L20 5 L22 16 M22 16 L28 4 L30 16 M30 16 L36 3 L38 16 M38 16 L44 5 L46 16"
        stroke="#16a34a"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function FlowerClusterPink({ className }: SpriteProps) {
  return (
    <svg viewBox="0 0 30 24" className={className}>
      <circle cx="8" cy="14" r="3" fill="#fb7185" />
      <circle cx="12" cy="10" r="3" fill="#fecaca" />
      <circle cx="16" cy="15" r="3" fill="#fda4af" />
      <circle cx="20" cy="12" r="3" fill="#fb7185" />
      <rect x="9" y="16" width="2" height="6" fill="#16a34a" />
      <rect x="15" y="17" width="2" height="5" fill="#16a34a" />
      <rect x="19" y="16" width="2" height="6" fill="#16a34a" />
    </svg>
  );
}

export function FlowerClusterYellow({ className }: SpriteProps) {
  return (
    <svg viewBox="0 0 28 22" className={className}>
      <circle cx="6" cy="12" r="3" fill="#fde68a" />
      <circle cx="11" cy="9" r="3" fill="#facc15" />
      <circle cx="16" cy="13" r="3" fill="#fbbf24" />
      <circle cx="21" cy="10" r="3" fill="#fef08a" />
      <rect x="7" y="14" width="2" height="6" fill="#16a34a" />
      <rect x="13" y="15" width="2" height="5" fill="#16a34a" />
      <rect x="19" y="14" width="2" height="6" fill="#16a34a" />
    </svg>
  );
}

export function RockSmall({ className }: SpriteProps) {
  return (
    <svg viewBox="0 0 24 16" className={className}>
      <path
        d="M2 14 L6 4 L14 3 L20 10 L18 14 Z"
        fill="#cbd5f5"
        stroke="#94a3b8"
        strokeWidth="0.8"
      />
    </svg>
  );
}

export function RockFlat({ className }: SpriteProps) {
  return (
    <svg viewBox="0 0 30 14" className={className}>
      <path
        d="M2 12 L8 5 L18 4 L26 10 L24 12 Z"
        fill="#e2e8f0"
        stroke="#94a3b8"
        strokeWidth="0.7"
      />
    </svg>
  );
}

export function BirdFlying({ className }: SpriteProps) {
  return (
    <svg viewBox="0 0 24 16" className={className}>
      <path
        d="M2 10 C5 5, 9 5, 12 8 C15 5, 19 5, 22 10"
        fill="none"
        stroke="#0f172a"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Butterfly({ className }: SpriteProps) {
  return (
    <svg viewBox="0 0 20 16" className={className}>
      <circle cx="7" cy="8" r="4" fill="#f9a8d4" />
      <circle cx="13" cy="8" r="4" fill="#bfdbfe" />
      <rect x="9" y="6" width="2" height="6" fill="#4b5563" rx="1" />
    </svg>
  );
}

export function CloudSoft({ className }: SpriteProps) {
  return (
    <svg viewBox="0 0 40 20" className={className}>
      <circle cx="10" cy="12" r="6" fill="#ffffff" />
      <circle cx="18" cy="9" r="7" fill="#ffffff" />
      <circle cx="27" cy="11" r="6" fill="#ffffff" />
      <rect x="10" y="12" width="18" height="6" fill="#ffffff" />
    </svg>
  );
}

export function CloudLong({ className }: SpriteProps) {
  return (
    <svg viewBox="0 0 60 20" className={className}>
      <circle cx="12" cy="11" r="6" fill="#ffffff" />
      <circle cx="24" cy="9" r="7" fill="#ffffff" />
      <circle cx="38" cy="10" r="6" fill="#ffffff" />
      <rect x="12" y="11" width="30" height="6" fill="#ffffff" />
    </svg>
  );
}

