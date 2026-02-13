"use client";

import { useState, useEffect } from "react";
import { Heart, HeartOff, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import Link from "next/link";

interface FollowButtonProps {
  entityType: "player" | "team" | "competition";
  entityId: string;
  className?: string;
  showLabel?: boolean;
}

export function FollowButton({ entityType, entityId, className = "", showLabel = true }: FollowButtonProps) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

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

      if (!res.ok) {
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

  if (!user) {
    return (
      <Link
        href="/login"
        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors ${className}`}
      >
        <Heart className="w-4 h-4" />
        {showLabel && "Follow"}
      </Link>
    );
  }

  if (isLoading) {
    return (
      <button
        disabled
        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-400 bg-neutral-100 border border-neutral-200 rounded-lg cursor-not-allowed ${className}`}
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        {showLabel && "Loading"}
      </button>
    );
  }

  return (
    <button
      onClick={handleToggleFollow}
      disabled={isUpdating}
      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        isFollowing
          ? "text-red-600 bg-red-50 border border-red-200 hover:bg-red-100"
          : "text-white bg-blue-600 hover:bg-blue-700"
      } disabled:opacity-50 ${className}`}
    >
      {isUpdating ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isFollowing ? (
        <HeartOff className="w-4 h-4" />
      ) : (
        <Heart className="w-4 h-4" />
      )}
      {showLabel && (isFollowing ? "Following" : "Follow")}
    </button>
  );
}
