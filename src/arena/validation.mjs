import { asArray, asRecord, asString } from "./core.mjs";

const duplicateIds = (items) => {
  const seen = new Set();
  const duplicates = new Set();
  for (const item of asArray(items)) {
    const id = asString(item.id);
    if (!id) {
      continue;
    }
    if (seen.has(id)) {
      duplicates.add(id);
    }
    seen.add(id);
  }
  return [...duplicates];
};

const hasEvidence = (value) => {
  const record = asRecord(value);
  return (
    asArray(record.evidenceUrls).some((url) => asString(url).startsWith("http")) ||
    asArray(record.sourceIds).some((id) => asString(id))
  );
};

const requireRationaleEvidence = (errors, label, value) => {
  const record = asRecord(value);
  if (!asString(record.rationale || record.text || record.description)) {
    errors.push(`${label} requires rationale text`);
  }
  if (!hasEvidence(record)) {
    errors.push(`${label} requires at least one evidence URL or source id`);
  }
};

export const validateArena = (arena) => {
  const errors = [];
  const warnings = [];
  const value = asRecord(arena);
  const contenders = asArray(value.contenders);
  const characters = asArray(value.characters);
  const concepts = asArray(value.concepts);
  const signals = asArray(value.signals);
  const dashboard = asRecord(value.dashboard);

  if (!asString(value.id)) {
    errors.push("arena.id is required");
  }
  if (!asString(value.title)) {
    errors.push("arena.title is required");
  }
  if (!contenders.length) {
    errors.push("at least one contender manifest is required");
  }

  for (const id of duplicateIds(contenders)) {
    errors.push(`duplicate contender id: ${id}`);
  }
  for (const id of duplicateIds(characters)) {
    errors.push(`duplicate character id: ${id}`);
  }
  for (const id of duplicateIds(concepts)) {
    errors.push(`duplicate concept id: ${id}`);
  }

  const contenderIds = new Set(contenders.map((contender) => asString(contender.id)).filter(Boolean));
  const contenderSides = new Set();
  for (const contender of contenders) {
    if (!asString(contender.id)) {
      errors.push("contender.id is required");
    }
    if (!asString(contender.name)) {
      errors.push(`contender ${asString(contender.id, "(missing id)")} requires name`);
    }
    const side = asString(contender.side);
    if (!side) {
      warnings.push(`contender ${asString(contender.id)} has no side; dashboard compatibility will be limited`);
    } else if (contenderSides.has(side)) {
      errors.push(`duplicate contender side: ${side}`);
    } else {
      contenderSides.add(side);
    }

    if (["c1", "c2"].includes(side)) {
      const fatalities = asArray(contender.fatalities);
      if (!fatalities.length) {
        errors.push(`contender ${asString(contender.id)} requires at least one fatality`);
      }
      for (const fatality of fatalities) {
        const fatalityId = asString(fatality.id || fatality.title, "(missing fatality)");
        if (!asString(fatality.title)) {
          errors.push(`contender ${asString(contender.id)} fatality ${fatalityId} requires title`);
        }
        if (!asString(fatality.unlockTrigger)) {
          errors.push(`contender ${asString(contender.id)} fatality ${fatalityId} requires unlockTrigger`);
        }
        if (!asString(fatality.arenaEffect)) {
          errors.push(`contender ${asString(contender.id)} fatality ${fatalityId} requires arenaEffect`);
        }
        requireRationaleEvidence(errors, `contender ${asString(contender.id)} fatality ${fatalityId}`, {
          rationale: fatality.arenaEffect,
          evidenceUrls: fatality.evidenceUrls,
          sourceIds: fatality.sourceIds
        });
      }
    }
  }

  for (const character of characters) {
    const id = asString(character.id, "(missing id)");
    const contenderId = asString(character.contenderId ?? character.contender_id);
    if (!asString(character.id)) {
      errors.push("character.id is required");
    }
    if (!contenderId) {
      errors.push(`character ${id} requires contenderId`);
    } else if (!contenderIds.has(contenderId)) {
      errors.push(`character ${id} references unknown contenderId: ${contenderId}`);
    }
    if (!asString(character.name || character.displayName)) {
      errors.push(`character ${id} requires name or displayName`);
    }

    const scoreRationale = asRecord(character.scoreRationale);
    const statRationales = asRecord(scoreRationale.stats);
    for (const stat of ["ATK", "DEF", "SPD", "COMBO", "HP"]) {
      if (!Number.isFinite(Number(character.stats?.[stat]))) {
        continue;
      }
      requireRationaleEvidence(errors, `character ${id} stat ${stat}`, statRationales[stat]);
    }
    if (Number.isFinite(Number(character.threatScore ?? character.score))) {
      requireRationaleEvidence(errors, `character ${id} threatScore`, scoreRationale.threatScore);
    }
  }

  for (const concept of concepts) {
    const id = asString(concept.id, "(missing id)");
    if (!asString(concept.id)) {
      errors.push("concept.id is required");
    }
    if (!asString(concept.kind)) {
      errors.push(`concept ${id} requires kind`);
    }
    if (!asString(concept.title)) {
      errors.push(`concept ${id} requires title`);
    }
    if (!asString(concept.description)) {
      errors.push(`concept ${id} requires description`);
    }
    for (const key of ["entities", "relationships", "surfaces", "dataSources"]) {
      if (!Array.isArray(concept[key])) {
        errors.push(`concept ${id} requires ${key} array`);
      }
    }
  }

  for (const signal of signals) {
    const id = asString(signal.id, "(missing id)");
    if (!asString(signal.side)) {
      errors.push(`signal ${id} requires side`);
    }
    if (!Array.isArray(signal.evidenceUrls) || !signal.evidenceUrls.length) {
      errors.push(`signal ${id} requires at least one evidence URL`);
    }
    if (!asString(signal.rationale || signal.insight)) {
      errors.push(`signal ${id} requires rationale or insight`);
    }
  }

  const power = asRecord(asRecord(dashboard.metrics).power ?? dashboard.power);
  const powerRationale = asRecord(power.rationale);
  for (const metric of ["momentum", "mindshare", "enterprise", "ship"]) {
    for (const side of ["c1", "c2"]) {
      if (Number.isFinite(Number(power[side]?.[metric]))) {
        requireRationaleEvidence(errors, `dashboard power ${side}.${metric}`, asRecord(powerRationale[metric])[side]);
      }
    }
  }

  for (const territory of asArray(dashboard.territories ?? value.territories)) {
    const id = asString(territory.key || territory.name, "(missing territory)");
    const rationale = asRecord(territory.rationale);
    for (const side of ["c1", "c2"]) {
      if (Number.isFinite(Number(territory[side]))) {
        requireRationaleEvidence(errors, `territory ${id} ${side}`, rationale[side]);
      }
    }
  }

  for (const [rowIndex, row] of asArray(dashboard.announcements).entries()) {
    for (const side of ["c1", "c2"]) {
      const move = row?.[side];
      if (!move) {
        continue;
      }
      requireRationaleEvidence(errors, `announcement row ${rowIndex + 1} ${side}`, move);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
};
