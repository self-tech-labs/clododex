import fs from "node:fs";
import path from "node:path";

import { asString } from "./core.mjs";

export const readJsonFile = (filePath, fallback = null) => {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
};

export const writeJsonFile = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

export const loadEnvFile = (rootDir, filename = ".env") => {
  const envPath = path.resolve(rootDir, filename);
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }

    const [rawKey, ...rawValue] = line.split("=");
    const key = rawKey.trim();
    const value = rawValue.join("=").trim().replace(/^['"]|['"]$/g, "");

    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
};

export const sanitizeError = (message) =>
  asString(message)
    .replace(/xai-[^"'\s]+/g, "xai-...redacted")
    .replace(/"account_id":\d+/g, '"account_id":"redacted"')
    .replace(/account \[\d+\]/g, "account [redacted]")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "redacted-team-id");
