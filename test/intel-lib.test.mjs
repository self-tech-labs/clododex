import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDashboardSnapshot,
  dedupePosts,
  isVisibleIntelItem,
  normalizeDossier,
  normalizePost,
  parseXaiIntelResponse
} from "../scripts/intel-lib.mjs";

const config = {
  version: 1,
  dashboard: { maxIntelItems: 10, lowConfidenceThreshold: 0.72 },
  x: { lists: [{ id: "1" }] },
  companies: {
    claude: {
      side: "c1",
      organization: "Anthropic",
      officialAccounts: [{ handle: "@AnthropicAI", name: "Anthropic", weight: 1.5 }],
      people: [{ handle: "@bcherny", name: "Boris Cherny", role: "Claude Code", weight: 1.2 }]
    },
    codex: {
      side: "c2",
      organization: "OpenAI",
      officialAccounts: [{ handle: "@OpenAI", name: "OpenAI", weight: 1.5 }],
      people: [{ handle: "@thsottiaux", name: "Tibo", role: "Codex", weight: 1.2 }]
    }
  }
};

const backfill = {
  version: 1,
  sources: [{ url: "https://example.com/source" }],
  dashboard: {
    claudeTeam: [{ id: "boris", handle: "@bcherny", name: "BORIS", surname: "CHERNY", lastActivity: "n/a" }],
    codexTeam: [{ id: "tibo", handle: "@thsottiaux", name: "TIBO", surname: "SOTTIAUX", lastActivity: "n/a" }],
    announcements: [],
    verticals: [{ key: "DEV", name: "DEVELOPERS", sub: "code", c1: 80, c2: 80 }],
    power: {
      c1: { momentum: 80, mindshare: 30, enterprise: 20, ship: 10 },
      c2: { momentum: 80, mindshare: 30, enterprise: 20, ship: 10 }
    }
  },
  intel: [
    {
      id: "seed",
      side: "c1",
      type: "fact",
      confidence: 0.9,
      author: "Anthropic",
      handle: "@AnthropicAI",
      createdAt: "2026-01-01T00:00:00.000Z",
      text: "Seed fact",
      insight: "Seed insight",
      evidenceUrls: ["https://example.com/source"],
      tags: [{ l: "PRODUCT", t: "info" }]
    }
  ]
};

test("normalizePost accepts X public_metrics and builds tweet URLs", () => {
  const post = normalizePost({
    id: "123",
    username: "OpenAI",
    name: "OpenAI",
    created_at: "2026-05-19T12:00:00.000Z",
    text: "Codex update",
    public_metrics: { like_count: 10, retweet_count: 2, reply_count: 1, quote_count: 1 }
  });

  assert.equal(post.username, "openai");
  assert.equal(post.tweetUrl, "https://x.com/openai/status/123");
  assert.equal(post.engagementScore, 22);
});

test("dedupePosts keeps the strongest copy and skips malformed posts", () => {
  const posts = dedupePosts([
    { id: "1", username: "OpenAI", text: "A", createdAt: "2026-01-01T00:00:00.000Z", tweetUrl: "https://x.com/OpenAI/status/1", metrics: { likes: 1 } },
    { id: "1", username: "OpenAI", text: "A", createdAt: "2026-01-01T00:00:00.000Z", tweetUrl: "https://x.com/OpenAI/status/1", metrics: { likes: 10 } },
    { id: "", username: "OpenAI", text: "", createdAt: "bad" }
  ]);

  assert.equal(posts.length, 1);
  assert.equal(posts[0].metrics.likes, 10);
});

test("evidence policy hides weak inferences and allows sourced facts", () => {
  assert.equal(
    isVisibleIntelItem({ type: "fact", confidence: 0.51, text: "A sourced official-quality factual update with enough substance.", evidenceUrls: ["https://example.com"] }),
    true
  );
  assert.equal(
    isVisibleIntelItem({ type: "inference", confidence: 0.71, evidenceUrls: ["https://example.com/a", "https://example.com/b"] }),
    false
  );
  assert.equal(
    isVisibleIntelItem({ type: "inference", confidence: 0.8, text: "A sourced strategic inference with enough substance for display.", evidenceUrls: ["https://example.com/a", "https://example.com/b"] }),
    true
  );
});

test("parseXaiIntelResponse tolerates malformed output", () => {
  assert.deepEqual(parseXaiIntelResponse("not json"), []);
  assert.deepEqual(parseXaiIntelResponse('```json\n{"items":[{"id":"a"}]}\n```'), [{ id: "a" }]);
});

