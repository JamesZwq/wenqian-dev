export function StatusBanner({ notes }: { notes?: string[] }) {
  if (!notes || notes.length === 0) {
    return (
      <div>
        <span className="badge good">OK</span>
        <span className="small">Sheet loaded.</span>
      </div>
    );
  }

  const hasAuthIssue = notes.some(
    (n) =>
      n.toLowerCase().includes("not accessible without auth") ||
      n.toLowerCase().includes("publish"),
  );

  return (
    <div>
      <span className={"badge " + (hasAuthIssue ? "warn" : "bad")}>
        {hasAuthIssue ? "Needs access setting" : "Warning"}
      </span>
      <div className="small" style={{ marginTop: 8 }}>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {notes.slice(0, 6).map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

