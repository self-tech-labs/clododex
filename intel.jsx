"use client";

import React from "react";

/* Intel feed — tweets w/ AI-generated strategic insight tags */

function confidenceLabel(confidence) {
  if (typeof confidence !== "number") return "CONF n/a";
  return `CONF ${Math.round(confidence * 100)}%`;
}

function generatedLabel(meta) {
  const generatedAt = meta?.generatedAt ? new Date(meta.generatedAt) : null;
  if (!generatedAt || Number.isNaN(generatedAt.getTime())) return "SNAPSHOT seed";
  return `SNAPSHOT ${generatedAt.toISOString().slice(5, 16).replace("T", " ")} UTC`;
}

function freshnessState(status, meta, now) {
  const snapshotStatus = status || {};
  const xPosts = Number(snapshotStatus.xPostsToday || 0);
  const generatedAt = meta?.generatedAt ? Date.parse(meta.generatedAt) : 0;
  const stale = generatedAt && now ? now - generatedAt > 36 * 60 * 60 * 1000 : false;
  const messages = [...(meta?.errors || []), ...(meta?.warnings || [])].filter(Boolean);
  const quotaIssue = messages.some((message) => /CreditsDepleted|402 Payment Required|problems\/credits/i.test(message));
  const degraded = snapshotStatus.streamOk === false || xPosts < 1 || stale || quotaIssue;
  let reason = "";

  if (quotaIssue) {
    reason = "X quota depleted";
  } else if (snapshotStatus.streamOk === false) {
    reason = "stream degraded";
  } else if (xPosts < 1) {
    reason = "no fresh X posts";
  } else if (stale) {
    reason = "snapshot older than 36h";
  }

  return {
    degraded,
    label: degraded ? "DEGRADED" : "LIVE",
    xPosts,
    reason
  };
}

function TweetRow({ tw }) {
  const evidenceUrls = Array.isArray(tw.evidenceUrls) ? tw.evidenceUrls : [];
  const tags = Array.isArray(tw.tags) ? tw.tags : [];

  return (
    <div className={`tweet ${tw.side}`}>
      <div className="side-bar"></div>
      <div className="body">
        <div className="meta-line">
          <span className="author">{tw.author}</span>
          <span className="handle">{tw.handle}</span>
          <span className={`evidence-type ${tw.type === "inference" ? "inference" : "fact"}`}>
            {tw.type === "inference" ? "INFERENCE" : "FACT"}
          </span>
          <span className="confidence">{confidenceLabel(tw.confidence)}</span>
          <span className="stamp">· {tw.stamp} ago</span>
        </div>
        <div className="text">{tw.text}</div>
        <div className="insight">
          <span className="insight-label">⚡ STRAT INSIGHT</span>
          {tw.insight}
        </div>
        {tw.impact && <div className="impact">TACTICAL READ · {tw.impact}</div>}
        {tw.rationale && (
          <details className="score-why signal-why">
            <summary>WHY SHOWN?</summary>
            <p>{tw.rationale}</p>
          </details>
        )}
        {evidenceUrls.length > 0 && (
          <div className="evidence">
            <span>EVIDENCE</span>
            {evidenceUrls.slice(0, 3).map((url, i) => (
              <a key={`${url}-${i}`} href={url} target="_blank" rel="noreferrer">
                {i === 0 ? "source" : `source ${i + 1}`}
              </a>
            ))}
          </div>
        )}
        <div className="tags">
          {tags.map((t, i) => (
            <span key={i} className={`tag ${t.t}`}>{t.l}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function IntelFeed({ tweets, signals, filter, setFilter, status, meta }) {
  const [now, setNow] = React.useState(null);
  const rows = Array.isArray(signals) ? signals : Array.isArray(tweets) ? tweets : [];
  const shown = rows.filter((t) =>
    filter === "all" ? true : t.side === filter
  );
  React.useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 60 * 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  const freshness = freshnessState(status, meta, now);
  return (
    <div className="panel">
      <div className="panel-head">
        <span>INTEL FEED · SIGNAL INTERCEPT</span>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            className={"filter-btn " + (filter === "all" ? "active" : "")}
            onClick={() => setFilter("all")}
          >ALL</button>
          <button
            className={"filter-btn c1 " + (filter === "c1" ? "active" : "")}
            onClick={() => setFilter("c1")}
          >CLAUDE</button>
          <button
            className={"filter-btn c2 " + (filter === "c2" ? "active" : "")}
            onClick={() => setFilter("c2")}
          >CODEX</button>
          <span className={"live " + (freshness.degraded ? "degraded" : "")}>{freshness.label}</span>
        </span>
      </div>
      <div className="intel-freshness">
        <span>{generatedLabel(meta)}</span>
        <span>X POSTS {freshness.xPosts}</span>
        {freshness.degraded && <span className="bad">DEGRADED · {freshness.reason}</span>}
      </div>
      <div>
        {shown.map((tw, i) => <TweetRow key={i} tw={tw} />)}
      </div>
    </div>
  );
}
