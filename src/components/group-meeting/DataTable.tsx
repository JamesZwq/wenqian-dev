"use client";

import { useMemo, useState } from "react";
import { pinyinToHanziSync } from "@/lib/meeting/pinyinToHanzi";

type Props = {
  headers: string[];
  rows: Record<string, string>[];
};

function guess(headers: string[], pattern: RegExp) {
  return headers.find((h) => pattern.test(h));
}

export function DataTable({ headers, rows }: Props) {
  const [q, setQ] = useState("");

  const cols = useMemo(() => {
    const dateCol = guess(headers, /(date|week|meeting|session|日期|时间)/i) ?? "";
    const timeCol = guess(headers, /(time|开始|start)/i) ?? "";
    const nameCol = guess(headers, /^(name|presenter|speaker)$/i) || guess(headers, /name/i) || "";
    const titleCol = guess(headers, /title/i) ?? "";
    const venueCol = guess(headers, /(venue|conf|conference)/i) ?? "";
    const fromCol = guess(headers, /(from|affiliation|institution|university|org)/i) ?? "";
    const areaCol = guess(headers, /area/i) ?? "";
    return { dateCol, timeCol, nameCol, titleCol, venueCol, fromCol, areaCol };
  }, [headers]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((r) =>
      headers.some((h) => (r[h] ?? "").toLowerCase().includes(query)),
    );
  }, [q, rows, headers]);

  const grouped = useMemo(() => {
    const map = new Map<string, Record<string, string>[]>();
    for (const r of filtered) {
      const label = (cols.dateCol && r[cols.dateCol]) ? r[cols.dateCol].trim() : "(未标日期)";
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(r);
    }
    return Array.from(map.entries());
  }, [filtered, cols.dateCol]);

  return (
    <div className="card dtCard" style={{ gap: 10, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexShrink: 0 }}>
        <h2 style={{ margin: 0 }}>Roster</h2>
        <span className="small">{filtered.length} / {rows.length}</span>
      </div>

      <input
        className="input"
        placeholder="搜索 presenter / title / venue..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ flexShrink: 0 }}
      />

      <div className="dtScroll" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {grouped.map(([label, items]) => (
          <div key={label} style={{ border: "1px solid var(--gm-border)", borderRadius: 12, padding: 10, background: "var(--gm-card-veil)" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontWeight: 650 }}>{label || "(未标日期)"}</div>
              <div className="small">{items.length} 人</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {items.map((r, idx) => {
                const name = cols.nameCol ? (r[cols.nameCol] ?? "").trim() : "";
                const nameDisplay = name ? pinyinToHanziSync(name) : "";
                const title = cols.titleCol ? (r[cols.titleCol] ?? "").trim() : "";
                const venue = cols.venueCol ? (r[cols.venueCol] ?? "").trim() : "";
                const from = cols.fromCol ? (r[cols.fromCol] ?? "").trim() : "";
                const area = cols.areaCol ? (r[cols.areaCol] ?? "").trim() : "";
                const time = cols.timeCol ? (r[cols.timeCol] ?? "").trim() : "";
                const lineParts = nameDisplay ? [nameDisplay + (nameDisplay !== name ? ` (${name})` : ""), title] : [name, title];
                const line = lineParts.filter(Boolean).join(" · ") || "(信息缺失)";
                const meta = [area, venue, from, time].filter(Boolean).join(" · ");
                return (
                  <div key={idx} style={{ padding: "6px 8px", borderRadius: 10, background: "var(--gm-card)" }}>
                    <div style={{ fontWeight: 600, color: "var(--gm-text)" }}>{line}</div>
                    {meta && <div className="small" style={{ marginTop: 2 }}>{meta}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {grouped.length === 0 && (
          <div className="small" style={{ color: "var(--gm-muted)" }}>没有匹配的记录。</div>
        )}
      </div>
    </div>
  );
}

