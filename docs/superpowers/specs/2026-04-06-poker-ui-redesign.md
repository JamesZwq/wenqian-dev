# Poker UI Redesign — Design Spec
Date: 2026-04-06

## Summary

Complete visual overhaul of the Texas Hold'em poker game (`src/app/poker/page.tsx`) plus bug fixes. The new design uses **Version D style** (deep black background, gradient title, strong glow accents) with a full **D+ALL information layer**.

---

## Visual Style (Version D)

- **Background**: `rgba(4,3,12,0.95)` — deeper black than the site's `--pixel-bg`
- **Panel background**: `rgba(8,6,20,0.85)` — dark glass
- **Title**: gradient `--accent → --accent2` with `-webkit-background-clip: text`
- **Glow**: `box-shadow: 0 0 24px rgba(129,140,248,0.1)` on active panels
- **My-turn panel**: `border-color: rgba(129,140,248,0.6)` + glow
- **Pulse bar**: 2px animated gradient line at top of my-turn panel
- **Cards**: unchanged card face design; `back` cards keep existing `linear-gradient(135deg,#1e1b4b,#312e81)`; freshly-dealt community card gets `border-color: var(--accent2)` + subtle glow
- **Action buttons**: slightly taller (py-3), CALL has inward ripple ring animation

---

## Information Layer (D+ALL)

All data is derived from existing game state — no new backend or data sources needed.

### Header (inside page chrome, always visible)

1. **Chip ratio bar** — horizontal bar split between OPP (left, accent2) and YOU (right, accent). Labels show `OPP $X (Y%)` and `YOU $X (Y%)`. Calculated from `myChips` / `(myChips + opponentChips)`.

2. **Blind level progress** — shows current blind level (`smallBlind/bigBlind`) and a progress bar filling toward the next level. Labels: `"Blinds 2/4"` → progress bar → `"3 hands → 4/8"`. Use `getBlindLevel(handNumber)` to compute current and next level thresholds.

### Table center

3. **POT / BETS / TOTAL three-column split** — replaces the single "POT" label.
   - POT = `view.pot` (money already collected from previous rounds)
   - BETS = `view.myBet + view.opponentBet` (money bet this round, not yet in pot)
   - TOTAL = POT + BETS

4. **SPR (Stack-to-Pot Ratio)** — `effectiveStack / TOTAL` where `effectiveStack = min(myChips, opponentChips)`. Display as one decimal place. Shown beside TOTAL.

5. **Pot odds** — visible only when it's my turn and `toCall > 0`. Formula: `toCall / (TOTAL + toCall)` as a percentage. Display as `"25% · Good odds"` / `"25% · Poor odds"` based on whether pot odds % < equity %. "Good odds" / "Bad odds" in English.

6. **Action log** — scrollable (max 5 rows) list of all actions this hand, in order. Each row: `WHO · ACTION · AMOUNT`. WHO shows "YOU" (accent color) or "OPP" (accent2 color). Last row shows `"· to act…"` with a pulsing dot when it's my turn. Cleared on new hand.

### My player panel

7. **Hand strength badge** — shows current made hand name (e.g., `TWO PAIR`, `STRAIGHT`, `HIGH CARD`). Uses `evaluateHand` on current hole + community cards. Only shown when ≥ 3 community cards are visible. During preflop, omit. Note: draws (flush draw, straight draw) are not shown — only the best made hand from available cards.

8. **Win rate bar** — thin horizontal bar (5px height) showing equity win%. Uses the existing `calcEquity` function, computed in background once per phase change (same logic as hold-SPACE, but always visible and lightweight). Shows `WIN XX%` with a green fill bar.

---

## Animations

### Number Animations — Linear Counter (existing `AnimatedNumber` pattern)

All numeric values use the **linear easing count-up/down** approach (existing `AnimatedNumber` component). This is intentional: when you win a hand, your chips visibly rise while the opponent's chips fall toward zero. When the pot is collected, POT counts down to 0 and chips count up. The "drain and fill" feel is the goal.

Apply `AnimatedNumber` to every numeric display:
- `myChips`, `opponentChips`
- `pot`, `myBet`, `opponentBet` (and derived BETS, TOTAL)
- Chip ratio percentages (YOU X% / OPP X%)
- Win rate percentage (WIN XX%)
- SPR value

