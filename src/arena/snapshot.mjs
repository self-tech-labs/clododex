import { asArray, asNumber, asRecord, asString, compactObject } from "./core.mjs";
import { normalizeCharacter, normalizeFighter } from "./evidence.mjs";
import { recomputePower, recomputeTerritories, updateRosterActivity } from "./metrics.mjs";
import {
  applyConfiguredSide,
  buildHandleIndex,
  dedupeIntelItems,
  dedupePosts,
  isVisibleIntelItem,
  makeIntelItemFromPost,
  normalizeIntelItem
} from "./signals.mjs";
import { toDashboardTweet } from "./dashboard.mjs";
import { validateArena } from "./validation.mjs";

const normalizeContender = (contender) => {
  const value = asRecord(contender);
  return {
    ...value,
    id: asString(value.id),
    side: asString(value.side),
    name: asString(value.name || value.product || value.organization),
    organization: asString(value.organization),
    product: asString(value.product || value.name),
    stance: asString(value.stance),
    teamLabel: asString(value.teamLabel) || `TEAM ${asString(value.name || value.product || value.id).toUpperCase()}`
  };
};

const normalizeArenaCharacter = (character, contendersById) => {
  const value = normalizeCharacter(character);
  const contenderId = asString(value.contenderId ?? value.contender_id);
  const contender = contendersById.get(contenderId);
  return {
    ...value,
    contenderId,
    side: asString(value.side || contender?.side),
    contenderSide: asString(contender?.side),
    roleClass: asString(value.roleClass || value.cls || value.role),
    displayName: asString(value.displayName || `${asString(value.name)} ${asString(value.surname)}`).trim()
  };
};

const buildDashboardFromPrimitives = ({ arena, contenders, characters, visibleSignals, territories, power, status, meta }) => {
  const dashboard = asRecord(arena.dashboard);
  const bySide = (side) =>
    characters
      .filter((character) => character.side === side)
      .map((character) => ({
        ...character,
        name: asString(character.name || character.displayName).toUpperCase(),
        surname: asString(character.surname).toUpperCase(),
        cls: asString(character.cls || character.roleClass || "THE BUILDER").toUpperCase(),
        stats: character.stats ?? { ATK: 70, DEF: 70, SPD: 70, COMBO: 70, HP: 70 },
        special: asString(character.special, "SIGNAL BURST"),
        combo: asArray(character.combo),
        lore: asString(character.lore || character.description),
        threatScore: asNumber(character.threatScore ?? character.score, 70),
        lastActivity: asString(character.lastActivity, "n/a")
      }));

  return {
    meta,
    arena: {
      id: arena.id,
      title: arena.title,
      summary: arena.summary
    },
    contenders,
    claudeTeam: bySide("c1"),
    codexTeam: bySide("c2"),
    tweets: visibleSignals.map(toDashboardTweet),
    announcements: asArray(dashboard.announcements),
    verticals: territories,
    power,
    status,
    scoringRubric: arena.scoringRubric,
    concepts: asArray(arena.concepts),
    integrations: asArray(arena.integrations),
    surfaces: asArray(arena.surfaces)
  };
};

const executeConceptHooks = ({ arena, snapshot, now, adapters }) => {
  const hooksByConcept = asRecord(arena.conceptHooks ?? adapters?.conceptHooks);
  const results = {};

  for (const concept of asArray(arena.concepts)) {
    const hooks = asRecord(hooksByConcept[concept.id]);
    if (!Object.keys(hooks).length) {
      continue;
    }

    const context = { arena, concept, snapshot, now, adapters: asRecord(adapters) };
    const entities = asArray(concept.entities);
    const normalizedEntities = hooks.normalize
      ? entities.map((entity) => hooks.normalize(entity, context)).filter(Boolean)
      : entities;
    const renderHints = hooks.renderHint
      ? normalizedEntities.map((entity) => hooks.renderHint(entity, context)).filter(Boolean)
      : [];
    const score = hooks.score ? hooks.score(snapshot, context) : undefined;

    results[concept.id] = compactObject({
      normalizedEntities,
      renderHints,
      score
    });
  }

  return results;
};

