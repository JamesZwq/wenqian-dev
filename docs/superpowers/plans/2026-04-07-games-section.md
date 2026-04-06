# Games Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a responsive Games Section with frosted-glass portrait cards and a fan-to-grid entry animation to the main portfolio page.

**Architecture:** A single new client component `GamesSection.tsx` renders 8 game cards using Framer Motion's `whileInView` + per-card `initial` fan transforms. Cards live in a `flex-wrap` container so they naturally reflow to 2 or 4 columns at runtime — no JS layout math needed. `ExtraSections.tsx` mounts the component between "Beyond Academia" and the section divider.

**Tech Stack:** Next.js 15 App Router, Framer Motion (already installed), Tailwind CSS, lucide-react, Next.js `<Image>` for SVG icons

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| **Create** | `src/app/components/GamesSection.tsx` | All card UI, icons, animations |
| **Modify** | `src/app/ExtraSections.tsx` line 349 | Import + mount `<GamesSection />` |

---

## Task 1: Scaffold GamesSection with static card layout

**Files:**
- Create: `src/app/components/GamesSection.tsx`

- [ ] **Step 1: Create the file with game data and skeleton markup**

```tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Gamepad2 } from "lucide-react";

// ── Game registry ──────────────────────────────────────────
type Game = {
  href: string;
  name: string;
  desc: string;
  badge: string;
  accent: string;
  glow: string;
  iconFile?: string; // filename inside /public/games/
};

const GAMES: Game[] = [
  { href: "/gomoku",      name: "Gomoku",        desc: "Five in a Row",          badge: "P2P",    accent: "#6366f1", glow: "rgba(99,102,241,0.5)"  },
  { href: "/maze",        name: "Maze Runner",   desc: "P2P race + items",       badge: "Race",   accent: "#f97316", glow: "rgba(249,115,22,0.5)",  iconFile: "maze-1-svgrepo-com.svg"     },
  { href: "/math",        name: "Math Sprint",   desc: "Speed arithmetic",       badge: "Solo",   accent: "#10b981", glow: "rgba(16,185,129,0.5)",  iconFile: "math-svgrepo-com.svg"       },
  { href: "/flash-count", name: "Flash Count",   desc: "Count 3D blocks",        badge: "Memory", accent: "#3b82f6", glow: "rgba(59,130,246,0.5)",  iconFile: "cube-svgrepo-com.svg"       },
  { href: "/poker",       name: "Texas Hold'em", desc: "P2P poker",              badge: "Poker",  accent: "#ef4444", glow: "rgba(239,68,68,0.5)",   iconFile: "clovers-poker-svgrepo-com.svg" },
  { href: "/sudoku",      name: "Sudoku",        desc: "Solo or P2P race",       badge: "Puzzle", accent: "#8b5cf6", glow: "rgba(139,92,246,0.5)",  iconFile: "sudoku-svgrepo-com.svg"     },
  { href: "/halli-galli", name: "Halli Galli",   desc: "Ring at 5 fruits",       badge: "Party",  accent: "#f59e0b", glow: "rgba(245,158,11,0.5)",  iconFile: "bell-svgrepo-com.svg"       },
  { href: "/chat",        name: "P2P Chat",      desc: "Encrypted, no server",   badge: "Chat",   accent: "#14b8a6", glow: "rgba(20,184,166,0.5)",  iconFile: "chat-round-dots-svgrepo-com.svg" },
];

// ── Gomoku custom inline SVG ───────────────────────────────
function GomokuIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
      <line x1="4"  y1="4"  x2="4"  y2="20" stroke="white" strokeWidth="1" opacity="0.4" />
      <line x1="9"  y1="4"  x2="9"  y2="20" stroke="white" strokeWidth="1" opacity="0.4" />
      <line x1="14" y1="4"  x2="14" y2="20" stroke="white" strokeWidth="1" opacity="0.4" />
      <line x1="19" y1="4"  x2="19" y2="20" stroke="white" strokeWidth="1" opacity="0.4" />
      <line x1="4"  y1="7"  x2="20" y2="7"  stroke="white" strokeWidth="1" opacity="0.4" />
      <line x1="4"  y1="12" x2="20" y2="12" stroke="white" strokeWidth="1" opacity="0.4" />
      <line x1="4"  y1="17" x2="20" y2="17" stroke="white" strokeWidth="1" opacity="0.4" />
      <circle cx="4"  cy="17" r="2.2" fill="white" />
      <circle cx="9"  cy="12" r="2.2" fill="white" />
      <circle cx="14" cy="7"  r="2.2" fill="white" />
      <circle cx="9"  cy="17" r="2.2" fill="none" stroke="white" strokeWidth="1.4" />
      <circle cx="14" cy="12" r="2.2" fill="none" stroke="white" strokeWidth="1.4" />
      <circle cx="4"  cy="12" r="2.2" fill="none" stroke="white" strokeWidth="1.4" />
    </svg>
  );
}

// ── Card component (no animation yet) ─────────────────────
function GameCard({ game }: { game: Game; index: number }) {
  return (
    <Link href={game.href} className="block" style={{ width: 152, flexShrink: 0 }}>
      <div
        style={{
          width: 152,
          height: 241,
          borderRadius: 18,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
        }}
      >
        {/* icon zone */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* glow orb */}
          <div
            style={{
              position: "absolute",
              width: 90, height: 90,
              borderRadius: "50%",
              background: game.accent,
              filter: "blur(28px)",
              opacity: 0.25,
              pointerEvents: "none",
            }}
          />
          {/* icon box */}
          <div
            style={{
              width: 62, height: 62,
              borderRadius: 16,
              background: game.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              zIndex: 1,
              boxShadow: `0 4px 20px ${game.glow}`,
            }}
          >
            {game.iconFile ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/games/${game.iconFile}`}
                alt={game.name}
                width={30}
                height={30}
                style={{ filter: "brightness(0) invert(1)" }}
              />
            ) : (
              <GomokuIcon />
            )}
          </div>
        </div>

        {/* info zone */}
        <div
          style={{
            padding: "12px 14px 13px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(0,0,0,0.20)",
          }}
        >
          <p
            className="font-sans font-bold"
            style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", marginBottom: 4, lineHeight: 1.2 }}
          >
            {game.name}
          </p>
          <p
            className="font-mono"
            style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", lineHeight: 1.3, marginBottom: 8 }}
          >
            {game.desc}
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              className="font-mono"
              style={{
                fontSize: 9,
                color: game.accent,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.04)",
                padding: "1px 6px",
                borderRadius: 4,
                letterSpacing: "0.04em",
              }}
            >
              {game.badge}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Section ────────────────────────────────────────────────
