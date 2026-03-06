import Papa from "papaparse";

export type ParsedTable = {
  headers: string[];
  rows: Record<string, string>[];
  fetchedAtIso: string;
  source: {
    sheetId: string;
    gid: string;
    url: string;
  };
  notes?: string[];
};

function looksLikeHtml(text: string) {
  const t = text.trim().toLowerCase();
  return t.startsWith("<!doctype html") || t.startsWith("<html") || t.includes("accounts.google.com");
}

export async function fetchSheetCsv(params: {
  sheetId: string;
  gid: string;
  revalidateSeconds: number;
}): Promise<{ csvText: string; url: string; notes: string[] }> {
  const { sheetId, gid, revalidateSeconds } = params;
  const url = `https://docs.google.com/spreadsheets/d/18ffrZOqvPL7YS9pUcN18OIrEuIZ395yoTjPHWyFxjNI/export?format=csv&gid=1602646240`;

  const res = await fetch(url, {
    next: { revalidate: revalidateSeconds },
    headers: { Accept: "text/csv, text/plain;q=0.9, */*;q=0.8" },
  });

  const csvText = await res.text();
  const notes: string[] = [];

  if (!res.ok) notes.push(`Upstream HTTP ${res.status}: ${res.statusText}`);

  if (looksLikeHtml(csvText)) {
    notes.push("The response looks like HTML (not CSV). This usually means the sheet is NOT accessible without auth.");
    notes.push("Fix options: (1) Set sharing to 'Anyone with the link' (Viewer), or (2) 'Publish to the web' in Google Sheets.");
  }

  return { csvText, url, notes };
}

export function parseCsvToTable(csvText: string): { headers: string[]; rows: Record<string, string>[]; notes: string[] } {
  const notes: string[] = [];

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
    transformHeader: (h) => (h ?? "").trim(),
  });

  if (parsed.errors?.length) {
    notes.push(...parsed.errors.slice(0, 5).map((e) => `CSV parse error: ${e.message}`));
  }

  const headers = (parsed.meta?.fields ?? []).filter(Boolean) as string[];
  const rows = (parsed.data ?? []).map((r) => {
    const out: Record<string, string> = {};
    for (const h of headers) {
      const v = (r as any)?.[h];
      out[h] = v == null ? "" : String(v);
    }
    return out;
  });

  if (headers.length === 0) notes.push("No headers detected. Make sure the first row is a header row.");

  return { headers, rows, notes };
}

export function tryParseDate(value: string): number | null {
  const v = (value ?? "").trim();
  if (!v) return null;

  const t1 = Date.parse(v);
  if (!Number.isNaN(t1)) return t1;

  const m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const y = parseInt(m[3].length === 2 ? "20" + m[3] : m[3], 10);
    const day = a > 12 ? a : b;
    const month = a > 12 ? b : a;
    const dt = Date.UTC(y, month - 1, day);
    return Number.isNaN(dt) ? null : dt;
  }

  return null;
}

export function pickUpcomingRow(args: {
  headers: string[];
  rows: Record<string, string>[];
  preferredDateColumn?: string;
}): { row: Record<string, string> | null; dateColumnUsed?: string; notes: string[] } {
  const { headers, rows, preferredDateColumn } = args;
  const notes: string[] = [];
  if (rows.length === 0) return { row: null, notes: ["No rows found."] };

  const candidates =
    preferredDateColumn && headers.includes(preferredDateColumn)
      ? [preferredDateColumn]
      : headers.filter((h) => /(date|week|time|session|meeting)/i.test(h));

  const now = Date.now();
  // 当天 0 点（本地）的时间戳，用于“从今天起算”的最近会议
  const todayStart = new Date(now).setHours(0, 0, 0, 0);
  let best: { idx: number; t: number; col: string; score: number } | null = null;

  for (const col of candidates) {
    for (let i = 0; i < rows.length; i++) {
      const t = tryParseDate(rows[i][col] ?? "");
      if (t == null) continue;
      // 将解析出的日期转为“当天 0 点”本地时间，与今天比较
      const rowDayStart = new Date(t).setHours(0, 0, 0, 0);
      if (rowDayStart < todayStart) continue; // 已过去的日期不参与“下一个”
      const score = rowDayStart; // 今天最小，明天次之…
      if (!best || score < best.score) best = { idx: i, t, col, score };
    }
  }

  if (!best) {
    notes.push("Could not detect a date/week column automatically. Showing the first row as 'current'.");
    return { row: rows[0], notes };
  }

  return { row: rows[best.idx], dateColumnUsed: best.col, notes };
}

