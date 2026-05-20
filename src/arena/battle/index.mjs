import { asArray, asNumber, asRecord, asString, clamp, compactObject } from "../core.mjs";

const SIDE_ORDER = ["c1", "c2"];

const DEFAULT_BATTLE_CONFIG = {
  tokenBudget: { defaultTokens: 3000, maxTokens: 50000 },
  modes: [
    { id: "random-1v1", teamSize: 1, selection: "random", allowWildcards: true },
    { id: "select-1v1", teamSize: 1, selection: "select", allowWildcards: false },
    { id: "random-5v5", teamSize: 5, selection: "random", allowWildcards: true },
    { id: "select-5v5", teamSize: 5, selection: "select", allowWildcards: false }
  ],
  attacks: [
    { id: "quick", label: "Quick Strike", kind: "attack", stat: "SPD", power: 18, accuracy: 0.94 },
    { id: "heavy", label: "Heavy Thesis", kind: "attack", stat: "ATK", power: 30, accuracy: 0.82 },
    { id: "counter", label: "Guard Counter", kind: "defend", stat: "DEF", power: 13, accuracy: 1, shield: 0.38 },
    { id: "special", label: "Special Move", kind: "special", stat: "COMBO", power: 36, accuracy: 0.88 }
  ],
  wildcards: { enabledModes: ["random-1v1", "random-5v5"], spawnChance: 0.18, entries: [] }
};

export const otherSide = (side) => (side === "c1" ? "c2" : "c1");

const QUALITY_RULES = [
  {
    id: "researcher",
    label: "Researcher",
    keywords: ["research", "scientist", "pre-training", "pretraining", "reasoning", "frontier", "training", "capability"],
    stats: { ATK: 0.18, COMBO: 0.08 }
  },
  {
    id: "communicator",
    label: "Communicator",
    keywords: ["public", "educator", "education", "docs", "developer experience", "devex", "framing", "narrative", "voice"],
    stats: { SPD: 0.14, COMBO: 0.08 }
  },
  {
    id: "builder",
    label: "Builder",
    keywords: ["builder", "code", "codex", "claude code", "terminal", "repo", "patch", "ship", "implementation", "developer"],
    stats: { COMBO: 0.14, SPD: 0.1 }
  },
  {
    id: "operator",
    label: "Operator",
    keywords: ["operator", "operations", "operating", "enterprise", "process", "coordination", "company", "workflow"],
    stats: { DEF: 0.12, HP: 0.1 }
  },
  {
    id: "strategist",
    label: "Strategist",
    keywords: ["strategy", "strategic", "governance", "policy", "long-horizon", "roadmap", "sequencing", "capital"],
    stats: { DEF: 0.12, ATK: 0.08 }
  },
  {
    id: "safety",
    label: "Safety",
    keywords: ["safety", "reliable", "interpretable", "steerable", "responsible", "governance", "policy"],
    stats: { DEF: 0.18, HP: 0.08 }
  },
  {
    id: "schema",
    label: "Schema",
    keywords: ["schema", "structured", "pydantic", "json", "validation", "typed", "instructor", "parse"],
    stats: { COMBO: 0.18, DEF: 0.08 }
  },
  {
    id: "product",
    label: "Product",
    keywords: ["product", "applications", "surfaces", "customer", "adoption", "launch", "labs", "prototype"],
    stats: { SPD: 0.12, ATK: 0.08 }
  },
  {
    id: "distribution",
    label: "Distribution",
    keywords: ["distribution", "market", "consumer", "capital", "compute", "growth", "scale", "flywheel"],
    stats: { ATK: 0.16, SPD: 0.1 }
  },
  {
    id: "agent",
    label: "Agent",
    keywords: ["agent", "agents", "personal assistant", "multi-agent", "swarm", "delegated", "assistant", "openclaw"],
    stats: { SPD: 0.1, COMBO: 0.14 }
  }
];

const QUALITY_BY_ID = Object.fromEntries(QUALITY_RULES.map((quality) => [quality.id, quality]));

const QUALITY_ATTACKS = {
  researcher: ["product", "distribution", "communicator"],
  communicator: ["researcher", "safety", "strategist"],
  builder: ["communicator", "operator", "product"],
  operator: ["distribution", "agent", "product"],
  strategist: ["distribution", "product", "agent"],
  safety: ["agent", "distribution", "product"],
  schema: ["agent", "communicator", "product"],
  product: ["researcher", "safety", "strategist"],
  distribution: ["researcher", "safety", "product"],
  agent: ["operator", "strategist", "researcher"]
};

const QUALITY_DEFENDS = {
  researcher: ["researcher", "schema"],
  communicator: ["product", "distribution"],
  builder: ["schema", "agent"],
  operator: ["distribution", "agent", "product"],
  strategist: ["distribution", "product", "communicator"],
  safety: ["agent", "distribution", "product"],
  schema: ["agent", "communicator", "builder"],
  product: ["communicator", "researcher"],
  distribution: ["safety", "researcher"],
  agent: ["schema", "researcher", "operator"]
};

