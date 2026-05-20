import { asArray, asNumber, asRecord, asString, clamp } from "../core.mjs";
import {
  applyJudgeVerdict,
  getActiveFighter,
  getAvailableAttacks,
  getCharacterName,
  otherSide,
  pickCpuAttack,
  resolveClassicTurn
} from "./index.mjs";

const DEFAULT_PROVIDER = {
  baseUrl: "http://127.0.0.1:4000",
  endpoint: "/v1/chat/completions",
  attackerModel: "gpt-5-mini",
  defenderModel: "gpt-5-mini",
  judgeModel: "gpt-5-mini",
  narratorModel: "gpt-5-mini",
  temperature: 0.75,
  maxTokensPerCall: 450
};

const asProvider = (provider) => ({
  ...DEFAULT_PROVIDER,
  ...asRecord(provider)
});

const endpointUrl = (provider) => {
  const baseUrl = asString(provider.baseUrl, DEFAULT_PROVIDER.baseUrl).replace(/\/+$/, "");
  const endpoint = asString(provider.endpoint, DEFAULT_PROVIDER.endpoint);
  return `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
};

export const estimateTokens = (value) => {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return Math.max(1, Math.ceil(text.length / 4));
};

export const normalizeLiteLLMUsage = (payload, fallbackValue) => {
  const usage = asRecord(payload?.usage);
  const promptTokens = asNumber(usage.prompt_tokens ?? usage.input_tokens, 0);
  const completionTokens = asNumber(usage.completion_tokens ?? usage.output_tokens, 0);
  const totalTokens = asNumber(usage.total_tokens, promptTokens + completionTokens);
  if (totalTokens > 0) {
    return {
      promptTokens,
      completionTokens,
      totalTokens,
      estimated: false
    };
  }

  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: estimateTokens(fallbackValue),
    estimated: true
  };
};

export const parseJsonObject = (text) => {
  const raw = asString(text).trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("No JSON object found in model response");
  }
  return JSON.parse(raw.slice(start, end + 1));
};

const extractContent = (payload) => {
  const choice = asArray(payload?.choices)[0];
  return asString(choice?.message?.content ?? choice?.delta?.content ?? payload?.content);
};

export const callLiteLLM = async ({
  provider,
  apiKey,
  model,
  messages,
  role,
  fetchImpl = fetch,
  responseFormat = true
}) => {
  if (!apiKey) {
    throw new Error("missing-api-key");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("missing-fetch");
  }

  const config = asProvider(provider);
  const requestBody = {
    model,
    messages,
    temperature: asNumber(config.temperature, DEFAULT_PROVIDER.temperature),
    max_tokens: clamp(asNumber(config.maxTokensPerCall, DEFAULT_PROVIDER.maxTokensPerCall), 80, 1200)
  };
  if (responseFormat) {
    requestBody.response_format = { type: "json_object" };
  }

  const response = await fetchImpl(endpointUrl(config), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const message = asString(payload?.error?.message || payload?.message || text, `litellm-http-${response.status}`);
    throw new Error(message);
  }

  const content = extractContent(payload);
  const usage = normalizeLiteLLMUsage(payload, { messages, content });
  return {
    role,
    model,
    content,
    json: responseFormat ? parseJsonObject(content) : null,
    usage
  };
};

const activeSnapshot = (battle) => {
  const attackerSide = battle.turnSide;
  const defenderSide = otherSide(attackerSide);
  const attacker = getActiveFighter(battle, attackerSide);
  const defender = getActiveFighter(battle, defenderSide);
  return {
    round: battle.round,
    attackerSide,
    defenderSide,
    attacker: {
      id: attacker?.id,
      name: getCharacterName(attacker),
      class: attacker?.cls,
      special: attacker?.special,
      stats: attacker?.stats,
      hp: battle.hp?.[attacker?.instanceId],
      maxHp: attacker?.maxHp,
      lore: attacker?.lore
    },
    defender: {
      id: defender?.id,
      name: getCharacterName(defender),
      class: defender?.cls,
      special: defender?.special,
      stats: defender?.stats,
      hp: battle.hp?.[defender?.instanceId],
      maxHp: defender?.maxHp,
      lore: defender?.lore
    },
    recentLog: asArray(battle.log).slice(-5)
  };
};

const selectedAttack = (battle, attackInput, battleConfig) => {
  if (attackInput?.id || typeof attackInput === "string") {
    const attackId = typeof attackInput === "string" ? attackInput : attackInput.id;
    return getAvailableAttacks(getActiveFighter(battle, battle.turnSide), battleConfig).find((attack) => attack.id === attackId);
  }
  return null;
};

const chooseAttack = async ({ battle, attackInput, battleConfig, provider, apiKey, fetchImpl, calls }) => {
  const existing = selectedAttack(battle, attackInput, battleConfig);
  if (existing) {
    return existing;
  }

  const fallback = pickCpuAttack(battle, battleConfig);
  if (!apiKey) {
    return fallback;
  }

  const attacks = getAvailableAttacks(getActiveFighter(battle, battle.turnSide), battleConfig);
  const call = await callLiteLLM({
    provider,
    apiKey,
    model: asString(provider.attackerModel, DEFAULT_PROVIDER.attackerModel),
    role: "selector",
    fetchImpl,
    messages: [
      {
        role: "system",
        content:
          "You choose one attack for an arcade turn-based AI arena. Return strict JSON: {\"attackId\":\"quick|heavy|counter|special\",\"reason\":\"short reason\"}."
      },
      {
        role: "user",
        content: JSON.stringify({
          battle: activeSnapshot(battle),
          availableAttacks: attacks.map((attack) => ({
            id: attack.id,
            label: attack.label,
            kind: attack.kind,
            description: attack.description
          }))
        })
      }
    ]
  });
  calls.push(call);
  return attacks.find((attack) => attack.id === call.json.attackId) ?? fallback;
};

const withTokenLedger = (battle, calls) => {
  const ledger = asRecord(battle.tokenLedger);
  const previousCalls = asArray(ledger.calls);
  const compactCalls = asArray(calls).map((call) => ({
    role: call.role,
    model: call.model,
    totalTokens: call.usage.totalTokens,
    estimated: call.usage.estimated
  }));
  const spentThisTurn = compactCalls.reduce((sum, call) => sum + asNumber(call.totalTokens, 0), 0);
  const budget = asNumber(ledger.budget, 0);
  const spent = asNumber(ledger.spent, 0) + spentThisTurn;
  return {
    ...battle,
    tokenLedger: {
      budget,
      spent,
      remaining: Math.max(0, budget - spent),
      calls: [...previousCalls, ...compactCalls]
    }
  };
};

const fallbackResult = ({ battle, attack, battleConfig, error, calls = [] }) => ({
  battle: withTokenLedger(resolveClassicTurn(battle, attack ?? pickCpuAttack(battle, battleConfig), { battleConfig }), calls),
  attack: attack ?? pickCpuAttack(battle, battleConfig),
  llm: {
    ok: false,
    fallback: true,
    error: asString(error?.message || error, "llm-fallback"),
    calls: calls.map((call) => ({ role: call.role, model: call.model, usage: call.usage }))
  }
});

const replaceLastTurnNarrative = (battle, narrative) => {
  const log = asArray(battle.log);
  const index = [...log].reverse().findIndex((entry) => entry.type === "turn");
  if (index < 0) {
    return battle;
  }
  const actualIndex = log.length - 1 - index;
  return {
    ...battle,
    log: log.map((entry, entryIndex) => (entryIndex === actualIndex ? { ...entry, narrative, source: "llm-narrator" } : entry))
  };
};

const buildJudgePrompt = ({ battle, attack, attackIntent, defenseResponse, battleConfig }) => ({
  battle: activeSnapshot(battle),
  selectedAttack: {
    id: attack.id,
    label: attack.label,
    kind: attack.kind,
    power: attack.power,
    stat: attack.stat
  },
  attackerModelOutput: attackIntent,
  defenderModelOutput: defenseResponse,
  judgeCriteria: asArray(battleConfig?.judgeCriteria),
  requiredJson:
    "{ narrative: string, attackQuality: 0-100, defenseQuality: 0-100, criteriaScores: object, damage: 0-64, statusEffects: array, tokenSummary: string }"
});

export const resolveLlmBattleTurn = async ({
  battle,
  attack: attackInput,
  style = "classic",
  provider,
  apiKey,
  battleConfig,
  fetchImpl = fetch
}) => {
  const config = asProvider(provider);
  const calls = [];
  const ledger = asRecord(battle?.tokenLedger);
  const remaining = asNumber(config.remainingTokens ?? ledger.remaining, ledger.remaining ?? 0);
  if (remaining <= 0) {
    return fallbackResult({ battle, attack: attackInput, battleConfig, error: "token-budget-exhausted" });
  }

  let attack = attackInput;
  try {
    attack = await chooseAttack({ battle, attackInput, battleConfig, provider: config, apiKey, fetchImpl, calls });
  } catch (error) {
    return fallbackResult({ battle, attack: attackInput, battleConfig, error, calls });
  }

  if (!apiKey) {
    return fallbackResult({ battle, attack, battleConfig, error: "missing-api-key", calls });
  }

  try {
    if (style !== "model-duel") {
      const classicBattle = resolveClassicTurn(battle, attack, { battleConfig });
      const latestTurn = asArray(classicBattle.log).findLast((entry) => entry.type === "turn");
      const narrator = await callLiteLLM({
        provider: config,
        apiKey,
        model: asString(config.narratorModel, config.judgeModel),
        role: "narrator",
        fetchImpl,
        messages: [
          {
            role: "system",
            content:
              "You narrate one Agent Arena turn. Keep the deterministic damage unchanged. Return strict JSON: {\"narrative\":\"one punchy sentence\"}."
          },
          {
            role: "user",
            content: JSON.stringify({
              before: activeSnapshot(battle),
              selectedAttack: attack,
              deterministicResult: latestTurn
            })
          }
        ]
      });
      calls.push(narrator);
      const narratedBattle = replaceLastTurnNarrative(classicBattle, asString(narrator.json.narrative, latestTurn?.narrative));
      return {
        battle: withTokenLedger(narratedBattle, calls),
        attack,
        llm: {
          ok: true,
          fallback: false,
          style: "classic",
          calls: calls.map((call) => ({ role: call.role, model: call.model, usage: call.usage }))
        }
      };
    }

    const attacker = await callLiteLLM({
      provider: config,
      apiKey,
      model: asString(config.attackerModel, DEFAULT_PROVIDER.attackerModel),
      role: "attacker",
      fetchImpl,
      messages: [
        {
          role: "system",
          content:
            "You are the attacker model in Agent Arena. Write the selected attack in character. Return strict JSON: {\"intent\":\"short attack intent\",\"attackVector\":\"specific vector\",\"styleScore\":0-100}."
        },
        {
          role: "user",
          content: JSON.stringify({ battle: activeSnapshot(battle), selectedAttack: attack })
        }
      ]
    });
    calls.push(attacker);

    const defender = await callLiteLLM({
      provider: config,
      apiKey,
      model: asString(config.defenderModel, DEFAULT_PROVIDER.defenderModel),
      role: "defender",
      fetchImpl,
      messages: [
        {
          role: "system",
          content:
            "You are the defender model in Agent Arena. Respond in character and mitigate the attack. Return strict JSON: {\"defense\":\"short defense\",\"mitigation\":\"specific mitigation\",\"styleScore\":0-100}."
        },
        {
          role: "user",
          content: JSON.stringify({
            battle: activeSnapshot(battle),
            selectedAttack: attack,
            attackerOutput: attacker.json
          })
        }
      ]
    });
    calls.push(defender);

    const judge = await callLiteLLM({
      provider: config,
      apiKey,
      model: asString(config.judgeModel, DEFAULT_PROVIDER.judgeModel),
      role: "judge",
      fetchImpl,
      messages: [
        {
          role: "system",
          content:
            "You are the neutral Agent Arena judge. Score attack and defense, then choose bounded damage. Return only valid JSON."
        },
        {
          role: "user",
          content: JSON.stringify(buildJudgePrompt({ battle, attack, attackIntent: attacker.json, defenseResponse: defender.json, battleConfig }))
        }
      ]
    });
    calls.push(judge);

    const judgedBattle = applyJudgeVerdict(battle, judge.json, attack, { battleConfig });
    return {
      battle: withTokenLedger(judgedBattle, calls),
      attack,
      llm: {
        ok: true,
        fallback: false,
        style: "model-duel",
        calls: calls.map((call) => ({ role: call.role, model: call.model, usage: call.usage }))
      }
    };
  } catch (error) {
    return fallbackResult({ battle, attack, battleConfig, error, calls });
  }
};
