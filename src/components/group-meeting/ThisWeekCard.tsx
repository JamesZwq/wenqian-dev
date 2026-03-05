import { pickUpcomingRow } from "@/lib/meeting/sheets";

export function ThisWeekCard(props: {
  headers: string[];
  rows: Record<string, string>[];
  preferredDateColumn?: string;
}) {
  const { row, dateColumnUsed, notes } = pickUpcomingRow({
    headers: props.headers,
    rows: props.rows,
    preferredDateColumn: props.preferredDateColumn,
  });

  const hasRow = !!row;

  return (
    <div className="card">
      <h2>Current / Upcoming Meeting (Auto)</h2>

      {!hasRow ? (
        <div className="small">No data.</div>
      ) : (
        <>
          <div style={{ marginBottom: 10 }}>
            <span className="badge good">Read-only</span>
            {dateColumnUsed ? (
              <span className="badge">date col: {dateColumnUsed}</span>
            ) : (
              <span className="badge warn">date col: unknown</span>
            )}
          </div>

          <div className="kv">
            {Object.entries(row!)
              .filter(([, v]) => (v ?? "").trim() !== "")
              .slice(0, 18)
              .map(([k, v]) => (
                <div key={k} style={{ display: "contents" }}>
                  <div className="k">{k}</div>
                  <div className="v">{v}</div>
                </div>
              ))}
          </div>

          {notes.length > 0 && (
            <>
              <hr />
              <div className="small">
                <span className="badge warn">Heuristic</span>
                {notes.join(" ")}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

