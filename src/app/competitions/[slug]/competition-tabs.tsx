"use client";

import { ReactNode } from "react";
import { TabNavigation, TabPanels } from "@/components/ui/tab-navigation";

const TABS = [
  { id: "standings", label: "Standings" },
  { id: "fixtures", label: "Fixtures" },
  { id: "scorers", label: "Top Scorers" },
];

interface CompetitionTabsProps {
  teamCount: number;
  children: (activeTab: string) => ReactNode;
}

export function CompetitionTabs({ teamCount, children }: CompetitionTabsProps) {
  const tabs = TABS.map((t) => {
    if (t.id === "standings") return { ...t, count: teamCount };
    return t;
  });

  return (
    <TabNavigation tabs={tabs} defaultTab="standings">
      <TabPanels defaultTab="standings" tabs={tabs.map((t) => t.id)}>
        {children}
      </TabPanels>
    </TabNavigation>
  );
}
