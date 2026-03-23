"use client";

import { ReactNode } from "react";
import { TabNavigation } from "@/components/ui/tab-navigation";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "squad", label: "Squad" },
  { id: "fixtures", label: "Fixtures" },
  { id: "stats", label: "Stats" },
];

interface TeamTabsProps {
  squadCount: number;
  children: ReactNode;
}

export function TeamTabs({ squadCount, children }: TeamTabsProps) {
  const tabs = TABS.map((t) => {
    if (t.id === "squad") return { ...t, count: squadCount };
    return t;
  });

  return (
    <TabNavigation tabs={tabs} defaultTab="overview">
      {children}
    </TabNavigation>
  );
}
