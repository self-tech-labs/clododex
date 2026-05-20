#!/usr/bin/env node

import path from "node:path";

import { buildArenaSnapshot, loadArena, toDashboardView, writeJsonFile } from "../src/arena/index.mjs";

const rootDir = process.cwd();
const args = new Set(process.argv.slice(2));
const arenaSnapshotPath = path.resolve(rootDir, "data/arena/snapshots/current.json");
const intelSnapshotPath = path.resolve(rootDir, "data/intel/current-snapshot.json");

const main = async () => {
  const now = new Date();
  const arena = await loadArena(rootDir);
  const snapshot = buildArenaSnapshot({
    arena,
    now,
    adapters: {
      dataMode: args.has("--offline") ? "arena-offline" : "arena-manifest",
      streamOk: !args.has("--offline")
    }
  });
  const dashboardView = toDashboardView(snapshot);

  if (args.has("--offline")) {
    snapshot.meta.warnings = [
      ...new Set([...(snapshot.meta.warnings ?? []), "Offline arena build requested; generated from file manifests only."])
    ];
    dashboardView.meta = {
      ...dashboardView.meta,
      warnings: snapshot.meta.warnings
    };
    dashboardView.status = {
      ...dashboardView.status,
      streamOk: false
    };
  }

  writeJsonFile(arenaSnapshotPath, snapshot);
  writeJsonFile(intelSnapshotPath, dashboardView);

  console.log(`Arena snapshot written: ${path.relative(rootDir, arenaSnapshotPath)}`);
  console.log(`Dashboard compatibility snapshot written: ${path.relative(rootDir, intelSnapshotPath)}`);
  console.log(`Concepts: ${snapshot.primitives.concepts.length}; signals: ${snapshot.status.visibleSignals}/${snapshot.status.archivedSignals}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
