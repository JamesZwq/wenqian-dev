/**
 * Exact & Monte-Carlo poker equity calculator.
 *
 * Uses a zero-allocation integer hand evaluator for maximum throughput.
 * River / Turn / Flop → exact enumeration.
 * Pre-flop → fast Monte-Carlo (20 000 samples).
 */

import type { Card } from "./types";

/* ── Fast card encoding ──────────────────────────────────────────────── */
/* id = (rank - 2) * 4 + suitIdx   where h=0 d=1 c=2 s=3               */
/* rank 2→0 … A→12                                                      */

const RK = new Uint8Array(52);
const ST = new Uint8Array(52);
for (let i = 0; i < 52; i++) { RK[i] = i >> 2; ST[i] = i & 3; }

function toId(c: Card): number {
  return (c.rank - 2) * 4 + (c.suit === "h" ? 0 : c.suit === "d" ? 1 : c.suit === "c" ? 2 : 3);
}

/* ── Zero-allocation 5-card evaluator ────────────────────────────────── */
/* Returns a single integer – higher = better hand.                      */
/* Uses sorting-network + pattern-matching, no arrays / objects created.  */

const P = 371293; // 13^5 — separates hand-type tiers

function e5(a: number, b: number, c: number, d: number, e: number): number {
  let r0 = RK[a], r1 = RK[b], r2 = RK[c], r3 = RK[d], r4 = RK[e], t: number;
  /* optimal 9-comparator sorting network (descending) */
  if (r0 < r1) { t = r0; r0 = r1; r1 = t; } if (r3 < r4) { t = r3; r3 = r4; r4 = t; }
  if (r0 < r2) { t = r0; r0 = r2; r2 = t; } if (r1 < r2) { t = r1; r1 = r2; r2 = t; }
  if (r0 < r3) { t = r0; r0 = r3; r3 = t; } if (r2 < r3) { t = r2; r2 = r3; r3 = t; }
  if (r1 < r4) { t = r1; r1 = r4; r4 = t; } if (r1 < r2) { t = r1; r1 = r2; r2 = t; }
  if (r3 < r4) { t = r3; r3 = r4; r4 = t; }
  /* r0 ≥ r1 ≥ r2 ≥ r3 ≥ r4 */

  const fl = ST[a] === ST[b] && ST[b] === ST[c] && ST[c] === ST[d] && ST[d] === ST[e];
  let sr = 0;
  if (r0 - r4 === 4 && r0 !== r1 && r1 !== r2 && r2 !== r3 && r3 !== r4) sr = r0;
  else if (r0 === 12 && r1 === 3 && r2 === 2 && r3 === 1 && r4 === 0) sr = 3; // wheel

  if (sr > 0 && fl) return 8 * P + sr;             // straight flush
  if (r0 === r3) return 7 * P + r0 * 13 + r4;      // quads (AAAAB)
  if (r1 === r4) return 7 * P + r1 * 13 + r0;      // quads (ABBBB)
  if (r0 === r2 && r3 === r4) return 6 * P + r0 * 13 + r3; // full house (AAABB)
  if (r0 === r1 && r2 === r4) return 6 * P + r2 * 13 + r0; // full house (AABBB)
  if (fl) return 5 * P + r0 * 28561 + r1 * 2197 + r2 * 169 + r3 * 13 + r4; // flush
  if (sr > 0) return 4 * P + sr;                    // straight
  if (r0 === r2) return 3 * P + r0 * 169 + r3 * 13 + r4;  // trips (AAABC)
  if (r1 === r3) return 3 * P + r1 * 169 + r0 * 13 + r4;  // trips (ABBBC)
  if (r2 === r4) return 3 * P + r2 * 169 + r0 * 13 + r1;  // trips (ABCCC)
  if (r0 === r1 && r2 === r3) return 2 * P + r0 * 169 + r2 * 13 + r4; // two pair
  if (r0 === r1 && r3 === r4) return 2 * P + r0 * 169 + r3 * 13 + r2;
  if (r1 === r2 && r3 === r4) return 2 * P + r1 * 169 + r3 * 13 + r0;
  if (r0 === r1) return P + r0 * 2197 + r2 * 169 + r3 * 13 + r4; // one pair
  if (r1 === r2) return P + r1 * 2197 + r0 * 169 + r3 * 13 + r4;
  if (r2 === r3) return P + r2 * 2197 + r0 * 169 + r1 * 13 + r4;
  if (r3 === r4) return P + r3 * 2197 + r0 * 169 + r1 * 13 + r2;
  return r0 * 28561 + r1 * 2197 + r2 * 169 + r3 * 13 + r4; // high card
}

