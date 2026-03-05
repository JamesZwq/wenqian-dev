"use client";

import { useEffect, useMemo, useState } from "react";

type CopyBlock = {
  id: string;
  title: string;
  description?: string;
  initialText: string;
};

function useCopy() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(
        () => setCopiedId((x) => (x === id ? null : x)),
        1200,
      );
    } catch {
      setCopiedId("__failed__");
      setTimeout(() => setCopiedId(null), 1200);
    }
  }

  return { copiedId, copy };
}

export function CopyToolkit(props: {
  sheetLink: string;
  csvUrl: string;
  meetingLabel: string;
  meetingRowsSummary: string;
  reviewersMessage: string;
  reminderMessage: string;
  rawTsv: string;
  blocksOverride?: CopyBlock[];
}) {
  const { copiedId, copy } = useCopy();

  const blocks: CopyBlock[] = useMemo(
    () =>
      props.blocksOverride ?? [
        {
          id: "reviewers",
          title: "评委群：本周 Presenters 信息（可编辑后复制）",
          description:
            "默认用同一日期（Meeting）下的所有行拼出来。你可以在这里微调措辞。",
          initialText: props.reviewersMessage,
        },
        {
          id: "reminder",
          title: "评委群：10/11 点催认领（可编辑后复制）",
          initialText: props.reminderMessage,
        },
        {
          id: "summary",
          title: "本周 Meeting 汇总（纯文本）",
          initialText: props.meetingRowsSummary,
        },
        {
          id: "tsv",
          title: "本周相关行（TSV，适合粘到表格/消息里）",
          initialText: props.rawTsv,
        },
        {
          id: "links",
          title: "Links",
          initialText: `Sheet: ${props.sheetLink}\nCSV: ${props.csvUrl}`,
        },
      ],
    [props],
  );

  const [textMap, setTextMap] = useState<Record<string, string>>(
    Object.fromEntries(blocks.map((b) => [b.id, b.initialText])),
  );

  useEffect(() => {
    setTextMap(Object.fromEntries(blocks.map((b) => [b.id, b.initialText])));
  }, [blocks]);

  return (
    <div className="card">
      <h2>Copy Center</h2>
      <div className="small" style={{ marginBottom: 10 }}>
        目标：把你常用的“可复制内容”集中在这里。当前 Meeting：
        <span className="code">
          {props.meetingLabel || "(unknown)"}
        </span>
      </div>

      <div
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        {blocks.map((b) => (
          <div
            key={b.id}
            style={{
              border: "1px solid rgba(28,36,64,0.65)",
              borderRadius: 12,
              padding: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 650,
                  }}
                >
                  {b.title}
                </div>
                {b.description && (
                  <div
                    className="small"
                    style={{ marginTop: 4 }}
                  >
                    {b.description}
                  </div>
                )}
              </div>
              <button
                className="btn primary"
                onClick={() => copy(b.id, textMap[b.id] ?? "")}
                title="Copy to clipboard"
              >
                {copiedId === b.id ? "Copied" : "Copy"}
              </button>
            </div>

            <div style={{ height: 8 }} />
            <textarea
              className="textarea"
              rows={b.id === "tsv" ? 6 : 5}
              value={textMap[b.id] ?? ""}
              onChange={(e) =>
                setTextMap((m) => ({
                  ...m,
                  [b.id]: e.target.value,
                }))
              }
            />
          </div>
        ))}
      </div>

      {copiedId === "__failed__" && (
        <div
          className="small"
          style={{
            marginTop: 10,
            color: "var(--warn)",
          }}
        >
          复制失败（浏览器权限限制）。你可以手动全选 textarea 内容复制。
        </div>
      )}
    </div>
  );
}

