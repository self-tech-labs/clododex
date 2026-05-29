import assert from "node:assert/strict";
import test from "node:test";

import { assessFreshIntelSnapshot, assertFreshIntelSnapshot } from "../src/arena/freshness.mjs";

test("fresh intel assessment passes when stream has fresh X posts", () => {
  const result = assessFreshIntelSnapshot({
    meta: { errors: [] },
    status: { streamOk: true, xPostsToday: 3 }
  });

  assert.equal(result.ok, true);
  assert.equal(result.xPostsToday, 3);
});

test("fresh intel assessment fails when X posts are missing", () => {
  const result = assessFreshIntelSnapshot({
    meta: { errors: [] },
    status: { streamOk: true, xPostsToday: 0 }
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /expected at least 1 fresh X post/);
});

test("fresh intel assertion rejects degraded streams and quota errors", () => {
  assert.throws(
    () => assertFreshIntelSnapshot({
      views: {
        dashboard: {
          meta: {
            errors: ["X API 402 Payment Required: CreditsDepleted"]
          },
          status: { streamOk: false, xPostsToday: 0 }
        }
      }
    }),
    /CreditsDepleted/
  );
});
