#!/usr/bin/env node

import path from "node:path";
import { assertFreshIntelSnapshot, readJsonFile } from "./intel-lib.mjs";

const rootDir = process.cwd();
const args = process.argv.slice(2);
const minXPostsIndex = args.indexOf("--min-x-posts");
const minXPosts = minXPostsIndex >= 0 ? Number(args[minXPostsIndex + 1]) : 1;

const snapshots = [
  {
    label: "data/intel/current-snapshot.json",
    path: path.resolve(rootDir, "data/intel/current-snapshot.json")
  },
  {
    label: "data/arena/snapshots/current.json",
    path: path.resolve(rootDir, "data/arena/snapshots/current.json")
  }
];

const failures = [];

for (const snapshot of snapshots) {
  try {
    assertFreshIntelSnapshot(readJsonFile(snapshot.path), {
      label: snapshot.label,
      minXPosts
    });
    console.log(`${snapshot.label}: fresh X intel OK`);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

if (failures.length) {
  console.error("Fresh intel assertion failed:");
  console.error(failures.join("\n"));
  process.exit(1);
}
