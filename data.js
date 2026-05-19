import CurrentSnapshot from "./data/intel/current-snapshot.json";
import Backfill from "./data/intel/backfill.json";

/* ============================================================
   Fallback sample data for the CLAUDE vs CODEX intel dashboard.
   The app normally reads data/intel/current-snapshot.json, generated
   by scripts/build-intel-snapshot.mjs.
   ============================================================ */

const claudeTeam = [
  {
      id: "dario",
      name: "DARIO",
      surname: "AMODEI",
      handle: "@DarioAmodei",
      cls: "THE STRATEGIST",
      stats: { ATK: 92, DEF: 96, SPD: 78, COMBO: 88, HP: 95 },
      special: "DEFENSIVE SUPERCYCLE",
      combo: ["↓", "↘", "→", "SAFETY"],
      lore: "Anthropic CEO. Frames the arms race as inevitable — and winnable through safety-first scaling. Public letters land as field manuals for the AGI debate.",
      threatScore: 94,
      lastActivity: "2h",
    },
    {
      id: "daniela",
      name: "DANIELA",
      surname: "AMODEI",
      handle: "@DanielaAmodei",
      cls: "THE CONDUCTOR",
      stats: { ATK: 78, DEF: 92, SPD: 86, COMBO: 90, HP: 92 },
      special: "ORG VELOCITY BOOST",
      combo: ["↑", "→", "ENT"],
      lore: "President. Built the org that turned a research lab into the enterprise alternative to OpenAI. Quietly closes the deals nobody tweets about.",
      threatScore: 87,
      lastActivity: "1d",
    },
    {
      id: "krieger",
      name: "MIKE",
      surname: "KRIEGER",
      handle: "@mikeyk",
      cls: "THE BUILDER",
      stats: { ATK: 88, DEF: 82, SPD: 94, COMBO: 86, HP: 88 },
      special: "PRODUCT FRENZY",
      combo: ["→", "→", "SHIP"],
      lore: "CPO. Ex-Instagram. Turned Claude from a chat box into an artifact, a project, a skill, a code agent. The reason Claude no longer feels like a research demo.",
      threatScore: 91,
      lastActivity: "4h",
    },
    {
      id: "kaplan",
      name: "JARED",
      surname: "KAPLAN",
      handle: "@jaredkaplan",
      cls: "THE SCALING SAGE",
      stats: { ATK: 90, DEF: 88, SPD: 70, COMBO: 84, HP: 90 },
      special: "SCALING LAW BURN",
      combo: ["↓", "↓", "FLOPS"],
      lore: "Chief Science Officer. Co-author of the scaling laws paper that's now the religion of every frontier lab. Quiet axis of Anthropic's compute thesis.",
      threatScore: 86,
      lastActivity: "3d",
    },
];

const codexTeam = [
    {
      id: "sama",
      name: "SAM",
      surname: "ALTMAN",
      handle: "@sama",
      cls: "THE HUSTLER",
      stats: { ATK: 96, DEF: 72, SPD: 95, COMBO: 92, HP: 94 },
      special: "TRILLION-DOLLAR TELEGRAM",
      combo: ["↑", "↑", "↓", "↓", "GPU"],
      lore: "OpenAI CEO. Distribution machine. Drops cryptic tweets that move the market and a roadmap that always seems to land a quarter ahead of the field.",
      threatScore: 97,
      lastActivity: "20m",
    },
    {
      id: "greg",
      name: "GREG",
      surname: "BROCKMAN",
      handle: "@gdb",
      cls: "THE ENGINEER",
      stats: { ATK: 90, DEF: 80, SPD: 88, COMBO: 94, HP: 91 },
      special: "CODEX BAREMETAL",
      combo: ["→", "↓", "→", "RUN"],
      lore: "President & co-founder. The hands on the keyboard. Demoes Codex live on stage and writes the launch tweets that send GitHub stars vertical.",
      threatScore: 90,
      lastActivity: "6h",
    },
    {
      id: "kweil",
      name: "KEVIN",
      surname: "WEIL",
      handle: "@kevinweil",
      cls: "THE PRODUCT WIZARD",
      stats: { ATK: 86, DEF: 78, SPD: 92, COMBO: 88, HP: 87 },
      special: "INSTAGRAM-GRADE LAUNCH",
      combo: ["←", "→", "POST"],
      lore: "Chief Product Officer. Veteran of Twitter, Insta, Planet. Treats ChatGPT like a consumer surface, not a research demo — and ships accordingly.",
      threatScore: 85,
      lastActivity: "9h",
    },
    {
      id: "jakub",
      name: "JAKUB",
      surname: "PACHOCKI",
      handle: "@merettm",
      cls: "THE CHIEF SCIENTIST",
      stats: { ATK: 94, DEF: 90, SPD: 74, COMBO: 86, HP: 93 },
      special: "REASONING OVERDRIVE",
      combo: ["↓", "↘", "→", "RL"],
      lore: "Chief Scientist post-Ilya. Steers reasoning-model research. Rarely tweets — when he does, it's a hint at what's a quarter out.",
      threatScore: 89,
      lastActivity: "5d",
    },
];