/* ── Best-of-7 (C(7,5) = 21 combos) ─────────────────────────────────── */

function best7(h: Int32Array): number {
  let b = 0;
  for (let i = 0; i < 3; i++)
    for (let j = i + 1; j < 4; j++)
      for (let k = j + 1; k < 5; k++)
        for (let l = k + 1; l < 6; l++)
          for (let m = l + 1; m < 7; m++) {
            const v = e5(h[i], h[j], h[k], h[l], h[m]);
            if (v > b) b = v;
          }
  return b;
}

/* ── Pre-allocated work buffers ──────────────────────────────────────── */

const myH = new Int32Array(7);
const opH = new Int32Array(7);
const subDk = new Int32Array(50); // filtered deck for opponent enumeration
const idxBuf = new Int32Array(52); // shuffle indices for MC

const LABELS = [
  "High Card", "One Pair", "Two Pair", "Three of a Kind",
  "Straight", "Flush", "Full House", "Four of a Kind", "Straight Flush",
] as const;

/* ── Public types & API ──────────────────────────────────────────────── */

export interface EquityResult {
  winPct: number;
  losePct: number;
  tiePct: number;
  handDist: { name: string; pct: number }[];
  samples: number;
  exact: boolean;
}

export function calcEquity(myCards: Card[], community: Card[]): EquityResult {
  const my = myCards.map(toId);
  const comm = community.map(toId);
  const used = new Set([...my, ...comm]);
  const dk: number[] = [];
  for (let i = 0; i < 52; i++) if (!used.has(i)) dk.push(i);

  switch (comm.length) {
    case 5: return river(my, comm, dk);
    case 4: return turnExact(my, comm, dk);
    case 3: return flopExact(my, comm, dk);
    default: return preflopMC(my, dk);
  }
}

/* ── River — exact C(45,2) = 990 ─────────────────────────────────────── */

function river(my: number[], c: number[], dk: number[]): EquityResult {
  myH[0] = my[0]; myH[1] = my[1];
  for (let i = 0; i < 5; i++) { myH[i + 2] = c[i]; opH[i + 2] = c[i]; }
  const mv = best7(myH), mt = Math.floor(mv / P);
  let w = 0, l = 0, ti = 0;
  for (let i = 0; i < dk.length - 1; i++) {
    opH[0] = dk[i];
    for (let j = i + 1; j < dk.length; j++) {
      opH[1] = dk[j];
      const ov = best7(opH);
      if (mv > ov) w++; else if (mv < ov) l++; else ti++;
    }
  }
  const n = w + l + ti;
  return mk(w, l, ti, n, singleType(mt), n, true);
}

/* ── Turn — exact 46 × C(44,2) = 41 624 ─────────────────────────────── */

function turnExact(my: number[], c: number[], dk: number[]): EquityResult {
  myH[0] = my[0]; myH[1] = my[1];
  for (let i = 0; i < 4; i++) { myH[i + 2] = c[i]; opH[i + 2] = c[i]; }
  let w = 0, l = 0, ti = 0, tot = 0;
  const hc = new Float64Array(9); let ht = 0;

  for (let r = 0; r < dk.length; r++) {
    myH[6] = dk[r]; opH[6] = dk[r];
    const mv = best7(myH); hc[Math.floor(mv / P)]++; ht++;

    // build sub-deck excluding card at index r
    let sLen = 0;
    for (let x = 0; x < dk.length; x++) if (x !== r) subDk[sLen++] = dk[x];

    for (let i = 0; i < sLen - 1; i++) {
      opH[0] = subDk[i];
      for (let j = i + 1; j < sLen; j++) {
        opH[1] = subDk[j];
        const ov = best7(opH);
        if (mv > ov) w++; else if (mv < ov) l++; else ti++; tot++;
      }
    }
  }
  return mk(w, l, ti, tot, distArr(hc, ht), tot, true);
}

