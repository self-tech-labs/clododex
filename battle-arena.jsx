"use client";

import React from "react";

import BattleConfig from "./data/arena/battle.json";
import Wildcards from "./data/arena/characters/wildcards.json";
import {
  createBattle,
  getActiveFighter,
  getAvailableAttacks,
  getCharacterName,
  pickCpuAttack,
  resolveClassicTurn
} from "./src/arena/battle/index.mjs";
import { BaseFighter } from "./sprites.jsx";

const SIDE_LABELS = {
  c1: "PLAYER 1",
  c2: "PLAYER 2"
};

const CONTROL_LABELS = {
  human: "Human",
  "cpu-random": "CPU Random"
};

const modeById = (id) => BattleConfig.modes.find((mode) => mode.id === id) ?? BattleConfig.modes[0];

const asNumberInput = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getLatestBattleCard = (battle) => {
  if (!battle) return null;
  if (battle.lastBattleCard) return battle.lastBattleCard;
  return [...(battle.log ?? [])].reverse().find((entry) => entry.metadata?.battleCard)?.metadata?.battleCard ?? null;
};

const qualityText = (qualities = []) => qualities.map((quality) => quality.label).filter(Boolean).join(" / ");

function TeamPicker({ side, team, selectedIds, max, disabled, onChange }) {
  const toggle = (fighterId) => {
    if (disabled) return;
    if (max === 1) {
      onChange([fighterId]);
      return;
    }
    if (selectedIds.includes(fighterId)) {
      if (selectedIds.length > 1) {
        onChange(selectedIds.filter((id) => id !== fighterId));
      }
      return;
    }
    if (selectedIds.length >= max) {
      onChange([...selectedIds.slice(1), fighterId]);
      return;
    }
    onChange([...selectedIds, fighterId]);
  };

  return (
    <div className={`battle-team-picker ${side} ${disabled ? "disabled" : ""}`}>
      <div className="battle-mini-head">
        <span>{SIDE_LABELS[side]}</span>
        <span>{disabled ? "RANDOM DRAW" : `${selectedIds.length}/${max} LOCKED`}</span>
      </div>
      <div className="battle-pick-grid">
        {team.map((fighter) => {
          const selected = selectedIds.includes(fighter.id);
          return (
            <button
              type="button"
              key={fighter.id}
              className={selected ? "selected" : ""}
              onClick={() => toggle(fighter.id)}
              disabled={disabled}
            >
              <span>{getCharacterName(fighter)}</span>
              <em>{fighter.cls}</em>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FighterPanel({ battle, side }) {
  const fighter = getActiveFighter(battle, side);
  if (!fighter) return null;
  const hp = asNumberInput(battle.hp?.[fighter.instanceId], fighter.maxHp);
  const maxHp = Math.max(1, asNumberInput(fighter.maxHp, 1));
  const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const shield = asNumberInput(battle.shields?.[side], 0);

  return (
    <div className={`battle-fighter-panel ${side} ${battle.turnSide === side ? "turn" : ""}`}>
      <div className="battle-fighter-top">
        <span>{SIDE_LABELS[side]}</span>
        <span>{battle.turnSide === side ? "TURN" : shield > 0 ? "GUARD" : "WAIT"}</span>
      </div>
      <div className="battle-fighter-body">
        <div className="battle-sprite-wrap">
          <BaseFighter side={side} variant={fighter.slot} />
        </div>
        <div className="battle-fighter-copy">
          <strong>{getCharacterName(fighter)}</strong>
          <span>{fighter.cls}</span>
          <em>{fighter.special}</em>
        </div>
      </div>
      <div className="battle-hp-row">
        <span>HP</span>
        <div className="battle-hp-bar">
          <div className="battle-hp-fill" style={{ width: `${hpPct}%` }} />
        </div>
        <span>{hp}</span>
      </div>
      {shield > 0 && <div className="battle-shield">SHIELD {Math.round(shield * 100)}%</div>}
    </div>
  );
}

function BenchRail({ battle, side }) {
  const activeIndex = asNumberInput(battle.activeIndex?.[side], 0);
  return (
    <div className={`battle-bench ${side}`}>
      {battle.teams[side].map((fighter, index) => {
        const hp = asNumberInput(battle.hp?.[fighter.instanceId], fighter.maxHp);
        const state = hp <= 0 ? "ko" : index === activeIndex ? "active" : "ready";
        return (
          <span key={fighter.instanceId} className={state}>
            {index + 1}. {getCharacterName(fighter).split(" ").slice(-1)[0]}
          </span>
        );
      })}
    </div>
  );
}

function BattleTranscript({ battle }) {
  if (!battle) return null;
  const rows = [...battle.log].reverse().slice(0, 10);
  return (
    <div className="battle-transcript">
      <div className="battle-mini-head">
        <span>ROUND LOG</span>
        <span>{battle.status === "complete" ? `${battle.winnerSide?.toUpperCase()} WINS` : `NEXT ${battle.turnSide.toUpperCase()}`}</span>
      </div>
      <div className="battle-log-list">
        {rows.map((entry) => {
          const card = entry.metadata?.battleCard;
          return (
            <article key={entry.id} className={entry.type}>
              <span>{entry.type.toUpperCase()} · R{entry.round}</span>
              {card && (
                <div className="battle-log-card">
                  <b>ATK</b>
                  <p>{card.attack.copy}</p>
                  <b>DEF</b>
                  <p>{card.defense.copy}</p>
                </div>
              )}
              <p>{entry.narrative}</p>
              {typeof entry.damage === "number" && <strong>{entry.damage} DMG · {card?.matchup?.label ?? "turn"}</strong>}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function BattleCardPanel({ battle }) {
  const card = getLatestBattleCard(battle);
  if (!card) {
    return (
      <div className="battle-card-panel empty">
        <div className="battle-mini-head">
          <span>JSON BATTLE CARD</span>
          <span>WAITING FOR FIRST BIT</span>
        </div>
        <p>Pick an attack to generate the first deterministic card.</p>
      </div>
    );
  }

  return (
    <div className="battle-card-panel">
      <div className="battle-mini-head">
        <span>JSON BATTLE CARD · ROUND {card.round}</span>
        <span>{card.matchup.label}</span>
      </div>
      <div className="battle-card-copy">
        <div>
          <span>ATTACK COPY</span>
          <strong>{card.attack.copy}</strong>
          <em>{qualityText(card.attack.qualities)}</em>
        </div>
        <div>
          <span>DEFENSE COPY</span>
          <strong>{card.defense.copy}</strong>
          <em>{qualityText(card.defense.qualities)}</em>
        </div>
      </div>
      <div className="battle-card-math">
        <span>ATK {card.attack.score}</span>
        <span>DEF {card.defense.score}</span>
        <span>EDGE {card.matchup.score > 0 ? "+" : ""}{card.matchup.score}</span>
        {typeof card.result?.damage === "number" && <span>{card.result.damage} DMG</span>}
      </div>
    </div>
  );
}

export function BattleArena({ claudeTeam = [], codexTeam = [] }) {
  const mode = "random-1v1";
  const style = "classic";
  const controlBySide = { c1: "human", c2: "human" };
  const [selectedIds, setSelectedIds] = React.useState({
    c1: claudeTeam.slice(0, 1).map((fighter) => fighter.id),
    c2: codexTeam.slice(0, 1).map((fighter) => fighter.id)
  });
  const [battle, setBattle] = React.useState(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState("");
  const modeConfig = modeById(mode);
  const teamSize = modeConfig.teamSize;
  const selectMode = modeConfig.selection === "select";
  const allCharacters = React.useMemo(() => [...claudeTeam, ...codexTeam, ...Wildcards], [claudeTeam, codexTeam]);

  const fitSelectedIds = React.useCallback(
    (ids, team) => {
      const available = new Set(team.map((fighter) => fighter.id));
      const kept = ids.filter((id) => available.has(id)).slice(0, teamSize);
      const fill = team.map((fighter) => fighter.id).filter((id) => !kept.includes(id));
      return [...kept, ...fill].slice(0, teamSize);
    },
    [teamSize]
  );

  const effectiveSelectedIds = React.useMemo(
    () => ({
      c1: fitSelectedIds(selectedIds.c1, claudeTeam),
      c2: fitSelectedIds(selectedIds.c2, codexTeam)
    }),
    [claudeTeam, codexTeam, fitSelectedIds, selectedIds]
  );

  const selectedTeams = React.useMemo(
    () => ({
      c1: effectiveSelectedIds.c1.map((id) => claudeTeam.find((fighter) => fighter.id === id)).filter(Boolean),
      c2: effectiveSelectedIds.c2.map((id) => codexTeam.find((fighter) => fighter.id === id)).filter(Boolean)
    }),
    [claudeTeam, codexTeam, effectiveSelectedIds]
  );

  const startBattle = React.useCallback(() => {
    const nextBattle = createBattle({
      mode,
      style,
      characters: allCharacters,
      selectedTeams,
      battleConfig: BattleConfig,
      seed: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      tokenBudget: BattleConfig.tokenBudget.defaultTokens
    });
    setBattle(nextBattle);
    setError("");
  }, [allCharacters, selectedTeams]);

  const activeFighter = battle ? getActiveFighter(battle, battle.turnSide) : null;
  const activeControl = battle ? controlBySide[battle.turnSide] : "human";
  const availableAttacks = activeFighter ? getAvailableAttacks(activeFighter, BattleConfig) : [];

  const resolveAttack = async (attackInput) => {
    if (!battle || pending || battle.status === "complete") return;
    const control = controlBySide[battle.turnSide];
    const attack = attackInput ?? (control === "cpu-random" ? pickCpuAttack(battle, BattleConfig) : null);
    setPending(true);
    setError("");

    setBattle(resolveClassicTurn(battle, attack ?? pickCpuAttack(battle, BattleConfig), { battleConfig: BattleConfig }));
    setPending(false);
  };

  const exportTranscript = () => {
    if (!battle || typeof window === "undefined") return;
    const blob = new Blob([JSON.stringify(battle, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${battle.id}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <section className="battle-arena">
      <div className="battle-shell">
        <div className="battle-header">
          <div>
            <span className="battle-kicker">BATTLE ARENA V1</span>
            <h2>DETERMINISTIC BATTLE CARDS</h2>
          </div>
          <div className="battle-header-actions">
            <button type="button" onClick={startBattle}>
              {battle ? "NEW BATTLE" : "START BATTLE"}
            </button>
            <button type="button" onClick={exportTranscript} disabled={!battle}>
              EXPORT LOG
            </button>
          </div>
        </div>

        <div className="battle-mode-summary">
          <span>MODE</span>
          <strong>{modeConfig.label}</strong>
        </div>

        {selectMode && (
          <div className="battle-selectors">
            <TeamPicker
              side="c1"
              team={claudeTeam}
              selectedIds={effectiveSelectedIds.c1}
              max={teamSize}
              disabled={false}
              onChange={(ids) => setSelectedIds((current) => ({ ...current, c1: ids }))}
            />
            <TeamPicker
              side="c2"
              team={codexTeam}
              selectedIds={effectiveSelectedIds.c2}
              max={teamSize}
              disabled={false}
              onChange={(ids) => setSelectedIds((current) => ({ ...current, c2: ids }))}
            />
          </div>
        )}

        {battle ? (
          <div className="battle-play-grid">
            <div className="battle-stage">
              <BenchRail battle={battle} side="c1" />
              <div className="battle-fighters">
                <FighterPanel battle={battle} side="c1" />
                <div className="battle-vs-core">
                  <span>ROUND {Math.max(1, battle.round)}</span>
                  <strong>VS</strong>
                  <em>{battle.status === "complete" ? `${battle.winnerSide?.toUpperCase()} CLEAR` : `${battle.turnSide.toUpperCase()} INPUT`}</em>
                </div>
                <FighterPanel battle={battle} side="c2" />
              </div>
              <BenchRail battle={battle} side="c2" />
              <BattleCardPanel battle={battle} />
              <div className="battle-actions">
                {battle.status === "complete" ? (
                  <button type="button" className="battle-big-action" onClick={startBattle}>
                    REMATCH
                  </button>
                ) : activeControl === "human" ? (
                  availableAttacks.map((attack) => (
                    <button key={attack.id} type="button" onClick={() => resolveAttack(attack)} disabled={pending}>
                      <span>{attack.label}</span>
                      <strong>{attack.preview}</strong>
                      <em>{attack.kind} · {attack.stat} · {attack.qualityLabels?.join(" / ")}</em>
                    </button>
                  ))
                ) : (
                  <button type="button" className="battle-big-action" onClick={() => resolveAttack(null)} disabled={pending}>
                    {pending ? "RESOLVING..." : `RESOLVE ${CONTROL_LABELS[activeControl]} TURN`}
                  </button>
                )}
              </div>
              {error && <div className="battle-error">{error}</div>}
            </div>
            <BattleTranscript battle={battle} />
          </div>
        ) : (
          <div className="battle-empty">
            <span>NO ACTIVE BATTLE</span>
            <button type="button" onClick={startBattle}>
              START DRAW
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
