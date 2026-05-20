"use client";

import React from "react";

/* Top-of-page chrome: arcade bar, VS banner, power stats */

function SourceLinks({ urls }) {
  const evidenceUrls = Array.isArray(urls) ? urls.filter((url) => typeof url === "string" && url.startsWith("http")) : [];
  if (!evidenceUrls.length) return null;

  return (
    <div className="score-evidence">
      {evidenceUrls.slice(0, 3).map((url, index) => (
        <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer">
          src {index + 1}
        </a>
      ))}
    </div>
  );
}

function ScoreWhy({ left, right }) {
  if (!left?.rationale && !right?.rationale) return null;

  return (
    <details className="score-why">
      <summary>WHY THIS SCORE?</summary>
      <div className="score-why-grid">
        <div>
          <strong>CLAUDE</strong>
          <p>{left?.rationale || "No rationale recorded."}</p>
          {typeof left?.confidence === "number" && <span>CONF {Math.round(left.confidence * 100)}%</span>}
          <SourceLinks urls={left?.evidenceUrls} />
        </div>
        <div>
          <strong>CODEX</strong>
          <p>{right?.rationale || "No rationale recorded."}</p>
          {typeof right?.confidence === "number" && <span>CONF {Math.round(right.confidence * 100)}%</span>}
          <SourceLinks urls={right?.evidenceUrls} />
        </div>
      </div>
    </details>
  );
}

