function ExtensionCard({ concept }) {
  const entities = Array.isArray(concept.entities) ? concept.entities : [];
  const surfaces = Array.isArray(concept.surfaces) ? concept.surfaces : [];
  const dataSources = Array.isArray(concept.dataSources) ? concept.dataSources : [];

  return (
    <article className="extension-card">
      <div className="extension-card-top">
        <span>{concept.kind}</span>
        <span>{concept.status || "draft"}</span>
      </div>
      <h3>{concept.title}</h3>
      <p>{concept.description}</p>
      <div className="extension-meta">
        <span>{entities.length} entities</span>
        <span>{surfaces.length} surfaces</span>
        <span>{dataSources.length} sources</span>
      </div>
    </article>
  );
}

export function ExtensionSurface({ concepts }) {
  const rows = Array.isArray(concepts) ? concepts : [];
  if (!rows.length) return null;

  return (
    <div className="panel extension-surface">
      <div className="panel-head">
        <span>EXTENSION LAB · HACKABLE PRIMITIVES</span>
        <span className="extension-count">{rows.length} manifests</span>
      </div>
      <div className="extension-grid">
        {rows.map((concept) => (
          <ExtensionCard key={concept.id} concept={concept} />
        ))}
      </div>
    </div>
  );
}