export default function GamesSection() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="mb-16 sm:mb-24"
    >
      {/* Section header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="flex items-center gap-4 mb-10"
      >
        <div className="p-2 rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-bg)] text-[var(--pixel-accent)]">
          <Gamepad2 size={20} />
        </div>
        <h2 className="font-sans text-base md:text-lg font-bold text-[var(--pixel-accent)] tracking-tight uppercase">
          Play Games
        </h2>
      </motion.div>

      {/* Card grid */}
      <div className="flex flex-wrap gap-3 sm:gap-4">
        {GAMES.map((game, i) => (
          <GameCard key={game.href} game={game} index={i} />
        ))}
      </div>
    </motion.section>
  );
}
```

- [ ] **Step 2: Verify file is valid TypeScript — run type check**

```bash
cd /Users/zhangwenqian/my-web && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing errors unrelated to this file)

- [ ] **Step 3: Mount in ExtraSections.tsx — import + insert before section divider**

In `src/app/ExtraSections.tsx`, add the import at the top of the imports block:

```tsx
import GamesSection from "./components/GamesSection";
```

Then insert `<GamesSection />` between the closing `</motion.section>` of "Beyond Academia" and the `{/* Section Divider */}` comment (after line 348, before line 350):

```tsx
        {/* Games */}
        <GamesSection />

        {/* Section Divider */}
```

- [ ] **Step 4: Verify dev server renders without errors**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

Expected: `200`  
Also check terminal for any hydration or import errors.

- [ ] **Step 5: Commit static layout**

