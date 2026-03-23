"use client";

import { ReactNode } from "react";
import { TabNavigation } from "@/components/ui/tab-navigation";

const TABS = [
  { id: "standings", label: "Standings" },
  { id: "fixtures", label: "Fixtures" },
  { id: "scorers", label: "Top Scorers" },
];

interface CompetitionTabsProps {
  teamCount: number;
  children: ReactNode;
}

export function CompetitionTabs({ teamCount, children }: CompetitionTabsProps) {
  const tabs = TABS.map((t) => {
    if (t.id === "standings") return { ...t, count: teamCount };
    return t;
  });

  return (
    <TabNavigation tabs={tabs} defaultTab="standings">
      {children}
    </TabNavigation>
  );
}
