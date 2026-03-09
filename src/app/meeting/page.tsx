import { DataTable } from "@/components/meeting/DataTable";
import { CopyToolkit } from "@/components/meeting/CopyToolkit";
import {
  fetchSheetCsv,
  parseCsvToTable,
  pickUpcomingRow,
  tryParseDate,
} from "@/lib/meeting/sheets";

export const dynamic = "force-dynamic";
export const runtime = "edge";

type Payload = {
  headers: string[];
  rows: Record<string, string>[];
  fetchedAtIso: string;
  source: { sheetId: string; gid: string; url: string };
  notes?: string[];
};

function env(name: string, fallback?: string) {
  const v = process.env[name] ?? fallback;
  if (v == null || v === "") throw new Error(`Missing env: ${name}`);
  return v;
}

async function getRoster(): Promise<Payload> {
  const sheetId = env("SHEET_ID");
  const gid = env("SHEET_GID");
  const revalidateSeconds =
    Number(process.env.SHEET_REVALIDATE_SECONDS ?? "60") || 60;

  const { csvText, url, notes: fetchNotes } =
    await fetchSheetCsv({ sheetId, gid, revalidateSeconds });
  const { headers, rows, notes: parseNotes } =
    parseCsvToTable(csvText);

  return {
    headers,
    rows,
    fetchedAtIso: new Date().toISOString(),
    source: { sheetId, gid, url },
    notes: [...fetchNotes, ...parseNotes],
  };
}

function detectDateColumn(headers: string[], preferredDateColumn?: string) {
  const preferred = preferredDateColumn?.trim();
  if (preferred && headers.includes(preferred)) return preferred;
  return (
    headers.find((h) => /(date|week|meeting|session|时间|日期)/i.test(h)) ||
    ""
  );
}

function pickRecentDates(args: {
  rows: Record<string, string>[];
  dateColumn: string;
  maxDates: number;
}) {
  const { rows, dateColumn, maxDates } = args;
  if (!dateColumn) return { labels: [], rows: rows.slice(0, maxDates * 5) };

  const groups = new Map<string, { rows: Record<string, string>[]; parsed: number | null }>();

  for (const r of rows) {
    const label = (r[dateColumn] ?? "").trim();
    if (!label) continue;
    const parsed = tryParseDate(label);
    const g = groups.get(label);
    if (g) {
      g.rows.push(r);
      if (g.parsed == null && parsed != null) g.parsed = parsed;
    } else {
      groups.set(label, { rows: [r], parsed });
    }
  }

  const sorted = Array.from(groups.entries())
    .sort((a, b) => {
      const pa = a[1].parsed ?? Number.NEGATIVE_INFINITY;
      const pb = b[1].parsed ?? Number.NEGATIVE_INFINITY;
      if (Number.isFinite(pa) || Number.isFinite(pb)) return pb - pa;
      return b[0].localeCompare(a[0]);
    })
    .map(([label]) => label);

  const labels = sorted.slice(0, maxDates);
  if (labels.length === 0) return { labels: [], rows: rows.slice(0, maxDates * 5) };
  const limitedRows = labels.flatMap((l) => groups.get(l)?.rows ?? []);
  return { labels, rows: limitedRows };
}

function buildCopyMessage(params: {
  rows: Record<string, string>[];
  areaCol?: string;
  nameCol?: string;
  titleCol?: string;
  venueCol?: string;
  fromCol?: string;
}) {
  const { rows, areaCol = "", nameCol = "", titleCol = "", venueCol = "", fromCol = "" } = params;
  const prefix = "各位老师好，下面是明天要讲的 paper，请各位老师如果有想要点评的，请及时认领。";

  const lines = rows.map((r, i) => {
    const area = areaCol && r[areaCol] ? r[areaCol].trim() : "";
    const name = nameCol && r[nameCol] ? r[nameCol].trim() : "";
    const title = titleCol && r[titleCol] ? r[titleCol].trim() : "";
    const venue = venueCol && r[venueCol] ? r[venueCol].trim() : "";
    const from = fromCol && r[fromCol] ? r[fromCol].trim() : "";

    const parts = [
      area ? `${area}, ` : "",
      name ? `${name}. ` : "",
      title ? `${title}. ` : "",
      venue ? `${venue}` : "",
      from ? `${venue ? ", " : ""}${from}` : "",
    ]
      .join("")
      .replace(/\s+/g, " ")
      .trim();

    return `${i + 1}. ${parts || "(信息缺失)"}`;
  });

  return [prefix, ...lines].join("\n\n");
}

