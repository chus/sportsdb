"use client";

import { useState, useEffect, useCallback } from "react";
import { Heart, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useAuthModal } from "@/components/auth/auth-modal";
import { useUpgradeModal } from "@/components/subscription/upgrade-modal";
import { useAnalytics } from "@/hooks/use-analytics";
import { cn } from "@/lib/utils/cn";

interface FollowButtonProps {
  entityType: "player" | "team" | "competition";
  entityId: string;
  entityName?: string;
  variant?: "default" | "compact" | "hero";
  className?: string;
}

export function FollowButton({
  entityType,
  entityId,
  entityName,
  variant = "default",
  className = "",
}: FollowButtonProps) {
  const { user } = useAuth();
  const { openModal } = useAuthModal();
  const { openUpgradeModal } = useUpgradeModal();
  const { trackFollow } = useAnalytics();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const checkFollowStatus = useCallback(async () => {
    if (!user) {
      setFollowing(false);
      setInitialized(true);
      return;
    }
    try {
      const res = await fetch(
        `/api/follow?entityType=${entityType}&entityId=${entityId}`
      );
      if (res.ok) {
        const data = await res.json();
        setFollowing(data.following);
      }
    } catch {
      // Silently fail — default to not following
    } finally {
      setInitialized(true);
    }
  }, [user, entityType, entityId]);

  useEffect(() => {
    checkFollowStatus();
  }, [checkFollowStatus]);

  const handleClick = async () => {
    if (!user) {
      openModal("signup");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          action: following ? "unfollow" : "follow",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setFollowing(data.following);
        if (data.following) {
          trackFollow(entityType, entityId);
        }
      } else if (res.status === 403) {
        openUpgradeModal("follow_limit");
      }
    } catch {
      console.error("Follow request failed");
    } finally {
      setLoading(false);
    }
  };

  if (!initialized) return null;

  if (variant === "hero") {
    return (
      <div className="relative">
        <button
          onClick={handleClick}
          disabled={loading}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50",
            following
              ? "bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm"
              : "bg-white text-blue-600 hover:bg-white/90",
            className
          )}
          title={following ? `Unfollow ${entityName || ""}` : `Follow ${entityName || ""}`}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Heart
              className={cn("w-4 h-4", following && "fill-current")}
            />
          )}
          {following ? "Following" : "Follow"}
        </button>

      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className="relative">
        <button
          onClick={handleClick}
          disabled={loading}
          className={cn(
            "p-2 rounded-lg transition-colors disabled:opacity-50",
            following
              ? "text-red-500 hover:bg-red-50"
              : "text-neutral-400 hover:text-red-500 hover:bg-red-50",
            className
          )}
          title={following ? `Unfollow ${entityName || ""}` : `Follow ${entityName || ""}`}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Heart className={cn("w-4 h-4", following && "fill-current")} />
          )}
        </button>

      </div>
    );
  }

  // Default variant
  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={loading}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border disabled:opacity-50",
          following
            ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
            : "border-neutral-200 bg-white text-neutral-700 hover:border-blue-300 hover:text-blue-600",
          className
        )}
        title={following ? `Unfollow ${entityName || ""}` : `Follow ${entityName || ""}`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Heart className={cn("w-4 h-4", following && "fill-current")} />
        )}
        {following ? "Following" : "Follow"}
      </button>
    </div>
  );
}
