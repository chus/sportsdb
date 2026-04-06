"use client";

import { useLiveMatches } from "@/hooks/use-live-matches";
import Link from "next/link";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { formatDistanceToNowStrict } from "date-fns";

interface LiveMatchesSectionProps {
  competitionFilter: string | null;
}

export function LiveMatchesSection({ competitionFilter }: LiveMatchesSectionProps) {
  const { matches, isLoading, lastUpdated, hasLiveMatches } = useLiveMatches({
    pollingInterval: 30000,
    enabled: true,
  });

  const filtered = competitionFilter
    ? matches.filter((m) => m.competition?.slug === competitionFilter)
    : matches;

  if (!hasLiveMatches || filtered.length === 0) return null;

  return (
    <section className="bg-red-50 border border-red-200 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
        </span>
        <h2 className="text-lg font-bold text-red-600 uppercase tracking-wide">Live Now</h2>
        <span className="text-xs text-neutral-400 ml-auto">
          {lastUpdated ? `Updated ${formatDistanceToNowStrict(lastUpdated)} ago` : ""}
        </span>
      </div>

      {/* Horizontal scrollable cards */}
      <div className="flex overflow-x-auto gap-3 pb-2 snap-x snap-mandatory scrollbar-hide">
        {filtered.map((match) => (
          <Link
            key={match.id}
            href={`/matches/${match.slug ?? match.id}`}
            className="min-w-[280px] snap-start flex-shrink-0 bg-white border border-red-200 rounded-xl p-4 hover:shadow-lg hover:border-red-300 transition-all"
          >
            {/* Competition badge */}
            <div className="text-xs text-neutral-500 mb-2 truncate">
              {match.competition?.name}
            </div>

            {/* Teams and score */}
            <div className="flex items-center gap-3">
              {/* Home */}
              <div className="flex-1 text-right">
                <div className="flex items-center justify-end gap-2">
                  <span className="text-sm font-medium truncate">
                    {match.homeTeam?.shortName || match.homeTeam?.name}
                  </span>
                  {match.homeTeam?.logoUrl && (
                    <ImageWithFallback
                      src={match.homeTeam.logoUrl}
                      alt={match.homeTeam.name}
                      width={28}
                      height={28}
                      className="w-7 h-7 object-contain"
                    />
                  )}
                </div>
              </div>

              {/* Score */}
              <div className="flex flex-col items-center min-w-[50px]">
                <span className="text-xl font-bold text-neutral-900">
                  {match.homeScore ?? 0} - {match.awayScore ?? 0}
                </span>
                <span className="text-xs font-semibold text-red-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  {match.status === "half_time" ? "HT" : `${match.minute ?? ""}\u2032`}
                </span>
              </div>

              {/* Away */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {match.awayTeam?.logoUrl && (
                    <ImageWithFallback
                      src={match.awayTeam.logoUrl}
                      alt={match.awayTeam.name}
                      width={28}
                      height={28}
                      className="w-7 h-7 object-contain"
                    />
                  )}
                  <span className="text-sm font-medium truncate">
                    {match.awayTeam?.shortName || match.awayTeam?.name}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
