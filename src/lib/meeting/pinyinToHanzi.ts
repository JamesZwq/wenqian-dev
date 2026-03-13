/**
 * 使用 Google 输入法 API 将拼音转换为汉字
 * API: https://inputtools.google.com/request?text=${pinyin}&itc=zh-t-i0-pinyin&num=5
 * 无需 API Key，免费使用
 *
 * 真实响应格式（curl 验证）：
 * ["SUCCESS", [["zhangwenqian", ["张文潜", "张文", ...], [], {...}]]]
 *  data[1][0][1][0] = 第一候选（最佳匹配）
 */

/** 判断字符串是否像纯拼音（字母和空格，无 CJK） */
function looksLikePinyin(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/[\u4e00-\u9fff]/.test(t)) return false;
  return /^[a-zA-Z\s]+$/.test(t);
}

/**
 * 将英文姓名重排为「姓在前」的拼音顺序再拼接
 * 例如："wenqian zhang" -> "zhangwenqian"
 *       "zhang wenqian" -> "zhangwenqian"
 * 规则：按空格拆分，把最后一个词（姓）移到最前面，其余依次拼接
 */
function reorderToSurnameFirst(name: string): string {
  const parts = name.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  const surname = parts[parts.length - 1];
  const rest = parts.slice(0, parts.length - 1);
  return surname + rest.join("");
}

/**
 * 将拼音名字转为中文名（同步占位，始终返回原始字符串）
 * 真正的转换请使用异步版本 pinyinToHanzi
 */
export function pinyinToHanziSync(name: string): string {
  return (name ?? "").trim();
}

/**
 * 使用 Google 输入法 API 将拼音转换为汉字
 * 例如 "wenqian zhang" -> 先重排为 "zhangwenqian" -> "张文潜"
 */
export async function pinyinToHanzi(name: string): Promise<string> {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return trimmed;
  if (!looksLikePinyin(trimmed)) return trimmed;

  try {
    // 姓在前重排并移除空格
    const pinyin = reorderToSurnameFirst(trimmed);
    const url = `https://inputtools.google.com/request?text=${encodeURIComponent(pinyin)}&itc=zh-t-i0-pinyin&num=5`;

    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Google IME API returned status ${response.status}`);
      return trimmed;
    }

    // 响应格式: ["SUCCESS", [["pinyin", ["候选1", "候选2", ...], [], {...}]]]
    const data = await response.json();

    if (data[0] !== "SUCCESS") {
      console.warn("Google IME API did not return SUCCESS:", data[0]);
      return trimmed;
    }

    const candidates: string[] | undefined = data?.[1]?.[0]?.[1];
    if (Array.isArray(candidates) && candidates.length > 0 && typeof candidates[0] === "string") {
      return candidates[0];
    }

    console.warn("No candidates found in Google IME response");
    return trimmed;
  } catch (error) {
    console.error("pinyinToHanzi error:", error);
    return trimmed;
  }
}

/**
 * 批量转换拼音列表
 */
export async function batchPinyinToHanzi(pinyinList: string[]): Promise<string[]> {
  return Promise.all(pinyinList.map((p) => pinyinToHanzi(p)));
}
