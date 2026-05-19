import fs from "node:fs";
import path from "node:path";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const asRecord = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

export const asArray = (value) => (Array.isArray(value) ? value : []);

export const asString = (value, fallback = "") => (typeof value === "string" ? value : fallback);

export const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const readJsonFile = (filePath, fallback = null) => {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
};

export const writeJsonFile = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

export const loadEnvFile = (rootDir, filename = ".env") => {
  const envPath = path.resolve(rootDir, filename);
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }

    const [rawKey, ...rawValue] = line.split("=");
    const key = rawKey.trim();
    const value = rawValue.join("=").trim().replace(/^['"]|['"]$/g, "");

    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
};

export const normalizeHandle = (value) => asString(value).trim().replace(/^@/, "").toLowerCase();

export const displayHandle = (value) => {
  const normalized = normalizeHandle(value);
  return normalized ? `@${normalized}` : "";
};

export const parseTimestamp = (value) => {
  const parsed = Date.parse(asString(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatRelativeTime = (createdAt, now = new Date()) => {
  const created = parseTimestamp(createdAt);
  if (!created) {
    return "n/a";
  }

  const delta = Math.max(0, now.getTime() - created);
  if (delta < HOUR_MS) {
    return `${Math.max(1, Math.round(delta / (60 * 1000)))}m`;
  }
  if (delta < DAY_MS) {
    return `${Math.round(delta / HOUR_MS)}h`;
  }
  return `${Math.round(delta / DAY_MS)}d`;
};

const engagementScore = (metrics) =>
  asNumber(metrics.likes ?? metrics.like_count, 0) +
  3 * asNumber(metrics.retweets ?? metrics.retweet_count, 0) +
  4 * asNumber(metrics.quotes ?? metrics.quote_count, 0) +
  2 * asNumber(metrics.replies ?? metrics.reply_count, 0);

export const normalizePost = (rawPost, source = {}) => {
  const post = asRecord(rawPost);
  const metrics = asRecord(post.metrics ?? post.public_metrics);
  const id = asString(post.id).trim();
  const username = normalizeHandle(post.username ?? post.author?.username ?? source.username);
  const authorName = asString(post.name ?? post.author?.name ?? source.name ?? username, username);
  const createdAt = asString(post.created_at ?? post.createdAt).trim();
  const tweetUrl = asString(post.tweet_url ?? post.tweetUrl).trim() || (id && username ? `https://x.com/${username}/status/${id}` : "");
  const text = asString(post.text).trim();

  if (!id || !username || !tweetUrl || !text) {
    return null;
  }

  const normalizedMetrics = {
    likes: asNumber(metrics.likes ?? metrics.like_count, 0),
    retweets: asNumber(metrics.retweets ?? metrics.retweet_count, 0),
    replies: asNumber(metrics.replies ?? metrics.reply_count, 0),
    quotes: asNumber(metrics.quotes ?? metrics.quote_count, 0),
    impressions: asNumber(metrics.impressions ?? metrics.impression_count, 0),
    bookmarks: asNumber(metrics.bookmarks ?? metrics.bookmark_count, 0)
  };

  return {
    id,
    createdAt,
    authorId: asString(post.author_id ?? post.authorId),
    username,
    name: authorName,
    text,
    conversationId: asString(post.conversation_id ?? post.conversationId),
    metrics: normalizedMetrics,
    engagementScore: asNumber(post.engagement_score ?? post.engagementScore, engagementScore(normalizedMetrics)),
    urls: asArray(post.urls).filter((url) => typeof url === "string" && url.startsWith("http")),
    hashtags: asArray(post.hashtags).filter((tag) => typeof tag === "string" && tag.trim()),
    tweetUrl,
    source: asRecord(source)
  };
};

export const dedupePosts = (posts) => {
  const byId = new Map();

  for (const maybePost of posts) {
    const post = normalizePost(maybePost);
    if (!post) {
      continue;
    }

    const previous = byId.get(post.id);
    if (!previous || post.engagementScore > previous.engagementScore) {
      byId.set(post.id, post);
    }
  }

  return [...byId.values()].sort((left, right) => parseTimestamp(right.createdAt) - parseTimestamp(left.createdAt));
};

export const getCompanyEntries = (config) =>
  Object.entries(asRecord(config.companies)).map(([key, company]) => ({
    key,
    ...asRecord(company)
  }));

export const buildHandleIndex = (config) => {
  const index = new Map();

  for (const company of getCompanyEntries(config)) {
    const side = asString(company.side);
    const addAccount = (entry, tier) => {
      const record = asRecord(entry);
      const username = normalizeHandle(record.handle ?? record.username);
      if (!username) {
        return;
      }

      index.set(username, {
        side,
        companyKey: company.key,
        organization: asString(company.organization),
        name: asString(record.name, username),
        role: asString(record.role, tier),
        tier,
        weight: asNumber(record.weight, tier === "official" ? 1.5 : 1)
      });
    };

    asArray(company.officialAccounts).forEach((entry) => addAccount(entry, "official"));
    asArray(company.productAccounts).forEach((entry) => addAccount(entry, "product"));
    asArray(company.people).forEach((entry) => addAccount(entry, "person"));
  }

  return index;
};

const tagRules = [
  { tag: { l: "DEVTOOLS", t: "move" }, terms: ["codex", "claude code", "coding", "codebase", "developer", "devtools", "pull request", "pr"] },
  { tag: { l: "PRODUCT", t: "info" }, terms: ["ship", "launch", "release", "product", "app", "feature", "preview", "beta"] },
  { tag: { l: "ENTERPRISE", t: "info" }, terms: ["enterprise", "customer", "deployment", "sales", "fortune", "case study", "seat"] },
  { tag: { l: "SECURITY", t: "warn" }, terms: ["security", "supply chain", "installer", "vulnerability", "policy", "trust", "safe"] },
  { tag: { l: "RESEARCH", t: "info" }, terms: ["research", "model", "benchmark", "reasoning", "rl", "eval", "science"] },
  { tag: { l: "FUNDING", t: "hot" }, terms: ["funding", "capital", "valuation", "compute", "gpu", "infrastructure"] },
  { tag: { l: "PARTNERSHIP", t: "move" }, terms: ["partner", "partnership", "acquired", "acquisition", "deal"] },
  { tag: { l: "TALENT", t: "warn" }, terms: ["hiring", "joined", "team", "labs", "org"] }
];

export const classifyTags = (text) => {
  const lower = asString(text).toLowerCase();
  const tags = [];

  for (const rule of tagRules) {
    if (rule.terms.some((term) => lower.includes(term))) {
      tags.push(rule.tag);
    }
  }

  return tags.length ? tags.slice(0, 3) : [{ l: "SIGNAL", t: "info" }];
};

const trimText = (value, maxLength = 260) => {
  const text = asString(value).replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1).trim()}...`;
};

const normalizeEvidenceUrls = (urls) => [
  ...new Set(asArray(urls).filter((url) => typeof url === "string" && /^https?:\/\//.test(url)))
];

const compactObject = (value) => Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));

const normalizeDossierTextEntry = (rawEntry, fields) => {
  const entry = asRecord(rawEntry);
  const evidenceUrls = normalizeEvidenceUrls(entry.evidenceUrls ?? entry.evidence_urls);
  if (!evidenceUrls.length) {
    return null;
  }

  const normalized = { evidenceUrls };
  for (const [field, maxLength] of fields) {
    const text = trimText(entry[field], maxLength);
    if (!text) {
      return null;
    }
    normalized[field] = text;
  }

  const confidence = clamp(asNumber(entry.confidence, 0.78), 0, 1);
  if ("confidence" in entry || fields.some(([field]) => field === "text")) {
    normalized.confidence = confidence;
  }

  if (Array.isArray(entry.tags)) {
    const tags = entry.tags.map((tag) => asString(tag).trim()).filter(Boolean).slice(0, 5);
    if (tags.length) {
      normalized.tags = tags;
    }
  }

  return compactObject(normalized);
};

export const normalizeDossier = (rawDossier) => {
  const dossier = asRecord(rawDossier);
  if (!Object.keys(dossier).length) {
    return null;
  }

  const background = asArray(dossier.background)
    .map((entry) => normalizeDossierTextEntry(entry, [["text", 320]]))
    .filter(Boolean);
  const keyProjects = asArray(dossier.keyProjects ?? dossier.key_projects)
    .map((entry) => normalizeDossierTextEntry(entry, [["name", 80], ["description", 320]]))
    .filter(Boolean);
  const strengths = asArray(dossier.strengths)
    .map((entry) => normalizeDossierTextEntry(entry, [["label", 80], ["description", 260]]))
    .filter(Boolean);

  const narrativeEntry = normalizeDossierTextEntry(dossier.narrative, [["title", 100], ["text", 420]]);
  const sourceUrls = normalizeEvidenceUrls([
    ...asArray(dossier.sourceUrls ?? dossier.source_urls),
    ...background.flatMap((entry) => entry.evidenceUrls),
    ...keyProjects.flatMap((entry) => entry.evidenceUrls),
    ...strengths.flatMap((entry) => entry.evidenceUrls),
    ...asArray(narrativeEntry?.evidenceUrls)
  ]);

  if (!sourceUrls.length) {
    return null;
  }

  return compactObject({
    lastReviewedAt: asString(dossier.lastReviewedAt ?? dossier.last_reviewed_at).trim() || undefined,
    tagline: trimText(dossier.tagline, 150) || undefined,
    background,
    keyProjects,
    strengths,
    narrative: narrativeEntry || undefined,
    sourceUrls
  });
};

export const normalizeFighter = (rawFighter) => {
  const fighter = asRecord(rawFighter);
  const { dossier: rawDossier, ...rest } = fighter;
  const dossier = normalizeDossier(rawDossier);
  return dossier ? { ...rest, dossier } : rest;
};

const normalizeTeam = (team) => asArray(team).map((fighter) => normalizeFighter(fighter));

export const makeIntelItemFromPost = (post, config, now = new Date()) => {
  const normalized = normalizePost(post);
  if (!normalized) {
    return null;
  }

  const account = buildHandleIndex(config).get(normalized.username);
  if (!account?.side) {
    return null;
  }

  const official = account.tier === "official" || account.tier === "product";
  const engagementBoost = clamp(Math.log10(Math.max(1, normalized.engagementScore + 1)) / 20, 0, 0.12);
  const confidence = clamp((official ? 0.82 : 0.62) + engagementBoost + (account.weight - 1) * 0.08, 0.5, 0.96);
  const evidenceUrls = [normalized.tweetUrl, ...normalized.urls].filter(Boolean);
  const signalName = official ? "Official signal" : "Watchlist signal";

  return {
    id: `post-${normalized.id}`,
    side: account.side,
    type: "fact",
    sourceTier: account.tier,
    confidence,
    author: normalized.name,
    handle: displayHandle(normalized.username),
    createdAt: normalized.createdAt,
    stamp: formatRelativeTime(normalized.createdAt, now),
    text: trimText(normalized.text),
    insight: `${signalName} from ${displayHandle(normalized.username)}. Treat as evidence-backed activity, and promote to roadmap signal only when it repeats across sources.`,
    impact: official ? "Official channel update" : `Role context: ${account.role}`,
    tags: classifyTags(normalized.text),
    evidenceUrls,
    sourcePostId: normalized.id,
    metrics: normalized.metrics
  };
};

export const normalizeIntelItem = (rawItem, now = new Date()) => {
  const item = asRecord(rawItem);
  const side = asString(item.side);
  const type = asString(item.type, "fact") === "inference" ? "inference" : "fact";
  const evidenceUrls = asArray(item.evidenceUrls ?? item.evidence_urls)
    .filter((url) => typeof url === "string" && url.startsWith("http"));

  if (!side || !["c1", "c2"].includes(side) || !evidenceUrls.length) {
    return null;
  }

  const rawHandle = asString(item.handle).trim();
  const handle = rawHandle ? (rawHandle.startsWith("@") ? rawHandle : displayHandle(rawHandle)) : "";
  const createdAt = asString(item.createdAt ?? item.created_at, new Date(0).toISOString());
  const author = asString(item.author, handle || (side === "c1" ? "Anthropic" : "OpenAI"));

  const text = trimText(item.text);
  const officialHandle = ["@OpenAI", "@OpenAIDevs", "@ChatGPTapp", "@OpenAINewsroom", "@AnthropicAI", "@claudeai"].includes(handle);
  const replyLike = text.startsWith("@") || text.length < 36;
  const rawConfidence = clamp(asNumber(item.confidence, type === "fact" ? 0.6 : 0.5), 0, 1);
  const confidence = clamp(
    Math.min(rawConfidence, type === "inference" ? 0.92 : 0.96) - (replyLike && !officialHandle ? 0.18 : 0),
    0,
    1
  );

  return {
    id: asString(item.id, `${type}-${side}-${evidenceUrls[0]}`),
    side,
    type,
    sourceTier: asString(item.sourceTier ?? item.source_tier),
    confidence,
    author,
    handle,
    createdAt,
    stamp: asString(item.stamp) || formatRelativeTime(createdAt, now),
    text,
    insight: trimText(item.insight, 320),
    impact: trimText(item.impact, 180),
    tags: asArray(item.tags).map((tag) => ({
      l: asString(asRecord(tag).l, "SIGNAL"),
      t: asString(asRecord(tag).t, "info")
    })),
    evidenceUrls,
    metrics: asRecord(item.metrics)
  };
};

export const isVisibleIntelItem = (item, threshold = 0.72) => {
  if (!item || !asArray(item.evidenceUrls).length) {
    return false;
  }

  const officialHandle = ["@OpenAI", "@OpenAIDevs", "@ChatGPTapp", "@OpenAINewsroom", "@AnthropicAI", "@claudeai"].includes(item.handle);
  const text = asString(item.text).trim();
  const casualReply = /^@/.test(text) || /\b(we should chat|good idea|welcome|honor|will save|will be fixed)\b/i.test(text);
  if (!officialHandle && (text.length < 48 || casualReply) && item.confidence < 0.9) {
    return false;
  }

  if (item.type === "fact") {
    return item.confidence >= 0.5;
  }

  return item.confidence >= threshold && (item.evidenceUrls.length >= 2 || item.sourceTier === "official" || item.confidence >= 0.88);
};

const dedupeIntelItems = (items) => {
  const byKey = new Map();

  for (const item of items) {
    if (!item) {
      continue;
    }

    const key = item.id || `${item.side}-${item.type}-${item.evidenceUrls?.[0]}`;
    const previous = byKey.get(key);
    if (!previous || item.confidence > previous.confidence) {
      byKey.set(key, item);
    }
  }

  return [...byKey.values()].sort((left, right) => {
    const delta = parseTimestamp(right.createdAt) - parseTimestamp(left.createdAt);
    return delta || right.confidence - left.confidence;
  });
};

const applyConfiguredSide = (item, handleIndex) => {
  if (!item) {
    return null;
  }

  const configured = handleIndex.get(normalizeHandle(item.handle));
  return configured?.side ? { ...item, side: configured.side } : item;
};

export const parseXaiIntelResponse = (content) => {
  const raw = asString(content).trim();
  if (!raw) {
    return [];
  }

  const withoutFence = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const candidates = [withoutFence];
  const objectStart = withoutFence.indexOf("{");
  const objectEnd = withoutFence.lastIndexOf("}");
  const arrayStart = withoutFence.indexOf("[");
  const arrayEnd = withoutFence.lastIndexOf("]");

  if (objectStart >= 0 && objectEnd > objectStart) {
    candidates.push(withoutFence.slice(objectStart, objectEnd + 1));
  }
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    candidates.push(withoutFence.slice(arrayStart, arrayEnd + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (Array.isArray(parsed.items)) {
        return parsed.items;
      }
    } catch {
      // Try the next candidate.
    }
  }

  return [];
};

const updateRosterActivity = (team, posts, now) =>
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

const verticalKeywords = {
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

export const recomputeVerticals = (baseVerticals, intelItems) =>
  asArray(baseVerticals).map((vertical) => {
    const next = { ...vertical };
    const labels = verticalKeywords[vertical.key] ?? [];

    for (const item of intelItems) {
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

export const recomputePower = (basePower, posts, intelItems) => {
  const bySide = { c1: { posts: 0, engagement: 0, enterprise: 0, ships: 0 }, c2: { posts: 0, engagement: 0, enterprise: 0, ships: 0 } };

  for (const item of intelItems) {
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

  const postSides = posts.reduce((acc, post) => {
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
    c2: computeSide("c2")
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

const toDashboardTweet = (item) => ({
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
  impact: item.impact
});

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
    verticals: recomputeVerticals(dashboard.verticals, visibleIntel),
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