const PERSONA_COPY = {
  jason: {
    quick: "a perfectly valid JSON jab that passes CI on the first try",
    heavy: "Pydantic structured outputs in a velvet hammer",
    defense: "a tiny schema bouncer checking every wristband",
    special: "PYDANTIC LOCK with response_model energy"
  },
  boris: {
    quick: "Claude Code terminal pressure and a suspiciously clean diff",
    heavy: "a plan-mode uppercut that already opened the repo",
    defense: "a super cute mini Claude Code character holding a foam shield",
    special: "CLAUDE CODE COMBO with the terminal cheering"
  },
  dario: {
    quick: "a governance memo folded into a paper airplane",
    heavy: "the Safety Thesis binder, tabbed and emotionally prepared",
    defense: "a responsible-scaling pillow fort with audit logs",
    special: "SAFETY THESIS as a very polite boss phase"
  },
  daniela: {
    quick: "an org-chart feint that routes around the blocker",
    heavy: "operating cadence with calendar-invite knockback",
    defense: "a process blanket and three perfectly timed follow-ups"
  },
  krieger: {
    quick: "a prototype loop taped together five minutes before demo",
    heavy: "Labs experiment velocity with confetti in the stack trace",
    defense: "a product incubator helmet covered in sticky notes"
  },
  karpathy: {
    quick: "a micro-lecture that somehow fits in one token",
    heavy: "a pretraining chalkboard slammed onto the matchup chart",
    defense: "nanoGPT diagrams arranged into a surprisingly comfy barricade"
  },
  noah: {
    quick: "a roadmap tell so small it needs product binoculars",
    heavy: "launch sequencing with a PM stare",
    defense: "a user-story umbrella labeled definitely not a leak"
  },
  sama: {
    quick: "distribution gravity in sneaker form",
    heavy: "the market flywheel, spinning loudly near the snacks",
    defense: "a keynote clicker reflecting every incoming projectile"
  },
  greg: {
    quick: "a live demo jab with the build still running",
    heavy: "bare-metal demo pressure and a cable nobody should unplug",
    defense: "an engineering console covered in reassuring blue lights"
  },
  fidji: {
    quick: "an applications-scale elbow from the business workflow lane",
    heavy: "product-market gravity in a very sharp blazer",
    defense: "a customer success parachute with tidy onboarding copy"
  },
  jakub: {
    quick: "a sparse research signal that makes the graph blink",
    heavy: "reasoning overdrive wrapped in ominous math notation",
    defense: "a chief-scientist force field made of careful assumptions"
  },
  tibo: {
    quick: "plan-patch-PR footwork",
    heavy: "a Codex ship loop that lands as a diff",
    defense: "a review queue shield with all comments resolved"
  },
  romain: {
    quick: "DevEx sparkle from the docs lane",
    heavy: "an API example that hits harder because it actually runs",
    defense: "a documentation cape with impeccable hover states"
  },
  peter: {
    quick: "OpenClaw chaos in desktop-assistant sneakers",
    heavy: "a hundred-agent swarm trying to expense the token bill",
    defense: "a personal-agent blanket fort running on unreasonable scale"
  },
  lecun: {
    quick: "a JEPA side-eye from the back of the seminar room",
    heavy: "an energy-based counterargument with vintage conviction",
    defense: "a ConvNet-era shield that refuses to be deprecated"
  },
  chollet: {
    quick: "an ARC puzzle piece thrown at a weird angle",
    heavy: "abstraction confusion that makes the arena check its assumptions",
    defense: "a test-set maze with no obvious training examples"
  },
  sutton: {
    quick: "a reward-signal poke after a very patient pause",
    heavy: "the Bitter Lesson, delivered with grandfather-clock timing",
    defense: "a reinforcement-learning cushion that waits for the return"
  },
  schmidhuber: {
    quick: "a memory cell tap from the ancient boss room",
    heavy: "LSTM LOCK with all the footnotes",
    defense: "a recurrent nostalgia dome"
  }
};

