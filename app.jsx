"use client";

import React from "react";
import { AnnouncementTimeline } from "./announcements.jsx";
import { ArcadeBar, PowerStats, StatusBar, VSBanner } from "./chrome.jsx";
import { getDashboardSnapshot } from "./data.js";
import { IntelFeed } from "./intel.jsx";
import { TeamPanel } from "./roster.jsx";
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
  const { claudeTeam, codexTeam, tweets, announcements, verticals, power, status, meta } = getDashboardSnapshot();
  const [intelFilter, setIntelFilter] = React.useState("all");
  const [round] = React.useState(7);

  return (
    <React.Fragment>
      <div className="app-bg"></div>
      <ArcadeBar round={round} credits={2} highScore={1287430} />
      <div className="app">

        {/* HERO MATCHUP */}
        <VSBanner power={power} />

        <SectionHead num="01" title="POWER STATS" sub="rolling 7-day · auto-refresh 5m" />
        <PowerStats power={power} />

        {/* ROSTER */}
        <SectionHead num="02" title="FIGHTER ROSTER" sub="select a character — read the dossier" />
        <div className="roster">
          <TeamPanel team={claudeTeam} side="c1" teamLabel="TEAM CLAUDE" />
          <TeamPanel team={codexTeam} side="c2" teamLabel="TEAM CODEX" />
        </div>

        {/* INTEL FEED */}
        <SectionHead num="03" title="INTEL FEED" sub="key-person posts · auto-tagged for strategy" />
        <IntelFeed tweets={tweets} filter={intelFilter} setFilter={setIntelFilter} />

        {/* ANNOUNCEMENTS */}
        <SectionHead num="04" title="POWER MOVES" sub="releases · hires · partnerships · funding" />
        <AnnouncementTimeline rows={announcements} />

        {/* VERTICALS */}
        <SectionHead num="05" title="VERTICAL CONQUEST" sub="who owns which industry · today" />
        <div className="verticals-wrap">
          <VerticalSpider verticals={verticals} />
          <TerritoryList verticals={verticals} />
        </div>

        <StatusBar status={status} meta={meta} />
      </div>
    </React.Fragment>
  );
}
