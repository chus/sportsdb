"use client";

import { useSubscription } from "./subscription-provider";
import { UpgradeBanner } from "./upgrade-banner";
import { SidebarAd } from "@/components/ads/sidebar-ad";

interface SidebarUpgradeOrAdProps {
  context?: string;
}

export function SidebarUpgradeOrAd({ context = "default" }: SidebarUpgradeOrAdProps) {
  const { tier, isLoading } = useSubscription();

  if (isLoading) return null;

  if (tier === "free") {
    return <UpgradeBanner variant="sidebar" context={context} />;
  }

  // Pro/Premium users see the ad component (which itself returns null for adFree users)
  return <SidebarAd />;
}
