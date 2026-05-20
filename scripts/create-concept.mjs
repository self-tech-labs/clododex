#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import { normalizeId, writeJsonFile } from "../src/arena/index.mjs";

const args = process.argv.slice(2);
const readFlag = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : "";
};

const id = normalizeId(readFlag("id"));
const kind = normalizeId(readFlag("kind") || "experiment");

if (!id) {
  console.error("Missing required --id");
  process.exit(1);
}

const title = readFlag("title") || id.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
const filePath = path.resolve(process.cwd(), "data/arena/concepts", `${id}.json`);
if (fs.existsSync(filePath)) {
  console.error(`Concept manifest already exists: ${path.relative(process.cwd(), filePath)}`);
  process.exit(1);
}

const manifest = {
  id,
  kind,
  title,
  description: `Describe the ${title} concept and the arena behavior it unlocks.`,
  entities: [],
  relationships: [],
  surfaces: [],
  dataSources: [],
  status: "draft"
};

writeJsonFile(filePath, manifest);
console.log(`Concept manifest written: ${path.relative(process.cwd(), filePath)}`);
