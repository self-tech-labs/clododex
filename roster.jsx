"use client";

import React from "react";
import { BaseFighter } from "./sprites.jsx";

/* Roster — two team panels of fighter cards + full dossier drawer */

function FighterCard({ fighter, side, selected, drawerOpen, onClick, variant }) {
  return (
    <button
      type="button"
      className={`fighter ${side} ${selected ? "selected" : ""}`}
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={drawerOpen}
      aria-label={`Open dossier for ${fighter.name} ${fighter.surname}`}
    >
      <div className="fighter-portrait">
        <div className="pixel-bg"></div>
        <div className="fighter-sprite">
          <BaseFighter side={side} variant={variant} />
        </div>
      </div>
      <div className="fighter-meta">
        <div className="fighter-class">{fighter.cls}</div>
        <div className="fighter-name">
          {fighter.name} {fighter.surname}
        </div>
        <div className="fighter-handle">{fighter.handle}</div>
        <div className="stat-row">
          <span className="stat-name">ATK</span>
          <span className="stat-bar"><span className="stat-fill" style={{ width: fighter.stats.ATK + "%" }} /></span>
          <span className="stat-val">{fighter.stats.ATK}</span>
        </div>
        <div className="stat-row">
          <span className="stat-name">DEF</span>
          <span className="stat-bar"><span className="stat-fill" style={{ width: fighter.stats.DEF + "%" }} /></span>
          <span className="stat-val">{fighter.stats.DEF}</span>
        </div>
        <div className="stat-row">
          <span className="stat-name">SPD</span>
          <span className="stat-bar"><span className="stat-fill" style={{ width: fighter.stats.SPD + "%" }} /></span>
          <span className="stat-val">{fighter.stats.SPD}</span>
        </div>
        <div className="stat-row">
          <span className="stat-name">CMB</span>
          <span className="stat-bar"><span className="stat-fill" style={{ width: fighter.stats.COMBO + "%" }} /></span>
          <span className="stat-val">{fighter.stats.COMBO}</span>
        </div>
      </div>
    </button>
  );
}

function SourceLinks({ urls }) {
  const evidenceUrls = Array.isArray(urls) ? urls.filter((url) => typeof url === "string" && url.startsWith("http")) : [];
  if (!evidenceUrls.length) return null;

  return (
    <div className="dossier-evidence">
      <span>EVIDENCE</span>
      {evidenceUrls.slice(0, 4).map((url, index) => (
        <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer">
          source {index + 1}
        </a>
      ))}
    </div>
  );
}

function ScoreLogic({ fighter }) {
  const stats = fighter?.scoreRationale?.stats || {};
  const threat = fighter?.scoreRationale?.threatScore;
  const rows = ["ATK", "DEF", "SPD", "COMBO", "HP"].filter((stat) => stats[stat]?.rationale);
  if (!rows.length && !threat?.rationale) return null;

  return (
    <section className="dossier-section score-logic">
      <h3>WHY THIS SCORE?</h3>
      <details>
        <summary>RUBRIC LOG</summary>
        <div className="score-logic-grid">
          {rows.map((stat) => (
            <article key={stat} className="score-logic-entry">
              <div className="score-logic-head">
                <strong>{stat}</strong>
                <span>{fighter.stats?.[stat]}</span>
              </div>
              <p>{stats[stat].rationale}</p>
              {typeof stats[stat].confidence === "number" && <span className="dossier-conf">CONF {Math.round(stats[stat].confidence * 100)}%</span>}
              <SourceLinks urls={stats[stat].evidenceUrls} />
            </article>
          ))}
          {threat?.rationale && (
            <article className="score-logic-entry threat">
              <div className="score-logic-head">
                <strong>THREAT</strong>
                <span>{fighter.threatScore}</span>
              </div>
              <p>{threat.rationale}</p>
              {typeof threat.confidence === "number" && <span className="dossier-conf">CONF {Math.round(threat.confidence * 100)}%</span>}
              <SourceLinks urls={threat.evidenceUrls} />
            </article>
          )}
        </div>
      </details>
    </section>
  );
}