const tweets = [
    {
      side: "c1",
      author: "Dario Amodei",
      handle: "@DarioAmodei",
      stamp: "2h",
      text: "We are entering the era where you should not deploy an agent you cannot also evaluate. Capability and oversight have to scale together — or one of them stops scaling.",
      insight: "Positions Claude as the responsible-deployment default. Likely setup for an enterprise governance announcement within ~2 weeks.",
      tags: [
        { l: "GOVERNANCE", t: "warn" },
        { l: "PRE-LAUNCH SIGNAL", t: "info" },
      ],
    },
    {
      side: "c2",
      author: "Sam Altman",
      handle: "@sama",
      stamp: "20m",
      text: "codex is now writing a meaningful fraction of new code at openai. the curve is steeper than i expected six months ago.",
      insight: "Classic Altman hype-tell. Pattern: vague capability claim → product update within ~10 days. Watch for a Codex tier expansion or pricing move.",
      tags: [
        { l: "HYPE PRIMING", t: "hot" },
        { l: "DEVTOOLS", t: "move" },
      ],
    },
    {
      side: "c1",
      author: "Mike Krieger",
      handle: "@mikeyk",
      stamp: "4h",
      text: "Skills are how Claude stops being a chat box. Hand it a folder, hand it a job, walk away. The interface is becoming invisible.",
      insight: "Doubling down on agent-skills as the wedge vs ChatGPT. Implies upcoming Claude Code expansion into non-developer verticals (legal, finance).",
      tags: [
        { l: "VERTICAL EXPAND", t: "move" },
        { l: "PRODUCT", t: "info" },
      ],
    },
    {
      side: "c2",
      author: "Greg Brockman",
      handle: "@gdb",
      stamp: "6h",
      text: "Spent the morning watching Codex refactor a 40k-line codebase end-to-end. Lunch break, it shipped a PR.",
      insight: "Live demo flex aimed at GitHub Copilot churn. Suggests OpenAI is preparing a Codex enterprise GA announcement, not a tier update.",
      tags: [
        { l: "DEVTOOLS", t: "move" },
        { l: "ENTERPRISE", t: "info" },
      ],
    },
    {
      side: "c1",
      author: "Daniela Amodei",
      handle: "@DanielaAmodei",
      stamp: "1d",
      text: "Five new Fortune 100 deployments this quarter. Three are deals nobody on AI Twitter is talking about. That's the point.",
      insight: "Counter-positioning vs OpenAI's consumer narrative. Signals enterprise revenue is the real moat play. Expect a Q-end disclosed metric.",
      tags: [
        { l: "ENTERPRISE", t: "info" },
        { l: "REVENUE", t: "warn" },
      ],
    },
    {
      side: "c2",
      author: "Kevin Weil",
      handle: "@kevinweil",
      stamp: "9h",
      text: "ChatGPT memory + projects + agents — picking up where you left off is the new default. The PC-era 'open file' is dead.",
      insight: "Frames OpenAI as the OS layer. Strategic threat to every productivity tool, including Claude's artifacts/skills story. Watch for consumer pricing change.",
      tags: [
        { l: "PLATFORM PLAY", t: "hot" },
        { l: "CONSUMER", t: "info" },
      ],
    },
];

