# Games Section Design

**Date:** 2026-04-07  
**Status:** Approved

---

## Overview

Add a Games Section to the main page (`ExtraSections.tsx`) that showcases all 8 playable apps via portrait cards with a fan-to-grid entry animation and per-game accent colors on a frosted-glass card surface.

---

## Visual Design

### Card

- **Size:** fixed 152×241 px (1:1.586 portrait ratio), `flex-shrink: 0`
- **Layout:** `flex-wrap: wrap` with gap; responsive column counts:
  - `< 640px` → 2 columns
  - `640–1023px` → 4 columns
  - `≥ 1024px` → 4 columns (max, can wrap to 2 rows)
- **Background:** `rgba(255,255,255,0.05)` + `backdrop-filter: blur(24px) saturate(160%)` — true frosted glass, shows page background through
- **Border:** `1px solid rgba(255,255,255,0.10)`, brightens on hover
- **Top shimmer:** 1px horizontal gradient line on the top edge (always visible)
- **Hover:** `translateY(-9px)` spring lift + colored glow box-shadow + stronger backdrop blur

### Icon zone (upper ~60% of card)

- Full-width, centered flex
- Background: subtle radial dot grid + a soft `blur(28px)` glow orb colored by the game's accent
- **Icon box:** 62×62 px rounded square, `background: var(--accent)`, white icon (`filter: brightness(0) invert(1)`) for all SVG files
- Hover: icon box `scale(1.12) rotate(-5deg)` spring

### Info zone (lower ~40%)

- `backdrop-filter: blur(4px)` + `rgba(0,0,0,0.20)` background
- `border-top: 1px solid rgba(255,255,255,0.06)`
- Game name (bold, white), short description (muted mono), badge + arrow row
- Arrow slides in on hover, colored by accent

### Per-game accent colors

| Game | Route | Accent | Glow |
|---|---|---|---|
| Gomoku | `/gomoku` | `#6366f1` indigo | rgba(99,102,241,0.5) |
| Maze Runner | `/maze` | `#f97316` orange | rgba(249,115,22,0.5) |
| Math Sprint | `/math` | `#10b981` emerald | rgba(16,185,129,0.5) |
| Flash Count | `/flash-count` | `#3b82f6` blue | rgba(59,130,246,0.5) |
| Texas Hold'em | `/poker` | `#ef4444` red | rgba(239,68,68,0.5) |
| Sudoku | `/sudoku` | `#8b5cf6` violet | rgba(139,92,246,0.5) |
| Halli Galli | `/halli-galli` | `#f59e0b` amber | rgba(245,158,11,0.5) |
| P2P Chat | `/chat` | `#14b8a6` teal | rgba(20,184,166,0.5) |

### Icons

- 7 games: `<img src="/games/<name>.svg">` from `/public/games/`
- Gomoku: custom inline SVG (grid lines + filled/outlined circles)
- All icons rendered white-on-accent via CSS filter

---

## Entry Animation — Fan to Grid

### Concept

On section scroll-into-view, cards animate from a fanned "hand of cards" position to their final grid positions.

### Mechanics (Framer Motion)

1. Each card's **natural position** in the flex grid is its final resting place (no transform).
2. Cards start with an `initial` prop that offsets them into a fan arc centered below/at the section:
   - `rotate: angle_i` — spread from -35° to +35° across 8 cards
   - `x: sin(angle_i) * R` — horizontal spread (R ≈ 280px)
   - `y: (cos(angle_i) - 1) * R` — upward arc (cards bow upward from bottom)
   - `scale: 0.85`, `opacity: 0`
3. `animate` state: `rotate:0, x:0, y:0, scale:1, opacity:1`
4. Triggered when section enters viewport (`useInView` with `once: true`)
5. **Stagger:** each card delays by `index * 0.055s + 0.2s` base
6. **Spring:** `stiffness: 180, damping: 22` — natural springy arc-to-slot feel

### Responsive grid positions

The grid is always CSS flex-wrap. The fan origin is always the horizontal center of the section. Cards fly to wherever the browser places them (2 or 4 columns). No JavaScript layout calculation needed — transforms do the work.

---

## Integration

**Location:** Add `<GamesSection />` in `ExtraSections.tsx` between the "Beyond Academia" section and the section divider (before Contact).

**New file:** `src/app/components/GamesSection.tsx`

- `"use client"` directive (uses framer-motion + useInView)
- Self-contained: exports default `GamesSection`
- Uses existing `SectionTitle`-style header (`Gamepad2` icon from lucide-react)
- Imports `motion` from `framer-motion`, `Link` from `next/link`, `useInView` from `framer-motion`

---

## Out of Scope

- No backend / analytics
- No "coming soon" states
- No drag-and-drop reordering
- Mobile touch swipe carousel (keep as wrap grid on mobile)
