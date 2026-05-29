#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  asArray,
  asNumber,
  asRecord,
  asString,
  buildArenaSnapshot,
  buildDashboardSnapshot,
  getCompanyEntries,
  loadArena,
  loadEnvFile,
  makeIntelItemFromPost,
  normalizeHandle,
  normalizePost,
  parseXaiIntelResponse,
  readJsonFile,
  toDashboardView,
  writeJsonFile
} from "./intel-lib.mjs";

const rootDir = process.cwd();
const dataDir = path.resolve(rootDir, "data/intel");
const configPath = path.join(dataDir, "config.json");
const backfillPath = path.join(dataDir, "backfill.json");
const currentSnapshotPath = path.join(dataDir, "current-snapshot.json");
const arenaSnapshotPath = path.resolve(rootDir, "data/arena/snapshots/current.json");
const fetchListScript = path.resolve(rootDir, "scripts/fetch-x-list-posts.py");
const args = new Set(process.argv.slice(2));

loadEnvFile(rootDir);

const config = readJsonFile(configPath);
const backfill = readJsonFile(backfillPath);

if (!config || !backfill) {
  throw new Error("Missing data/intel/config.json or data/intel/backfill.json");
}

const chunk = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const isCreditError = (message) => /CreditsDepleted|402 Payment Required|problems\/credits/i.test(message);

const isPermissionError = (message) => /disabled|permission|403|api key/i.test(message);

const isTransientXStatus = (status) => status === 429 || status >= 500;

const sanitizeError = (message) =>
  asString(message)
    .replace(/xai-[^"'\s]+/g, "xai-...redacted")
    .replace(/"account_id":\d+/g, '"account_id":"redacted"')
    .replace(/account \[\d+\]/g, "account [redacted]")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "redacted-team-id");

const monitoredHandles = () => {
  const handles = [];

  for (const company of getCompanyEntries(config)) {
    for (const account of asArray(company.officialAccounts)) {
      handles.push(asString(asRecord(account).handle));
    }
    for (const account of asArray(company.productAccounts)) {
      handles.push(asString(asRecord(account).handle));
    }
    for (const person of asArray(company.people)) {
      handles.push(asString(asRecord(person).handle));
    }
  }

  const unique = [...new Set(handles.map(normalizeHandle).filter(Boolean))];
  return unique.slice(0, asNumber(config.x?.maxAccountsPerRun, 60));
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const xApiGet = async (urlPath, token, options = {}) => {
  const url = new URL(urlPath, "https://api.x.com");
  const maxAttempts = Math.max(1, asNumber(options.maxAttempts, 3));
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (response.ok) {
      return response.json();
    }

    const body = await response.text();
    lastError = new Error(`X API ${response.status} ${response.statusText}: ${body.slice(0, 300)}`);
    if (!isTransientXStatus(response.status) || attempt === maxAttempts) {
      throw lastError;
    }

    const retryAfter = Number(response.headers.get("retry-after"));
    await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 1000 * attempt);
  }

  throw lastError;
};

const fetchUsersByHandle = async (handles, token) => {
  const users = new Map();

  for (const batch of chunk(handles, 100)) {
    const params = new URLSearchParams({
      usernames: batch.join(","),
      "user.fields": "username,name,description,public_metrics,verified,verified_type"
    });
    const payload = await xApiGet(`/2/users/by?${params.toString()}`, token);
    for (const user of asArray(payload.data)) {
      users.set(normalizeHandle(user.username), user);
    }
  }

  return users;
};

const fetchAccountPosts = async (token, errors) => {
  if (args.has("--offline") || args.has("--no-x-api")) {
    return [];
  }

  const handles = monitoredHandles();
  let users;
  try {
    users = await fetchUsersByHandle(handles, token);
  } catch (error) {
    const message = sanitizeError(error instanceof Error ? error.message : String(error));
    errors.push(`Failed to fetch X users: ${message}`);
    if (isCreditError(message)) {
      errors.push("Skipping X account timeline fetch because the X API account has no remaining credits.");
      return [];
    }
    errors.push("Skipping X account timeline fetch; continuing with list fetch and xAI analysis.");
    return [];
  }
  const posts = [];
  const maxResults = Math.min(Math.max(asNumber(config.x?.postsPerAccount, 10), 5), 100);

  for (const handle of handles) {
    const user = users.get(handle);
    if (!user?.id) {
      errors.push(`No X user found for @${handle}`);
      continue;
    }

    try {
      const params = new URLSearchParams({
        max_results: String(maxResults),
        "tweet.fields": "created_at,public_metrics,author_id,conversation_id,entities,referenced_tweets",
        expansions: "author_id",
        "user.fields": "username,name,description,public_metrics,verified,verified_type"
      });
      if (config.x?.excludeRetweets) {
        params.set("exclude", "retweets");
      }

      const payload = await xApiGet(`/2/users/${user.id}/tweets?${params.toString()}`, token);
      for (const tweet of asArray(payload.data)) {
        const normalized = normalizePost({
          ...tweet,
          username: user.username,
          name: user.name,
          tweet_url: `https://x.com/${user.username}/status/${tweet.id}`
        });
        if (normalized) {
          posts.push({
            ...normalized,
            source: { type: "account", handle: `@${handle}` }
          });
        }
      }
    } catch (error) {
      const message = sanitizeError(error instanceof Error ? error.message : String(error));
      errors.push(`Failed to fetch @${handle}: ${message}`);
      if (isCreditError(message)) {
        errors.push("Stopping X account timeline fetch because the X API account has no remaining credits.");
        break;
      }
    }
  }

  return posts;
};

