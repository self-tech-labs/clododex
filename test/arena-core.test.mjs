import assert from "node:assert/strict";
import test from "node:test";

import {
  buildArenaSnapshot,
  loadArena,
  loadConceptHooks,
  recomputePower,
  toDashboardView,
  validateArena
} from "../src/arena/index.mjs";

const minimalArena = {
  schemaVersion: 1,
  version: 1,
  id: "fixture-arena",
  title: "Fixture Arena",
  summary: "Fixture",
  contenders: [
    {
      id: "fixture",
      side: "c1",
      name: "Fixture",
      organization: "Fixture Lab",
      people: [{ handle: "@fixture", name: "Fixture Person", role: "Builder" }],
      fatalities: [
        {
          id: "fixture-finisher",
          title: "FIXTURE FINISHER",
          unlockTrigger: "Fixture test round.",
          arenaEffect: "Confirms validation accepts sourced contender finishers.",
          evidenceUrls: ["https://example.com/fixture"]
        }
      ]
    },
    {
      id: "rival",
      side: "c2",
      name: "Rival",
      organization: "Rival Lab",
      officialAccounts: [{ handle: "@rival", name: "Rival" }],
      fatalities: [
        {
          id: "rival-finisher",
          title: "RIVAL FINISHER",
          unlockTrigger: "Rival test round.",
          arenaEffect: "Confirms validation accepts sourced rival finishers.",
          evidenceUrls: ["https://example.com/rival"]
        }
      ]
    }
  ],
  characters: [
    {
      id: "fixture-person",
      contenderId: "fixture",
      name: "FIXTURE",
      surname: "PERSON",
      handle: "@fixture",
      cls: "THE TESTER",
      lore: "A sourced fixture character.",
      stats: { ATK: 70, DEF: 70, SPD: 70, COMBO: 70, HP: 70 },
      threatScore: 70,
      lastActivity: "n/a",
      scoreRationale: {
        stats: {
          ATK: { rationale: "Fixture attack is sourced for validation.", evidenceUrls: ["https://example.com/fixture"] },
          DEF: { rationale: "Fixture defense is sourced for validation.", evidenceUrls: ["https://example.com/fixture"] },
          SPD: { rationale: "Fixture speed is sourced for validation.", evidenceUrls: ["https://example.com/fixture"] },
          COMBO: { rationale: "Fixture combo is sourced for validation.", evidenceUrls: ["https://example.com/fixture"] },
          HP: { rationale: "Fixture HP is sourced for validation.", evidenceUrls: ["https://example.com/fixture"] }
        },
        threatScore: { rationale: "Fixture threat is sourced for validation.", evidenceUrls: ["https://example.com/fixture"] }
      }
    }
  ],
  dashboard: {
    maxSignals: 12,
    lowConfidenceThreshold: 0.72,
    announcements: [],
    territories: [
      {
        key: "DEV",
        name: "DEVELOPERS",
        sub: "code",
        c1: 50,
        c2: 50,
        rationale: {
          c1: { rationale: "Fixture territory c1 is sourced.", evidenceUrls: ["https://example.com/fixture"] },
          c2: { rationale: "Fixture territory c2 is sourced.", evidenceUrls: ["https://example.com/rival"] }
        }
      }
    ],
    metrics: {
      power: {
        c1: { momentum: 50, mindshare: 20, enterprise: 10, ship: 4 },
        c2: { momentum: 50, mindshare: 20, enterprise: 10, ship: 4 },
        rationale: {
          momentum: {
            c1: { rationale: "Fixture c1 momentum is sourced.", evidenceUrls: ["https://example.com/fixture"] },
            c2: { rationale: "Fixture c2 momentum is sourced.", evidenceUrls: ["https://example.com/rival"] }
          },
          mindshare: {
            c1: { rationale: "Fixture c1 mindshare is sourced.", evidenceUrls: ["https://example.com/fixture"] },
            c2: { rationale: "Fixture c2 mindshare is sourced.", evidenceUrls: ["https://example.com/rival"] }
          },
          enterprise: {
            c1: { rationale: "Fixture c1 enterprise is sourced.", evidenceUrls: ["https://example.com/fixture"] },
            c2: { rationale: "Fixture c2 enterprise is sourced.", evidenceUrls: ["https://example.com/rival"] }
          },
          ship: {
            c1: { rationale: "Fixture c1 ship is sourced.", evidenceUrls: ["https://example.com/fixture"] },
            c2: { rationale: "Fixture c2 ship is sourced.", evidenceUrls: ["https://example.com/rival"] }
          }
        }
      }
    }
  },
  concepts: [],
  signals: [
    {
      id: "fixture-signal",
      side: "c1",
      type: "fact",
      confidence: 0.9,
      author: "Fixture",
      handle: "@fixture",
      createdAt: "2026-05-19T12:00:00.000Z",
      text: "Fixture shipped a developer workflow update with enough evidence for display.",
      insight: "This validates generic signal rendering.",
      rationale: "Fixture signal is included because it is sourced.",
      evidenceUrls: ["https://example.com/fixture"],
      tags: [{ l: "DEVTOOLS", t: "move" }]
    }
  ],
  sources: [{ url: "https://example.com/fixture" }]
};

