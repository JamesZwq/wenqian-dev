# Poker UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the poker game to Version D style (deep black + gradient title + strong glow) with D+ALL information layer (chip bar, blind progress, POT/BETS/TOTAL split, SPR, pot odds, action log, hand strength, win rate), per-event card/win animations, and bug fixes.

**Architecture:** All UI changes live in `src/app/poker/page.tsx` (new inline sub-components added at top). One new helper `getNextBlindLevel` added to `src/app/poker/utils.ts`. No other files touched. Game logic (`usePokerGame.ts`, `equity.ts`) is read-only.

**Tech Stack:** Next.js 15, React 19, Framer Motion, Tailwind CSS v4, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-06-poker-ui-redesign.md`

---

## File Map

| File | Changes |
|------|---------|
| `src/app/poker/utils.ts` | Add `getNextBlindLevel()` after existing `getBlindLevel` |
| `src/app/poker/page.tsx` | Replace nearly all UI code; add 9 new sub-components; fix 2 bugs; rewire `PokerTable` and `PokerPage` |

---

## Task 1: Bug Fixes

**Files:**
- Modify: `src/app/poker/page.tsx:480-530`

- [ ] **Fix 1 — Remove `pointermove` from equity overlay dismiss listener**

In `PokerTable`, find the `useEffect` that adds `pointerdown` + `pointermove` dismiss listeners (lines ~481-490). Remove the `pointermove` lines entirely:

```ts
// BEFORE (lines ~481-490):
useEffect(() => {
  if (!showEquity) return;
  const dismiss = () => setShowEquity(false);
  window.addEventListener("pointerdown", dismiss, { capture: true, once: true });
  window.addEventListener("pointermove", dismiss, { capture: true, once: true });  // ← remove this
  return () => {
    window.removeEventListener("pointerdown", dismiss, { capture: true });
    window.removeEventListener("pointermove", dismiss, { capture: true });          // ← remove this
  };
}, [showEquity]);

