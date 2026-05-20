import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createBattle, getActiveFighter, getAvailableAttacks } from "../src/arena/battle/index.mjs";
import { resolveLlmBattleTurn } from "../src/arena/battle/litellm.mjs";

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const battleConfig = readJson("../data/arena/battle.json");
const claudeTeam = readJson("../data/arena/characters/claude.json");
const codexTeam = readJson("../data/arena/characters/codex.json");
const characters = [...claudeTeam, ...codexTeam];

const makeBattle = (seed = "llm-test") =>
  createBattle({
    mode: "select-1v1",
    characters,
    selectedTeams: {
      c1: [claudeTeam[0]],
      c2: [codexTeam[0]]
    },
    battleConfig,
    seed,
    tokenBudget: 2000
  });

const jsonResponse = (content, usage) => ({
  ok: true,
  status: 200,
  text: async () =>
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(content) } }],
      usage
    })
});

test("model-duel resolves attacker, defender, and judge calls with token ledger", async () => {
  const payloads = [
    { intent: "Push tempo", attackVector: "distribution pressure", styleScore: 82 },
    { defense: "Absorb with governance", mitigation: "policy shield", styleScore: 73 },
    {
      narrative: "The distribution pressure lands, but the policy shield keeps it contained.",
      attackQuality: 82,
      defenseQuality: 73,
      criteriaScores: { characterFit: 80 },
      damage: 19,
      statusEffects: [],
      tokenSummary: "three calls"
    }
  ];
  const fetchImpl = async () => jsonResponse(payloads.shift(), { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 });
  const battle = makeBattle("model-duel-success");
  const attack = getAvailableAttacks(getActiveFighter(battle, "c1"), battleConfig)[0];
  const result = await resolveLlmBattleTurn({
    battle,
    attack,
    style: "model-duel",
    provider: battleConfig.provider,
    apiKey: "test-key",
    battleConfig,
    fetchImpl
  });

  assert.equal(result.llm.ok, true);
  assert.equal(result.battle.tokenLedger.spent, 36);
  assert.equal(result.battle.log.findLast((entry) => entry.type === "turn").source, "llm-judge");
});

test("missing usage falls back to estimated token accounting", async () => {
  const fetchImpl = async () => jsonResponse({ narrative: "A clean narrated hit." }, undefined);
  const battle = makeBattle("missing-usage");
  const attack = getAvailableAttacks(getActiveFighter(battle, "c1"), battleConfig)[0];
  const result = await resolveLlmBattleTurn({
    battle,
    attack,
    style: "classic",
    provider: battleConfig.provider,
    apiKey: "test-key",
    battleConfig,
    fetchImpl
  });

  assert.equal(result.llm.ok, true);
  assert.equal(result.battle.tokenLedger.spent > 0, true);
  assert.equal(result.battle.tokenLedger.calls[0].estimated, true);
});

test("invalid model JSON falls back to classic resolution", async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ choices: [{ message: { content: "not-json" } }], usage: { total_tokens: 9 } })
  });
  const battle = makeBattle("invalid-json");
  const attack = getAvailableAttacks(getActiveFighter(battle, "c1"), battleConfig)[0];
  const result = await resolveLlmBattleTurn({
    battle,
    attack,
    style: "classic",
    provider: battleConfig.provider,
    apiKey: "test-key",
    battleConfig,
    fetchImpl
  });

  assert.equal(result.llm.fallback, true);
  assert.equal(result.battle.log.findLast((entry) => entry.type === "turn").source, "classic");
});

test("auth and rate-limit failures fall back to classic resolution", async () => {
  for (const status of [401, 429]) {
    const fetchImpl = async () => ({
      ok: false,
      status,
      text: async () => JSON.stringify({ error: { message: `http-${status}` } })
    });
    const battle = makeBattle(`http-${status}`);
    const attack = getAvailableAttacks(getActiveFighter(battle, "c1"), battleConfig)[0];
    const result = await resolveLlmBattleTurn({
      battle,
      attack,
      style: "classic",
      provider: battleConfig.provider,
      apiKey: "test-key",
      battleConfig,
      fetchImpl
    });

    assert.equal(result.llm.fallback, true);
    assert.equal(result.battle.log.findLast((entry) => entry.type === "turn").source, "classic");
  }
});

test("exhausted token budget does not call LiteLLM", async () => {
  let calls = 0;
  const battle = makeBattle("budget-exhausted");
  const attack = getAvailableAttacks(getActiveFighter(battle, "c1"), battleConfig)[0];
  const result = await resolveLlmBattleTurn({
    battle,
    attack,
    style: "classic",
    provider: { ...battleConfig.provider, remainingTokens: 0 },
    apiKey: "test-key",
    battleConfig,
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({ narrative: "Should not run" }, { total_tokens: 1 });
    }
  });

  assert.equal(calls, 0);
  assert.equal(result.llm.fallback, true);
});
