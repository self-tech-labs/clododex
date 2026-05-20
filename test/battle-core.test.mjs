import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  advanceBattle,
  createBattleCard,
  createBattle,
  deriveCharacterQualities,
  getActiveFighter,
  getAvailableAttacks,
  resolveClassicTurn,
  rollWildcard,
  selectRandomTeam
} from "../src/arena/battle/index.mjs";

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const battleConfig = readJson("../data/arena/battle.json");
const claudeTeam = readJson("../data/arena/characters/claude.json");
const codexTeam = readJson("../data/arena/characters/codex.json");
const wildcards = readJson("../data/arena/characters/wildcards.json");
const characters = [...claudeTeam, ...codexTeam, ...wildcards];

test("random 1v1 and selected 5v5 battle setup produce correct party sizes", () => {
  const randomBattle = createBattle({
    mode: "random-1v1",
    characters,
    battleConfig,
    seed: "battle-random-setup"
  });
  assert.equal(randomBattle.teams.c1.length, 1);
  assert.equal(randomBattle.teams.c2.length, 1);
  assert.equal(randomBattle.status, "active");

  const selectedBattle = createBattle({
    mode: "select-5v5",
    characters,
    selectedTeams: {
      c1: claudeTeam.slice(0, 5),
      c2: codexTeam.slice(0, 5)
    },
    battleConfig,
    seed: "battle-selected-setup"
  });
  assert.equal(selectedBattle.teams.c1.length, 5);
  assert.equal(selectedBattle.teams.c2.length, 5);
});

test("wildcard rolling is deterministic and disabled for select modes", () => {
  const draws = [0, 0.99];
  const entry = rollWildcard({
    mode: "random-1v1",
    battleConfig,
    random: () => draws.shift() ?? 0
  });
  assert.equal(entry.characterId, "schmidhuber");

  const selectEntry = rollWildcard({
    mode: "select-1v1",
    battleConfig,
    random: () => 0
  });
  assert.equal(selectEntry, null);
});

test("selectRandomTeam can inject a wildcard into random teams", () => {
  const draws = [0, 0.99, 0, 0.2, 0.4, 0.6];
  const team = selectRandomTeam({
    characters,
    side: "c1",
    size: 5,
    mode: "random-5v5",
    battleConfig,
    random: () => draws.shift() ?? 0.1
  });
  assert.equal(team.length, 5);
  assert.equal(team.some((fighter) => fighter.id === "schmidhuber"), true);
});

test("Schmidhuber LSTM lock immediately wins when he appears", () => {
  const schmidhuber = wildcards.find((fighter) => fighter.id === "schmidhuber");
  const battle = createBattle({
    mode: "select-1v1",
    characters,
    selectedTeams: {
      c1: [schmidhuber],
      c2: [codexTeam[0]]
    },
    battleConfig,
    seed: "lstm-lock"
  });

  assert.equal(battle.status, "complete");
  assert.equal(battle.winnerSide, "c1");
  assert.match(battle.log.at(-1).narrative, /LSTM LOCK/);
});

test("classic turns apply bounded damage and advance the turn", () => {
  const battle = createBattle({
    mode: "select-1v1",
    characters,
    selectedTeams: {
      c1: [claudeTeam[0]],
      c2: [codexTeam[0]]
    },
    battleConfig,
    seed: "classic-bounds"
  });
  const attack = getAvailableAttacks(getActiveFighter(battle, "c1"), battleConfig).find((row) => row.id === "heavy");
  const next = resolveClassicTurn(battle, attack, { battleConfig });
  const turn = next.log.findLast((entry) => entry.type === "turn");

  assert.equal(next.turnSide, "c2");
  assert.equal(turn.damage >= 0, true);
  assert.equal(turn.damage <= 44, true);
});

test("deterministic turns produce funny JSON battle cards from character qualities", () => {
  const jason = codexTeam.find((fighter) => fighter.id === "jason");
  const boris = claudeTeam.find((fighter) => fighter.id === "boris");
  const battle = createBattle({
    mode: "select-1v1",
    characters,
    selectedTeams: {
      c1: [jason],
      c2: [boris]
    },
    battleConfig,
    seed: "funny-card"
  });
  const qualities = deriveCharacterQualities(jason);
  assert.equal(qualities.some((quality) => quality.id === "schema"), true);

  const attack = getAvailableAttacks(getActiveFighter(battle, "c1"), battleConfig).find((row) => row.id === "heavy");
  const card = createBattleCard(battle, attack, { battleConfig });
  assert.match(card.attack.copy, /Pydantic structured outputs/);
  assert.match(card.defense.copy, /mini Claude Code/);
  assert.equal(card.selectedAttack.qualityTags.length > 0, true);

  const next = resolveClassicTurn(battle, attack, { battleConfig });
  const turn = next.log.findLast((entry) => entry.type === "turn");
  assert.equal(turn.metadata.battleCard.schemaVersion, 1);
  assert.equal(typeof turn.metadata.battleCard.result.damage, "number");
});

test("party battles switch on KO and finish when no fighters remain", () => {
  const partyBattle = createBattle({
    mode: "select-5v5",
    characters,
    selectedTeams: {
      c1: claudeTeam.slice(0, 5),
      c2: codexTeam.slice(0, 5)
    },
    battleConfig,
    seed: "party-ko"
  });
  const partyDefender = getActiveFighter(partyBattle, "c2");
  const woundedPartyBattle = {
    ...partyBattle,
    hp: {
      ...partyBattle.hp,
      [partyDefender.instanceId]: 10
    }
  };
  const switched = advanceBattle(woundedPartyBattle, {
    attackerSide: "c1",
    defenderSide: "c2",
    attack: { id: "test", label: "Test Hit" },
    hit: true,
    damage: 20,
    narrative: "Test hit."
  });
  assert.equal(switched.status, "active");
  assert.equal(switched.activeIndex.c2, 1);

  const duelBattle = createBattle({
    mode: "select-1v1",
    characters,
    selectedTeams: {
      c1: [claudeTeam[0]],
      c2: [codexTeam[0]]
    },
    battleConfig,
    seed: "final-ko"
  });
  const duelDefender = getActiveFighter(duelBattle, "c2");
  const woundedDuelBattle = {
    ...duelBattle,
    hp: {
      ...duelBattle.hp,
      [duelDefender.instanceId]: 10
    }
  };
  const completed = advanceBattle(woundedDuelBattle, {
    attackerSide: "c1",
    defenderSide: "c2",
    attack: { id: "test", label: "Test Hit" },
    hit: true,
    damage: 20,
    narrative: "Final hit."
  });
  assert.equal(completed.status, "complete");
  assert.equal(completed.winnerSide, "c1");
});
