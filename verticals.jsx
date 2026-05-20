/* Vertical conquest — spider/radar chart + territory bars */

function SourceLinks({ urls }) {
  const evidenceUrls = Array.isArray(urls) ? urls.filter((url) => typeof url === "string" && url.startsWith("http")) : [];
  if (!evidenceUrls.length) return null;

  return (
    <div className="score-evidence">
      {evidenceUrls.slice(0, 3).map((url, index) => (
        <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer">
          src {index + 1}
        </a>
      ))}
    </div>
  );
}

function TerritoryWhy({ rationale }) {
  if (!rationale?.c1?.rationale && !rationale?.c2?.rationale) return null;

  return (
    <details className="score-why territory-why">
      <summary>WHY THIS TERRITORY?</summary>
      <div className="score-why-grid">
        <div>
          <strong>CLAUDE</strong>
          <p>{rationale?.c1?.rationale || "No rationale recorded."}</p>
          {typeof rationale?.c1?.confidence === "number" && <span>CONF {Math.round(rationale.c1.confidence * 100)}%</span>}
          <SourceLinks urls={rationale?.c1?.evidenceUrls} />
        </div>
        <div>
          <strong>CODEX</strong>
          <p>{rationale?.c2?.rationale || "No rationale recorded."}</p>
          {typeof rationale?.c2?.confidence === "number" && <span>CONF {Math.round(rationale.c2.confidence * 100)}%</span>}
          <SourceLinks urls={rationale?.c2?.evidenceUrls} />
        </div>
      </div>
    </details>
  );
}

function SpiderChart({ verticals }) {
  const size = 560;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;
  const N = verticals.length;
  const rings = [0.25, 0.5, 0.75, 1.0];

  // Convert axis index to angle (start at top, go clockwise)
  const angle = (i) => (-Math.PI / 2) + (i / N) * Math.PI * 2;
  const point = (i, v) => {
    const r = (v / 100) * radius;
    const a = angle(i);
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };

  const polyPoints = (key) =>
    verticals
      .map((v, i) => point(i, v[key]).join(","))
      .join(" ");

  return (
    <svg className="spider-svg" viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id="ambient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,203,61,0.06)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={radius * 1.05} fill="url(#ambient)" />

      {/* concentric rings */}
      {rings.map((r, idx) => {
        const pts = verticals
          .map((_, i) => {
            const a = angle(i);
            const rr = radius * r;
            return `${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`;
          })
          .join(" ");
        return (
          <polygon
            key={idx}
            points={pts}
            fill="none"
            stroke="rgba(122,132,168,0.15)"
            strokeWidth={1}
            strokeDasharray={idx === rings.length - 1 ? "0" : "3 4"}
          />
        );
      })}

      {/* axis spokes + labels */}
      {verticals.map((v, i) => {
        const [ex, ey] = point(i, 100);
        const labelR = radius + 32;
        const a = angle(i);
        const lx = cx + Math.cos(a) * labelR;
        const ly = cy + Math.sin(a) * labelR;
        const valR = radius + 14;
        const vx = cx + Math.cos(a) * valR;
        const vy = cy + Math.sin(a) * valR;
        return (
          <g key={v.key}>
            <line x1={cx} y1={cy} x2={ex} y2={ey} stroke="rgba(122,132,168,0.12)" strokeWidth="1" />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="var(--font-pixel)"
              fontSize="9"
              letterSpacing="0.14em"
              fill="#f0f0f5"
            >
              {v.key}
            </text>
            <text
              x={lx}
              y={ly + 14}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="var(--font-mono)"
              fontSize="9"
              fill="#6e6e85"
              letterSpacing="0.02em"
            >
              {v.name}
            </text>
          </g>
        );
      })}

      {/* Claude polygon */}
      <polygon
        points={polyPoints("c1")}
        fill="rgba(224, 122, 83, 0.18)"
        stroke="#E07A53"
        strokeWidth={2}
        style={{ filter: "drop-shadow(0 0 12px rgba(224,122,83,0.45))" }}
      />
      {verticals.map((v, i) => {
        const [x, y] = point(i, v.c1);
        return <rect key={"c1"+i} x={x-3} y={y-3} width="6" height="6" fill="#FF9469" />;
      })}

      {/* Codex polygon */}
      <polygon
        points={polyPoints("c2")}
        fill="rgba(47, 128, 237, 0.16)"
        stroke="#2F80ED"
        strokeWidth={2}
        style={{ filter: "drop-shadow(0 0 12px rgba(47,128,237,0.45))" }}
      />
      {verticals.map((v, i) => {
        const [x, y] = point(i, v.c2);
        return <rect key={"c2"+i} x={x-3} y={y-3} width="6" height="6" fill="#7DB7FF" />;
      })}

      {/* center mark */}
      <rect x={cx - 3} y={cy - 3} width="6" height="6" fill="#FF2E63" />
      <text x={cx} y={cy + 20} textAnchor="middle" fontFamily="var(--font-pixel)" fontSize="7" fill="#FF2E63" letterSpacing="0.18em">CONTESTED</text>
    </svg>
  );
}

export function TerritorySpider({ territories, verticals }) {
  const rows = Array.isArray(territories) ? territories : Array.isArray(verticals) ? verticals : [];
  return (
    <div className="panel spider-wrap">
      <div className="panel-head" style={{ margin: "-20px -20px 0", padding: "12px 16px" }}>
        <span>VERTICAL CONQUEST · RADAR</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-dim)", letterSpacing: "0.06em" }}>
          MINDSHARE × DEPLOYMENT INDEX · 0–100
        </span>
      </div>
      <SpiderChart verticals={rows} />
      <div className="legend">
        <div className="c1"><span className="swatch"></span>CLAUDE</div>
        <div className="c2"><span className="swatch"></span>CODEX</div>
      </div>
    </div>
  );
}

export function VerticalSpider({ verticals }) {
  return <TerritorySpider territories={verticals} />;
}

export function TerritoryList({ territories, verticals }) {
  const rows = Array.isArray(territories) ? territories : Array.isArray(verticals) ? verticals : [];
  // sort by total contention
  const sorted = [...rows].sort((a,b) => (Math.abs(b.c1-b.c2) < 12 ? 1 : 0) - (Math.abs(a.c1-a.c2) < 12 ? 1 : 0));
  return (
    <div className="panel territories">
      <div className="panel-head" style={{ margin: "-16px -16px 12px", padding: "12px 16px" }}>
        <span>TERRITORY CONTROL · BY VERTICAL</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-dim)", letterSpacing: "0.06em" }}>
          ◀ CLAUDE · CODEX ▶
        </span>
      </div>
      {sorted.map((v) => {
        const contested = Math.abs(v.c1 - v.c2) < 12;
        const c1win = v.c1 > v.c2;
        return (
          <div className="territory" key={v.key}>
            <div className="terr-name">
              {v.name}
              <span className="sub">{v.sub}</span>
              {contested && <span className="battle-tag">⚔ HOT</span>}
            </div>
            <div className="terr-meter c1 right">
              <div className="fill" style={{ width: v.c1 + "%" }}><span>{v.c1}</span></div>
              {c1win && !contested && <span className="crown" style={{ left: 4, right: "auto" }}>★</span>}
            </div>
            <div className="terr-meter c2">
              <div className="fill" style={{ width: v.c2 + "%" }}>{v.c2}</div>
              {!c1win && !contested && <span className="crown">★</span>}
            </div>
            <TerritoryWhy rationale={v.rationale} />
          </div>
        );
      })}
    </div>
  );
}
