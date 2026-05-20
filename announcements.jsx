/* Announcements timeline — power-moves ledger, side-by-side */

function SourceLinks({ urls }) {
  const evidenceUrls = Array.isArray(urls) ? urls.filter((url) => typeof url === "string" && url.startsWith("http")) : [];
  if (!evidenceUrls.length) return null;

  return (
    <div className="move-evidence">
      {evidenceUrls.slice(0, 3).map((url, index) => (
        <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer">
          source {index + 1}
        </a>
      ))}
    </div>
  );
}

function MoveCell({ move, side }) {
  if (!move) return <div className={`tl-cell empty`}></div>;
  return (
    <div className={`tl-cell ${side}`}>
      <span className="move-tag">{move.tag}</span>
      <div>{move.title}</div>
      <span className="impact">→ {move.impact}</span>
      {move.rationale && (
        <details className="score-why move-why">
          <summary>WHY?</summary>
          <p>{move.rationale}</p>
          {typeof move.confidence === "number" && <span>CONF {Math.round(move.confidence * 100)}%</span>}
          <SourceLinks urls={move.evidenceUrls} />
        </details>
      )}
    </div>
  );
}

export function AnnouncementTimeline({ rows }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <span>POWER MOVES · 30-DAY LEDGER</span>
        <span style={{ display: "flex", gap: 16, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.06em" }}>
          <span style={{ color: "var(--c1-bright)" }}>● CLAUDE</span>
          <span style={{ color: "var(--c2-bright)" }}>● CODEX</span>
        </span>
      </div>
      <div className="timeline">
        <div className="tl-row" style={{ borderBottom: "1px solid var(--grid-strong)", paddingBottom: 8 }}>
          <div className="tl-date">WHEN</div>
          <div style={{ fontFamily: "var(--font-pixel)", fontSize: 9, color: "var(--c1-bright)", letterSpacing: "0.14em", padding: "4px 12px" }}>← CLAUDE</div>
          <div style={{ fontFamily: "var(--font-pixel)", fontSize: 9, color: "var(--c2-bright)", letterSpacing: "0.14em", padding: "4px 12px" }}>CODEX →</div>
        </div>
        {rows.map((row, i) => (
          <div className="tl-row" key={i}>
            <div className="tl-date">{row.date}</div>
            <MoveCell move={row.c1} side="c1" />
            <MoveCell move={row.c2} side="c2" />
          </div>
        ))}
      </div>
    </div>
  );
}