export const buildArenaSnapshot = ({ arena, signals = [], adapters = {}, now = new Date() }) => {
  const validation = validateArena(arena);
  if (!validation.ok) {
    throw new Error(`Arena manifest validation failed:\n${validation.errors.join("\n")}`);
  }

  const contenders = asArray(arena.contenders).map(normalizeContender);
  const contendersById = new Map(contenders.map((contender) => [contender.id, contender]));
  const characters = asArray(arena.characters).map((character) => normalizeArenaCharacter(character, contendersById));
  const settings = asRecord(arena.dashboard);
  const threshold = asNumber(settings.lowConfidenceThreshold, 0.72);
  const baseSignals = adapters.replaceSignals ? [] : asArray(arena.signals);
  const normalizedSignals = [...baseSignals, ...asArray(signals)]
    .map((signal) => normalizeIntelItem(signal, now))
    .filter(Boolean);
  const allSignals = dedupeIntelItems(normalizedSignals);
  const visibleSignals = allSignals.filter((item) => isVisibleIntelItem(item, threshold));
  const maxSignals = asNumber(settings.maxSignals ?? settings.maxIntelItems, 12);
  const posts = asArray(adapters.posts);
  const territories = recomputeTerritories(settings.territories ?? arena.territories, visibleSignals);
  const power = recomputePower(settings.metrics?.power ?? settings.power, posts, visibleSignals);
  const sourceCount = new Set(asArray(arena.sources).map((source) => asString(source.url)).filter(Boolean)).size;
  const status = {
    streamOk: adapters.streamOk ?? true,
    xPostsToday: posts.length,
    xAccounts: buildHandleIndex(arena).size,
    xLists: asArray(arena.x?.lists).length,
    newsSources: sourceCount,
    githubRepos: 0,
    archivedSignals: allSignals.length,
    visibleSignals: visibleSignals.length
  };
  const meta = {
    generatedAt: now.toISOString(),
    schemaVersion: asNumber(arena.schemaVersion, 1),
    arenaVersion: asNumber(arena.version, 1),
    dataMode: adapters.dataMode ?? "arena-manifest",
    evidencePolicy: "Facts require source URLs. Inferences require confidence and multiple or official evidence.",
    warnings: validation.warnings
  };
  const visibleLimited = visibleSignals.slice(0, maxSignals);
  const dashboardView = adapters.dashboardView ?? buildDashboardFromPrimitives({
    arena,
    contenders,
    characters,
    visibleSignals: visibleLimited,
    territories,
    power,
    status,
    meta
  });
  const baseSnapshot = {
    kind: "arena.snapshot",
    schemaVersion: 1,
    meta,
    arena: {
      id: arena.id,
      title: arena.title,
      summary: arena.summary
    },
    primitives: {
      contenders,
      characters,
      signals: visibleLimited,
      dossiers: characters.filter((character) => character.dossier).map((character) => ({
        entityId: character.id,
        entityType: "character",
        dossier: character.dossier
      })),
      metrics: { power },
      territories,
      scoringRubric: arena.scoringRubric,
      concepts: asArray(arena.concepts),
      integrations: asArray(arena.integrations),
      surfaces: asArray(arena.surfaces)
    },
    views: {
      dashboard: dashboardView
    },
    status,
    archive: {
      lowConfidence: allSignals.filter((item) => !isVisibleIntelItem(item, threshold)),
      rawSignalCount: allSignals.length,
      rawPostCount: posts.length
    }
  };

  return {
    ...baseSnapshot,
    extensions: {
      hookResults: executeConceptHooks({ arena, snapshot: baseSnapshot, now, adapters })
    }
  };
};

const normalizeTeam = (team) => asArray(team).map((fighter) => normalizeFighter(fighter));

export const buildDashboardSnapshot = ({ config, backfill, posts = [], xaiItems = [], now = new Date(), errors = [] }) => {
  const dashboard = asRecord(backfill.dashboard);
  const handleIndex = buildHandleIndex(config);
  const normalizedPosts = dedupePosts(posts).map((post) => ({
    ...post,
    side: handleIndex.get(post.username)?.side
  }));
  const postIntel = normalizedPosts.map((post) => makeIntelItemFromPost(post, config, now));
  const seededIntel = asArray(backfill.intel).map((item) => applyConfiguredSide(normalizeIntelItem(item, now), handleIndex));
  const xaiIntel = asArray(xaiItems).map((item) => applyConfiguredSide(normalizeIntelItem(item, now), handleIndex));
  const allIntel = dedupeIntelItems([...xaiIntel, ...postIntel, ...seededIntel]);
  const visibleIntel = allIntel.filter((item) => isVisibleIntelItem(item, asNumber(config.dashboard?.lowConfidenceThreshold, 0.72)));
  const maxIntelItems = asNumber(config.dashboard?.maxIntelItems, 12);
  const sourceCount = new Set(asArray(backfill.sources).map((source) => asString(source.url)).filter(Boolean)).size;

  return {
    meta: {
      generatedAt: now.toISOString(),
      configVersion: asNumber(config.version, 1),
      backfillVersion: asNumber(backfill.version, 1),
      dataMode: posts.length ? "live-x-plus-backfill" : "backfill-only",
      evidencePolicy: "Facts require source URLs. Inferences require confidence and multiple or official evidence.",
      errors
    },
    claudeTeam: updateRosterActivity(normalizeTeam(dashboard.claudeTeam), normalizedPosts, now),
    codexTeam: updateRosterActivity(normalizeTeam(dashboard.codexTeam), normalizedPosts, now),
    tweets: visibleIntel.slice(0, maxIntelItems).map(toDashboardTweet),
    announcements: asArray(dashboard.announcements),
    verticals: recomputeTerritories(dashboard.verticals, visibleIntel),
    power: recomputePower(dashboard.power, normalizedPosts, visibleIntel),
    status: {
      streamOk: errors.length === 0,
      xPostsToday: normalizedPosts.length,
      xAccounts: handleIndex.size,
      xLists: asArray(config.x?.lists).length,
      newsSources: sourceCount,
      githubRepos: 0,
      archivedSignals: allIntel.length,
      visibleSignals: visibleIntel.length
    },
    archive: {
      lowConfidence: allIntel.filter((item) => !isVisibleIntelItem(item, asNumber(config.dashboard?.lowConfidenceThreshold, 0.72))),
      rawPostCount: normalizedPosts.length
    }
  };
};
