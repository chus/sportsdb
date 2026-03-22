"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLiveMatches } from "@/hooks/use-live-matches";
import { cn } from "@/lib/utils/cn";

export function ScoreStrip() {
  const { matches, hasLiveMatches, isLoading } = useLiveMatches({
    pollingInterval: 30000,
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hide completely when no live matches (and not loading)
  if (!isLoading && !hasLiveMatches) return null;

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const amount = direction === "left" ? -200 : 200;
      scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
    }
  };

  return (
    <div className="bg-neutral-900 border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 relative">
        {/* Scroll buttons */}
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-0 bottom-0 z-10 px-1 bg-gradient-to-r from-neutral-900 to-transparent text-neutral-400 hover:text-white"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-0 bottom-0 z-10 px-1 bg-gradient-to-l from-neutral-900 to-transparent text-neutral-400 hover:text-white"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Scrollable area */}
        <div
          ref={scrollRef}
          className="flex items-center gap-3 overflow-x-auto scrollbar-hide px-6 py-2"
        >
          {isLoading && !hasLiveMatches && (
            <div className="flex items-center gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-36 h-10 bg-neutral-800 rounded animate-pulse flex-shrink-0"
                />
              ))}
            </div>
          )}

          {/* Live label */}
          {hasLiveMatches && (
            <div className="flex items-center gap-1.5 pr-2 border-r border-neutral-700 flex-shrink-0">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Live</span>
            </div>
          )}

          {matches.map((match) => (
            <Link
              key={match.id}
              href={`/matches/${match.id}`}
              className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800/60 hover:bg-neutral-700/60 rounded transition-colors flex-shrink-0"
            >
              {/* Home */}
              <span className="text-xs text-neutral-300 font-medium truncate max-w-[60px]">
                {match.homeTeam?.shortName || match.homeTeam?.name?.slice(0, 3).toUpperCase() || "---"}
              </span>

              {/* Score */}
              <div className="flex items-center gap-1">
                <span className={cn(
                  "text-sm font-bold min-w-[18px] text-center",
                  match.status === "live" ? "text-white" : "text-neutral-300"
                )}>
                  {match.homeScore ?? "-"}
                </span>
                <span className="text-neutral-600 text-xs">-</span>
                <span className={cn(
                  "text-sm font-bold min-w-[18px] text-center",
                  match.status === "live" ? "text-white" : "text-neutral-300"
                )}>
                  {match.awayScore ?? "-"}
                </span>
              </div>

              {/* Away */}
              <span className="text-xs text-neutral-300 font-medium truncate max-w-[60px]">
                {match.awayTeam?.shortName || match.awayTeam?.name?.slice(0, 3).toUpperCase() || "---"}
              </span>

              {/* Status */}
              {match.status === "live" && match.minute != null && (
                <span className="text-[10px] text-red-400 font-semibold">{match.minute}&apos;</span>
              )}
              {match.status === "half_time" && (
                <span className="text-[10px] text-yellow-400 font-semibold">HT</span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
