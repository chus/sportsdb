"use client";

import { useEffect } from "react";
import { useAnalytics } from "@/hooks/use-analytics";

export function PageTracker({
  entityType,
  entityId,
}: {
  entityType?: "player" | "team" | "competition" | "match";
  entityId?: string;
}) {
  const { trackPageView } = useAnalytics();

  useEffect(() => {
    trackPageView(entityType, entityId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
