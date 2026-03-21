"use client";

import { ReactNode } from "react";
import { ProTeaser } from "./pro-teaser";
import { useUpgradeModal } from "./upgrade-modal";

interface ProTeaserWithModalProps {
  feature: "advanced_stats" | "historical_data" | "export_data" | "ad_free";
  children: ReactNode;
  className?: string;
  label?: string;
}

export function ProTeaserWithModal({
  feature,
  children,
  className,
  label,
}: ProTeaserWithModalProps) {
  const { openUpgradeModal } = useUpgradeModal();

  return (
    <ProTeaser
      className={className}
      label={label}
      onUnlock={() => openUpgradeModal(feature)}
    >
      {children}
    </ProTeaser>
  );
}
