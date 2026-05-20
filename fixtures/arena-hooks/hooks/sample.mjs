export const normalize = (entity) => ({
  ...entity,
  normalized: true
});

export const score = (snapshot) => ({
  visibleSignals: snapshot.primitives.signals.length
});

export const renderHint = (entity) => ({
  entityId: entity.id,
  label: `Render ${entity.type}`
});
