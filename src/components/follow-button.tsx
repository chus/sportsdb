"use client";

import { useState, useEffect } from "react";
import { Heart, Loader2, Check } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import Link from "next/link";

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
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    async function checkFollowStatus() {
      try {
        const res = await fetch(`/api/follow?entityType=${entityType}&entityId=${entityId}`);
        const data = await res.json();
        setIsFollowing(data.following);
      } catch {
        // Ignore errors
      } finally {
        setIsLoading(false);
      }
    }

    checkFollowStatus();
  }, [user, entityType, entityId]);

  const handleToggleFollow = async () => {
    if (!user || isUpdating) return;

    setIsUpdating(true);
    const newFollowState = !isFollowing;
    setIsFollowing(newFollowState); // Optimistic update

    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          action: newFollowState ? "follow" : "unfollow",
        }),
      });

      if (res.ok) {
        // Show toast
        setToastMessage(
          newFollowState
            ? `Following ${entityName || entityType}`
            : `Unfollowed ${entityName || entityType}`
        );
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2500);
      } else {
        // Revert on error
        setIsFollowing(!newFollowState);
      }
    } catch {
      // Revert on error
      setIsFollowing(!newFollowState);
    } finally {
      setIsUpdating(false);
    }
  };

  // Toast component
  const Toast = () =>
    showToast ? (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="bg-neutral-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
          <Check className="w-5 h-5 text-green-400" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      </div>
    ) : null;

  if (!user) {
    if (variant === "hero") {
      return (
        <Link
          href="/login"
          className={`px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-medium rounded-xl hover:bg-white/20 transition-all flex items-center gap-2 ${className}`}
        >
          <Heart className="w-5 h-5" />
          Follow {entityType === "player" ? "Player" : entityType === "team" ? "Team" : "Competition"}
        </Link>
      );
    }

    return (
      <Link
        href="/login"
        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-xl hover:bg-neutral-50 transition-colors ${className}`}
      >
        <Heart className="w-4 h-4" />
        Follow
      </Link>
    );
  }

  if (isLoading) {
    return (
      <button
        disabled
        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-400 bg-neutral-100 border border-neutral-200 rounded-xl cursor-not-allowed ${className}`}
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        {variant !== "compact" && "Loading"}
      </button>
    );
  }

  // Hero variant (for player/team pages with dark background)
  if (variant === "hero") {
    return (
      <>
        <button
          onClick={handleToggleFollow}
          disabled={isUpdating}
          className={`px-6 py-3 backdrop-blur-sm border font-medium rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 ${
            isFollowing
              ? "bg-white/20 border-red-400/50 text-white hover:bg-red-500/30"
              : "bg-white/10 border-white/20 text-white hover:bg-white/20"
          } ${className}`}
        >
          {isUpdating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Heart
              className={`w-5 h-5 transition-all duration-200 ${
                isFollowing ? "fill-current text-red-400" : ""
              }`}
            />
          )}
          {isFollowing
            ? "Following"
            : `Follow ${entityType === "player" ? "Player" : entityType === "team" ? "Team" : "Competition"}`}
        </button>
        <Toast />
      </>
    );
  }

  // Compact variant
  if (variant === "compact") {
    return (
      <>
        <button
          onClick={handleToggleFollow}
          disabled={isUpdating}
          className={`px-4 py-2 rounded-xl font-medium text-sm transition-all duration-200 flex items-center gap-2 disabled:opacity-50 ${
            isFollowing
              ? "bg-red-100 text-red-600 hover:bg-red-200"
              : "bg-blue-600 text-white hover:bg-blue-700"
          } ${className}`}
        >
          {isUpdating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Heart
              className={`w-4 h-4 transition-all duration-200 ${
                isFollowing ? "fill-current" : ""
              }`}
            />
          )}
          {isFollowing ? "Following" : "Follow"}
        </button>
        <Toast />
      </>
    );
  }

  // Default variant
  return (
    <>
      <button
        onClick={handleToggleFollow}
        disabled={isUpdating}
        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
          isFollowing
            ? "text-red-600 bg-red-50 border border-red-200 hover:bg-red-100"
            : "text-white bg-blue-600 hover:bg-blue-700"
        } disabled:opacity-50 ${className}`}
      >
        {isUpdating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Heart
            className={`w-4 h-4 transition-all duration-200 ${
              isFollowing ? "fill-current" : ""
            }`}
          />
        )}
        {isFollowing ? "Following" : "Follow"}
      </button>
      <Toast />
    </>
  );
}
