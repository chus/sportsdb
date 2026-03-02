"use client";

import { Heart } from "lucide-react";

interface FollowButtonProps {
  entityType: "player" | "team" | "competition";
  entityId: string;
  entityName?: string;
  variant?: "default" | "compact" | "hero";
  className?: string;
}

// Follow functionality is not available in the MVP (no user accounts).
// This component renders a placeholder that doesn't break existing pages.
export function FollowButton({
  variant = "default",
  className = "",
}: FollowButtonProps) {
  if (variant === "hero") {
    return null;
  }

  return null;
}
