"use client";

import React from "react";

function SourceLinks({ urls }) {
  const evidenceUrls = Array.isArray(urls) ? urls.filter((url) => typeof url === "string" && url.startsWith("http")) : [];
  if (!evidenceUrls.length) return null;

  return (
    <div className="fatality-evidence">
      <span>SOURCES</span>
      {evidenceUrls.slice(0, 4).map((url, index) => (
        <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer">
          source {index + 1}
        </a>
      ))}
    </div>
  );
}

function FatalityCard({ contender }) {
  const fatalities = Array.isArray(contender?.fatalities) ? contender.fatalities : [];
  const [selectedId, setSelectedId] = React.useState(null);
  const selected = fatalities.find((fatality) => fatality.id === selectedId) ?? fatalities[0];
  const side = contender?.side || "c1";

  if (!selected) {
    return null;
  }

  return (
    <section className={`fatality-card ${side}`}>
      <div className="fatality-card-head">
        <span>{contender?.teamLabel || contender?.name || "TEAM"}</span>
        <strong>{Math.round((selected.confidence || 0) * 100)}% CONF</strong>
      </div>
      <div className="fatality-picker" aria-label={`${contender?.name || "team"} fatalities`}>
        {fatalities.map((fatality) => (
          <button
            key={fatality.id}
            type="button"
            className={fatality.id === selected.id ? "active" : ""}
            onClick={() => setSelectedId(fatality.id)}
          >
            {fatality.title}
          </button>
        ))}
      </div>
      <article className="fatality-detail">
        <div className="fatality-kicker">HIDDEN WEAPON · {selected.type || "fact"}</div>
        <h3>{selected.title}</h3>
        {selected.subtitle && <p className="fatality-subtitle">{selected.subtitle}</p>}
        <dl>
          <div>
            <dt>UNLOCK</dt>
            <dd>{selected.unlockTrigger}</dd>
          </div>
          <div>
            <dt>ARENA EFFECT</dt>
            <dd>{selected.arenaEffect}</dd>
          </div>
        </dl>
        {Array.isArray(selected.tags) && selected.tags.length > 0 && (
          <div className="fatality-tags">
            {selected.tags.slice(0, 4).map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        )}
        <SourceLinks urls={selected.evidenceUrls} />
      </article>
    </section>
  );
}

export function FatalitiesPanel({ contenders = [] }) {
  const visible = contenders.filter((contender) => ["c1", "c2"].includes(contender.side));
  if (!visible.some((contender) => Array.isArray(contender.fatalities) && contender.fatalities.length)) {
    return null;
  }

  return (
    <div className="fatalities-grid">
      {visible.map((contender) => (
        <FatalityCard key={contender.id} contender={contender} />
      ))}
    </div>
  );
}
