import Link from "next/link";
import { Shield, Calendar, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { getCompetitionFixtures } from "@/lib/queries/matches";

interface CompetitionFixturesProps {
  competitionSeasonId: string;
  matchday?: number;
  limit?: number;
}

function getStatusBadge(status: string, homeScore: number | null, awayScore: number | null) {
  switch (status) {
    case "finished":
      return (
        <span className="text-sm font-bold text-neutral-900">
          {homeScore ?? 0} - {awayScore ?? 0}
        </span>
      );
    case "live":
    case "half_time":
      return (
        <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-medium rounded animate-pulse">
          LIVE
        </span>
      );
    case "scheduled":
      return (
        <span className="text-xs text-neutral-500">
          vs
        </span>
      );
    case "postponed":
      return (
        <span className="px-2 py-0.5 bg-neutral-200 text-neutral-600 text-xs font-medium rounded">
          PPD
        </span>
      );
    case "cancelled":
      return (
        <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-medium rounded">
          CAN
        </span>
      );
    default:
      return (
        <span className="text-xs text-neutral-400">
          -
        </span>
      );
  }
}

// Loading skeleton for fixtures
export function CompetitionFixturesSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden animate-pulse">
      <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200">
        <div className="h-5 bg-neutral-200 rounded w-24" />
      </div>
      <div className="divide-y divide-neutral-100">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center p-4 gap-4">
            <div className="w-20 flex-shrink-0">
              <div className="h-3 bg-neutral-200 rounded w-12 mx-auto mb-1" />
              <div className="h-4 bg-neutral-200 rounded w-10 mx-auto" />
            </div>
            <div className="flex-1 flex items-center justify-end gap-3">
              <div className="h-4 bg-neutral-200 rounded w-24" />
              <div className="w-8 h-8 bg-neutral-200 rounded" />
            </div>
            <div className="w-16 flex-shrink-0 flex justify-center">
              <div className="h-4 bg-neutral-200 rounded w-8" />
            </div>
            <div className="flex-1 flex items-center gap-3">
              <div className="w-8 h-8 bg-neutral-200 rounded" />
              <div className="h-4 bg-neutral-200 rounded w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export async function CompetitionFixtures({
  competitionSeasonId,
  matchday,
  limit = 20,
}: CompetitionFixturesProps) {
  let fixtures;
  let error: string | null = null;

  try {
    fixtures = await getCompetitionFixtures(competitionSeasonId, {
      matchday,
      limit,
    });
  } catch (e) {
    console.error("Failed to fetch fixtures:", e);
    error = "Failed to load fixtures";
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-600 font-medium mb-2">Unable to load fixtures</p>
        <p className="text-neutral-500 text-sm">Please try refreshing the page</p>
      </div>
    );
  }

  // Empty state - only when confirmed empty
  if (!fixtures || fixtures.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
        <Calendar className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
        <p className="text-neutral-500">No fixtures available for this season</p>
        <p className="text-neutral-400 text-sm mt-1">Check back later for scheduled matches</p>
      </div>
    );
  }

  // Group fixtures by matchday
  const fixturesByMatchday = fixtures.reduce(
    (acc, fixture) => {
      const md = fixture.matchday || 0;
      if (!acc[md]) {
        acc[md] = [];
      }
      acc[md].push(fixture);
      return acc;
    },
    {} as Record<number, typeof fixtures>
  );

  return (
    <div className="space-y-6">
      {Object.entries(fixturesByMatchday)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([md, mdFixtures]) => (
          <div key={md} className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            {/* Matchday Header */}
            <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200">
              <h3 className="font-semibold text-neutral-900">
                {Number(md) > 0 ? `Matchday ${md}` : "Fixtures"}
              </h3>
            </div>

            {/* Fixtures List */}
            <div className="divide-y divide-neutral-100">
              {mdFixtures.map((fixture) => (
                <Link
                  key={fixture.id}
                  href={`/matches/${fixture.id}`}
                  className="flex items-center p-4 hover:bg-neutral-50 transition-colors group"
                >
                  {/* Date/Time */}
                  <div className="w-20 flex-shrink-0 text-center">
                    <div className="text-xs text-neutral-500">
                      {format(new Date(fixture.scheduledAt), "MMM d")}
                    </div>
                    <div className="text-sm font-medium text-neutral-700">
                      {format(new Date(fixture.scheduledAt), "HH:mm")}
                    </div>
                  </div>

                  {/* Home Team */}
                  <div className="flex-1 flex items-center justify-end gap-3">
                    <span className="font-medium text-neutral-900 group-hover:text-blue-600 transition-colors text-right truncate">
                      {fixture.homeTeam?.shortName || fixture.homeTeam?.name}
                    </span>
                    <div className="w-8 h-8 bg-neutral-100 rounded flex items-center justify-center flex-shrink-0">
                      {fixture.homeTeam?.logoUrl ? (
                        <img
                          src={fixture.homeTeam.logoUrl}
                          alt={fixture.homeTeam.name}
                          className="w-6 h-6 object-contain"
                        />
                      ) : (
                        <Shield className="w-4 h-4 text-neutral-400" />
                      )}
                    </div>
                  </div>

                  {/* Score/Status */}
                  <div className="w-16 flex-shrink-0 flex items-center justify-center">
                    {getStatusBadge(fixture.status, fixture.homeScore, fixture.awayScore)}
                  </div>

                  {/* Away Team */}
                  <div className="flex-1 flex items-center gap-3">
                    <div className="w-8 h-8 bg-neutral-100 rounded flex items-center justify-center flex-shrink-0">
                      {fixture.awayTeam?.logoUrl ? (
                        <img
                          src={fixture.awayTeam.logoUrl}
                          alt={fixture.awayTeam.name}
                          className="w-6 h-6 object-contain"
                        />
                      ) : (
                        <Shield className="w-4 h-4 text-neutral-400" />
                      )}
                    </div>
                    <span className="font-medium text-neutral-900 group-hover:text-blue-600 transition-colors truncate">
                      {fixture.awayTeam?.shortName || fixture.awayTeam?.name}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
