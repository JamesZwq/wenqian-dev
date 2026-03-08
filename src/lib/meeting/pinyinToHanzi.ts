/**
 * 使用 pinyin-split + find-hanzi 词库将拼音名字猜测为中文名（类似输入法）。
 * 仅当整段为纯拼音（无汉字）时尝试转换，否则返回原字符串。
 */

import split from "pinyin-split";
// find-hanzi 词库 + pinyin-utils：词库用声调符号作 key，需 numberToMark 转换
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pinyin2hanzi = require("find-hanzi/data/pinyin2hanzi.json") as Record<string, string[]>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const hanzi2frequency = require("find-hanzi/data/hanzi2frequency.json") as Record<string, number>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const numberToMark = require("pinyin-utils").numberToMark as (pinyin: string) => string;

/** 判断字符串是否像纯拼音（字母、空格，无 CJK） */
function looksLikePinyin(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/[\u4e00-\u9fff]/.test(t)) return false;
  return /^[a-zA-Z\s]+$/.test(t);
}

/** 单音节 + 声调 1~4 查词库，按字频取首选汉字 */
function syllableToHanzi(syllable: string): string | null {
  const s = syllable.toLowerCase().trim();
  if (!s) return null;
  for (let tone = 1; tone <= 4; tone++) {
    const key = numberToMark(s + String(tone));
    const list = pinyin2hanzi[key];
    if (list && list.length > 0) {
      const withFreq = list.map((h) => ({ h, f: hanzi2frequency[h] ?? 9999 }));
      withFreq.sort((a, b) => a.f - b.f);
      return withFreq[0].h;
    }
  }
  return null;
}

/**
 * 将拼音名字转为中文名猜测。
 * 例如 "zhang san" -> "张三"，"Zhang San" -> "张三"。
 * 失败或非拼音时返回原字符串。
 */
export function pinyinToHanziSync(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return trimmed;
  if (!looksLikePinyin(trimmed)) return trimmed;

  try {
    const syllables = split(trimmed.toLowerCase());
    if (!Array.isArray(syllables) || syllables.length === 0) return trimmed;

    const chars: string[] = [];
    for (const syl of syllables) {
      const s = typeof syl === "string" ? syl : "";
      if (!s) continue;
      const hanzi = syllableToHanzi(s);
      if (hanzi) chars.push(hanzi);
      else return trimmed;
    }
    return chars.join("");
  } catch {
    return trimmed;
  }
}

/** 异步版本，与同步结果相同，便于以后如需异步词库时替换 */
export async function pinyinToHanzi(name: string): Promise<string> {
  return Promise.resolve(pinyinToHanziSync(name));
}
