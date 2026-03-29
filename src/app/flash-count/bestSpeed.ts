import type { Difficulty } from "./flashCountEngine";

const LS_KEY = "flash-count-best";

function getKey(diff: Difficulty, count: number): string {
  return `${diff}:${count}`;
}

export function getBestSpeed(diff: Difficulty, count: number): number | null {
  try {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    const v = all[getKey(diff, count)];
    return typeof v === "number" ? v : null;
  } catch {
    return null;
  }
}

export function saveBestSpeed(diff: Difficulty, count: number, speed: number): boolean {
  try {
    const key = getKey(diff, count);
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
