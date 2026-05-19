"use client";

/* Pixel sprite portraits for fighters — abstract blocky avatars.
   These are not portraits — they are arcade-style class icons,
   varied by fighter class so each card feels distinct.            */

const PIXEL = 6; // px per pixel cell
function px(x, y, w = 1, h = 1, fill = "#fff", key) {
  return (
    <rect
      key={key}
      x={x * PIXEL}
      y={y * PIXEL}
      width={w * PIXEL}
      height={h * PIXEL}
      fill={fill}
      shapeRendering="crispEdges"
    />
  );
}

// Color palettes per side
const PAL = {
  c1: {
    skin: "#f0bb8a",
    hair: "#3a1f15",
    coat: "#E07A53",
    coatHi: "#FF9469",
    coatLo: "#7a3520",
    accent: "#FFCB3D",
    eye: "#0c0c14",
    shadow: "#1a0f0a",
  },
  c2: {
    skin: "#d8c3a8",
    hair: "#1a1a20",
    coat: "#10B981",
    coatHi: "#34E5A8",
    coatLo: "#0a4d3a",
    accent: "#FFCB3D",
    eye: "#0c0c14",
    shadow: "#06231a",
  },
};

// A base humanoid sprite — 10w × 14h pixel grid — varied by accessories
export function BaseFighter({ side, variant }) {
  const p = PAL[side];
  // variant changes hair/headgear and pose accents
  const v = variant % 4;

  // headgear
  let headGear = null;
  if (v === 0) {
    // Strategist — wide brimmed
    headGear = [
      px(2, 1, 6, 1, p.hair, "hg1"),
      px(1, 2, 8, 1, p.hair, "hg2"),
    ];
  } else if (v === 1) {
    // Conductor — short tied hair / band
    headGear = [
      px(3, 1, 4, 1, p.accent, "hg1"),
      px(2, 2, 6, 1, p.hair, "hg2"),
    ];
  } else if (v === 2) {
    // Builder — visor / cap
    headGear = [
      px(2, 2, 6, 1, p.coatLo, "hg1"),
      px(2, 1, 6, 1, p.coat, "hg2"),
      px(1, 2, 1, 1, p.coatHi, "hg3"),
      px(8, 2, 1, 1, p.coatHi, "hg4"),
    ];
  } else {
    // Scientist / Sage — wild hair
    headGear = [
      px(1, 1, 1, 1, p.hair, "hg1"),
      px(8, 1, 1, 1, p.hair, "hg2"),
      px(2, 2, 6, 1, p.hair, "hg3"),
      px(2, 1, 6, 1, p.hair, "hg4"),
    ];
  }

  return (
    <svg
      viewBox="0 0 60 84"
      width="100%"
      height="100%"
      style={{ imageRendering: "pixelated" }}
    >
      {/* shadow / platform */}
      {px(1, 13, 8, 1, p.shadow)}
      {/* head */}
      {px(3, 3, 4, 3, p.skin)}
      {px(2, 4, 1, 1, p.skin)}
      {px(7, 4, 1, 1, p.skin)}
      {/* eyes */}
      {px(3, 4, 1, 1, p.eye)}
      {px(6, 4, 1, 1, p.eye)}
      {/* headgear */}
      {headGear}
      {/* neck */}
      {px(4, 6, 2, 1, p.skin)}
      {/* coat / body */}
      {px(2, 7, 6, 1, p.coatLo)}
      {px(1, 8, 8, 3, p.coat)}
      {/* coat highlights (left lapel) */}
      {px(2, 8, 1, 3, p.coatHi)}
      {/* accent badge */}
      {px(3, 9, 1, 1, p.accent)}
      {/* arms */}
      {px(0, 8, 1, 3, p.coatLo)}
      {px(9, 8, 1, 3, p.coatLo)}
      {/* fists */}
      {px(0, 11, 1, 1, p.skin)}
      {px(9, 11, 1, 1, p.skin)}
      {/* legs */}
      {px(3, 11, 2, 2, p.coatLo)}
      {px(5, 11, 2, 2, p.coatLo)}
      {/* feet */}
      {px(2, 12, 2, 1, p.shadow)}
      {px(6, 12, 2, 1, p.shadow)}
    </svg>
  );
}
