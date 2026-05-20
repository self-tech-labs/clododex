import { asArray, asRecord, asString, clamp, compactObject, trimText } from "./core.mjs";

export const normalizeEvidenceUrls = (urls) => [
  ...new Set(asArray(urls).filter((url) => typeof url === "string" && /^https?:\/\//.test(url)))
];

const normalizeDossierTextEntry = (rawEntry, fields) => {
  const entry = asRecord(rawEntry);
  const evidenceUrls = normalizeEvidenceUrls(entry.evidenceUrls ?? entry.evidence_urls);
  if (!evidenceUrls.length) {
    return null;
  }

  const normalized = { evidenceUrls };
  for (const [field, maxLength] of fields) {
    const text = trimText(entry[field], maxLength);
    if (!text) {
      return null;
    }
    normalized[field] = text;
  }

  const confidence = clamp(Number(entry.confidence ?? 0.78), 0, 1);
  if ("confidence" in entry || fields.some(([field]) => field === "text")) {
    normalized.confidence = Number.isFinite(confidence) ? confidence : 0.78;
  }

  if (Array.isArray(entry.tags)) {
    const tags = entry.tags.map((tag) => asString(tag).trim()).filter(Boolean).slice(0, 5);
    if (tags.length) {
      normalized.tags = tags;
    }
  }

  return compactObject(normalized);
};

export const normalizeDossier = (rawDossier) => {
  const dossier = asRecord(rawDossier);
  if (!Object.keys(dossier).length) {
    return null;
  }

  const background = asArray(dossier.background)
    .map((entry) => normalizeDossierTextEntry(entry, [["text", 320]]))
    .filter(Boolean);
  const keyProjects = asArray(dossier.keyProjects ?? dossier.key_projects)
    .map((entry) => normalizeDossierTextEntry(entry, [["name", 80], ["description", 320]]))
    .filter(Boolean);
  const strengths = asArray(dossier.strengths)
    .map((entry) => normalizeDossierTextEntry(entry, [["label", 80], ["description", 260]]))
    .filter(Boolean);
  const narrativeEntry = normalizeDossierTextEntry(dossier.narrative, [["title", 100], ["text", 420]]);
  const sourceUrls = normalizeEvidenceUrls([
    ...asArray(dossier.sourceUrls ?? dossier.source_urls),
    ...background.flatMap((entry) => entry.evidenceUrls),
    ...keyProjects.flatMap((entry) => entry.evidenceUrls),
    ...strengths.flatMap((entry) => entry.evidenceUrls),
    ...asArray(narrativeEntry?.evidenceUrls)
  ]);

  if (!sourceUrls.length) {
    return null;
  }

  return compactObject({
    lastReviewedAt: asString(dossier.lastReviewedAt ?? dossier.last_reviewed_at).trim() || undefined,
    tagline: trimText(dossier.tagline, 150) || undefined,
    background,
    keyProjects,
    strengths,
    narrative: narrativeEntry || undefined,
    sourceUrls
  });
};

export const normalizeCharacter = (rawCharacter) => {
  const character = asRecord(rawCharacter);
  const { dossier: rawDossier, ...rest } = character;
  const dossier = normalizeDossier(rawDossier);
  return dossier ? { ...rest, dossier } : rest;
};

export const normalizeFighter = normalizeCharacter;