const fetchListPosts = (tokenPresent, errors) => {
  if (args.has("--offline") || args.has("--no-x-api") || !tokenPresent) {
    return [];
  }

  const posts = [];
  for (const list of asArray(config.x?.lists)) {
    const listId = asString(asRecord(list).id);
    if (!listId) {
      continue;
    }

    const scriptArgs = [
      fetchListScript,
      "--list-id",
      listId,
      "--limit",
      String(asNumber(config.x?.postsPerList, 40)),
      "--max-results",
      String(asNumber(config.x?.postsPerList, 40)),
      "--since-days",
      String(asNumber(config.x?.sinceDays, 7))
    ];
    if (config.x?.excludeRetweets) {
      scriptArgs.push("--exclude-retweets");
    }

    const result = spawnSync("python3", scriptArgs, {
      cwd: rootDir,
      env: process.env,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024
    });

    if (result.status !== 0) {
      const detail = sanitizeError([result.stderr.trim(), result.stdout.trim()].filter(Boolean).join("\n"));
      errors.push(`Failed to fetch X list ${listId}: ${detail || result.error?.message || "unknown error"}`);
      if (isCreditError(detail)) {
        errors.push("Stopping X list fetch because the X API account has no remaining credits.");
        break;
      }
      continue;
    }

    try {
      const payload = JSON.parse(result.stdout);
      for (const post of asArray(payload.posts)) {
        const normalized = normalizePost(post);
        if (normalized) {
          posts.push({
            ...normalized,
            source: { type: "list", listId, name: asString(payload.list?.name, listId) }
          });
        }
      }
    } catch (error) {
      errors.push(`Failed to parse X list ${listId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return posts;
};

const analyzeWithXai = async (errors) => {
  if (args.has("--offline") || args.has("--no-xai") || config.xai?.enabled === false) {
    return [];
  }

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return [];
  }

  const handles = monitoredHandles();
  const batchSize = Math.min(Math.max(asNumber(config.xai?.batchSize, 10), 1), 10);
  const items = [];

  for (const handleBatch of chunk(handles, batchSize)) {
    const fromDate = new Date(Date.now() - asNumber(config.x?.sinceDays, 7) * 24 * 60 * 60 * 1000).toISOString();
    const prompt = [
      "Analyze recent X activity from these AI company accounts.",
      "Return strict JSON only with this shape:",
      "{\"items\":[{\"id\":\"stable-id\",\"side\":\"c1|c2\",\"type\":\"fact|inference\",\"confidence\":0.0,\"author\":\"Name\",\"handle\":\"@handle\",\"createdAt\":\"ISO date if known\",\"text\":\"short evidence statement\",\"insight\":\"why it matters\",\"impact\":\"tactical or strategic implication\",\"tags\":[{\"l\":\"TAG\",\"t\":\"info|warn|hot|move\"}],\"evidenceUrls\":[\"https://x.com/...\"]}]}",
      "Rules: direct facts need source URLs; inferences need at least two evidence URLs unless the signal is from an official account.",
      `Handles: ${handleBatch.map((handle) => `@${handle}`).join(", ")}`
    ].join("\n");

    const body = {
      model: asString(config.xai?.model, "grok-4.3"),
      input: [
        {
          role: "system",
          content: "You are a concise competitive-intelligence analyst. Never invent citations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      tools: [
        {
          type: "x_search",
          allowed_x_handles: handleBatch,
          from_date: fromDate
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "intel_items",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    id: { type: "string" },
                    side: { type: "string", enum: ["c1", "c2"] },
                    type: { type: "string", enum: ["fact", "inference"] },
                    confidence: { type: "number", minimum: 0, maximum: 1 },
                    author: { type: "string" },
                    handle: { type: "string" },
                    createdAt: { type: "string" },
                    text: { type: "string" },
                    insight: { type: "string" },
                    impact: { type: "string" },
                    tags: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                          l: { type: "string" },
                          t: { type: "string", enum: ["info", "warn", "hot", "move"] }
                        },
                        required: ["l", "t"]
                      }
                    },
                    evidenceUrls: {
                      type: "array",
                      items: { type: "string" }
                    }
                  },
                  required: [
                    "id",
                    "side",
                    "type",
                    "confidence",
                    "author",
                    "handle",
                    "createdAt",
                    "text",
                    "insight",
                    "impact",
                    "tags",
                    "evidenceUrls"
                  ]
                }
              }
            },
            required: ["items"]
          }
        }
      }
    };

    try {
      const response = await fetch("https://api.x.ai/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const text = sanitizeError(await response.text());
        errors.push(`xAI batch failed (${response.status}): ${text.slice(0, 300)}`);
        if (response.status === 401 || response.status === 403 || isPermissionError(text)) {
          errors.push("Stopping xAI analysis because the configured XAI_API_KEY is not authorized for requests.");
          break;
        }
        continue;
      }

      const payload = await response.json();
      const outputText = asArray(payload.output)
        .flatMap((item) => asArray(item.content))
        .filter((content) => content.type === "output_text")
        .map((content) => content.text)
        .join("\n");
      const parsedItems = parseXaiIntelResponse(outputText);
      const citations = [
        ...asArray(payload.citations),
        ...asArray(payload.output)
          .flatMap((item) => asArray(item.content))
          .flatMap((content) => asArray(content.annotations))
          .map((annotation) => annotation.url)
          .filter(Boolean)
      ];

      for (const item of parsedItems) {
        const evidenceUrls = asArray(item.evidenceUrls);
        items.push({
          ...item,
          evidenceUrls: evidenceUrls.length ? evidenceUrls : citations
        });
      }
    } catch (error) {
      errors.push(`xAI batch error: ${sanitizeError(error instanceof Error ? error.message : String(error))}`);
    }
  }

  return items;
};

const main = async () => {
  const errors = [];
  const token = process.env.X_BEARER_TOKEN || process.env.BEARER_TOKEN;
  const accountPosts = token ? await fetchAccountPosts(token, errors) : [];
  const listPosts = fetchListPosts(Boolean(token), errors);
  const xaiItems = await analyzeWithXai(errors);
  const posts = [...accountPosts, ...listPosts];
  const now = new Date();
  const snapshot = buildDashboardSnapshot({
    config,
    backfill,
    posts,
    xaiItems,
    now,
    errors
  });

  if (args.has("--offline")) {
    snapshot.status.streamOk = false;
    snapshot.meta.warnings = ["Offline build requested; generated from seeded backfill only."];
  } else if (!token) {
    snapshot.status.streamOk = false;
    snapshot.meta.warnings = ["No X_BEARER_TOKEN or BEARER_TOKEN configured; generated from seeded backfill only."];
  } else if (!process.env.XAI_API_KEY) {
    snapshot.meta.warnings = ["No XAI_API_KEY configured; skipped xAI inference and used deterministic post extraction."];
  }

  const day = now.toISOString().slice(0, 10);
  const dailyPayload = {
    generatedAt: now.toISOString(),
    configVersion: config.version,
    raw: {
      accountPosts,
      listPosts
    },
    analysis: {
      xaiItems,
      visibleSignals: snapshot.status.visibleSignals,
      archivedSignals: snapshot.status.archivedSignals,
      lowConfidence: snapshot.archive.lowConfidence
    },
    snapshot
  };

  const arena = await loadArena(rootDir);
  const postSignals = posts.map((post) => makeIntelItemFromPost(post, config, now)).filter(Boolean);
  const arenaSnapshot = buildArenaSnapshot({
    arena,
    signals: [...postSignals, ...xaiItems],
    now,
    adapters: {
      posts,
      dashboardView: snapshot,
      dataMode: snapshot.meta.dataMode,
      streamOk: snapshot.status.streamOk
    }
  });
  const dashboardView = toDashboardView(arenaSnapshot);
  dailyPayload.snapshot = dashboardView;
  dailyPayload.arenaSnapshot = {
    path: path.relative(rootDir, arenaSnapshotPath),
    concepts: arenaSnapshot.primitives.concepts.length,
    visibleSignals: arenaSnapshot.status.visibleSignals,
    archivedSignals: arenaSnapshot.status.archivedSignals
  };

  writeJsonFile(currentSnapshotPath, dashboardView);
  writeJsonFile(arenaSnapshotPath, arenaSnapshot);
  writeJsonFile(path.join(dataDir, "daily", `${day}.json`), dailyPayload);

  console.log(`Snapshot written: ${path.relative(rootDir, currentSnapshotPath)}`);
  console.log(`Arena snapshot written: ${path.relative(rootDir, arenaSnapshotPath)}`);
  console.log(`Daily archive written: ${path.relative(rootDir, path.join(dataDir, "daily", `${day}.json`))}`);
  console.log(`Visible signals: ${snapshot.status.visibleSignals}; raw X posts: ${snapshot.status.xPostsToday}`);
  if (errors.length) {
    console.log(`Warnings/errors: ${errors.length}`);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
