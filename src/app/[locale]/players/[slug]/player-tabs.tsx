"use client";

import { ReactNode } from "react";
import { TabNavigation } from "@/components/ui/tab-navigation";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "stats", label: "Stats" },
  { id: "career", label: "Career" },
  { id: "news", label: "News" },
];

interface PlayerTabsProps {
  statsCount: number;
  careerCount: number;
  matchCount: number;
  children: ReactNode;
}

export function PlayerTabs({ statsCount, careerCount, matchCount, children }: PlayerTabsProps) {
  const tabs = TABS.map((t) => {
    if (t.id === "stats" && statsCount > 0) return { ...t, count: statsCount };
    if (t.id === "career" && careerCount > 0) return { ...t, count: careerCount };
    return t;
  });

  return (
    <TabNavigation tabs={tabs} defaultTab="overview">
      {children}
    </TabNavigation>
  );
}
