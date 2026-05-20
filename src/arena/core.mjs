export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const asRecord = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

export const asArray = (value) => (Array.isArray(value) ? value : []);

export const asString = (value, fallback = "") => (typeof value === "string" ? value : fallback);

export const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const trimText = (value, maxLength = 260) => {
  const text = asString(value).replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1).trim()}...`;
};

export const compactObject = (value) =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));

export const normalizeId = (value) =>
  asString(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const unique = (values) => [...new Set(asArray(values).filter(Boolean))];

export const uniqueBy = (values, getKey) => {
  const seen = new Set();
  const result = [];

  for (const value of asArray(values)) {
    const key = getKey(value);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(value);
  }

  return result;
};
