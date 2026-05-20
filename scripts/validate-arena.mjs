#!/usr/bin/env node

import { loadArena, validateArena } from "../src/arena/index.mjs";

const main = async () => {
  const arena = await loadArena(process.cwd(), { throwOnInvalid: false, loadHooks: false });
  const result = validateArena(arena);

  for (const warning of result.warnings) {
    console.warn(`Warning: ${warning}`);
  }

  if (!result.ok) {
    for (const error of result.errors) {
      console.error(`Error: ${error}`);
    }
    process.exit(1);
  }

  console.log(`Arena manifests valid: ${arena.contenders.length} contenders, ${arena.characters.length} characters, ${arena.concepts.length} concepts, ${arena.signals.length} signals.`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