const stableHash = (value) => {
  const text = asString(value, "arena");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const createSeededRandom = (seed = "arena") => {
  let state = stableHash(seed) || 1;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const getModeConfig = (battleConfig, modeId) =>
  asArray(battleConfig?.modes ?? DEFAULT_BATTLE_CONFIG.modes).find((mode) => mode.id === modeId) ??
  DEFAULT_BATTLE_CONFIG.modes[0];

const getAttackConfig = (battleConfig, attackId) =>
  asArray(battleConfig?.attacks ?? DEFAULT_BATTLE_CONFIG.attacks).find((attack) => attack.id === attackId) ??
  DEFAULT_BATTLE_CONFIG.attacks[0];

const normalizeStats = (stats) => ({
  ATK: asNumber(stats?.ATK, 70),
  DEF: asNumber(stats?.DEF, 70),
  SPD: asNumber(stats?.SPD, 70),
  COMBO: asNumber(stats?.COMBO, 70),
  HP: asNumber(stats?.HP, 70)
});

export const getCharacterName = (fighter) => {
  const value = asRecord(fighter);
  return asString(value.displayName || [value.name, value.surname].filter(Boolean).join(" "), value.id || "Unknown Fighter").trim();
};

const fighterSearchText = (fighter) => {
  const value = asRecord(fighter);
  const dossier = asRecord(value.dossier);
  const narrative = asRecord(dossier.narrative);
  const keyProjects = asArray(dossier.keyProjects);
  const strengths = asArray(dossier.strengths);
  return [
    value.id,
    value.name,
    value.surname,
    value.displayName,
    value.cls,
    value.roleClass,
    value.special,
    value.lore,
    dossier.tagline,
    narrative.title,
    narrative.text,
    ...keyProjects.flatMap((project) => [
      project?.name,
      project?.description,
      ...asArray(project?.tags)
    ]),
    ...strengths.flatMap((strength) => [strength?.label, strength?.description])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

const qualityFallbacksForStats = (stats) => {
  const normalized = normalizeStats(stats);
  return [
    { id: "researcher", score: normalized.ATK },
    { id: "safety", score: normalized.DEF },
    { id: "communicator", score: normalized.SPD },
    { id: "builder", score: normalized.COMBO },
    { id: "operator", score: normalized.HP }
  ].sort((left, right) => right.score - left.score);
};

export const deriveCharacterQualities = (fighter) => {
  const value = asRecord(fighter);
  const text = fighterSearchText(value);
  const stats = normalizeStats(value.stats);
  const scored = QUALITY_RULES.map((quality) => {
    const keywordScore = quality.keywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 22 : 0), 0);
    const statScore = Object.entries(quality.stats).reduce(
      (sum, [stat, weight]) => sum + Math.max(0, asNumber(stats[stat], 70) - 70) * weight,
      0
    );
    const threatScore = Math.max(0, asNumber(value.threatScore, 70) - 70) * 0.05;
    return {
      id: quality.id,
      label: quality.label,
      score: Math.round(clamp(keywordScore + statScore + threatScore, 0, 100))
    };
  }).sort((left, right) => right.score - left.score || left.label.localeCompare(right.label));

  const selected = scored.filter((quality) => quality.score >= 12).slice(0, 4);
  for (const fallback of qualityFallbacksForStats(stats)) {
    if (selected.length >= 3) {
      break;
    }
    if (!selected.some((quality) => quality.id === fallback.id)) {
      const quality = QUALITY_BY_ID[fallback.id];
      selected.push({
        id: quality.id,
        label: quality.label,
        score: Math.round(clamp((fallback.score - 54) * 0.72, 12, 52))
      });
    }
  }

  return selected.slice(0, 4);
};

const qualityLabels = (qualities) => asArray(qualities).map((quality) => quality.label).filter(Boolean);

const personaFor = (fighter) => PERSONA_COPY[asString(fighter?.id).toLowerCase()] ?? {};

const genericAttackNoun = (fighter, attack, qualities) => {
  const topQuality = asArray(qualities)[0]?.label?.toLowerCase() ?? "signal";
  if (attack.id === "heavy") {
    return `an overexplained ${topQuality} haymaker with too many tabs open`;
  }
  if (attack.id === "counter") {
    return `a tiny ${topQuality} shield and one deeply petty counterpoint`;
  }
  if (attack.id === "special") {
    return `${asString(fighter?.special, "SIGNATURE NONSENSE")} with extra arcade smoke`;
  }
  return `a ${topQuality} jab wearing novelty sunglasses`;
};

const makeAttackCopy = (fighter, attack, qualities) => {
  const persona = personaFor(fighter);
  const name = getCharacterName(fighter);
  const noun =
    (attack.id === "special" && persona.special) ||
    (attack.id === "heavy" && persona.heavy) ||
    (attack.id === "counter" && persona.defense) ||
    (attack.id === "quick" && persona.quick) ||
    genericAttackNoun(fighter, attack, qualities);

  if (attack.kind === "defend") {
    return `${name} defends with ${noun}`;
  }
  return `${name} attacks with ${noun}`;
};

const makeDefenseCopy = (fighter, attackQualities, defenderQualities, shield) => {
  const persona = personaFor(fighter);
  const name = getCharacterName(fighter);
  const topDefense = asArray(defenderQualities)[0]?.label?.toLowerCase() ?? "vibes";
  const attackLabel = qualityLabels(attackQualities).slice(0, 2).join(" + ").toLowerCase() || "incoming nonsense";
  const noun = persona.defense || `a ${topDefense} umbrella rated for ${attackLabel}`;
  const shieldText = shield > 0 ? " plus leftover shield glitter" : "";
  return `${name} defends with ${noun}${shieldText}`;
};

const attackQualityIdsFor = (fighter, attack) => {
  const explicit = asArray(attack.qualityTags).filter(Boolean);
  if (attack.id === "special") {
    return deriveCharacterQualities(fighter).slice(0, 2).map((quality) => quality.id);
  }
  if (explicit.length) {
    return explicit.slice(0, 3);
  }
  if (attack.kind === "defend") {
    return ["safety", "operator"];
  }
  if (attack.id === "heavy") {
    return ["researcher", "strategist"];
  }
  return ["communicator", "product"];
};

const qualityRowsFromIds = (ids) =>
  asArray(ids)
    .map((id) => QUALITY_BY_ID[id])
    .filter(Boolean)
    .map((quality) => ({ id: quality.id, label: quality.label }));

const uniqueQualityRows = (rows) => {
  const seen = new Set();
  return asArray(rows).filter((quality) => {
    if (!quality?.id || seen.has(quality.id)) {
      return false;
    }
    seen.add(quality.id);
    return true;
  });
};

const evaluateQualityMatchup = ({ attackQualities, defenderQualities, attack, defenderShield }) => {
  const attackerIds = asArray(attackQualities).map((quality) => quality.id);
  const defenderIds = asArray(defenderQualities).map((quality) => quality.id);
  let score = 0;
  const notes = [];

  for (const attackId of attackerIds) {
    for (const defenderId of defenderIds) {
      if (QUALITY_ATTACKS[attackId]?.includes(defenderId)) {
        score += 9;
        notes.push(`${QUALITY_BY_ID[attackId]?.label} pressures ${QUALITY_BY_ID[defenderId]?.label}`);
      }
      if (QUALITY_DEFENDS[defenderId]?.includes(attackId)) {
        score -= 8;
        notes.push(`${QUALITY_BY_ID[defenderId]?.label} blocks ${QUALITY_BY_ID[attackId]?.label}`);
      }
    }
  }

  if (attack.kind === "defend") {
    score -= 5;
    notes.push("Defensive move trades damage for a shield");
  }
  if (defenderShield > 0) {
    score -= Math.round(defenderShield * 16);
    notes.push("Stored shield eats the first bite");
  }

  const clampedScore = clamp(score, -28, 30);
  const label = clampedScore >= 16 ? "strong attack" : clampedScore <= -14 ? "strong defense" : "messy neutral";
  return {
    score: clampedScore,
    label,
    attackBonus: Math.max(0, clampedScore),
    defenseBonus: Math.max(0, -clampedScore),
    notes: notes.slice(0, 4)
  };
};

const normalizeCharacter = (character) => {
  const value = asRecord(character);
  return {
    ...value,
    id: asString(value.id),
    name: asString(value.name),
    surname: asString(value.surname),
    displayName: getCharacterName(value),
    side: asString(value.side || value.contenderSide),
    contenderId: asString(value.contenderId ?? value.contender_id),
    cls: asString(value.cls || value.roleClass || value.role || "THE FIGHTER"),
    stats: normalizeStats(value.stats),
    special: asString(value.special, "SIGNAL BURST"),
    threatScore: asNumber(value.threatScore ?? value.score, 70),
    lore: asString(value.lore || value.description),
    specialRule: asString(value.specialRule)
  };
};

const isSideCharacter = (character, side) =>
  character.side === side || character.contenderSide === side || character.battleSide === side;

const isWildcardCharacter = (character) => character.contenderId === "wildcards" || character.side === "neutral";

const maxHpFor = (fighter) => clamp(80 + normalizeStats(fighter.stats).HP, 120, 200);

const hasLstmLock = (fighter) => fighter?.specialRule === "lstm-lock" || fighter?.id === "schmidhuber";

const toCombatant = (character, side, slot) => {
  const fighter = normalizeCharacter(character);
  const maxHp = maxHpFor(fighter);
  return {
    ...fighter,
    originalSide: fighter.side,
    battleSide: side,
    slot,
    instanceId: `${side}-${slot}-${fighter.id}`,
    maxHp
  };
};

const chooseWeighted = (entries, random) => {
  const rows = asArray(entries).filter((entry) => asNumber(entry.weight, 0) > 0);
  const total = rows.reduce((sum, entry) => sum + asNumber(entry.weight, 0), 0);
  if (!rows.length || total <= 0) {
    return null;
  }

  let cursor = random() * total;
  for (const entry of rows) {
    cursor -= asNumber(entry.weight, 0);
    if (cursor <= 0) {
      return entry;
    }
  }

  return rows[rows.length - 1];
};

const pickFromPool = (pool, usedIds, random) => {
  const available = pool.filter((character) => !usedIds.has(character.id));
  const source = available.length ? available : pool;
  if (!source.length) {
    return null;
  }
  const picked = source[Math.floor(random() * source.length) % source.length];
  usedIds.add(picked.id);
  return picked;
};

export const rollWildcard = ({ mode = "random-1v1", battleConfig = DEFAULT_BATTLE_CONFIG, random = Math.random } = {}) => {
  const wildcards = asRecord(battleConfig.wildcards ?? DEFAULT_BATTLE_CONFIG.wildcards);
  const enabledModes = asArray(wildcards.enabledModes);
  if (!enabledModes.includes(mode)) {
    return null;
  }
  if (random() >= asNumber(wildcards.spawnChance, 0)) {
    return null;
  }
  return chooseWeighted(wildcards.entries, random);
};

export const selectRandomTeam = ({
  characters = [],
  side = "c1",
  size = 1,
  mode = "random-1v1",
  battleConfig = DEFAULT_BATTLE_CONFIG,
  seed = "arena",
  excludeIds = [],
  random
} = {}) => {
  const rng = random ?? createSeededRandom(`${seed}:${mode}:${side}:${size}`);
  const allCharacters = asArray(characters).map(normalizeCharacter).filter((character) => character.id);
  const sidePool = allCharacters.filter((character) => isSideCharacter(character, side));
  const wildcardPool = allCharacters.filter(isWildcardCharacter);
  const usedIds = new Set(excludeIds);
  const team = [];
  const modeConfig = getModeConfig(battleConfig, mode);
  const wildcardEntry = modeConfig.allowWildcards === false ? null : rollWildcard({ mode, battleConfig, random: rng });
  const wildcard =
    wildcardEntry &&
    wildcardPool.find((character) => character.id === wildcardEntry.characterId && !usedIds.has(character.id));
  const wildcardSlot = wildcard ? Math.floor(rng() * Math.max(1, size)) : -1;

  for (let index = 0; index < size; index += 1) {
    if (index === wildcardSlot && wildcard) {
      usedIds.add(wildcard.id);
      team.push(wildcard);
      continue;
    }

    const picked = pickFromPool(sidePool, usedIds, rng);
    if (picked) {
      team.push(picked);
    }
  }

  return team.slice(0, size);
};

const completeSelectedTeam = ({ selected, characters, side, size, mode, battleConfig, seed }) => {
  const normalizedSelected = asArray(selected).map(normalizeCharacter).filter((character) => character.id);
  if (normalizedSelected.length >= size) {
    return normalizedSelected.slice(0, size);
  }

  const fill = selectRandomTeam({
    characters,
    side,
    size: size - normalizedSelected.length,
    mode,
    battleConfig,
    seed: `${seed}:fill:${side}`,
    excludeIds: normalizedSelected.map((character) => character.id)
  });

  return [...normalizedSelected, ...fill].slice(0, size);
};

const initialLog = (modeConfig, style) => [
  {
    id: "battle-start",
    type: "system",
    round: 0,
    source: "arena",
    narrative: `${modeConfig.label || modeConfig.id} initialized in ${style === "model-duel" ? "model duel" : "classic"} style.`
  }
];

const applyLstmLock = (battle) => {
  for (const side of SIDE_ORDER) {
    const boss = asArray(battle.teams?.[side]).find(hasLstmLock);
    if (boss) {
      return {
        ...battle,
        status: "complete",
        winnerSide: side,
        log: [
          ...battle.log,
          {
            id: `lstm-lock-${side}`,
            type: "wildcard",
            round: 0,
            side,
            source: "arena",
            narrative: `${getCharacterName(boss)} triggers LSTM LOCK. The arena remembers the whole fight tree and awards ${side.toUpperCase()} the win.`
          }
        ]
      };
    }
  }

  return battle;
};

export const createBattle = ({
  mode = "random-1v1",
  style = "classic",
  characters = [],
  selectedTeams = {},
  battleConfig = DEFAULT_BATTLE_CONFIG,
  seed = `${Date.now()}`,
  tokenBudget
} = {}) => {
  const modeConfig = getModeConfig(battleConfig, mode);
  const size = clamp(asNumber(modeConfig.teamSize, 1), 1, 5);
  const allCharacters = asArray(characters).map(normalizeCharacter).filter((character) => character.id);
  const selected = asRecord(selectedTeams);
  const selectionMode = asString(modeConfig.selection, "random");
  const c1Team =
    selectionMode === "select"
      ? completeSelectedTeam({ selected: selected.c1, characters: allCharacters, side: "c1", size, mode, battleConfig, seed })
      : selectRandomTeam({ characters: allCharacters, side: "c1", size, mode, battleConfig, seed: `${seed}:c1` });
  const c2Team =
    selectionMode === "select"
      ? completeSelectedTeam({ selected: selected.c2, characters: allCharacters, side: "c2", size, mode, battleConfig, seed })
      : selectRandomTeam({
          characters: allCharacters,
          side: "c2",
          size,
          mode,
          battleConfig,
          seed: `${seed}:c2`,
          excludeIds: c1Team.map((character) => character.id)
        });
  const teams = {
    c1: c1Team.map((character, index) => toCombatant(character, "c1", index)),
    c2: c2Team.map((character, index) => toCombatant(character, "c2", index))
  };
  const hp = Object.fromEntries([...teams.c1, ...teams.c2].map((fighter) => [fighter.instanceId, fighter.maxHp]));
  const budget = clamp(
    asNumber(tokenBudget, battleConfig.tokenBudget?.defaultTokens ?? DEFAULT_BATTLE_CONFIG.tokenBudget.defaultTokens),
    0,
    asNumber(battleConfig.tokenBudget?.maxTokens, DEFAULT_BATTLE_CONFIG.tokenBudget.maxTokens)
  );
  const battle = {
    id: `battle-${stableHash(`${seed}:${mode}:${style}`).toString(16)}`,
    mode,
    style,
    seed,
    round: 1,
    turnSide: "c1",
    status: "active",
    winnerSide: null,
    teams,
    activeIndex: { c1: 0, c2: 0 },
    hp,
    shields: { c1: 0, c2: 0 },
    statusEffects: [],
    tokenLedger: {
      budget,
      spent: 0,
      remaining: budget,
      calls: []
    },
    log: initialLog(modeConfig, style)
  };

  return applyLstmLock(battle);
};

export const getActiveFighter = (battle, side = battle?.turnSide) => {
  const value = asRecord(battle);
  const index = asNumber(value.activeIndex?.[side], 0);
  return asArray(value.teams?.[side])[index] ?? null;
};

const hydrateAttack = (fighter, attackInput, battleConfig = DEFAULT_BATTLE_CONFIG) => {
  const attackId = typeof attackInput === "string" ? attackInput : attackInput?.id;
  const base = {
    ...getAttackConfig(battleConfig, attackId),
    ...(typeof attackInput === "object" ? attackInput : {})
  };
  const qualities = deriveCharacterQualities(fighter);
  const attack = {
    ...base,
    label: base.id === "special" ? asString(fighter?.special, base.label) : base.label,
    qualityTags: attackQualityIdsFor(fighter, base)
  };
  return {
    ...attack,
    preview: makeAttackCopy(fighter, attack, qualities),
    qualityLabels: qualityLabels(qualityRowsFromIds(attack.qualityTags)),
    description:
      attack.id === "special"
        ? `${getCharacterName(fighter)} signature move. ${asString(fighter?.lore).slice(0, 120)}`
        : attack.description
  };
};

export const getAvailableAttacks = (fighter, battleConfig = DEFAULT_BATTLE_CONFIG) =>
  asArray(battleConfig.attacks ?? DEFAULT_BATTLE_CONFIG.attacks).map((attack) => hydrateAttack(fighter, attack, battleConfig));

export const createBattleCard = (battle, attackInput, { battleConfig = DEFAULT_BATTLE_CONFIG } = {}) => {
  const value = asRecord(battle);
  const attackerSide = asString(value.turnSide, "c1");
  const defenderSide = otherSide(attackerSide);
  const attacker = getActiveFighter(value, attackerSide);
  const defender = getActiveFighter(value, defenderSide);
  if (!attacker || !defender) {
    return null;
  }

  const attack = hydrateAttack(attacker, attackInput, battleConfig);
  const attackerQualities = deriveCharacterQualities(attacker);
  const defenderBaseQualities = deriveCharacterQualities(defender);
  const attackQualities = uniqueQualityRows([
    ...qualityRowsFromIds(attack.qualityTags),
    ...(attack.id === "special" ? attackerQualities.slice(0, 1) : [])
  ]).slice(0, 4);
  const defenderQualities = uniqueQualityRows([
    ...defenderBaseQualities,
    ...(asNumber(value.shields?.[defenderSide], 0) > 0 ? qualityRowsFromIds(["safety"]) : [])
  ]).slice(0, 4);
  const defenderShield = clamp(asNumber(value.shields?.[defenderSide], 0), 0, 0.75);
  const matchup = evaluateQualityMatchup({ attackQualities, defenderQualities, attack, defenderShield });
  const attackerStats = normalizeStats(attacker.stats);
  const defenderStats = normalizeStats(defender.stats);
  const attackStat = asNumber(attackerStats[attack.stat], attackerStats.ATK);
  const defenseStat = asNumber(defenderStats.DEF, 70);
  const statDelta = Math.round((attackStat - defenseStat) * 0.45);

  return {
    schemaVersion: 1,
    id: `card-${value.round}-${attackerSide}-${defenderSide}-${attack.id}`,
    round: asNumber(value.round, 1),
    attackerSide,
    defenderSide,
    attacker: {
      id: attacker.id,
      name: getCharacterName(attacker),
      class: attacker.cls,
      qualities: attackerQualities
    },
    defender: {
      id: defender.id,
      name: getCharacterName(defender),
      class: defender.cls,
      qualities: defenderQualities
    },
    selectedAttack: {
      id: attack.id,
      label: attack.label,
      kind: attack.kind,
      stat: attack.stat,
      power: asNumber(attack.power, 0),
      qualityTags: attackQualities.map((quality) => quality.id)
    },
    attack: {
      copy: makeAttackCopy(attacker, attack, attackerQualities),
      qualities: attackQualities,
      statValue: attackStat,
      score: clamp(attackStat + matchup.attackBonus + statDelta, 0, 140)
    },
    defense: {
      copy: makeDefenseCopy(defender, attackQualities, defenderQualities, defenderShield),
      qualities: defenderQualities,
      statValue: defenseStat,
      shield: defenderShield,
      score: clamp(defenseStat + matchup.defenseBonus - statDelta, 0, 140)
    },
    matchup: {
      ...matchup,
      statDelta
    }
  };
};

const activeEffects = (battle) =>
  asArray(battle.statusEffects).filter((effect) => asNumber(effect.expiresRound, battle.round + 1) >= battle.round);

const hasEffect = (battle, side, type) =>
  activeEffects(battle).some((effect) => effect.side === side && effect.type === type);

const makeClassicNarrative = ({ attacker, defender, attack, hit, damage, shield, effect, battleCard }) => {
  const attackCopy = asString(battleCard?.attack?.copy);
  const defenseCopy = asString(battleCard?.defense?.copy);
  const matchupLabel = asString(battleCard?.matchup?.label, "messy neutral");
  if (!hit) {
    return `${attackCopy || `${getCharacterName(attacker)} goes for ${attack.label}`}. ${defenseCopy || `${getCharacterName(defender)} slips out of the line`}. Zero damage; the matchup chart does a tiny victory dance for the defense.`;
  }
  if (attack.kind === "defend") {
    return `${attackCopy || `${getCharacterName(attacker)} braces behind ${attack.label}`}. ${getCharacterName(defender)} still catches ${damage} stray damage while the shield charges.`;
  }
  const effectText = effect ? ` ${effect.label} sticks.` : "";
  const shieldText = shield > 0 ? " The defender's guard absorbs part of it, rudely." : "";
  return `${attackCopy || `${getCharacterName(attacker)} lands ${attack.label}`}. ${defenseCopy || `${getCharacterName(defender)} tries to stabilize`}. ${matchupLabel.toUpperCase()} for ${damage} damage.${shieldText}${effectText}`;
};

const makeStatusEffect = ({ attack, defenderSide, random, battle }) => {
  if (attack.id === "special" && random() < 0.34) {
    return {
      side: defenderSide,
      type: "signal-jammed",
      label: "Signal jammed",
      expiresRound: battle.round + 2
    };
  }
  if (attack.id === "heavy" && random() < 0.16) {
    return {
      side: defenderSide,
      type: "staggered",
      label: "Staggered",
      expiresRound: battle.round + 2
    };
  }
  return null;
};

export const pickCpuAttack = (battle, battleConfig = DEFAULT_BATTLE_CONFIG) => {
  const attacker = getActiveFighter(battle, battle.turnSide);
  const defender = getActiveFighter(battle, otherSide(battle.turnSide));
  const attacks = getAvailableAttacks(attacker, battleConfig);
  const attackerHp = asNumber(battle.hp?.[attacker?.instanceId], 0);
  const attackerMaxHp = asNumber(attacker?.maxHp, 1);
  const defenderHp = asNumber(battle.hp?.[defender?.instanceId], 0);
  const rng = createSeededRandom(`${battle.seed}:cpu:${battle.round}:${battle.turnSide}`);

  if (attackerHp / attackerMaxHp < 0.34 && rng() < 0.45) {
    return attacks.find((attack) => attack.id === "counter") ?? attacks[0];
  }
  if (defenderHp < 38 && rng() < 0.7) {
    return attacks.find((attack) => attack.id === "quick") ?? attacks[0];
  }
  if (rng() > 0.62) {
    return attacks.find((attack) => attack.id === "special") ?? attacks[0];
  }

  return attacks[Math.floor(rng() * attacks.length) % attacks.length] ?? attacks[0];
};

const appendBattleLog = (battle, entries) => ({
  ...battle,
  log: [...asArray(battle.log), ...asArray(entries)]
});

export const advanceBattle = (battle, result = {}) => {
  const value = asRecord(battle);
  if (value.status === "complete") {
    return value;
  }

  const attackerSide = asString(result.attackerSide, value.turnSide);
  const defenderSide = asString(result.defenderSide, otherSide(attackerSide));
  const attacker = getActiveFighter(value, attackerSide);
  const defender = getActiveFighter(value, defenderSide);
  if (!attacker || !defender) {
    return value;
  }

  const damage = clamp(asNumber(result.damage, 0), 0, 80);
  const hp = { ...asRecord(value.hp) };
  hp[defender.instanceId] = Math.max(0, asNumber(hp[defender.instanceId], defender.maxHp) - damage);
  const shields = { ...asRecord(value.shields) };
  if (result.usedDefenderShield) {
    shields[defenderSide] = 0;
  }
  if (asNumber(result.shield, 0) > 0) {
    shields[attackerSide] = Math.max(asNumber(shields[attackerSide], 0), clamp(asNumber(result.shield, 0), 0, 0.75));
  }

  const battleCard = result.battleCard
    ? {
        ...result.battleCard,
        result: {
          hit: Boolean(result.hit),
          damage,
          hpAfter: hp[defender.instanceId],
          shieldGained: clamp(asNumber(result.shield, 0), 0, 0.75),
          usedDefenderShield: Boolean(result.usedDefenderShield)
        }
      }
    : null;
  const metadata = compactObject({
    ...asRecord(result.metadata),
    battleCard: battleCard || undefined
  });

  const logEntries = [
    compactObject({
      id: `turn-${value.round}-${attackerSide}-${asString(result.attack?.id, "attack")}`,
      type: "turn",
      round: value.round,
      side: attackerSide,
      source: asString(result.source, "classic"),
      attackerId: attacker.id,
      defenderId: defender.id,
      attackId: result.attack?.id,
      attackLabel: result.attack?.label,
      damage,
      hit: result.hit,
      narrative: asString(result.narrative),
      hpAfter: hp[defender.instanceId],
      metadata: Object.keys(metadata).length ? metadata : undefined
    })
  ];

  const activeIndex = { ...asRecord(value.activeIndex) };
  let status = "active";
  let winnerSide = null;
  let turnSide = defenderSide;

  if (hp[defender.instanceId] <= 0) {
    logEntries.push({
      id: `ko-${value.round}-${defender.instanceId}`,
      type: "ko",
      round: value.round,
      side: defenderSide,
      source: "arena",
      narrative: `${getCharacterName(defender)} is knocked out.`
    });

    const nextIndex = asNumber(activeIndex[defenderSide], 0) + 1;
    if (nextIndex < asArray(value.teams?.[defenderSide]).length) {
      activeIndex[defenderSide] = nextIndex;
      const nextFighter = value.teams[defenderSide][nextIndex];
      hp[nextFighter.instanceId] = asNumber(hp[nextFighter.instanceId], nextFighter.maxHp);
      logEntries.push({
        id: `send-${value.round}-${nextFighter.instanceId}`,
        type: "switch",
        round: value.round,
        side: defenderSide,
        source: "arena",
        narrative: `${getCharacterName(nextFighter)} enters for ${defenderSide.toUpperCase()}.`
      });
    } else {
      status = "complete";
      winnerSide = attackerSide;
      turnSide = attackerSide;
      logEntries.push({
        id: `win-${value.round}-${attackerSide}`,
        type: "win",
        round: value.round,
        side: attackerSide,
        source: "arena",
        narrative: `${attackerSide.toUpperCase()} wins the battle.`
      });
    }
  }

  const finalBattleCard = battleCard
    ? {
        ...battleCard,
        result: {
          ...battleCard.result,
          status,
          winnerSide
        }
      }
    : null;
  if (finalBattleCard) {
    const firstTurn = logEntries.find((entry) => entry.type === "turn");
    if (firstTurn?.metadata?.battleCard) {
      firstTurn.metadata.battleCard = finalBattleCard;
    }
  }

  return {
    ...appendBattleLog(value, logEntries),
    round: value.round + 1,
    turnSide,
    status,
    winnerSide,
    hp,
    shields,
    activeIndex,
    lastBattleCard: finalBattleCard ?? value.lastBattleCard ?? null,
    statusEffects: [
      ...activeEffects(value).filter((effect) => asNumber(effect.expiresRound, 0) > value.round),
      ...asArray(result.statusEffects).map((effect) => ({
        ...effect,
        side: asString(effect.side, defenderSide),
        expiresRound: asNumber(effect.expiresRound, value.round + 2)
      }))
    ]
  };
};

export const resolveClassicTurn = (battle, attackInput, { battleConfig = DEFAULT_BATTLE_CONFIG } = {}) => {
  const value = asRecord(battle);
  if (value.status === "complete") {
    return value;
  }

  const attackerSide = value.turnSide;
  const defenderSide = otherSide(attackerSide);
  const attacker = getActiveFighter(value, attackerSide);
  const defender = getActiveFighter(value, defenderSide);
  if (!attacker || !defender) {
    return value;
  }

  const attack = hydrateAttack(attacker, attackInput, battleConfig);
  const battleCard = createBattleCard(value, attack, { battleConfig });
  const rng = createSeededRandom(`${value.seed}:${value.round}:${attacker.instanceId}:${defender.instanceId}:${attack.id}`);
  const defenderShield = clamp(asNumber(value.shields?.[defenderSide], 0), 0, 0.75);
  const attackerStats = normalizeStats(attacker.stats);
  const defenderStats = normalizeStats(defender.stats);
  const attackStat = asNumber(attackerStats[attack.stat], attackerStats.ATK);
  const defensePenalty = hasEffect(value, defenderSide, "signal-jammed") ? 0.72 : 1;
  const attackerPenalty = hasEffect(value, attackerSide, "staggered") ? 0.84 : 1;
  const matchupScore = asNumber(battleCard?.matchup?.score, 0);
  const statDelta = asNumber(battleCard?.matchup?.statDelta, Math.round((attackStat - defenderStats.DEF) * 0.45));
  const accuracyScore = Math.round((asNumber(attack.accuracy, 1) - 0.86) * 55);
  const hit = attack.kind === "defend" || matchupScore + statDelta + accuracyScore > -18;
  const variance = 0.94 + rng() * 0.12;
  const base =
    (asNumber(attack.power, 18) +
      (attackStat - 70) * 0.24 +
      (asNumber(attacker.threatScore, 70) - 70) * 0.08 -
      (defenderStats.DEF - 70) * 0.13 * defensePenalty +
      matchupScore * 0.58) *
    attackerPenalty *
    variance *
    (1 - defenderShield);
  const maxDamage = attack.kind === "special" ? 56 : attack.kind === "defend" ? 22 : 44;
  const minDamage = attack.kind === "defend" ? 2 : 6;
  const damage = hit ? clamp(Math.round(base), minDamage, maxDamage) : 0;
  const effect = hit ? makeStatusEffect({ attack, defenderSide, random: rng, battle: value }) : null;
  const narrative = makeClassicNarrative({
    attacker,
    defender,
    attack,
    hit,
    damage,
    shield: defenderShield,
    effect,
    battleCard
  });

  return advanceBattle(value, {
    attackerSide,
    defenderSide,
    attack,
    hit,
    damage,
    shield: asNumber(attack.shield, 0),
    usedDefenderShield: defenderShield > 0,
    statusEffects: effect ? [effect] : [],
    source: "classic",
    narrative,
    battleCard,
    metadata: {
      matchup: battleCard?.matchup
    }
  });
};

export const applyJudgeVerdict = (battle, verdictInput, attackInput, { battleConfig = DEFAULT_BATTLE_CONFIG } = {}) => {
  const value = asRecord(battle);
  if (value.status === "complete") {
    return value;
  }

  const verdict = asRecord(verdictInput);
  const attackerSide = value.turnSide;
  const defenderSide = otherSide(attackerSide);
  const attackId = typeof attackInput === "string" ? attackInput : attackInput?.id;
  const attack = {
    ...getAttackConfig(battleConfig, attackId),
    ...(typeof attackInput === "object" ? attackInput : {})
  };
  const damage = clamp(asNumber(verdict.damage, 0), 0, 64);
  const statusEffects = asArray(verdict.statusEffects)
    .map((effect) => asRecord(effect))
    .filter((effect) => asString(effect.type))
    .slice(0, 2)
    .map((effect) => ({
      side: asString(effect.side, defenderSide),
      type: asString(effect.type),
      label: asString(effect.label || effect.type),
      expiresRound: asNumber(effect.expiresRound, value.round + 2)
    }));

  return advanceBattle(value, {
    attackerSide,
    defenderSide,
    attack,
    hit: damage > 0,
    damage,
    usedDefenderShield: asNumber(value.shields?.[defenderSide], 0) > 0,
    source: "llm-judge",
    narrative: asString(verdict.narrative, `${attack.label} lands for ${damage}.`),
    statusEffects,
    metadata: {
      attackQuality: verdict.attackQuality,
      defenseQuality: verdict.defenseQuality,
      criteriaScores: verdict.criteriaScores,
      tokenSummary: verdict.tokenSummary
    }
  });
};