export default async function MeetingPage() {
  const data = await getRoster();
  const sheetLink = `https://docs.google.com/spreadsheets/d/${data.source.sheetId}/edit?gid=${data.source.gid}#gid=${data.source.gid}`;
  const preferredDateColumn = process.env.DATE_COLUMN ?? "";

  const dateColumn = detectDateColumn(data.headers, preferredDateColumn);
  const upcoming = pickUpcomingRow({
    headers: data.headers,
    rows: data.rows,
    preferredDateColumn,
  });
  const dateCol = upcoming.dateColumnUsed || dateColumn;
  const meetingLabel =
    dateCol && upcoming.row
      ? (upcoming.row[dateCol] ?? "").trim()
      : "";
  const meetingRows =
    dateCol && meetingLabel
      ? data.rows.filter(
          (r) => (r[dateCol] ?? "").trim() === meetingLabel,
        )
      : upcoming.row
        ? [upcoming.row]
        : [];

  function guessCol(pattern: RegExp) {
    return data.headers.find((h) => pattern.test(h)) ?? "";
  }
  const areaCol = guessCol(/area/i);
  const nameCol =
    guessCol(/^(name|presenter|speaker)$/i) ||
    guessCol(/name/i);
  const titleCol = guessCol(/title/i);
  const venueCol = guessCol(/venue|conf|conference/i);
  const fromCol = guessCol(
    /from|affiliation|institution|university|org/i,
  );

  const timeCol = guessCol(/time|开始|start/i);

  const meetingRowsSummary =
    meetingRows.length === 0
      ? "(No meeting rows detected.)"
      : meetingRows
          .map((r, i) => {
            const name =
              nameCol && r[nameCol] ? r[nameCol].trim() : "";
            const area =
              areaCol && r[areaCol] ? r[areaCol].trim() : "";
            const title =
              titleCol && r[titleCol] ? r[titleCol].trim() : "";
            const venue =
              venueCol && r[venueCol] ? r[venueCol].trim() : "";
            const from =
              fromCol && r[fromCol] ? r[fromCol].trim() : "";
            const parts = [
              area ? `${area}` : "",
              name ? `Name: ${name}` : "Name: (missing)",
              title ? `Title: ${title}` : "Title: (missing)",
              venue ? `Venue: ${venue}` : "Venue: (missing)",
              from ? `From: ${from}` : "From: (missing)",
            ];
            return `P${i + 1}\n${parts
              .map((p) => `  ${p}`)
              .join("\n")}`;
          })
          .join("\n\n");

  const reviewersMessage = ""; // not used but kept for prop compatibility
  const reminderMessage = ""; // not used but kept for prop compatibility

  const rawTsv =
    meetingRows.length === 0
      ? ""
      : [
          data.headers.join("\t"),
          ...meetingRows.map((r) =>
            data.headers
              .map((h) =>
                (r[h] ?? "")
                  .replace(/\s+/g, " ")
                  .trim(),
              )
              .join("\t"),
          ),
        ].join("\n");

  const recent = pickRecentDates({ rows: data.rows, dateColumn: dateCol || "", maxDates: 3 });

  const copyMessage = buildCopyMessage({
    rows: meetingRows.slice(0, 3),
    areaCol,
    nameCol,
    titleCol,
    venueCol,
    fromCol,
  });

  const nextMeetingDisplay = [
    meetingLabel,
    timeCol && upcoming.row ? (upcoming.row[timeCol] ?? "").trim() : "",
  ]
    .filter(Boolean)
    .join(" / ") || "(未识别)";

  const today = new Date();
  const todayStr = today.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const hasData = data.rows.length > 0;

  return (
    <main className="container viewport">
      <div className="pageHeader">
        <h1 className="h1">组会管理面板</h1>
        <p className="sub">只保留最近 3 个日期的 roster 表和复制区。</p>
      </div>

      <div className="pageBody" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="card">
          <h2>概览</h2>
          <div className="kv">
            <div className="k">当前日期</div>
            <div className="v">{todayStr}</div>

            <div className="k">下一个 Meeting</div>
            <div className="v">{nextMeetingDisplay}</div>

            <div className="k">展示的日期</div>
            <div className="v">{recent.labels.length ? recent.labels.join(" / ") : "(未识别日期列)"}</div>

            <div className="k">数据源</div>
            <div className="v">
              <a href={sheetLink} target="_blank" rel="noreferrer">Sheet</a> · {" "}
              <a href={data.source.url} target="_blank" rel="noreferrer">CSV</a>
            </div>
          </div>
        </div>

        {!hasData && (
          <div className="card" style={{ borderColor: "rgba(255,107,107,0.35)", background: "color-mix(in srgb, var(--gm-card-veil) 80%, #ff6b6b 8%)" }}>
            <h2>⚠️ 数据为空</h2>
            <div className="small" style={{ marginBottom: 6 }}>
              未能从 Google Sheet 读取到任何行。请确认：
            </div>
            <ul className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
              <li>Sheet 需要对“拥有链接的任何人”开放只读，或使用 “发布到网络” 导出。</li>
              <li>无需登录即可访问 <a href={data.source.url} target="_blank" rel="noreferrer">CSV 导出链接</a>。</li>
              <li>如仍为空，检查环境变量 SHEET_ID / SHEET_GID 是否与当前 Sheet 对应。</li>
            </ul>
            {data.notes?.length ? (
              <div className="small" style={{ marginTop: 8 }}>
                调试信息：
                <ul style={{ margin: 6, paddingLeft: 18 }}>
                  {data.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        <div className="row">
          <section className="colScroll" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <CopyToolkit
              sheetLink={sheetLink}
              csvUrl={data.source.url}
              meetingLabel={meetingLabel || (dateCol ? `col:${dateCol}` : "")}
              meetingRowsSummary={meetingRowsSummary}
              reviewersMessage={reviewersMessage}
              reminderMessage={reminderMessage}
              rawTsv={rawTsv}
              blocksOverride={[{
                id: "agenda",
                title: "评委群：明日讲稿通知",
                description: `自动生成，基于 ${meetingLabel || "未识别日期"} 的前 ${Math.min(meetingRows.length, 3) || 0} 行，可手动调整后复制。`,
                initialText: copyMessage,
              }]}
            />
          </section>

          <section className="colRight">
            <DataTable headers={data.headers} rows={recent.rows} />
          </section>
        </div>
      </div>
    </main>
  );
}

