/* Tweaks panel — customize the dashboard's visual style */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "scanlines": true,
  "grain": "subtle",
  "crtFlicker": false,
  "vsPulse": true,
  "palette": "default",
  "intelDensity": "regular",
  "spiderStyle": "filled"
}/*EDITMODE-END*/;

const PALETTES = {
  default: { c1: "#E07A53", c1b: "#FF9469", c2: "#10B981", c2b: "#34E5A8", hot: "#FF2E63" },
  neon:    { c1: "#FF3E96", c1b: "#FF85C0", c2: "#00E5FF", c2b: "#66F2FF", hot: "#FFEB3B" },
  retro:   { c1: "#F2A23B", c1b: "#FFD080", c2: "#7AE582", c2b: "#B4F0A0", hot: "#FF5050" },
  mono:    { c1: "#E0E0E0", c1b: "#FFFFFF", c2: "#8A8A8A", c2b: "#BCBCBC", hot: "#FF2E63" },
};

function applyTweaks(t) {
  const root = document.documentElement;
  const p = PALETTES[t.palette] || PALETTES.default;
  root.style.setProperty("--c1", p.c1);
  root.style.setProperty("--c1-bright", p.c1b);
  root.style.setProperty("--c2", p.c2);
  root.style.setProperty("--c2-bright", p.c2b);
  root.style.setProperty("--hot", p.hot);

  document.body.classList.toggle("no-scanlines", !t.scanlines);
  document.body.classList.toggle("grain-heavy", t.grain === "heavy");
  document.body.classList.toggle("grain-off", t.grain === "off");
  document.body.classList.toggle("crt-flicker", t.crtFlicker);
  document.body.classList.toggle("vs-still", !t.vsPulse);
  document.body.classList.toggle("intel-compact", t.intelDensity === "compact");
  document.body.classList.toggle("spider-line", t.spiderStyle === "line");
}

function AppTweaks() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  React.useEffect(() => applyTweaks(t), [t]);
  return (
    <TweaksPanel>
      <TweakSection label="CRT Effects" />
      <TweakToggle label="Scanlines"     value={t.scanlines}  onChange={(v) => setTweak("scanlines", v)} />
      <TweakRadio  label="Grain"         value={t.grain}      options={["off","subtle","heavy"]} onChange={(v)=>setTweak("grain",v)} />
      <TweakToggle label="CRT flicker"   value={t.crtFlicker} onChange={(v) => setTweak("crtFlicker", v)} />
      <TweakToggle label="VS pulse"      value={t.vsPulse}    onChange={(v) => setTweak("vsPulse", v)} />

      <TweakSection label="Palette" />
      <TweakRadio  label="Theme"         value={t.palette}    options={["default","neon","retro","mono"]} onChange={(v)=>setTweak("palette",v)} />

      <TweakSection label="Layout" />
      <TweakRadio  label="Intel feed"    value={t.intelDensity} options={["compact","regular"]} onChange={(v)=>setTweak("intelDensity",v)} />
      <TweakRadio  label="Radar"         value={t.spiderStyle}  options={["line","filled"]} onChange={(v)=>setTweak("spiderStyle",v)} />
    </TweaksPanel>
  );
}

// Mount into root sibling once the main app exists
window.addEventListener("DOMContentLoaded", () => {
  const host = document.createElement("div");
  host.id = "tweaks-root";
  document.body.appendChild(host);
  // Defer until react ready
  const mount = () => {
    if (window.TweaksPanel && window.useTweaks) {
      ReactDOM.createRoot(host).render(<AppTweaks />);
    } else {
      setTimeout(mount, 50);
    }
  };
  mount();
});
