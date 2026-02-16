"use client";

import Link from "next/link";
import { Circle, Shield, RefreshCw } from "lucide-react";
import { useLiveMatches } from "@/hooks/use-live-matches";

export function LiveMatchesSection() {
  const { matches, isLoading, error, lastUpdated, refetch, hasLiveMatches } =
    useLiveMatches({ pollingInterval: 30000 });

  if (!hasLiveMatches && !isLoading) {
    return null; // Don't show section if no live matches
  }

  return (
    <section className="bg-gradient-to-r from-red-600 to-red-700 py-6">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full">
              <Circle className="w-2 h-2 fill-white animate-pulse" />
              <span className="text-white text-sm font-semibold">LIVE NOW</span>
            </div>
            <span className="text-white/70 text-sm">
              {matches.length} match{matches.length !== 1 ? "es" : ""} in progress
            </span>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-2 text-white/70 hover:text-white text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            {lastUpdated && (
              <span className="hidden sm:inline">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </button>
        </div>

        {/* Error state */}
        {error && (
          <div className="text-white/70 text-sm mb-4">
            Failed to load live matches. Will retry automatically.
          </div>
        )}

        {/* Loading state */}
        {isLoading && matches.length === 0 && (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex-shrink-0 w-72 bg-white/10 rounded-xl p-4 animate-pulse"
              >
                <div className="h-4 bg-white/20 rounded w-24 mb-4" />
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/20 rounded-lg" />
                    <div className="h-4 bg-white/20 rounded w-32" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/20 rounded-lg" />
                    <div className="h-4 bg-white/20 rounded w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Live matches */}
        {matches.length > 0 && (
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {matches.map((match) => (
              <Link
                key={match.id}
                href={`/matches/${match.id}`}
                className="flex-shrink-0 w-72 bg-white rounded-xl p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
              >
                {/* Competition & Status */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-neutral-500">
                    {match.competition?.name || "Competition"}
                  </span>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-100 text-red-600 rounded-full">
                    <Circle className="w-2 h-2 fill-current animate-pulse" />
                    <span className="text-xs font-semibold">
                      {match.status === "half_time" ? "HT" : "LIVE"}
                    </span>
                  </div>
                </div>

                {/* Teams */}
                <div className="space-y-2">
                  {/* Home Team */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        {match.homeTeam?.logoUrl ? (
                          <img
                            src={match.homeTeam.logoUrl}
                            alt={match.homeTeam.name}
                            className="w-6 h-6 object-contain"
                          />
                        ) : (
                          <Shield className="w-4 h-4 text-neutral-400" />
                        )}
                      </div>
                      <span className="font-semibold text-neutral-900 truncate">
                        {match.homeTeam?.shortName || match.homeTeam?.name || "Home"}
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-neutral-900 ml-2">
                      {match.homeScore ?? 0}
                    </span>
                  </div>

                  {/* Away Team */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        {match.awayTeam?.logoUrl ? (
                          <img
                            src={match.awayTeam.logoUrl}
                            alt={match.awayTeam.name}
                            className="w-6 h-6 object-contain"
                          />
                        ) : (
                          <Shield className="w-4 h-4 text-neutral-400" />
                        )}
                      </div>
                      <span className="font-semibold text-neutral-900 truncate">
                        {match.awayTeam?.shortName || match.awayTeam?.name || "Away"}
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-neutral-900 ml-2">
                      {match.awayScore ?? 0}
                    </span>
                  </div>
                </div>

                {/* Live minute */}
                {match.status === "live" && match.minute && (
                  <div className="mt-3 text-center text-sm font-medium text-red-600">
                    {match.minute}&apos;
                  </div>
                )}
                {match.status === "half_time" && (
                  <div className="mt-3 text-center text-sm font-medium text-orange-600">
                    Half Time
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