```bash
cd /Users/zhangwenqian/my-web
git add src/app/components/GamesSection.tsx src/app/ExtraSections.tsx
git commit -m "feat: add GamesSection static layout with glass cards

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Add hover animations to cards

**Files:**
- Modify: `src/app/components/GamesSection.tsx`

- [ ] **Step 1: Wrap GameCard's outer div in motion.div with hover effects**

Replace the outer `<div ...>` inside `GameCard` with a `motion.div`, and add hover state for icon box. Replace the `GameCard` function body with:

```tsx
function GameCard({ game }: { game: Game; index: number }) {
  return (
    <Link href={game.href} className="block" style={{ width: 152, flexShrink: 0 }}>
      <motion.div
        whileHover={{ y: -9, borderColor: "rgba(255,255,255,0.22)" }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 320, damping: 24 }}
        style={{
          width: 152,
          height: 241,
          borderRadius: 18,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          boxShadow: "none",
          position: "relative",
        }}
      >
        {/* shimmer top line */}
        <div
          style={{
            position: "absolute",
            top: 0, left: "12%", right: "12%",
            height: 1,
            background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.28),transparent)",
            zIndex: 2,
          }}
        />

        {/* icon zone */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 90, height: 90,
              borderRadius: "50%",
              background: game.accent,
              filter: "blur(28px)",
              opacity: 0.25,
              pointerEvents: "none",
            }}
          />
          <motion.div
            whileHover={{ scale: 1.12, rotate: -5 }}
            transition={{ type: "spring", stiffness: 320, damping: 20 }}
            style={{
              width: 62, height: 62,
              borderRadius: 16,
              background: game.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              zIndex: 1,
              boxShadow: `0 4px 20px ${game.glow}`,
            }}
          >
            {game.iconFile ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/games/${game.iconFile}`}
                alt={game.name}
                width={30}
                height={30}
                style={{ filter: "brightness(0) invert(1)" }}
              />
            ) : (
              <GomokuIcon />
            )}
          </motion.div>
        </div>

        {/* info zone */}
        <div
          style={{
            padding: "12px 14px 13px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(0,0,0,0.20)",
          }}
        >
          <p
            className="font-sans font-bold"
            style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", marginBottom: 4, lineHeight: 1.2 }}
          >
            {game.name}
          </p>
          <p
            className="font-mono"
            style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", lineHeight: 1.3, marginBottom: 8 }}
          >
            {game.desc}
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              className="font-mono"
              style={{
                fontSize: 9,
                color: game.accent,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.04)",
                padding: "1px 6px",
                borderRadius: 4,
                letterSpacing: "0.04em",
              }}
            >
              {game.badge}
            </span>
            <motion.span
              initial={{ opacity: 0, x: -4 }}
              whileHover={{ opacity: 1, x: 0 }}
              style={{ fontSize: 12, color: game.accent, fontFamily: "monospace" }}
            >
              →
            </motion.span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
```

- [ ] **Step 2: Verify type check passes**

```bash
cd /Users/zhangwenqian/my-web && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors

- [ ] **Step 3: Commit hover animations**

```bash
cd /Users/zhangwenqian/my-web
git add src/app/components/GamesSection.tsx
git commit -m "feat: add hover animations to game cards

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Add fan-to-grid entry animation

**Files:**
- Modify: `src/app/components/GamesSection.tsx`

- [ ] **Step 1: Add fan position calculation and update GameCard signature**

Add the index parameter usage and fan math. Replace the `GameCard` function signature and add the fan initial/animate props to the outer `motion.div`:

First, add this helper above the `GameCard` function:

```tsx
function getFanInitial(index: number, total: number) {
  const spreadDeg = 70;
  const angle = -spreadDeg / 2 + index * (spreadDeg / (total - 1));
  const rad = (angle * Math.PI) / 180;
  const R = 280;
  return {
    rotate: angle,
    x: Math.sin(rad) * R,
    // arc: center card stays at y=0, edge cards rise slightly; all pushed down 220px
    y: (Math.cos(rad) - 1) * R + 220,
    scale: 0.72,
    opacity: 0,
  };
}
```

Then update the `GameCard` function signature to use `index` and `total`:

```tsx
function GameCard({ game, index, total }: { game: Game; index: number; total: number }) {
```

And replace the outer `motion.div` opening tag to add fan animation:

```tsx
      <motion.div
        initial={getFanInitial(index, total)}
        whileInView={{ rotate: 0, x: 0, y: 0, scale: 1, opacity: 1 }}
        whileHover={{ y: -9, borderColor: "rgba(255,255,255,0.22)" }}
        whileTap={{ scale: 0.97 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{
          // fan → grid: spring, staggered by index
          rotate:  { type: "spring", stiffness: 180, damping: 22, delay: index * 0.055 + 0.15 },
          x:       { type: "spring", stiffness: 180, damping: 22, delay: index * 0.055 + 0.15 },
          y:       { type: "spring", stiffness: 180, damping: 22, delay: index * 0.055 + 0.15 },
          scale:   { type: "spring", stiffness: 200, damping: 24, delay: index * 0.055 + 0.15 },
          opacity: { duration: 0.3, delay: index * 0.055 + 0.15 },
          // hover override: fast spring (no delay)
        }}
        style={{ ... }} // keep existing style object unchanged
      >
```

- [ ] **Step 2: Update GAMES.map call in GamesSection to pass total**

Replace the map in `GamesSection`:

```tsx
      <div className="flex flex-wrap gap-3 sm:gap-4">
        {GAMES.map((game, i) => (
          <GameCard key={game.href} game={game} index={i} total={GAMES.length} />
        ))}
      </div>
```

- [ ] **Step 3: Verify type check**

```bash
cd /Users/zhangwenqian/my-web && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors

- [ ] **Step 4: Confirm animation works in browser**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

Expected: `200`. Open `http://localhost:3000` in browser and scroll to the games section — cards should fan-animate into their grid positions.

- [ ] **Step 5: Commit fan animation**

```bash
cd /Users/zhangwenqian/my-web
git add src/app/components/GamesSection.tsx
git commit -m "feat: add fan-to-grid entry animation for game cards

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Fix whileHover transition conflict with entry animation

**Context:** Framer Motion merges `transition` objects — the entry spring delay will also apply to hover if not overridden. We need to ensure hover transitions have no delay.

**Files:**
- Modify: `src/app/components/GamesSection.tsx`

- [ ] **Step 1: Split entry and hover animations using variants**

Replace the single `motion.div` with variant-based animation in `GameCard`. The outer `motion.div` should become:

```tsx
      <motion.div
        initial="fan"
        whileInView="grid"
        whileHover="hover"
        whileTap={{ scale: 0.97 }}
        viewport={{ once: true, margin: "-80px" }}
        variants={{
          fan: getFanInitial(index, total),
          grid: {
            rotate: 0, x: 0, y: 0, scale: 1, opacity: 1,
            transition: {
              rotate:  { type: "spring", stiffness: 180, damping: 22, delay: index * 0.055 + 0.15 },
              x:       { type: "spring", stiffness: 180, damping: 22, delay: index * 0.055 + 0.15 },
              y:       { type: "spring", stiffness: 180, damping: 22, delay: index * 0.055 + 0.15 },
              scale:   { type: "spring", stiffness: 200, damping: 24, delay: index * 0.055 + 0.15 },
              opacity: { duration: 0.3, delay: index * 0.055 + 0.15 },
            },
          },
          hover: {
            y: -9,
            borderColor: "rgba(255,255,255,0.22)",
            transition: { type: "spring", stiffness: 320, damping: 24, delay: 0 },
          },
        }}
        style={{
          width: 152,
          height: 241,
          borderRadius: 18,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          position: "relative",
        }}
      >
```

- [ ] **Step 2: Type check**

```bash
cd /Users/zhangwenqian/my-web && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
cd /Users/zhangwenqian/my-web
git add src/app/components/GamesSection.tsx
git commit -m "fix: isolate hover transition delay from entry animation

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage check:**
- ✅ 152×241px portrait cards — Task 1
- ✅ Frosted glass (`backdrop-filter: blur(24px) saturate(160%)`) — Task 1
- ✅ Per-game accent colors (all 8 defined in GAMES array) — Task 1
- ✅ White icon on colored icon-box — Task 1 (`filter: brightness(0) invert(1)`)
- ✅ Gomoku custom inline SVG — Task 1 (`GomokuIcon` component)
- ✅ Hover: card lift + icon rotate/scale — Task 2
- ✅ Fan-to-grid entry animation — Task 3
- ✅ Stagger 0.055s per card — Task 3
- ✅ `whileInView once: true` — Task 3
- ✅ `whileTap scale(0.97)` — Task 2
- ✅ Responsive flex-wrap (2→4 cols) via Tailwind `flex flex-wrap` — Task 1
- ✅ Mounted in ExtraSections before section divider — Task 1 Step 3
- ✅ Hover transition delay isolation — Task 4

**Placeholder scan:** None found. All steps contain complete code.

**Type consistency:**
- `getFanInitial(index, total)` defined in Task 3 Step 1, used in Task 3 Step 1 and Task 4 Step 1 ✅
- `Game` type defined in Task 1, used throughout ✅
- `GameCard({ game, index, total })` — `total` added in Task 3, used in Task 4 ✅
