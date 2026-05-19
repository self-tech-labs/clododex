"use client";

import React from "react";
import { BaseFighter } from "./sprites.jsx";

/* Roster — two team panels of fighter cards + selected fighter detail */

function FighterCard({ fighter, side, selected, onClick, variant }) {
  return (
    <button
      type="button"
      className={`fighter ${side} ${selected ? "selected" : ""}`}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`Select ${fighter.name} ${fighter.surname}`}
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

function FighterDetail({ fighter, side }) {
  if (!fighter) return null;
  return (
    <div className={`fighter-detail ${side}`}>
      <span className="label">DOSSIER · {fighter.name} {fighter.surname}</span>
      <div>{fighter.lore}</div>
      <span className="label">SPECIAL MOVE</span>
      <div className="special">{fighter.special}</div>
      <div className="combo">
        {fighter.combo.map((k, i) => (
          <React.Fragment key={i}>
            <span className="key">{k}</span>
            {i < fighter.combo.length - 1 && <span className="plus">+</span>}
          </React.Fragment>
        ))}
      </div>
      <span className="label">THREAT INDEX · LAST SEEN</span>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{fighter.threatScore} / 100</span>
        <span>{fighter.lastActivity} ago</span>
      </div>
    </div>
  );
}

export function TeamPanel({ team, side, teamLabel }) {
  const [selectedId, setSelectedId] = React.useState(team[0].id);
  const sel = team.find((f) => f.id === selectedId);
  return (
    <div className="team-col">
      <div className={`team-header ${side}`}>
        <span>{teamLabel}</span>
        <span className="roster-count">{team.length} fighters · {team.filter(f=>f.lastActivity.endsWith("h")||f.lastActivity.endsWith("m")).length} active</span>
      </div>
      <div className="fighter-grid">
        {team.map((f, i) => (
          <FighterCard
            key={f.id}
            fighter={f}
            side={side}
            variant={i}
            selected={selectedId === f.id}
            onClick={() => setSelectedId(f.id)}
          />
        ))}
      </div>
      <FighterDetail fighter={sel} side={side} />
    </div>
  );
}
