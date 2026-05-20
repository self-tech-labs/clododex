import { asArray, asNumber, asRecord, asString, clamp } from "./core.mjs";
import { formatRelativeTime, normalizeHandle } from "./signals.mjs";

export const updateRosterActivity = (team, posts, now) =>
  asArray(team).map((fighter) => {
    const handle = normalizeHandle(fighter.handle);
    const latest = posts.find((post) => post.username === handle);
    return latest
      ? {
          ...fighter,
          lastActivity: formatRelativeTime(latest.createdAt, now)
        }
      : fighter;
  });

const territoryKeywords = {
  DEV: ["DEVTOOLS", "PRODUCT"],
  LAW: ["ENTERPRISE"],
  FIN: ["ENTERPRISE", "FUNDING"],
  MED: ["RESEARCH"],
  EDU: ["PRODUCT"],
  CRE: ["PRODUCT"],
  CS: ["ENTERPRISE", "PRODUCT"],
  GOV: ["SECURITY"],
  ENT: ["ENTERPRISE", "SECURITY"],
  SCI: ["RESEARCH"]
};

export const recomputeTerritories = (baseTerritories, signals) =>
  asArray(baseTerritories).map((territory) => {
    const next = { ...territory };
    const labels = territory.keywords ?? territoryKeywords[territory.key] ?? [];

    for (const item of signals) {
      const itemLabels = asArray(item.tags).map((tag) => asString(tag.l));
      if (!itemLabels.some((label) => labels.includes(label))) {
        continue;
      }

      const key = item.side === "c1" ? "c1" : "c2";
      const delta = item.type === "inference" ? 2 : 1;
      next[key] = clamp(asNumber(next[key], 0) + delta, 0, 100);
    }

    return next;
  });

export const recomputeVerticals = recomputeTerritories;

export const recomputePower = (basePower, posts, signals) => {
  const bySide = { c1: { posts: 0, engagement: 0, enterprise: 0, ships: 0 }, c2: { posts: 0, engagement: 0, enterprise: 0, ships: 0 } };

  for (const item of signals) {
    const bucket = bySide[item.side];
    if (!bucket) {
      continue;
    }

    bucket.posts += 1;
    bucket.engagement += asNumber(item.metrics?.likes, 0) + asNumber(item.metrics?.retweets, 0) * 3;
    const labels = asArray(item.tags).map((tag) => asString(tag.l));
    if (labels.includes("ENTERPRISE")) {
      bucket.enterprise += 1;
    }
    if (labels.some((label) => ["PRODUCT", "DEVTOOLS"].includes(label))) {
      bucket.ships += 1;
    }
  }

  const postSides = asArray(posts).reduce((acc, post) => {
    acc[post.side] = (acc[post.side] ?? 0) + 1;
    return acc;
  }, {});

  const computeSide = (side) => {
    const base = asRecord(basePower?.[side]);
    const bucket = bySide[side];
    const postLift = Math.min(8, bucket.posts + asNumber(postSides[side], 0) * 0.4);
    const engagementLift = Math.min(6, Math.log10(Math.max(1, bucket.engagement + 1)));

    return {
      momentum: Math.round(clamp(asNumber(base.momentum, 75) + postLift + engagementLift, 0, 100)),
      mindshare: Math.round(clamp(asNumber(base.mindshare, 30) + engagementLift, 0, 100)),
      enterprise: Math.round(clamp(asNumber(base.enterprise, 30) + bucket.enterprise, 0, 100)),
      ship: Math.round(clamp(asNumber(base.ship, 10) + bucket.ships, 0, 100))
    };
  };

  const next = {
    c1: computeSide("c1"),
    c2: computeSide("c2"),
    rationale: asRecord(basePower?.rationale)
  };

  next.trends = {
    c1: {
      momentum: `+${Math.max(0, next.c1.momentum - asNumber(basePower?.c1?.momentum, next.c1.momentum))}`,
      mindshare: `+${Math.max(0, next.c1.mindshare - asNumber(basePower?.c1?.mindshare, next.c1.mindshare))}`,
      enterprise: `+${Math.max(0, next.c1.enterprise - asNumber(basePower?.c1?.enterprise, next.c1.enterprise))}`,
      ship: `+${Math.max(0, next.c1.ship - asNumber(basePower?.c1?.ship, next.c1.ship))}`
    },
    c2: {
      momentum: `+${Math.max(0, next.c2.momentum - asNumber(basePower?.c2?.momentum, next.c2.momentum))}`,
      mindshare: `+${Math.max(0, next.c2.mindshare - asNumber(basePower?.c2?.mindshare, next.c2.mindshare))}`,
      enterprise: `+${Math.max(0, next.c2.enterprise - asNumber(basePower?.c2?.enterprise, next.c2.enterprise))}`,
      ship: `+${Math.max(0, next.c2.ship - asNumber(basePower?.c2?.ship, next.c2.ship))}`
    }
  };

  return next;
};
