import { DataTable } from "@/components/DataTable";
import { CopyToolkit } from "@/components/CopyToolkit";
import { fetchSheetCsv, parseCsvToTable, pickUpcomingRow, tryParseDate } from "@/lib/sheets";

// Avoid build-time pre-rendering that could fail if env is not present during `next build`.
export const dynamic = "force-dynamic";

// Hardcoded Sheet source (Cloudflare 环境拿不到 .env 时使用)
const SHEET_ID = "18ffrZOqvPL7YS9pUcN18OIrEuIZ395yoTjPHWyFxjNI";
const SHEET_GID = "1602646240";
const SHEET_REVALIDATE_SECONDS = 60;

type Payload = {
  headers: string[];
  rows: Record<string, string>[];
  fetchedAtIso: string;
  source: { sheetId: string; gid: string; url: string };
  notes?: string[];
};

async function getRoster(): Promise<Payload> {
  const sheetId = SHEET_ID;
  const gid = SHEET_GID;
  const revalidateSeconds = SHEET_REVALIDATE_SECONDS;

  const { csvText, url, notes: fetchNotes } = await fetchSheetCsv({ sheetId, gid, revalidateSeconds });
  const { headers, rows, notes: parseNotes } = parseCsvToTable(csvText);

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
  return headers.find((h) => /(date|week|meeting|session|时间|日期)/i.test(h)) ?? "";
}

function pickRecentDates(args: { rows: Record<string, string>[]; dateColumn: string; maxDates: number }) {
  const { rows, dateColumn, maxDates } = args;
  if (!dateColumn) return { labels: [] as string[], rows: rows.slice(0, maxDates * 5) };

  const groups = new Map<string, { rows: Record<string, string>[]; parsed: number | null }>();

  for (const r of rows) {
    const label = (r[dateColumn] ?? "").trim();
    if (!label) continue;
    const parsed = tryParseDate(label);
    const current = groups.get(label);
    if (current) {
      current.rows.push(r);
      if (current.parsed == null && parsed != null) current.parsed = parsed;
    } else {
      groups.set(label, { rows: [r], parsed });
    }
  }

  const sortedLabels = Array.from(groups.entries())
    .sort((a, b) => {
      const pa = a[1].parsed ?? Number.NEGATIVE_INFINITY;
      const pb = b[1].parsed ?? Number.NEGATIVE_INFINITY;
      if (Number.isFinite(pa) || Number.isFinite(pb)) return pb - pa;
      return b[0].localeCompare(a[0]);
    })
    .map(([label]) => label);

  const labels = sortedLabels.slice(0, maxDates);
  const limitedRows = labels.flatMap((l) => groups.get(l)?.rows ?? []);
  if (labels.length === 0) return { labels: [], rows: rows.slice(0, maxDates * 5) };
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
    const area = (areaCol && r[areaCol]) ? r[areaCol].trim() : "";
    const name = (nameCol && r[nameCol]) ? r[nameCol].trim() : "";
    const title = (titleCol && r[titleCol]) ? r[titleCol].trim() : "";
    const venue = (venueCol && r[venueCol]) ? r[venueCol].trim() : "";
    const from = (fromCol && r[fromCol]) ? r[fromCol].trim() : "";

    const parts = [
      area ? `${area}, ` : "",
      name ? `${name}. ` : "",
      title ? `${title}. ` : "",
      venue ? `${venue}` : "",
      from ? `${venue ? ", " : ""}${from}` : "",
    ].join("").replace(/\s+/g, " ").trim();

    return `${i + 1}. ${parts || "(信息缺失)"}`;
  });

  return [prefix, ...lines].join("\n\n");
}

