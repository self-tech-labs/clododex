#!/usr/bin/env node

import path from "node:path";
import {
  asArray,
  asRecord,
  asString,
  buildDashboardSnapshot,
  loadEnvFile,
  readJsonFile,
  writeJsonFile
} from "./intel-lib.mjs";

const rootDir = process.cwd();
const dataDir = path.resolve(rootDir, "data/intel");
const configPath = path.join(dataDir, "config.json");
const backfillPath = path.join(dataDir, "backfill.json");
const args = new Set(process.argv.slice(2));

loadEnvFile(rootDir);

const config = readJsonFile(configPath);
const backfill = readJsonFile(backfillPath);

if (!config || !backfill) {
  throw new Error("Missing data/intel/config.json or data/intel/backfill.json");
}

const checkSource = async (source) => {
  const url = asString(source.url);
  if (!url) {
    return { ...source, status: "missing-url" };
  }

  try {
    const response = await fetch(url, { method: "GET" });
    return {
      ...source,
      checkedAt: new Date().toISOString(),
      status: response.ok ? "reachable" : "failed",
      httpStatus: response.status
    };
  } catch (error) {
    return {
      ...source,
      checkedAt: new Date().toISOString(),
      status: "failed",
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

const validateBackfill = (candidate) => {
  const dashboard = asRecord(candidate.dashboard);
  const requiredArrays = ["claudeTeam", "codexTeam", "announcements", "verticals"];
  const missing = requiredArrays.filter((key) => !Array.isArray(dashboard[key]) || dashboard[key].length === 0);
  if (missing.length) {
    throw new Error(`Backfill is missing required dashboard arrays: ${missing.join(", ")}`);
  }

  if (!Array.isArray(candidate.intel) || candidate.intel.length === 0) {
    throw new Error("Backfill is missing seeded intel items.");
  }

  const snapshot = buildDashboardSnapshot({
    config,
    backfill: candidate,
    posts: [],
    xaiItems: [],
    now: new Date(candidate.researchedAt || Date.now()),
    errors: []
  });

  if (!snapshot.tweets.length) {
    throw new Error("Backfill did not produce any visible dashboard intel.");
  }
};

const main = async () => {
  const nextBackfill = {
    ...backfill,
    refreshedAt: new Date().toISOString(),
    sources: args.has("--refresh-sources")
      ? await Promise.all(asArray(backfill.sources).map((source) => checkSource(source)))
      : asArray(backfill.sources)
  };

  validateBackfill(nextBackfill);
  writeJsonFile(backfillPath, nextBackfill);

  console.log(`Backfill validated: ${path.relative(rootDir, backfillPath)}`);
  console.log(`Sources: ${asArray(nextBackfill.sources).length}; seeded signals: ${asArray(nextBackfill.intel).length}`);
  if (args.has("--refresh-sources")) {
    const failed = asArray(nextBackfill.sources).filter((source) => asString(source.status) !== "reachable");
    console.log(`Source check failures: ${failed.length}`);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
