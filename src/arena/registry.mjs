import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { asArray, asRecord } from "./core.mjs";
import { readJsonFile } from "./files.mjs";
import { validateArena } from "./validation.mjs";

const withSourceFile = (value, filePath) => {
  if (value && typeof value === "object") {
    Object.defineProperty(value, "__file", {
      value: filePath,
      enumerable: false
    });
  }
  return value;
};

const readJsonCollection = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs
    .readdirSync(dirPath)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .flatMap((name) => {
      const filePath = path.join(dirPath, name);
      const parsed = readJsonFile(filePath, null);
      const values = Array.isArray(parsed) ? parsed : [parsed];
      return values.filter(Boolean).map((value) => withSourceFile(value, filePath));
    });
};

const resolveHookPath = (rootDir, concept, hookPath) => {
  const baseDir = concept.__file ? path.dirname(concept.__file) : rootDir;
  return path.resolve(baseDir, hookPath);
};

export const loadConceptHooks = async (rootDir, concepts) => {
  const hooksByConcept = {};

  for (const concept of asArray(concepts)) {
    const hooks = asRecord(concept.hooks);
    if (!Object.keys(hooks).length) {
      continue;
    }

    const conceptHooks = {};
    if (hooks.module) {
      const modulePath = resolveHookPath(rootDir, concept, hooks.module);
      const hookModule = await import(pathToFileURL(modulePath).href);
      for (const name of ["normalize", "score", "renderHint"]) {
        if (typeof hookModule[name] === "function") {
          conceptHooks[name] = hookModule[name];
        }
      }
    }

    for (const name of ["normalize", "score", "renderHint"]) {
      if (!hooks[name]) {
        continue;
      }
      const modulePath = resolveHookPath(rootDir, concept, hooks[name]);
      const hookModule = await import(pathToFileURL(modulePath).href);
      if (typeof hookModule[name] === "function") {
        conceptHooks[name] = hookModule[name];
      } else if (typeof hookModule.default === "function") {
        conceptHooks[name] = hookModule.default;
      }
    }

    if (Object.keys(conceptHooks).length) {
      hooksByConcept[concept.id] = conceptHooks;
    }
  }

  return hooksByConcept;
};

export const loadArenaSync = (rootDir = process.cwd()) => {
  const arenaDir = path.resolve(rootDir, "data/arena");
  const base = readJsonFile(path.join(arenaDir, "arena.json"), null);
  if (!base) {
    throw new Error("Missing data/arena/arena.json");
  }

  return {
    ...base,
    contenders: readJsonCollection(path.join(arenaDir, "contenders")),
    characters: readJsonCollection(path.join(arenaDir, "characters")),
    concepts: readJsonCollection(path.join(arenaDir, "concepts")),
    signals: readJsonCollection(path.join(arenaDir, "signals"))
  };
};

export const loadArena = async (rootDir = process.cwd(), options = {}) => {
  const arena = loadArenaSync(rootDir);
  const validation = validateArena(arena);
  if (!validation.ok && options.throwOnInvalid !== false) {
    throw new Error(`Arena manifest validation failed:\n${validation.errors.join("\n")}`);
  }
  if (options.loadHooks !== false) {
    arena.conceptHooks = await loadConceptHooks(rootDir, arena.concepts);
  }
  return arena;
};

export { validateArena };
