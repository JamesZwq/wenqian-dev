import type { Operation } from "./mathEngine";

const LS_KEY = "math-sprint-best";

function getKey(ops: Operation[], count: number): string {
  return [...ops].sort().join(",") + ":" + count;
}

export function getBestSpeed(ops: Operation[], count: number): number | null {
  try {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    const v = all[getKey(ops, count)];
    return typeof v === "number" ? v : null;
  } catch {
    return null;
  }
}

export function saveBestSpeed(ops: Operation[], count: number, speed: number): boolean {
  try {
    const key = getKey(ops, count);
    const all = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    const prev = all[key];
    if (typeof prev !== "number" || speed > prev) {
      all[key] = speed;
      localStorage.setItem(LS_KEY, JSON.stringify(all));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
