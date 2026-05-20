import { asArray, asRecord, asString } from "./core.mjs";

export const hasDashboardShape = (value) =>
  Boolean(
    value &&
      Array.isArray(value.claudeTeam) &&
      Array.isArray(value.codexTeam) &&
      Array.isArray(value.tweets) &&
      Array.isArray(value.announcements) &&
      Array.isArray(value.verticals) &&
      value.power?.c1 &&
      value.power?.c2
  );

export const toDashboardTweet = (item) => ({
  side: item.side,
  author: item.author,
  handle: item.handle,
  stamp: item.stamp,
  text: item.text,
  insight: item.insight,
  tags: item.tags?.length ? item.tags : [{ l: "SIGNAL", t: "info" }],
  type: item.type,
  confidence: item.confidence,
  evidenceUrls: item.evidenceUrls,
  rationale: item.rationale,
  impact: item.impact
});

const adaptCharacter = (character) => ({
  ...character,
  name: asString(character.name || character.givenName || character.displayName).toUpperCase(),
  surname: asString(character.surname || character.familyName || "").toUpperCase(),
  cls: asString(character.cls || character.roleClass || character.role || "THE BUILDER").toUpperCase(),
  stats: character.stats ?? { ATK: 70, DEF: 70, SPD: 70, COMBO: 70, HP: 70 },
  combo: Array.isArray(character.combo) ? character.combo : [],
  lastActivity: asString(character.lastActivity, "n/a"),
  threatScore: character.threatScore ?? character.score ?? 70
});

const contenderFallbacks = [
  { id: "claude", side: "c1", name: "Claude", organization: "Anthropic", stance: "safety-first", teamLabel: "TEAM CLAUDE" },
  { id: "codex", side: "c2", name: "Codex", organization: "OpenAI", stance: "distribution-first", teamLabel: "TEAM CODEX" }
];

export const toDashboardView = (snapshot) => {
  if (!snapshot) {
    return null;
  }

  const existingDashboard = snapshot.views?.dashboard ?? snapshot.dashboard;
  if (hasDashboardShape(existingDashboard)) {
    return {
      ...existingDashboard,
      arena: snapshot.arena ?? existingDashboard.arena,
      contenders: snapshot.primitives?.contenders ?? existingDashboard.contenders ?? contenderFallbacks,
      concepts: snapshot.primitives?.concepts ?? existingDashboard.concepts ?? [],
      integrations: snapshot.primitives?.integrations ?? existingDashboard.integrations ?? [],
      surfaces: snapshot.primitives?.surfaces ?? existingDashboard.surfaces ?? [],
      scoringRubric: snapshot.primitives?.scoringRubric ?? existingDashboard.scoringRubric,
      extensions: snapshot.extensions ?? existingDashboard.extensions ?? {}
    };
  }

  if (hasDashboardShape(snapshot)) {
    return {
      ...snapshot,
      contenders: snapshot.contenders ?? contenderFallbacks,
      concepts: snapshot.concepts ?? [],
      integrations: snapshot.integrations ?? [],
      surfaces: snapshot.surfaces ?? [],
      scoringRubric: snapshot.scoringRubric,
      extensions: snapshot.extensions ?? {}
    };
  }

  const primitives = asRecord(snapshot.primitives);
  const contenders = asArray(primitives.contenders).length ? asArray(primitives.contenders) : contenderFallbacks;
  const characters = asArray(primitives.characters);
  const bySide = (side) => characters.filter((character) => character.side === side || character.contenderSide === side).map(adaptCharacter);
  const dashboardSettings = asRecord(snapshot.dashboard ?? snapshot.arena?.dashboard);

  return {
    meta: snapshot.meta,
    arena: snapshot.arena,
    contenders,
    claudeTeam: bySide("c1"),
    codexTeam: bySide("c2"),
    tweets: asArray(primitives.signals).map(toDashboardTweet),
    announcements: asArray(dashboardSettings.announcements),
    verticals: asArray(primitives.territories),
    power: asRecord(primitives.metrics?.power),
    status: snapshot.status,
    scoringRubric: primitives.scoringRubric,
    concepts: asArray(primitives.concepts),
    integrations: asArray(primitives.integrations),
    surfaces: asArray(primitives.surfaces),
    extensions: snapshot.extensions ?? {}
  };
};
