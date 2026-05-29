"use client";

import React from "react";
import { AnnouncementTimeline } from "./announcements.jsx";
import { BattleArena } from "./battle-arena.jsx";
import { ArcadeBar, PowerStats, StatusBar, VSBanner } from "./chrome.jsx";
import { getDashboardSnapshot } from "./data.js";
import { ExtensionSurface } from "./extensions.jsx";
import { FatalitiesPanel } from "./fatalities.jsx";
import { IntelFeed } from "./intel.jsx";
import { NewsletterSignup } from "./newsletter.jsx";
import { ContenderRoster } from "./roster.jsx";
import { TerritoryList, VerticalSpider } from "./verticals.jsx";

/* Section header w/ pixel number + title */

function SectionHead({ num, title, sub }) {
  return (
    <div className="section-head">
      <span className="num">{num}</span>
      <span className="ttl">{title}</span>
      <span className="rule"></span>
      <span className="sub">{sub}</span>
    </div>
  );
}

export default function DashboardApp() {
  const { contenders = [], claudeTeam, codexTeam, tweets, announcements, verticals, power, status, meta, concepts } = getDashboardSnapshot();
  const [intelFilter, setIntelFilter] = React.useState("all");
  const [round] = React.useState(7);
  const leftContender = contenders.find((contender) => contender.side === "c1") ?? contenders[0];
  const rightContender = contenders.find((contender) => contender.side === "c2") ?? contenders[1];

  return (
    <React.Fragment>
      <div className="app-bg"></div>
      <ArcadeBar round={round} credits={2} highScore={1287430} />
      <div className="app">
        <a className="repo-callout" href="https://github.com/self-tech-labs/clododex" target="_blank" rel="noreferrer">
          <span className="repo-callout-kicker">OPEN SOURCE · HACKABLE BY DESIGN</span>
          <span className="repo-callout-main">Fork the file-first arena, remix manifests, and ship your own agent meta.</span>
          <span className="repo-callout-cta">self-tech-labs/clododex</span>
        </a>

        {/* HERO MATCHUP */}
        <VSBanner power={power} contenders={contenders} />

        {/* INTEL FEED */}
        <SectionHead num="00" title="INTEL FEED" sub="key-person posts · auto-tagged for strategy" />
        <IntelFeed tweets={tweets} filter={intelFilter} setFilter={setIntelFilter} status={status} meta={meta} />
        <NewsletterSignup />

        {/* ANNOUNCEMENTS */}
        <SectionHead num="01" title="POWER MOVES" sub="releases · hires · partnerships · funding" />
        <AnnouncementTimeline rows={announcements} />

        {/* VERTICALS */}
        <SectionHead num="02" title="VERTICAL CONQUEST" sub="who owns which industry · today" />
        <div className="verticals-wrap">
          <VerticalSpider verticals={verticals} />
          <TerritoryList verticals={verticals} />
        </div>

        <SectionHead num="03" title="POWER STATS" sub="rolling 7-day · auto-refresh 5m" />
        <PowerStats power={power} />

        <SectionHead num="04" title="BATTLE ARENA" sub="token-metered turns · hot-seat or cpu" />
        <BattleArena claudeTeam={claudeTeam} codexTeam={codexTeam} />

        <SectionHead num="05" title="FATALITIES" sub="hidden weapons · source-backed finishers" />
        <FatalitiesPanel contenders={contenders} />

        {/* ROSTER */}
        <SectionHead num="06" title="FIGHTER ROSTER" sub="select a character — read the dossier" />
        <div className="roster">
          <ContenderRoster contender={leftContender} characters={claudeTeam} side="c1" />
          <ContenderRoster contender={rightContender} characters={codexTeam} side="c2" />
        </div>

        <SectionHead num="07" title="EXTENSION LAB" sub="manifest primitives · dormant hooks · future surfaces" />
        <ExtensionSurface concepts={concepts} />

        <StatusBar status={status} meta={meta} />
      </div>
    </React.Fragment>
  );
}