test("normalizeDossier keeps only sourced claims and clamps confidence", () => {
  const dossier = normalizeDossier({
    lastReviewedAt: "2026-05-19",
    tagline: "Schema specialist",
    background: [
      { text: "Sourced fact", evidenceUrls: ["https://example.com/fact"], confidence: 2 },
      { text: "Unsupported fact", evidenceUrls: [] }
    ],
    keyProjects: [
      { name: "Project", description: "Sourced project", tags: ["AI", ""], evidenceUrls: ["https://example.com/project"] },
      { name: "No source", description: "Dropped" }
    ],
    strengths: [
      { label: "Strength", description: "Sourced strength", evidenceUrls: ["https://example.com/strength"] }
    ],
    narrative: { title: "Arc", text: "Sourced narrative", evidenceUrls: ["https://example.com/narrative"] },
    sourceUrls: ["not-a-url", "https://example.com/source"]
  });

  assert.equal(dossier.background.length, 1);
  assert.equal(dossier.background[0].confidence, 1);
  assert.equal(dossier.keyProjects.length, 1);
  assert.deepEqual(dossier.keyProjects[0].tags, ["AI"]);
  assert.equal(dossier.strengths.length, 1);
  assert.equal(dossier.narrative.title, "Arc");
  assert.equal(dossier.sourceUrls.includes("not-a-url"), false);
  assert.equal(dossier.sourceUrls.includes("https://example.com/project"), true);
});

test("buildDashboardSnapshot dedupes posts and archives low confidence items", () => {
  const snapshot = buildDashboardSnapshot({
    config,
    backfill,
    posts: [
      {
        id: "tw-1",
        username: "thsottiaux",
        name: "Tibo",
        createdAt: "2026-05-19T12:00:00.000Z",
        text: "Codex shipped a developer workflow update with enough evidence for the dashboard",
        tweetUrl: "https://x.com/thsottiaux/status/tw-1",
        metrics: { likes: 5 }
      },
      {
        id: "tw-1",
        username: "thsottiaux",
        name: "Tibo",
        createdAt: "2026-05-19T12:00:00.000Z",
        text: "Codex shipped a developer workflow update with enough evidence for the dashboard",
        tweetUrl: "https://x.com/thsottiaux/status/tw-1",
        metrics: { likes: 6 }
      }
    ],
    xaiItems: [
      {
        id: "weak",
        side: "c2",
        type: "inference",
        confidence: 0.6,
        author: "Analyst",
        handle: "@OpenAI",
        text: "Weak signal",
        insight: "Weak",
        evidenceUrls: ["https://example.com/weak"],
        tags: [{ l: "STRATEGY", t: "info" }]
      }
    ],
    now: new Date("2026-05-19T13:00:00.000Z"),
    errors: []
  });

  assert.equal(snapshot.archive.rawPostCount, 1);
  assert.equal(snapshot.status.xPostsToday, 1);
  assert.equal(snapshot.codexTeam[0].lastActivity, "1h");
  assert.equal(snapshot.archive.lowConfidence.some((item) => item.id === "weak"), true);
  assert.equal(snapshot.tweets.some((tweet) => tweet.handle === "@thsottiaux"), true);
});

test("buildDashboardSnapshot preserves dossiers and corrects generated sides from known handles", () => {
  const snapshot = buildDashboardSnapshot({
    config,
    backfill: {
      ...backfill,
      dashboard: {
        ...backfill.dashboard,
        codexTeam: [
          {
            id: "openai",
            handle: "@OpenAI",
            name: "OPENAI",
            surname: "SIGNAL",
            lastActivity: "n/a",
            dossier: {
              background: [
                { text: "OpenAI sourced background", evidenceUrls: ["https://example.com/openai"], confidence: -1 }
              ],
              sourceUrls: ["https://example.com/openai"]
            }
          }
        ]
      }
    },
    xaiItems: [
      {
        id: "wrong-side",
        side: "c1",
        type: "fact",
        confidence: 0.9,
        author: "OpenAI",
        handle: "@OpenAI",
        createdAt: "2026-05-19T12:00:00.000Z",
        text: "OpenAI published a sourced Codex developer update with enough text for display",
        insight: "This should render on the Codex side after handle correction.",
        evidenceUrls: ["https://example.com/openai-post"],
        tags: [{ l: "DEVTOOLS", t: "move" }]
      }
    ],
    now: new Date("2026-05-19T13:00:00.000Z"),
    errors: []
  });

  assert.equal(snapshot.codexTeam[0].dossier.background[0].confidence, 0);
  assert.equal(snapshot.tweets.find((tweet) => tweet.text.includes("sourced Codex developer update"))?.side, "c2");
});