Number animation curve: **easeOutCubic** (`1 - Math.pow(1 - t, 3)`) — fast start, decelerating finish. This matches the desired "先快再慢" feel exactly. Keep this curve.

At showdown, increase the duration multiplier from `3` to `5` (max `900ms`) so large chip swings (e.g. winning $240) feel weighty — rockets up fast, settles smoothly:
```ts
const dur = Math.min(Math.abs(diff) * 5, 900);
```
For small bet changes during a hand, the shorter duration (small diff × 5 is still fast) keeps the UI responsive.

### Card Deal Animations

| Event | Animation |
|-------|-----------|
| **Flop** | 3 cards appear sequentially, each sliding down from above, 80ms stagger. Uses existing `rotateY` flip + `translateY(-18px)` initial state. |
| **Turn** | Single card with bounce spring (`stiffness:400, damping:18`), slight rotation from `-8deg` to `0`. Fresh card gets `border-color: var(--accent2)` + glow. |
| **River** | Single card with blur dissolve (`filter: blur(4px) → blur(0)`) + scale `1.15→1` + radial glow burst behind it. Most dramatic of the three. |

### Win / Result Animations

| Scenario | Animation |
|----------|-----------|
| **Opponent folds** | Opponent's face-down cards animate `translateY(-30px) + rotate(-20deg) + opacity→0`. Clean, quick. |
| **Win by hand** | Winning best-5 cards pulse gold (`box-shadow` glow repeating). Losing cards dim to `opacity: 0.22`. |
| **All-in** | Two concentric rings expand outward from the all-in player's card area, `scale(0.4→2.2) + opacity(1→0)`, 150ms stagger between rings. |
| **Rare hand** (Four-of-a-kind / Straight Flush / Royal Flush) | Cards pop in sequentially with spring overshoot, 80ms stagger. Gradient text label (`✦ ROYAL FLUSH ✦`) fades in with letter-spacing expand. |
| **Result banner — WIN** | Spring pop `scale(0.6→1) + translateY(10px→0)` + continuous shimmer sweep overlay. Green color scheme. |
| **Result banner — LOSE** | Horizontal shake `translateX` sequence (existing shake pattern). Red color scheme. |
| **Result banner — SPLIT** | Smooth slide-in `translateY(8px→0)`. Yellow color scheme. |

---

## Bug Fixes

1. **Equity overlay touch bug** — the `pointermove` listener dismisses the overlay when the user is just trying to scroll. Fix: remove the `pointermove` listener; only dismiss on `pointerdown` outside the `?` button.

2. **`lastActionLabel` pattern** — currently defined as `useCallback` returning a string but called as a function `lastActionLabel()` inside JSX, causing unnecessary renders. Convert to a plain derived variable (memo or inline).

3. **POT label confusion** — now resolved by the three-column POT/BETS/TOTAL split.

4. **Turn indicator** — previously no clear visual cue. Now: glow border + pulse bar + "YOUR TURN" badge on my panel; opponent panel has no highlight when it's not my turn.

---

## Component Structure

All changes stay within `src/app/poker/page.tsx` and `src/app/poker/utils.ts`. No new files needed.

### New sub-components in page.tsx

- `ChipBar` — chip ratio bar (props: myChips, opponentChips)
- `BlindProgress` — blind level + countdown (props: handNumber, smallBlind)
- `ActionLog` — action history list (props: actions: LogEntry[])
- `HandStrengthBadge` — hand name badge (props: myCards, community)
- `WinRateBar` — equity bar (props: myCards, community)
- `PotDisplay` — three-column pot/bets/total (props: pot, myBet, opponentBet)
- `PotOdds` — pot odds display (props: toCall, total, equity)

### Additions to utils.ts

- `getNextBlindLevel(handNumber)` — returns next SB amount and how many hands away

### State additions in PokerTable component

- `actionLog: LogEntry[]` — accumulated in a ref across renders by diffing `view.lastAction`; reset when `view.handNumber` changes. `LogEntry = { who: "YOU"|"OPP"; action: ActionType; amount: number; phase: Phase }`
- `equityPct: number | null` — computed async when phase/cards change, cached

---

## Out of Scope

- No changes to P2P connection logic
- No changes to game rules / `processAction` / `evaluateHand`
- No changes to layout.tsx, equity.ts (only calling it, not modifying)
- No server-side changes