export function ArcadeBar({ round, credits, highScore }) {
  const [timeText, setTimeText] = React.useState("--:--:--");
  React.useEffect(() => {
    const id = setInterval(() => setTimeText(new Date().toISOString().substr(11, 8)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="arcade-bar">
      <div className="grp">
        <span className="credit">◆ CLAUDE vs CODEX</span>
        <span className="label">ARCADE</span>
        <span className="label">CREDITS</span><span className="high">{credits}</span>
        <span style={{ color: "var(--fg-mid)" }}>v0.1</span>
      </div>
      <div className="grp">
        <span className="blink">▶ INSERT COIN TO CHALLENGE</span>
      </div>
      <div className="grp">
        <span className="label">ROUND</span><span className="high">{round}</span>
        <span className="label">HI-SCORE</span><span className="score">{highScore.toLocaleString()}</span>
        <span className="label">SYS</span><span style={{ color: "var(--c2-bright)" }}>{timeText} UTC</span>
      </div>
    </div>
  );
}

export function VSBanner({ power, contenders = [] }) {
  const c1 = contenders.find((contender) => contender.side === "c1") ?? {
    name: "CLAUDE",
    organization: "ANTHROPIC",
    stance: "safety-first"
  };
  const c2 = contenders.find((contender) => contender.side === "c2") ?? {
    name: "CODEX",
    organization: "OPENAI",
    stance: "distribution-first"
  };
  // Build matchup meters: normalized comparison rows
  const rows = [
    { label: "MOMENT", c1: power.c1.momentum, c2: power.c2.momentum },
    { label: "MIND %", c1: power.c1.mindshare, c2: power.c2.mindshare, scale: 60 },
    { label: "ENT $$", c1: power.c1.enterprise, c2: power.c2.enterprise, scale: 60 },
    { label: "SHIPS",  c1: power.c1.ship,       c2: power.c2.ship, scale: 30 },
  ];
  return (
    <div className="vs-banner">
      <div className="vs-side">
        <span className="vs-tag c1">PLAYER 1 · {c1.stance?.toUpperCase() || "CONTENDER"}</span>
        <span className="vs-name c1">{c1.name?.toUpperCase()}</span>
        <span className="vs-org">{c1.organization?.toUpperCase()}</span>
        <span className="vs-stance">stance · {c1.stance || "unclassified"}</span>
        <div className="vs-meters" style={{ gridTemplateColumns: "1fr", marginTop: 18 }}>
          {rows.map((r, i) => {
            const max = r.scale || 100;
            return (
              <div className="meter" key={i}>
                <div className="meter-row">
                  <span className="meter-label">{r.label}</span>
                  <div className="meter-bar right">
                    <div className="meter-fill" style={{ width: Math.min(100, (r.c1/max)*100) + "%" }} />
                    <div className="ticks"></div>
                  </div>
                  <span className="meter-val right">{r.c1}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="vs-mark">VS</div>

      <div className="vs-side right">
        <span className="vs-tag c2">PLAYER 2 · {c2.stance?.toUpperCase() || "CONTENDER"}</span>
        <span className="vs-name c2">{c2.name?.toUpperCase()}</span>
        <span className="vs-org">{c2.organization?.toUpperCase()}</span>
        <span className="vs-stance">stance · {c2.stance || "unclassified"}</span>
        <div className="vs-meters" style={{ gridTemplateColumns: "1fr", marginTop: 18 }}>
          {rows.map((r, i) => {
            const max = r.scale || 100;
            return (
              <div className="meter" key={i}>
                <div className="meter-row">
                  <span className="meter-val c2">{r.c2}</span>
                  <div className="meter-bar">
                    <div className="meter-fill c2" style={{ width: Math.min(100, (r.c2/max)*100) + "%" }} />
                    <div className="ticks"></div>
                  </div>
                  <span className="meter-label" style={{ textAlign: "right" }}>{r.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function PowerStats({ power }) {
  const trends = power.trends || {};
  const rationale = power.rationale || {};
  const items = [
    { key: "momentum", label: "MOMENTUM Δ 7D", v1: power.c1.momentum, v2: power.c2.momentum, unit: "", trendC1: trends.c1?.momentum || "+0", trendC2: trends.c2?.momentum || "+0" },
    { key: "mindshare", label: "MINDSHARE %",   v1: power.c1.mindshare, v2: power.c2.mindshare, unit: "%", trendC1: trends.c1?.mindshare || "+0", trendC2: trends.c2?.mindshare || "+0" },
    { key: "enterprise", label: "ENT WINS QTD",  v1: power.c1.enterprise, v2: power.c2.enterprise, unit: "", trendC1: trends.c1?.enterprise || "+0", trendC2: trends.c2?.enterprise || "+0" },
    { key: "ship", label: "SHIPS / MO",    v1: power.c1.ship, v2: power.c2.ship, unit: "", trendC1: trends.c1?.ship || "+0", trendC2: trends.c2?.ship || "+0" },
  ];
  return (
    <div className="power-stats">
      {items.map((it, i) => (
        <div className="pstat" key={i}>
          <div className="pstat-label">{it.label}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <div>
              <span className="pstat-value c1">{it.v1}{it.unit}</span>
              <span className={"pstat-trend " + (it.trendC1.startsWith("-") ? "down" : "up")}>{it.trendC1}</span>
            </div>
            <div style={{ fontFamily: "var(--font-pixel)", color: "var(--fg-dim)", fontSize: 11 }}>VS</div>
            <div>
              <span className={"pstat-trend " + (it.trendC2.startsWith("-") ? "down" : "up")} style={{ marginLeft: 0, marginRight: 8 }}>{it.trendC2}</span>
              <span className="pstat-value c2">{it.v2}{it.unit}</span>
            </div>
          </div>
          <ScoreWhy left={rationale[it.key]?.c1} right={rationale[it.key]?.c2} />
        </div>
      ))}
    </div>
  );
}

export function StatusBar({ status, meta }) {
  const snapshotStatus = status || {};
  const generatedAt = meta?.generatedAt ? new Date(meta.generatedAt) : null;
  const generatedStamp = generatedAt && !Number.isNaN(generatedAt.getTime())
    ? generatedAt.toISOString().slice(11, 16) + " UTC"
    : "SEED";

  return (
    <div className="status-bar">
      <div className="grp">
        <span className={snapshotStatus.streamOk === false ? "bad" : "ok"}>
          {snapshotStatus.streamOk === false ? "● STREAM DEGRADED" : "● STREAM OK"}
        </span>
        <span className="stream">X / API · {snapshotStatus.xPostsToday || 0} posts</span>
        <span>WATCHLIST · {snapshotStatus.xAccounts || 0} accounts</span>
        <span>LISTS · {snapshotStatus.xLists || 0}</span>
        <span>SOURCES · {snapshotStatus.newsSources || 0}</span>
      </div>
      <div className="grp">
        <span>{meta?.dataMode || "fallback"} · {generatedStamp}</span>
        <span style={{ color: "var(--fg)" }}>PRESS START</span>
      </div>
    </div>
  );
}