test("loadArena reads the file-first registry", async () => {
  const arena = await loadArena(process.cwd(), { loadHooks: false });
  const result = validateArena(arena);

  assert.equal(result.ok, true);
  assert.equal(arena.contenders.length, 3);
  assert.equal(arena.concepts.length, 5);
  assert.equal(arena.signals.length, 19);
});

test("buildArenaSnapshot produces a dashboard-compatible view", () => {
  const snapshot = buildArenaSnapshot({
    arena: minimalArena,
    now: new Date("2026-05-19T13:00:00.000Z")
  });
  const dashboard = toDashboardView(snapshot);

  assert.equal(snapshot.kind, "arena.snapshot");
  assert.equal(snapshot.primitives.contenders.length, 2);
  assert.equal(snapshot.primitives.signals.length, 1);
  assert.equal(dashboard.claudeTeam.length, 1);
  assert.equal(dashboard.tweets.length, 1);
  assert.equal(dashboard.verticals[0].c1, 51);
});

test("concept hooks can normalize entities, score snapshots, and emit render hints", async () => {
  const concept = {
    id: "hooked-concept",
    kind: "integration",
    title: "Hooked Concept",
    description: "Fixture hook concept.",
    entities: [{ id: "entity-1", type: "fixture" }],
    relationships: [],
    surfaces: [],
    dataSources: [],
    hooks: { module: "fixtures/arena-hooks/hooks/sample.mjs" }
  };
  const conceptHooks = await loadConceptHooks(process.cwd(), [concept]);
  const snapshot = buildArenaSnapshot({
    arena: {
      ...minimalArena,
      concepts: [concept],
      conceptHooks
    },
    now: new Date("2026-05-19T13:00:00.000Z")
  });
  const result = snapshot.extensions.hookResults["hooked-concept"];

  assert.equal(result.normalizedEntities[0].normalized, true);
  assert.equal(result.score.visibleSignals, 1);
  assert.equal(result.renderHints[0].entityId, "entity-1");
});

test("metric reducers preserve existing power trend behavior", () => {
  const power = recomputePower(
    minimalArena.dashboard.metrics.power,
    [{ side: "c1" }],
    [
      {
        side: "c1",
        type: "fact",
        tags: [{ l: "ENTERPRISE", t: "info" }, { l: "PRODUCT", t: "info" }],
        metrics: { likes: 100, retweets: 10 }
      }
    ]
  );

  assert.equal(power.c1.enterprise, 11);
  assert.equal(power.c1.ship, 5);
  assert.equal(power.trends.c1.enterprise, "+1");
});