// AFTER:
useEffect(() => {
  if (!showEquity) return;
  const dismiss = () => setShowEquity(false);
  window.addEventListener("pointerdown", dismiss, { capture: true, once: true });
  return () => {
    window.removeEventListener("pointerdown", dismiss, { capture: true });
  };
}, [showEquity]);
```

- [ ] **Fix 2 — Convert `lastActionLabel` from useCallback to plain derived value**

Find `const lastActionLabel = useCallback(() => {` (line ~522). Replace with a plain variable (no hook):

```ts
// BEFORE:
const lastActionLabel = useCallback(() => {
  if (!view.lastAction) return null;
  const who = view.lastAction.isMe ? "You" : "Opponent";
  const a = view.lastAction.action.toUpperCase();
  const amt = view.lastAction.action === "raise" ? ` to $${view.lastAction.amount}` :
              view.lastAction.action === "call" ? ` $${view.lastAction.amount}` :
              view.lastAction.action === "allin" ? " ALL IN" : "";
  return `${who}: ${a}${amt}`;
}, [view.lastAction]);

// AFTER (place before the return statement, no hook):
const lastActionLabel = (() => {
  if (!view.lastAction) return null;
  const who = view.lastAction.isMe ? "You" : "Opp";
  const a = view.lastAction.action.toUpperCase();
  const amt = view.lastAction.action === "raise" ? ` to $${view.lastAction.amount}` :
              view.lastAction.action === "call" ? ` $${view.lastAction.amount}` :
              view.lastAction.action === "allin" ? " ALL IN" : "";
  return `${who}: ${a}${amt}`;
})();
```

- [ ] **Fix 3 — Increase `AnimatedNumber` duration multiplier for larger, more satisfying chip-swing feel (easeOutCubic curve is already correct)**

```ts
// In AnimatedNumber, change:
// BEFORE:
const dur = Math.min(Math.abs(diff) * 3, 600);
// AFTER:
const dur = Math.min(Math.abs(diff) * 5, 900);
```

This keeps the existing `easeOutCubic` curve (`1 - Math.pow(1 - t, 3)` — fast start, decelerating end) and just gives it more room to breathe on large changes like chip wins.

- [ ] **Verify: start dev server and open `/poker`, connect P2P, confirm no console errors**

```bash
npm run dev
```

- [ ] **Commit**

```bash
git add src/app/poker/page.tsx
git commit -m "fix: poker equity overlay touch dismiss + lastActionLabel IIFE"
```

---

## Task 2: Add `getNextBlindLevel` to utils.ts

**Files:**
- Modify: `src/app/poker/utils.ts` (after line 99, after `getBlindLevel`)

- [ ] **Add the function immediately after `getBlindLevel`:**

```ts
/** Returns the next SB amount and how many hands until it kicks in. */
export function getNextBlindLevel(handNumber: number): { nextSb: number; handsAway: number } {
  const currentLevel = Math.floor(Math.log2((handNumber + 4) / 5));
  const nextSb = Math.pow(2, currentLevel + 1);
  const nextHandNumber = Math.round(5 * Math.pow(2, currentLevel + 1) - 4);
  return { nextSb, handsAway: Math.max(0, nextHandNumber - handNumber) };
}
```

- [ ] **Verify correctness mentally:**
  - Hand 1: currentLevel=0, nextSb=2, nextHandNumber=6, handsAway=5 ✓
  - Hand 5: currentLevel=0, nextSb=2, nextHandNumber=6, handsAway=1 ✓
  - Hand 6: currentLevel=1, nextSb=4, nextHandNumber=16, handsAway=10 ✓

- [ ] **Add the export to the import in page.tsx** — find the import line:

```ts
// BEFORE:
import { rankStr, suitSymbol, suitColor, getActions, isInBestHand } from "./utils";

// AFTER:
import { rankStr, suitSymbol, suitColor, getActions, isInBestHand, getNextBlindLevel } from "./utils";
```

- [ ] **Commit**

```bash
git add src/app/poker/utils.ts src/app/poker/page.tsx
git commit -m "feat: add getNextBlindLevel utility"
```

---

## Task 3: Version D — Page Shell & Panel Styles

**Files:**
- Modify: `src/app/poker/page.tsx` — `PokerPage` return JSX and global wrapper styles

This task only touches the outer shell: page background, title, panel background color tokens. No new components yet.

- [ ] **In `PokerPage`, replace the outermost wrapper div className:**

```tsx
// BEFORE:
<div className="relative min-h-screen overflow-hidden">

// AFTER:
<div className="relative min-h-screen overflow-hidden" style={{ background: "rgba(4,3,12,0.97)" }}>
```

- [ ] **Replace the title `<h1>` and subtitle `<p>` in `PokerPage`:**

```tsx
// BEFORE:
<h1 className="mb-2 font-sans font-semibold text-2xl tracking-tight text-[var(--pixel-accent)] md:text-5xl">
  TEXAS HOLD&apos;EM
</h1>
<p className="font-mono text-xs text-[var(--pixel-muted)] md:text-sm">
  &gt; Heads-up No-Limit Poker{isConnected ? " | P2P Connected" : ""}
</p>

// AFTER:
<h1 className="mb-2 font-sans font-bold text-2xl tracking-tight md:text-5xl"
    style={{ background: "linear-gradient(135deg, #818cf8, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
  TEXAS HOLD&apos;EM
</h1>
<p className="font-mono text-xs text-[var(--pixel-muted)] md:text-sm">
  &gt; Heads-up No-Limit Poker{isConnected ? " | P2P Connected" : ""}
</p>
```

- [ ] **Define a CSS-in-JS token object at the top of the file (after imports, before any component) for Version D panel colors — used in all subsequent tasks:**

```ts
// Add after the last import line, before the AnimatedNumber component:
const D = {
  panelBg:   "rgba(8,6,20,0.85)",
  panelBorder: "rgba(139,92,246,0.22)",
  oppBg:     "rgba(6,4,16,0.8)",
  tableBg:   "rgba(4,3,12,0.9)",
  tableBorder: "rgba(129,140,248,0.2)",
  myTurnBorder: "rgba(129,140,248,0.6)",
  myTurnGlow:  "0 0 0 1px rgba(129,140,248,0.12), 0 0 22px rgba(129,140,248,0.1)",
} as const;
```

- [ ] **Verify page loads without errors, title has gradient:**

```bash
# with npm run dev still running, visit http://localhost:3000/poker
```

- [ ] **Commit**

```bash
git add src/app/poker/page.tsx
git commit -m "feat: poker Version D page shell and color tokens"
```

---

## Task 4: `PotDisplay` + `PotOdds` Components

**Files:**
- Modify: `src/app/poker/page.tsx` — add two components before `PokerTable`

- [ ] **Add `PotDisplay` component** (insert before the `PokerTable` function definition):

```tsx
function PotDisplay({ pot, myBet, opponentBet }: { pot: number; myBet: number; opponentBet: number }) {
  const bets = myBet + opponentBet;
  const total = pot + bets;
  return (
    <div className="flex items-center gap-3">
      <div className="text-center">
        <div className="font-mono text-[7px] tracking-widest text-[var(--pixel-muted)] mb-0.5">POT</div>
        <AnimatedNumber value={pot} className="font-mono text-base font-bold text-[var(--pixel-warn)]" />
      </div>
      <div className="w-px h-5 bg-white/8" />
      <div className="text-center">
        <div className="font-mono text-[7px] tracking-widest text-[var(--pixel-muted)] mb-0.5">BETS</div>
        <AnimatedNumber value={bets} className="font-mono text-sm font-bold text-[var(--pixel-accent-2)]" prefix="+" />
      </div>
      <div className="w-px h-5 bg-white/8" />
      <div className="text-center">
        <div className="font-mono text-[7px] tracking-widest text-[var(--pixel-muted)] mb-0.5">TOTAL</div>
        <AnimatedNumber value={total} className="font-mono text-sm font-bold text-[var(--pixel-warn)]" />
      </div>
    </div>
  );
}
```

- [ ] **Update `AnimatedNumber` to accept an optional `prefix` prop and render it before the number:**

```tsx
// BEFORE:
function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  // ...
  return <span className={className}>${display}</span>;
}

// AFTER:
function AnimatedNumber({ value, className, prefix = "$" }: { value: number; className?: string; prefix?: string }) {
  // ... (keep body identical)
  return <span className={className}>{prefix}{display}</span>;
}
```

- [ ] **Add `PotOdds` component** (insert after `PotDisplay`):

```tsx
function PotOdds({ toCall, total, equityPct }: { toCall: number; total: number; equityPct: number | null }) {
  if (toCall <= 0) return null;
  const oddsPct = Math.round((toCall / (total + toCall)) * 100);
  const isGood = equityPct !== null && equityPct > oddsPct;
  return (
    <div className={`font-mono text-[8px] font-bold px-2 py-0.5 rounded-md border ${
      isGood
        ? "text-[#4ade80] bg-[rgba(74,222,128,0.07)] border-[rgba(74,222,128,0.25)]"
        : "text-[var(--pixel-muted)] bg-white/3 border-white/8"
    }`}>
      {oddsPct}% pot odds{isGood ? " · Good odds" : " · Poor odds"}
    </div>
  );
}
```

- [ ] **Verify TypeScript compiles with no errors:**

```bash
npx tsc --noEmit
```

- [ ] **Commit**

```bash
git add src/app/poker/page.tsx
git commit -m "feat: PotDisplay (POT/BETS/TOTAL) and PotOdds components"
```

---

## Task 5: `ChipBar` + `BlindProgress` Components

**Files:**
- Modify: `src/app/poker/page.tsx` — add two components before `PokerTable`

- [ ] **Add `ChipBar` component:**

```tsx
function ChipBar({ myChips, opponentChips }: { myChips: number; opponentChips: number }) {
  const total = myChips + opponentChips;
  if (total === 0) return null;
  const mePct = Math.round((myChips / total) * 100);
  const oppPct = 100 - mePct;
  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex items-center justify-between font-mono text-[8px]">
        <span className="text-[var(--pixel-accent-2)]">OPP {oppPct}%</span>
        <span className="text-[var(--pixel-accent)]">YOU {mePct}%</span>
      </div>
      <div className="w-full h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${mePct}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{
            marginLeft: "auto",
            background: "linear-gradient(90deg, rgba(129,140,248,0.5), #818cf8)",
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Add `BlindProgress` component:**

```tsx
function BlindProgress({ handNumber, smallBlind }: { handNumber: number; smallBlind: number }) {
  const { nextSb, handsAway } = getNextBlindLevel(handNumber);
  // progress within current level: 0→1
  const currentLevel = Math.floor(Math.log2((handNumber + 4) / 5));
  const levelStart = Math.round(5 * Math.pow(2, currentLevel) - 4);
  const levelEnd   = Math.round(5 * Math.pow(2, currentLevel + 1) - 4);
  const progress = (handNumber - levelStart) / Math.max(1, levelEnd - levelStart);

  return (
    <div className="flex items-center gap-2 w-full font-mono text-[8px] text-[var(--pixel-muted)]"
         style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 7, padding: "4px 10px", background: "rgba(4,3,12,0.5)" }}>
      <span>Blinds <span className="text-[var(--pixel-warn)] font-bold">{smallBlind}/{smallBlind * 2}</span></span>
      <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${Math.min(progress * 100, 100)}%` }}
          transition={{ duration: 0.5 }}
          style={{ background: "linear-gradient(90deg, rgba(251,191,36,0.4), #fbbf24)" }}
        />
      </div>
      {handsAway > 0
        ? <span>{handsAway} hand{handsAway !== 1 ? "s" : ""} → <span className="text-[var(--pixel-warn)] font-bold">{nextSb}/{nextSb * 2}</span></span>
        : <span className="text-[var(--pixel-warn)] font-bold">↑ next hand</span>
      }
    </div>
  );
}
```

- [ ] **Verify TypeScript compiles:**

```bash
npx tsc --noEmit
```

- [ ] **Commit**

```bash
git add src/app/poker/page.tsx
git commit -m "feat: ChipBar and BlindProgress components"
```

---

## Task 6: `ActionLog` Component + State

**Files:**
- Modify: `src/app/poker/page.tsx`

The action log accumulates `view.lastAction` entries across renders. It lives as a `useRef` inside `PokerTable` (not state, to avoid extra renders) plus a `useState` for display.

- [ ] **Define `LogEntry` type** — add near the top of the file, after the `D` token object:

```ts
type LogEntry = { who: "YOU" | "OPP"; action: string; amount: number; phase: string };
```

- [ ] **Add `ActionLog` component:**

```tsx
function ActionLog({ entries, isMyTurn }: { entries: LogEntry[]; isMyTurn: boolean }) {
  if (entries.length === 0) return null;
  const visible = entries.slice(-5); // last 5
  return (
    <div className="w-full rounded-lg border flex flex-col gap-[3px] px-2 py-1.5"
         style={{ background: "rgba(4,3,12,0.6)", borderColor: "rgba(255,255,255,0.06)" }}>
      {visible.map((e, i) => (
        <div key={i} className="flex items-center gap-1.5 font-mono text-[8px] text-[var(--pixel-muted)]">
          <span className={`font-bold w-6 ${e.who === "YOU" ? "text-[var(--pixel-accent)]" : "text-[var(--pixel-accent-2)]"}`}>
            {e.who}
          </span>
          <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: "rgba(139,92,246,0.4)" }} />
          <span className="text-[var(--pixel-text)]">{e.action.toUpperCase()}</span>
          {e.amount > 0 && (
            <span className="ml-auto text-[var(--pixel-warn)]">${e.amount}</span>
          )}
        </div>
      ))}
      {isMyTurn && (
        <div className="flex items-center gap-1.5 font-mono text-[8px]">
          <span className="font-bold w-6 text-[var(--pixel-accent)]">YOU</span>
          <motion.div
            className="w-1 h-1 rounded-full flex-shrink-0 bg-[var(--pixel-accent)]"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
          <span className="text-[var(--pixel-accent)]">to act…</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Add action log accumulation inside `PokerTable`** — add these before the `return` statement:

```tsx
// Action log accumulation — inside PokerTable, after existing state declarations
const [actionLog, setActionLog] = useState<LogEntry[]>([]);
const prevLastAction = useRef<typeof view.lastAction>(undefined);
const prevHandNumber = useRef(view.handNumber);

useEffect(() => {
  // Reset on new hand
  if (view.handNumber !== prevHandNumber.current) {
    prevHandNumber.current = view.handNumber;
    setActionLog([]);
    prevLastAction.current = undefined;
    return;
  }
  // Append new action
  if (
    view.lastAction &&
    view.lastAction !== prevLastAction.current &&
    (prevLastAction.current === undefined ||
      view.lastAction.action !== prevLastAction.current.action ||
      view.lastAction.amount !== prevLastAction.current.amount ||
      view.lastAction.isMe !== prevLastAction.current.isMe)
  ) {
    prevLastAction.current = view.lastAction;
    setActionLog(prev => [...prev, {
      who: view.lastAction!.isMe ? "YOU" : "OPP",
      action: view.lastAction!.action,
      amount: view.lastAction!.amount,
      phase: view.phase,
    }]);
  }
}, [view.lastAction, view.handNumber, view.phase]);
```

- [ ] **Verify TypeScript compiles:**

```bash
npx tsc --noEmit
```

- [ ] **Commit**

```bash
git add src/app/poker/page.tsx
git commit -m "feat: ActionLog component with per-hand accumulation"
```

---

## Task 7: `HandStrengthBadge` + `WinRateBar` Components

**Files:**
- Modify: `src/app/poker/page.tsx`

- [ ] **Add `HandStrengthBadge` component:**

```tsx
function HandStrengthBadge({ myCards, community }: { myCards: import("./types").Card[]; community: import("./types").Card[] }) {
  if (myCards.length < 2 || community.length < 3) return null;
  const { name } = evaluateHand(myCards, community);
  return (
    <div className="inline-flex items-center font-mono text-[8px] font-bold px-1.5 py-0.5 rounded-md"
         style={{ color: "var(--pixel-accent-2)", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}>
      {name.toUpperCase()}
    </div>
  );
}
```

- [ ] **Add `evaluateHand` to the import from utils** — find the utils import line and add it:

```ts
// BEFORE:
import { rankStr, suitSymbol, suitColor, getActions, isInBestHand, getNextBlindLevel } from "./utils";

// AFTER:
import { rankStr, suitSymbol, suitColor, getActions, isInBestHand, getNextBlindLevel, evaluateHand } from "./utils";
```

- [ ] **Add `WinRateBar` component:**

```tsx
function WinRateBar({ myCards, community, equityPct }: {
  myCards: import("./types").Card[];
  community: import("./types").Card[];
  equityPct: number | null;
}) {
  if (myCards.length < 2) return null;
  return (
    <div className="flex items-center gap-1.5 w-full mt-1.5">
      <span className="font-mono text-[7px] tracking-widest text-[var(--pixel-muted)] w-6">WIN</span>
      <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: "rgba(239,68,68,0.2)" }}>
        <motion.div
          className="h-full rounded-full"
          animate={{ width: equityPct !== null ? `${Math.min(equityPct, 100)}%` : "0%" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{ background: "linear-gradient(90deg, #4ade80, rgba(74,222,128,0.6))" }}
        />
      </div>
      <span className="font-mono text-[8px] font-bold w-8 text-right"
            style={{ color: equityPct !== null ? "#4ade80" : "var(--pixel-muted)" }}>
        {equityPct !== null ? `${equityPct.toFixed(0)}%` : "…"}
      </span>
    </div>
  );
}
```

- [ ] **Add equity computation state inside `PokerTable`** (after existing state declarations):

```tsx
const [equityPct, setEquityPct] = useState<number | null>(null);
const equityKey = useRef("");

useEffect(() => {
  if (view.myCards.length < 2 || view.phase === "showdown" || view.phase === "waiting") {
    setEquityPct(null);
    return;
  }
  const key = view.myCards.map(c => `${c.rank}${c.suit}`).join(",") + "|" + view.community.map(c => `${c.rank}${c.suit}`).join(",");
  if (equityKey.current === key) return;
  equityKey.current = key;
  const raf = requestAnimationFrame(() => {
    const r = calcEquity(view.myCards, view.community);
    setEquityPct(Math.round(r.winPct));
  });
  return () => cancelAnimationFrame(raf);
}, [view.phase, view.myCards, view.community]);
```

- [ ] **Verify TypeScript compiles:**

```bash
npx tsc --noEmit
```

- [ ] **Commit**

```bash
git add src/app/poker/page.tsx src/app/poker/utils.ts
git commit -m "feat: HandStrengthBadge and WinRateBar with always-on equity"
```

---

## Task 8: Wire All Components into `PokerTable` + `PokerPage`

**Files:**
- Modify: `src/app/poker/page.tsx` — `PokerTable` return JSX and `PokerPage` game view section

This is the main integration task. Replace the entire `PokerTable` return JSX with the Version D layout.

- [ ] **Replace the entire `return (...)` block inside `PokerTable` with the Version D layout:**

```tsx
return (
  <div className="w-full max-w-md mx-auto flex flex-col gap-3 relative">
    {/* Equity overlay (keep existing) */}
    <AnimatePresence>
      {showEquity && canShowEquity && <EquityOverlay result={equityResult} loading={equityLoading} />}
    </AnimatePresence>

    {/* Confetti on win */}
    <Confetti active={didWin} />

    {/* All-in flash (keep existing) */}
    <AnimatePresence>
      {allInFlash && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[60]"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.4, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, times: [0, 0.15, 1] }}
          style={{ background: "radial-gradient(circle, rgba(250,204,21,0.4), transparent 70%)" }}
        />
      )}
    </AnimatePresence>

    {/* Header: hand # / phase / equity btn */}
    <div className="flex items-center justify-between">
      <span className="font-mono text-[9px] text-[var(--pixel-muted)]">
        Hand #{view.handNumber} · Blinds {view.smallBlind}/{view.bigBlind}
      </span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[8px] tracking-widest text-[var(--pixel-muted)] px-2 py-0.5 rounded-md"
              style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}>
          {phaseName}
        </span>
        {canShowEquity && (
          <button
            onMouseDown={() => setShowEquity(true)} onMouseUp={() => setShowEquity(false)}
            onMouseLeave={() => setShowEquity(false)}
            onTouchStart={() => setShowEquity(true)} onTouchEnd={() => setShowEquity(false)}
            className="w-5 h-5 rounded-full flex items-center justify-center font-mono text-[9px] font-bold text-[var(--pixel-muted)] hover:text-[var(--pixel-accent)] transition-colors"
            style={{ border: "1px solid var(--pixel-border)", background: D.tableBg }}
          >?</button>
        )}
      </div>
    </div>

    {/* Opponent panel */}
    <div className="rounded-xl p-3" style={{ background: D.oppBg, border: `1px solid rgba(255,255,255,0.07)` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <DealerChip show={!view.amDealer} />
          <span className="font-sans font-semibold text-[10px] tracking-widest"
                style={{ color: "rgba(232,229,245,0.65)" }}>OPPONENT</span>
          {view.opponentFolded && <span className="font-mono text-[8px] text-red-400">FOLDED</span>}
          {view.opponentAllIn && <span className="font-mono text-[8px] text-[var(--pixel-warn)]">ALL IN</span>}
          {view.opponentBet > 0 && (
            <span className="font-mono text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ color: "var(--pixel-accent-2)", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)" }}>
              bet ${view.opponentBet}
            </span>
          )}
        </div>
        <AnimatedNumber value={view.opponentChips} className="font-mono text-xs font-bold text-[var(--pixel-accent)]" />
      </div>
      <div className="flex gap-1.5">
        {view.opponentCards ? (
          view.opponentCards.map((c, i) => {
            const hl = showBestCards && view.result!.iWon !== true && isInBestHand(c, view.result!.opponentBestCards);
            const dim = showBestCards && !isInBestHand(c, view.result!.opponentBestCards) && view.result!.iWon !== null;
            return <CardView key={i} card={c} small highlight={hl} dimmed={dim} delay={i * 0.12} />;
          })
        ) : (
          <><CardView faceDown small dimmed={isFoldWin && view.opponentFolded} /><CardView faceDown small dimmed={isFoldWin && view.opponentFolded} /></>
        )}
      </div>
      {isShowdown && view.result && !view.opponentFolded && (
        <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
          className="mt-1.5 font-mono text-[9px] text-[var(--pixel-muted)]">
          {view.result.opponentHandDesc}
        </motion.div>
      )}
    </div>

    {/* Table center */}
    <div className="relative rounded-xl flex flex-col items-center gap-2.5 p-3 overflow-hidden"
         style={{ background: D.tableBg, border: `1px solid ${D.tableBorder}` }}>
      {/* Top glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-44 h-12"
           style={{ background: "radial-gradient(ellipse, rgba(129,140,248,0.1), transparent)", filter: "blur(10px)" }} />
      <PhaseFlash phase={view.phase} handNumber={view.handNumber} />

      {/* Community cards */}
      <div className="flex gap-2 min-h-[74px] items-center justify-center relative">
        {view.community.length === 0 ? (
          <span className="font-mono text-[9px] text-[var(--pixel-muted)]">Waiting for community cards…</span>
        ) : (
          view.community.map((c, i) => {
            const hl = showBestCards && isInBestHand(c, winnerBest);
            const dim = showBestCards && !isInBestHand(c, winnerBest);
            // Fresh card: turn=index 3, river=index 4
            const isFresh = (view.phase === "turn" && i === 3) || (view.phase === "river" && i === 4);
            return <CardView key={i} card={c} highlight={hl} dimmed={dim} delay={i * 0.08} fresh={isFresh} />;
          })
        )}
      </div>

      {/* Pot display */}
      <PotDisplay pot={view.pot} myBet={view.myBet} opponentBet={view.opponentBet} />

      {/* Pot odds (my turn + facing a bet) */}
      {view.isMyTurn && !isShowdown && (
        <PotOdds
          toCall={Math.max(0, view.opponentBet - view.myBet)}
          total={view.pot + view.myBet + view.opponentBet}
          equityPct={equityPct}
        />
      )}

      {/* Action log */}
      <ActionLog entries={actionLog} isMyTurn={view.isMyTurn && !isShowdown} />
    </div>

    {/* Showdown result banner */}
    {isShowdown && view.result && (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.92 }}
        animate={didLose
          ? { opacity: 1, y: 0, scale: 1, x: [0, -6, 6, -4, 4, -2, 2, 0] }
          : { opacity: 1, y: 0, scale: 1 }}
        transition={didLose
          ? { opacity: { type: "spring", stiffness: 300, damping: 24 }, y: { type: "spring", stiffness: 300, damping: 24 }, scale: { type: "spring", stiffness: 300, damping: 24 }, x: { duration: 0.5, delay: 0.2 } }
          : { type: "spring", stiffness: 300, damping: 24 }}
        className="rounded-xl border p-4 text-center overflow-hidden relative"
        style={{
          background: view.result.iWon === true ? "rgba(34,197,94,0.07)" : view.result.iWon === false ? "rgba(239,68,68,0.08)" : "rgba(251,191,36,0.08)",
          borderColor: view.result.iWon === true ? "rgba(34,197,94,0.45)" : view.result.iWon === false ? "rgba(239,68,68,0.45)" : "rgba(251,191,36,0.45)",
        }}
      >
        {view.result.iWon === true && (
          <motion.div className="absolute inset-0"
            style={{ background: "linear-gradient(90deg,transparent,rgba(34,197,94,0.06),transparent)" }}
            initial={{ x: "-100%" }} animate={{ x: "200%" }}
            transition={{ duration: 1.6, delay: 0.3, repeat: Infinity, repeatDelay: 2 }}
          />
        )}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.15 }}
          className="font-sans font-bold text-xl relative"
          style={{ color: view.result.iWon === true ? "#4ade80" : view.result.iWon === false ? "#f87171" : "#fbbf24" }}
        >
          {view.result.iWon === true ? "YOU WIN!" : view.result.iWon === false ? "YOU LOSE" : "SPLIT POT"}
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
          className="font-mono text-[10px] text-[var(--pixel-muted)] mt-1.5 relative">
          {view.result.winnerHand === "Fold" ? "Opponent folded" : (
            <span>
              {view.result.iWon === true ? "Your hand: " : view.result.iWon === false ? "Opponent's hand: " : "Both hands: "}
              <span style={{ color: view.result.iWon === true ? "#4ade80" : view.result.iWon === false ? "#f87171" : "#fbbf24", fontWeight: 600 }}>
                {view.result.winnerHand}
              </span>
            </span>
          )}
        </motion.div>
        {!isFoldWin && view.result.myHandDesc && view.result.opponentHandDesc && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ delay: 0.55 }}
            className="mt-1.5 flex justify-center gap-3 font-mono text-[9px] relative">
            <span style={{ color: view.result.iWon === true ? "#4ade80" : "var(--pixel-muted)" }}>You: {view.result.myHandDesc}</span>
            <span className="text-[var(--pixel-muted)]">vs</span>
            <span style={{ color: view.result.iWon === false ? "#f87171" : "var(--pixel-muted)" }}>Opp: {view.result.opponentHandDesc}</span>
          </motion.div>
        )}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="mt-3 relative">
          {isGameOver ? (
            <div className="space-y-2">
              <div className="font-sans font-bold text-sm" style={{ color: view.result.iWon === true ? "#4ade80" : "#f87171" }}>
                {view.result.iWon === true ? "OPPONENT BUSTED!" : "YOU BUSTED!"}
              </div>
              <button onClick={onRematch}
                className="rounded-xl px-6 py-2.5 font-sans font-semibold text-[11px] transition-transform hover:scale-[1.02]"
                style={{ border: "1px solid var(--pixel-accent)", background: "var(--pixel-accent)", color: "var(--pixel-bg)" }}>
                REMATCH (500 each)
              </button>
            </div>
          ) : (
            <button onClick={onNextHand}
              className="rounded-xl px-6 py-2.5 font-sans font-semibold text-[11px] transition-transform hover:scale-[1.02]"
              style={{ border: "1px solid var(--pixel-accent)", background: "var(--pixel-accent)", color: "var(--pixel-bg)" }}>
              NEXT HAND
            </button>
          )}
        </motion.div>
      </motion.div>
    )}

    {/* My panel */}
    <div className="rounded-xl p-3 relative"
         style={{
           background: D.panelBg,
           border: `1px solid ${view.isMyTurn && !isShowdown ? D.myTurnBorder : D.panelBorder}`,
           boxShadow: view.isMyTurn && !isShowdown ? D.myTurnGlow : undefined,
         }}>
      {/* Turn pulse bar */}
      {view.isMyTurn && !isShowdown && (
        <motion.div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl"
          style={{ background: "linear-gradient(90deg, transparent, var(--pixel-accent), transparent)" }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
      )}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <DealerChip show={view.amDealer} />
          <span className="font-sans font-semibold text-[10px] tracking-widest text-[var(--pixel-accent)]">YOU</span>
          {view.isMyTurn && !isShowdown && (
            <span className="font-mono text-[8px] font-bold px-1.5 py-0.5 rounded"
                  style={{ color: "var(--pixel-accent)", background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.25)" }}>
              YOUR TURN
            </span>
          )}
          {view.myFolded && <span className="font-mono text-[8px] text-red-400">FOLDED</span>}
          {view.myAllIn && <span className="font-mono text-[8px] text-[var(--pixel-warn)]">ALL IN</span>}
          {view.myBet > 0 && (
            <span className="font-mono text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ color: "var(--pixel-accent-2)", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)" }}>
              bet ${view.myBet}
            </span>
          )}
        </div>
        <AnimatedNumber value={view.myChips} className="font-mono text-xs font-bold text-[var(--pixel-accent)]" />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5">
          {view.myCards.map((c, i) => {
            const hl = showBestCards && view.result!.iWon !== false && isInBestHand(c, view.result!.myBestCards);
            const dim = showBestCards && !isInBestHand(c, view.result!.myBestCards) && view.result!.iWon !== null;
            return <CardView key={i} card={c} small highlight={hl} dimmed={dim} delay={i * 0.12} />;
          })}
        </div>
        {!isShowdown && view.myCards.length >= 2 && view.community.length >= 3 && (
          <HandStrengthBadge myCards={view.myCards} community={view.community} />
        )}
      </div>
      {isShowdown && view.result && !view.myFolded && (
        <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
          className="mt-1.5 font-mono text-[9px] text-[var(--pixel-accent)]">
          {view.result.myHandDesc}
        </motion.div>
      )}
      {/* Win rate bar */}
      {!isShowdown && (
        <WinRateBar myCards={view.myCards} community={view.community} equityPct={equityPct} />
      )}
    </div>

    {/* Action buttons */}
    {view.isMyTurn && !isShowdown && (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <ActionBar view={view} onAction={onAction} />
      </motion.div>
    )}

    {/* Waiting */}
    {!view.isMyTurn && !isShowdown && view.phase !== "waiting" && (
      <div className="text-center py-2">
        <span className="font-mono text-[9px] text-[var(--pixel-muted)] animate-pulse">Waiting for opponent…</span>
      </div>
    )}

    {/* Equity hint */}
    {canShowEquity && !isShowdown && (
      <div className="text-center">
        <span className="font-mono text-[8px] text-[var(--pixel-muted)] opacity-50">
          <span className="hidden md:inline">Hold SPACE for hand analysis</span>
          <span className="md:hidden">Hold [?] for hand analysis</span>
        </span>
      </div>
    )}
  </div>
);
```

- [ ] **In `PokerPage`, add `ChipBar` and `BlindProgress` above the `PokerTable` when in game mode.** Find the game mode block `{gameMode === "p2p" && isConnected && displayView && (` and add inside the motion.div, before `<PokerTable>`:

```tsx
{/* Version D info: chip bar + blind progress */}
{displayView && (
  <div className="w-full max-w-md mx-auto flex flex-col gap-2 mb-2 px-1">
    <ChipBar myChips={displayView.myChips} opponentChips={displayView.opponentChips} />
    <BlindProgress handNumber={displayView.handNumber} smallBlind={displayView.smallBlind} />
  </div>
)}
```

- [ ] **Verify full page renders and game is playable:**

```bash
# Visit http://localhost:3000/poker — connect two browser tabs P2P and play a hand
```

- [ ] **Commit**

```bash
git add src/app/poker/page.tsx
git commit -m "feat: integrate all D+ALL info components into PokerTable and PokerPage"
```

---

## Task 9: Card Deal Animations (Flop / Turn / River)

**Files:**
- Modify: `src/app/poker/page.tsx` — `CardView` component + `PokerTable`

The key is tracking *how* a community card was dealt to choose the right animation. A `fresh` prop on `CardView` triggers the special effect.

- [ ] **Add `fresh` prop to `CardView`** — update the function signature and add a conditional animation for fresh cards:

```tsx
// BEFORE signature:
function CardView({ card, faceDown, small, highlight, dimmed, delay }: {
  card?: Card | null; faceDown?: boolean; small?: boolean;
  highlight?: boolean; dimmed?: boolean; delay?: number;
})

// AFTER:
function CardView({ card, faceDown, small, highlight, dimmed, delay, fresh }: {
  card?: Card | null; faceDown?: boolean; small?: boolean;
  highlight?: boolean; dimmed?: boolean; delay?: number; fresh?: boolean;
})
```

- [ ] **In `CardView`, replace the `motion.div` animate/transition props to incorporate `fresh`:**

```tsx
// BEFORE:
<motion.div
  initial={{ rotateY: 90, opacity: 0 }}
  animate={highlight
    ? { rotateY: 0, opacity: 1, scale: [1, 1.08, 1], boxShadow: [...] }
    : { rotateY: 0, opacity: dimmed ? 0.35 : 1 }}
  transition={highlight
    ? { rotateY: { duration: 0.3, delay: delay ?? 0 }, ... }
    : { duration: 0.3, delay: delay ?? 0 }}
  ...
>

// AFTER:
<motion.div
  initial={fresh
    ? { opacity: 0, scale: 1.15, filter: "blur(4px)" }
    : { rotateY: 90, opacity: 0 }}
  animate={highlight
    ? { rotateY: 0, opacity: 1, scale: [1, 1.08, 1], filter: "blur(0px)", boxShadow: ["0 0 0px rgba(250,204,21,0)", "0 0 18px rgba(250,204,21,0.7)", "0 0 10px rgba(250,204,21,0.5)"] }
    : fresh
      ? { opacity: 1, scale: 1, filter: "blur(0px)" }
      : { rotateY: 0, opacity: dimmed ? 0.35 : 1 }}
  transition={fresh
    ? { duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: delay ?? 0 }
    : highlight
      ? { rotateY: { duration: 0.3, delay: delay ?? 0 }, scale: { duration: 0.5, delay: (delay ?? 0) + 0.3, repeat: Infinity, repeatType: "reverse" }, boxShadow: { duration: 0.5, delay: (delay ?? 0) + 0.3, repeat: Infinity, repeatType: "reverse" }, opacity: { duration: 0.3, delay: delay ?? 0 } }
      : { duration: 0.3, delay: delay ?? 0 }}
  className={`${w} rounded-lg border-2 ${
    fresh ? "border-[var(--pixel-accent-2)]" :
    highlight ? "border-yellow-400" : "border-gray-300 dark:border-gray-500"
  } bg-white flex flex-col items-center justify-center relative shadow-md dark:shadow-black/30`}
  style={fresh ? { boxShadow: "0 0 10px rgba(167,139,250,0.35)" } : highlight ? { zIndex: 2 } : undefined}
>
```

- [ ] **Add a glow burst overlay for river cards in PokerTable** — in the community cards section, after the `.map()`, add a river glow burst overlay that fires when `view.phase === "river"` and `view.community.length === 5`:

```tsx
{/* River glow burst */}
<AnimatePresence>
  {view.phase === "river" && view.community.length === 5 && (
    <motion.div
      key={`river-glow-${view.handNumber}`}
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0] }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <motion.div
        initial={{ width: 0, height: 0 }}
        animate={{ width: 140, height: 90 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{ borderRadius: "50%", background: "radial-gradient(ellipse, rgba(167,139,250,0.25), transparent 70%)", filter: "blur(8px)" }}
      />
    </motion.div>
  )}
</AnimatePresence>
```

- [ ] **For the flop, add staggered deal animation.** The flop shows 3 cards at once. In the `.map()`, pass `delay={i * 0.1}` for the first 3 cards when `view.phase === "flop"` and `view.community.length === 3`:

```tsx
// In the community card map, update delay calculation:
const isFresh = (view.phase === "turn" && i === 3) || (view.phase === "river" && i === 4);
const isFlop = view.phase === "flop" && view.community.length === 3;
const dealDelay = isFlop ? i * 0.1 : (isFresh ? 0 : i * 0.08);

return <CardView key={i} card={c} highlight={hl} dimmed={dim} delay={dealDelay} fresh={isFresh} />;
```

- [ ] **Verify: play a hand and observe flop cards fan in, turn/river have different effects**

- [ ] **Commit**

```bash
git add src/app/poker/page.tsx
git commit -m "feat: Flop stagger, Turn spring, River blur+glow card deal animations"
```

---

## Task 10: Win / Result Animations

**Files:**
- Modify: `src/app/poker/page.tsx`

- [ ] **Add fold fly-away animation for opponent cards when opponent folds.** In the opponent panel, replace the face-down card rendering with a fold-aware version:

```tsx
// In opponent panel, replace:
<><CardView faceDown small dimmed={isFoldWin && view.opponentFolded} /><CardView faceDown small dimmed={isFoldWin && view.opponentFolded} /></>

// With:
<AnimatePresence>
  {[0, 1].map(i => (
    <motion.div key={i}
      initial={false}
      animate={isFoldWin && view.opponentFolded
        ? { opacity: 0, y: -28, rotate: i === 0 ? -18 : -24, transition: { duration: 0.4, delay: i * 0.06, ease: "easeIn" } }
        : { opacity: 1, y: 0, rotate: 0 }}
    >
      <CardView faceDown small />
    </motion.div>
  ))}
</AnimatePresence>
```

- [ ] **Add all-in double-ring expand animation.** The existing `allInFlash` state drives the full-screen radial. Add a second ring effect local to the active player's panel. Inside `PokerTable`, after the existing `allInFlash` state/effect, add:

```tsx
// All-in ring state (for panel-level rings — separate from the fullscreen flash)
const [allInRing, setAllInRing] = useState(false);
// Reuse the same prevAllIn ref already in the component
useEffect(() => {
  // existing allInFlash effect already handles prevAllIn.current
  // just mirror the trigger here
  if ((view.myAllIn || view.opponentAllIn) && !allInRing) {
    setAllInRing(true);
    const t = setTimeout(() => setAllInRing(false), 900);
    return () => clearTimeout(t);
  }
}, [view.myAllIn, view.opponentAllIn]); // eslint-disable-line react-hooks/exhaustive-deps
```

Then in the my panel JSX, add rings overlaid on the panel:

```tsx
{/* All-in rings — inside my panel, after the pulse bar */}
<AnimatePresence>
  {allInRing && (view.myAllIn) && (
    <>
      {[0, 1].map(i => (
        <motion.div key={i}
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{ border: "2px solid rgba(251,191,36,0.7)" }}
          initial={{ opacity: 1, scale: 0.5 }}
          animate={{ opacity: 0, scale: 1.18 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, delay: i * 0.15, ease: "easeOut" }}
        />
      ))}
    </>
  )}
</AnimatePresence>
```

- [ ] **Add rare hand pop animation.** At showdown, when the winning hand is Four of a Kind, Straight Flush, or Royal Flush, trigger a special sequential card pop. Add detection in the showdown result block:

```tsx
// Add near the top of PokerTable, with other derived values:
const isRareHand = isShowdown && view.result && !isFoldWin &&
  ["Four of a Kind", "Straight Flush", "Royal Flush"].includes(view.result.winnerHand);
```

Then in the result banner, add below the hand description line:

```tsx
{/* Rare hand label */}
{isRareHand && (
  <motion.div
    initial={{ opacity: 0, letterSpacing: "0em" }}
    animate={{ opacity: 1, letterSpacing: "0.08em" }}
    transition={{ delay: 0.6, duration: 0.5 }}
    className="font-mono text-[10px] font-bold mt-2"
    style={{ background: "linear-gradient(90deg, var(--pixel-warn), var(--pixel-accent-2), var(--pixel-warn))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
  >
    ✦ {view.result!.winnerHand.toUpperCase()} ✦
  </motion.div>
)}
```

- [ ] **Verify all three scenarios: fold win, all-in, rare hand (use dev console to force state if needed)**

- [ ] **Final compile check:**

```bash
npx tsc --noEmit
```

- [ ] **Commit**

```bash
git add src/app/poker/page.tsx
git commit -m "feat: fold fly-away, all-in rings, rare hand reveal animations"
```

---

## Self-Review Checklist

After all tasks are complete, verify against spec:

- [ ] Visual Style: deep black bg (`rgba(4,3,12,0.97)`), gradient title, glow on my-turn panel, pulse bar ✓
- [ ] ChipBar with animated % and bar ✓
- [ ] BlindProgress with next level countdown ✓  
- [ ] POT/BETS/TOTAL split via PotDisplay ✓
- [ ] SPR — **gap identified**: SPR is in spec but not in any task above. Add to `PotDisplay` component in Task 4: add a 4th column `SPR = min(myChips,opponentChips) / (pot+myBet+opponentBet)` displayed beside TOTAL.
- [ ] PotOdds showing % + "Good odds"/"Poor odds" ✓
- [ ] ActionLog with pulsing "to act…" ✓
- [ ] HandStrengthBadge (≥3 community cards) ✓
- [ ] WinRateBar always visible ✓
- [ ] AnimatedNumber on all numeric values ✓ (chip counts already had it; PotDisplay uses it; ChipBar uses motion.div for bar)
- [ ] Flop stagger ✓ / Turn spring ✓ / River blur+glow ✓
- [ ] Fold fly-away ✓ / All-in rings ✓ / Rare hand pop ✓
- [ ] Win/Lose/Split banners (existing code retained with D style) ✓
- [ ] Equity overlay touch bug fix ✓
- [ ] lastActionLabel IIFE fix ✓

**SPR fix — update Task 4's `PotDisplay` to include SPR column:**

```tsx
// Add 4th column to PotDisplay:
const effectiveStack = Math.min(/* need myChips + opponentChips */);
```

`PotDisplay` doesn't have access to chip counts. Pass them as props:

```tsx
// Updated PotDisplay signature in Task 4:
function PotDisplay({ pot, myBet, opponentBet, myChips, opponentChips }: {
  pot: number; myBet: number; opponentBet: number; myChips: number; opponentChips: number;
}) {
  const bets = myBet + opponentBet;
  const total = pot + bets;
  const effectiveStack = Math.min(myChips, opponentChips);
  const spr = total > 0 ? (effectiveStack / total).toFixed(1) : "—";
  return (
    <div className="flex items-center gap-3">
      {/* POT / BETS / TOTAL columns — same as before */}
      <div className="w-px h-5 bg-white/8" />
      <div className="text-center">
        <div className="font-mono text-[7px] tracking-widest text-[var(--pixel-muted)] mb-0.5">SPR</div>
        <span className="font-mono text-sm font-bold text-[var(--pixel-muted)]">{spr}</span>
      </div>
    </div>
  );
}
```

And update the call site in Task 8's `PokerTable` JSX:

```tsx
<PotDisplay pot={view.pot} myBet={view.myBet} opponentBet={view.opponentBet}
            myChips={view.myChips} opponentChips={view.opponentChips} />
```

---

*Plan saved to `docs/superpowers/plans/2026-04-06-poker-ui-redesign.md`*