/* ── Flop — exact C(47,2) × C(45,2) ≈ 1 070 190 ────────────────────── */

function flopExact(my: number[], c: number[], dk: number[]): EquityResult {
  myH[0] = my[0]; myH[1] = my[1];
  for (let i = 0; i < 3; i++) { myH[i + 2] = c[i]; opH[i + 2] = c[i]; }
  let w = 0, l = 0, ti = 0, tot = 0;
  const hc = new Float64Array(9); let ht = 0;

  for (let t = 0; t < dk.length - 1; t++) {
    myH[5] = dk[t]; opH[5] = dk[t];
    for (let r = t + 1; r < dk.length; r++) {
      myH[6] = dk[r]; opH[6] = dk[r];
      const mv = best7(myH); hc[Math.floor(mv / P)]++; ht++;

      // sub-deck excluding t and r
      let sLen = 0;
      for (let x = 0; x < dk.length; x++) if (x !== t && x !== r) subDk[sLen++] = dk[x];

      for (let i = 0; i < sLen - 1; i++) {
        opH[0] = subDk[i];
        for (let j = i + 1; j < sLen; j++) {
          opH[1] = subDk[j];
          const ov = best7(opH);
          if (mv > ov) w++; else if (mv < ov) l++; else ti++; tot++;
        }
      }
    }
  }
  return mk(w, l, ti, tot, distArr(hc, ht), tot, true);
}

/* ── Pre-flop — fast Monte-Carlo (20 000 samples) ───────────────────── */

function preflopMC(my: number[], dk: number[]): EquityResult {
  myH[0] = my[0]; myH[1] = my[1];
  const N = 20000, dkLen = dk.length;
  let w = 0, l = 0, ti = 0;
  const hc = new Float64Array(9);

  for (let s = 0; s < N; s++) {
    // partial Fisher-Yates: pick 7 random from dk
    for (let i = 0; i < dkLen; i++) idxBuf[i] = i;
    for (let i = 0; i < 7; i++) {
      const j = i + ((Math.random() * (dkLen - i)) | 0);
      const tmp = idxBuf[i]; idxBuf[i] = idxBuf[j]; idxBuf[j] = tmp;
    }
    opH[0] = dk[idxBuf[0]]; opH[1] = dk[idxBuf[1]];
    for (let i = 0; i < 5; i++) { myH[i + 2] = dk[idxBuf[i + 2]]; opH[i + 2] = dk[idxBuf[i + 2]]; }

    const mv = best7(myH), ov = best7(opH);
    hc[Math.floor(mv / P)]++;
    if (mv > ov) w++; else if (mv < ov) l++; else ti++;
  }
  return mk(w, l, ti, N, distArr(hc, N), N, false);
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function mk(
  w: number, l: number, ti: number, tot: number,
  handDist: { name: string; pct: number }[], samples: number, exact: boolean,
): EquityResult {
  return {
    winPct: (w / tot) * 100, losePct: (l / tot) * 100, tiePct: (ti / tot) * 100,
    handDist, samples, exact,
  };
}

function singleType(typeIdx: number): { name: string; pct: number }[] {
  return LABELS.map((name, i) => ({ name, pct: i === typeIdx ? 100 : 0 })).reverse();
}

function distArr(hc: Float64Array, total: number): { name: string; pct: number }[] {
  return LABELS.map((name, i) => ({ name, pct: (hc[i] / total) * 100 })).reverse();
}