export default async function Page() {
  const data = await getRoster();
  const sheetLink = `https://docs.google.com/spreadsheets/d/${data.source.sheetId}/edit?gid=${data.source.gid}#gid=${data.source.gid}`;
  const preferredDateColumn = process.env.DATE_COLUMN ?? "";

  const dateColumn = detectDateColumn(data.headers, preferredDateColumn);
  const upcoming = pickUpcomingRow({ headers: data.headers, rows: data.rows, preferredDateColumn });

  const dateCol = upcoming.dateColumnUsed;
  const meetingLabel = (dateCol && upcoming.row) ? (upcoming.row[dateCol] ?? "").trim() : "";
  const meetingRows = (dateCol && meetingLabel)
    ? data.rows.filter(r => (r[dateCol] ?? "").trim() === meetingLabel)
    : (upcoming.row ? [upcoming.row] : []);

  function guessCol(pattern: RegExp) {
    return data.headers.find(h => pattern.test(h)) ?? "";
  }
  const areaCol = guessCol(/area/i);
  const nameCol = guessCol(/^(name|presenter|speaker)$/i) || guessCol(/name/i);
  const titleCol = guessCol(/title/i);
  const venueCol = guessCol(/venue|conf|conference/i);
  const fromCol = guessCol(/from|affiliation|institution|university|org/i);
  const timeCol = guessCol(/time|开始|start/i);

  const recent = pickRecentDates({ rows: data.rows, dateColumn: dateColumn || dateCol || "", maxDates: 3 });

  const copyMessage = buildCopyMessage({
    rows: meetingRows.slice(0, 3),
    areaCol,
    nameCol,
    titleCol,
    venueCol,
    fromCol,
  });

  const nextMeetingDisplay = [meetingLabel, timeCol && upcoming.row ? (upcoming.row[timeCol] ?? "").trim() : ""]
    .filter(Boolean)
    .join(" / ") || "(未识别)";

  const today = new Date();
  const todayStr = today.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });

  const meetingRowsSummary = meetingRows.length === 0
    ? "(No meeting rows detected.)"
    : meetingRows.map((r, i) => {
        const name = (nameCol && r[nameCol]) ? r[nameCol].trim() : "";
        const area = (areaCol && r[areaCol]) ? r[areaCol].trim() : "";
        const title = (titleCol && r[titleCol]) ? r[titleCol].trim() : "";
        const venue = (venueCol && r[venueCol]) ? r[venueCol].trim() : "";
        const from = (fromCol && r[fromCol]) ? r[fromCol].trim() : "";
        const parts = [
          area ? `${area}` : "",
          name ? `Name: ${name}` : "Name: (missing)",
          title ? `Title: ${title}` : "Title: (missing)",
          venue ? `Venue: ${venue}` : "Venue: (missing)",
          from ? `From: ${from}` : "From: (missing)",
        ];
        return `P${i + 1}\n${parts.map(p => `  ${p}`).join("\n")}`;
      }).join("\n\n");

  const reviewersMessage = [
    `【Group Meeting】Presenters (${meetingLabel || "TBD"}) 各位老师好, 下面是明天要讲的paper, 请各位老师如果想要点评的请及时认领.`,
    "",
    meetingRowsSummary,
    "",
    "请老师们认领点评：回复例如 ‘1’, ‘2’, ‘3’）。",
  ].join("\n");

  const reminderMessage = [
    `【Reminder】(${meetingLabel || "TBD"}) presenters 的点评认领还没齐，麻烦老师们回复认领：`,
    "例如：P1 main / P1 sub / P2 main / P2 sub / P3 main / P3 sub",
  ].join("\n");

  const rawTsv = meetingRows.length === 0
    ? ""
    : [
        data.headers.join("\t"),
        ...meetingRows.map(r => data.headers.map(h => (r[h] ?? "").replace(/\s+/g, " ").trim()).join("\t"))
      ].join("\n");

  return (
    <main className="container viewport">
      <div className="pageHeader">
        <h1 className="h1">组会管理面板</h1>
        <p className="sub">只保留最近 3 个日期的 roster 表和复制区域。</p>
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
            <div className="v"><a href={sheetLink} target="_blank" rel="noreferrer">Sheet</a> · <a href={data.source.url} target="_blank" rel="noreferrer">CSV</a></div>
          </div>
        </div>

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
                description: `自动生成，基于 ${meetingLabel || "未识别日期"} 的前 ${Math.min(meetingRows.length, 3) || 0} 行。可手动微调后复制。`,
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