function CharacterDossierDrawer({ fighter, side, open, onClose }) {
  const titleId = React.useId();
  const closeRef = React.useRef(null);
  const dossier = fighter?.dossier;
  const background = Array.isArray(dossier?.background) ? dossier.background : [];
  const keyProjects = Array.isArray(dossier?.keyProjects) ? dossier.keyProjects : [];
  const strengths = Array.isArray(dossier?.strengths) ? dossier.strengths : [];
  const sourceUrls = Array.isArray(dossier?.sourceUrls) ? dossier.sourceUrls : [];

  React.useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!open || !fighter) return null;

  return (
    <div className="dossier-overlay">
      <button type="button" className="dossier-backdrop" aria-label="Close dossier" onClick={onClose} />
      <aside className={`dossier-drawer ${side}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="dossier-topline">
          <span>CHARACTER DOSSIER</span>
          <button ref={closeRef} type="button" className="dossier-close" onClick={onClose}>
            CLOSE
          </button>
        </div>

        <header className="dossier-hero">
          <div>
            <div className="dossier-class">{fighter.cls}</div>
            <h2 id={titleId}>{fighter.name} {fighter.surname}</h2>
            <div className="dossier-handle">{fighter.handle}</div>
          </div>
          <div className="dossier-score">
            <span>THREAT</span>
            <strong>{fighter.threatScore}</strong>
          </div>
        </header>

        <p className="dossier-tagline">{dossier?.tagline || fighter.lore}</p>

        <ScoreLogic fighter={fighter} />

        <section className="dossier-section">
          <h3>BACKGROUND</h3>
          {background.length ? (
            background.map((item, index) => (
              <article key={`${item.text}-${index}`} className="dossier-entry">
                <p>{item.text}</p>
                {typeof item.confidence === "number" && <span className="dossier-conf">CONF {Math.round(item.confidence * 100)}%</span>}
                <SourceLinks urls={item.evidenceUrls} />
              </article>
            ))
          ) : (
            <p className="dossier-empty">No sourced background has cleared the evidence gate yet.</p>
          )}
        </section>

        <section className="dossier-section">
          <h3>KEY PROJECTS</h3>
          {keyProjects.length ? (
            keyProjects.map((project, index) => (
              <article key={`${project.name}-${index}`} className="dossier-entry">
                <div className="dossier-entry-head">
                  <strong>{project.name}</strong>
                  {Array.isArray(project.tags) && project.tags.length > 0 && (
                    <span>{project.tags.slice(0, 3).join(" / ")}</span>
                  )}
                </div>
                <p>{project.description}</p>
                <SourceLinks urls={project.evidenceUrls} />
              </article>
            ))
          ) : (
            <p className="dossier-empty">No sourced projects have cleared the evidence gate yet.</p>
          )}
        </section>

        <section className="dossier-section">
          <h3>STRENGTHS</h3>
          {strengths.length ? (
            <div className="dossier-strengths">
              {strengths.map((strength, index) => (
                <article key={`${strength.label}-${index}`} className="dossier-strength">
                  <strong>{strength.label}</strong>
                  <p>{strength.description}</p>
                  <SourceLinks urls={strength.evidenceUrls} />
                </article>
              ))}
            </div>
          ) : (
            <p className="dossier-empty">No sourced strengths have cleared the evidence gate yet.</p>
          )}
        </section>

        {dossier?.narrative && (
          <section className="dossier-section narrative">
            <h3>{dossier.narrative.title}</h3>
            <p>{dossier.narrative.text}</p>
            <SourceLinks urls={dossier.narrative.evidenceUrls} />
          </section>
        )}

        <section className="dossier-section sources">
          <h3>SOURCES</h3>
          <SourceLinks urls={sourceUrls} />
          {dossier?.lastReviewedAt && <div className="dossier-reviewed">LAST REVIEWED · {dossier.lastReviewedAt}</div>}
        </section>
      </aside>
    </div>
  );
}

export function ContenderRoster({ contender, characters, side }) {
  const team = Array.isArray(characters) ? characters : [];
  const activeSide = side || contender?.side || "c1";
  const teamLabel = contender?.teamLabel || `TEAM ${(contender?.name || activeSide).toUpperCase()}`;
  const [selectedId, setSelectedId] = React.useState(team[0]?.id);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const sel = team.find((f) => f.id === selectedId) ?? team[0];

  if (!team.length) return null;

  return (
    <div className="team-col">
      <div className={`team-header ${activeSide}`}>
        <span>{teamLabel}</span>
        <span className="roster-count">{team.length} fighters · {team.filter((f) => String(f.lastActivity || "").endsWith("h") || String(f.lastActivity || "").endsWith("m")).length} active</span>
      </div>
      <div className="fighter-grid">
        {team.map((f, i) => (
          <FighterCard
            key={f.id}
            fighter={f}
            side={activeSide}
            variant={i}
            selected={sel?.id === f.id}
            drawerOpen={drawerOpen && sel?.id === f.id}
            onClick={() => {
              setSelectedId(f.id);
              setDrawerOpen(true);
            }}
          />
        ))}
      </div>
      <CharacterDossierDrawer fighter={sel} side={activeSide} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}

export function TeamPanel({ team, side, teamLabel }) {
  return <ContenderRoster characters={team} side={side} contender={{ side, teamLabel }} />;
}
