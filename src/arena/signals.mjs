import { asArray, asNumber, asRecord, asString, clamp, trimText } from "./core.mjs";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const OFFICIAL_HANDLES = new Set(["openai", "openaidevs", "chatgptapp", "openainewsroom", "anthropicai", "claudeai"]);

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

const getContenderEntries = (arena) =>
  asArray(arena.contenders).map((contender) => ({
    key: asString(contender.id),
    side: asString(contender.side),
    organization: asString(contender.organization ?? contender.name),
    product: asString(contender.product ?? contender.name),
    officialAccounts: contender.officialAccounts,
    productAccounts: contender.productAccounts,
    people: contender.people
  }));

export const buildHandleIndex = (source) => {
  const index = new Map();
  const entries = Object.keys(asRecord(source.companies)).length ? getCompanyEntries(source) : getContenderEntries(source);

  for (const company of entries) {
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
        contenderId: company.key,
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
    contenderId: account.contenderId,
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

  if (!side || !evidenceUrls.length) {
    return null;
  }

  const rawHandle = asString(item.handle).trim();
  const handle = rawHandle ? (rawHandle.startsWith("@") ? rawHandle : displayHandle(rawHandle)) : "";
  const createdAt = asString(item.createdAt ?? item.created_at ?? item.publishedAt ?? item.published_at, new Date(0).toISOString());
  const author = asString(item.author, handle || side);
  const text = trimText(item.text);
  const officialHandle = OFFICIAL_HANDLES.has(normalizeHandle(handle));
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
    contenderId: asString(item.contenderId ?? item.contender_id),
    type,
    sourceTier: asString(item.sourceTier ?? item.source_tier),
    confidence,
    author,
    handle,
    createdAt,
    stamp: asString(item.stamp) || formatRelativeTime(createdAt, now),
    text,
    insight: trimText(item.insight, 320),
    rationale: trimText(item.rationale, 320),
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

  const officialHandle = OFFICIAL_HANDLES.has(normalizeHandle(item.handle));
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

export const dedupeIntelItems = (items) => {
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

export const applyConfiguredSide = (item, handleIndex) => {
  if (!item) {
    return null;
  }

  const configured = handleIndex.get(normalizeHandle(item.handle));
  return configured?.side
    ? { ...item, side: configured.side, contenderId: item.contenderId || configured.contenderId }
    : item;
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