const announcements = [
    {
      date: "MAY 12",
      c1: { tag: "RELEASE", title: "Claude 4.5 Opus — sustained 8h agentic runs", impact: "Industry first" },
      c2: null,
    },
    {
      date: "MAY 09",
      c1: null,
      c2: { tag: "PARTNERSHIP", title: "OpenAI × Stripe — agentic checkout SDK", impact: "Payments wedge" },
    },
    {
      date: "MAY 04",
      c1: { tag: "VERTICAL", title: "Claude for Financial Services — JPM pilot live", impact: "$80B vertical" },
      c2: { tag: "RELEASE", title: "Codex CLI 2.0 — multi-repo refactors", impact: "Devtools push" },
    },
    {
      date: "APR 28",
      c1: { tag: "POLICY", title: "Responsible Scaling Policy v3.0 published", impact: "Reg framework" },
      c2: null,
    },
    {
      date: "APR 21",
      c1: null,
      c2: { tag: "FUNDING", title: "OpenAI raises $40B at $300B valuation", impact: "War chest" },
    },
    {
      date: "APR 14",
      c1: { tag: "HIRE", title: "Ex-Google DeepMind safety lead joins", impact: "Talent gain" },
      c2: { tag: "RELEASE", title: "ChatGPT Agents — desktop control GA", impact: "Consumer flex" },
    },
];

// Vertical conquest - 0-100 control / mindshare in each vertical.
const verticals = [
    { key: "DEV",  name: "DEVELOPERS",       sub: "ide, cli, code review", c1: 78, c2: 92 },
    { key: "LAW",  name: "LEGAL",            sub: "discovery, contracts", c1: 84, c2: 52 },
    { key: "FIN",  name: "FINANCE",          sub: "ib, pe, hedge", c1: 86, c2: 68 },
    { key: "MED",  name: "HEALTHCARE",       sub: "clinical, biotech", c1: 70, c2: 65 },
    { key: "EDU",  name: "EDUCATION",        sub: "tutoring, research", c1: 62, c2: 88 },
    { key: "CRE",  name: "CREATIVE",         sub: "writing, design", c1: 64, c2: 82 },
    { key: "CS",   name: "CUSTOMER OPS",     sub: "support, sales", c1: 76, c2: 80 },
    { key: "GOV",  name: "GOVERNMENT",       sub: "defense, civic", c1: 72, c2: 58 },
    { key: "ENT",  name: "ENTERPRISE IT",    sub: "knowledge ops", c1: 82, c2: 74 },
    { key: "SCI",  name: "SCIENCE",          sub: "research agents", c1: 80, c2: 78 },
];

// Top-line power stats.
const power = {
  c1: { momentum: 86, mindshare: 31, enterprise: 42, ship: 14 },
  c2: { momentum: 92, mindshare: 51, enterprise: 36, ship: 22 },
};

const SampleGameData = { claudeTeam, codexTeam, tweets, announcements, verticals, power };

function buildBackfillDashboard(value) {
  const dashboard = value?.dashboard ?? {};
  return {
    claudeTeam: dashboard.claudeTeam,
    codexTeam: dashboard.codexTeam,
    tweets: Array.isArray(value?.intel) ? value.intel : [],
    announcements: dashboard.announcements,
    verticals: dashboard.verticals,
    power: dashboard.power,
    meta: {
      dataMode: value?.researchMode,
      generatedAt: value?.researchedAt,
      evidencePolicy: "Facts require source URLs. Inferences require confidence and multiple or official evidence."
    },
    status: {
      streamOk: false,
      newsSources: Array.isArray(value?.sources) ? value.sources.length : 0,
      archivedSignals: Array.isArray(value?.intel) ? value.intel.length : 0,
      visibleSignals: Array.isArray(value?.intel) ? value.intel.length : 0
    }
  };
}

const BackfillGameData = buildBackfillDashboard(Backfill);
export const GameData = hasDashboardShape(BackfillGameData) ? BackfillGameData : SampleGameData;

function hasDashboardShape(value) {
  return Boolean(
    value &&
      Array.isArray(value.claudeTeam) &&
      Array.isArray(value.codexTeam) &&
      Array.isArray(value.tweets) &&
      Array.isArray(value.announcements) &&
      Array.isArray(value.verticals) &&
      value.power?.c1 &&
      value.power?.c2
  );
}

export function getDashboardSnapshot() {
  return hasDashboardShape(CurrentSnapshot) ? CurrentSnapshot : GameData;
}
