import { Link } from "@/i18n/navigation";
import { Calendar, Shield, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { getUpcomingMatches } from "@/lib/queries/matches";

interface UpcomingMatchesProps {
  limit?: number;
  showViewAll?: boolean;
}

export async function UpcomingMatches({
  limit = 6,
  showViewAll = true,
}: UpcomingMatchesProps) {
  const matches = await getUpcomingMatches(limit);

  if (matches.length === 0) return null;

  // Group matches by date
  const matchesByDate = matches.reduce(
    (acc, match) => {
      const dateKey = format(new Date(match.scheduledAt), "yyyy-MM-dd");
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(match);
      return acc;
    },
    {} as Record<string, typeof matches>
  );

  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-ink">
              Upcoming Matches
            </h2>
          </div>
          {showViewAll && (
            <Link
              href="/matches"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        <div className="space-y-6">
          {Object.entries(matchesByDate).map(([dateKey, dateMatches]) => (
            <div key={dateKey}>
              <div className="text-sm font-medium text-muted mb-3">
                {format(new Date(dateKey), "EEEE, MMMM d")}
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dateMatches.map((match) => (
                  <Link
                    key={match.id}
                    href={`/matches/${match.slug ?? match.id}`}
                    className="bg-surface rounded-xl border border-line p-4 hover:shadow-lg hover:border-blue-200 transition-all group"
                  >
                    {/* Competition badge */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-muted bg-surface-2 px-2 py-1 rounded">
                        {match.competition?.name}
                      </span>
                      <span className="text-xs text-faint">
                        {format(new Date(match.scheduledAt), "HH:mm")}
                      </span>
                    </div>

                    {/* Teams */}
                    <div className="space-y-3">
                      {/* Home Team */}
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-surface-2 rounded-lg flex items-center justify-center flex-shrink-0">
                          {match.homeTeam?.logoUrl ? (
                            <img
                              src={match.homeTeam.logoUrl}
                              alt={match.homeTeam.name}
                              className="w-6 h-6 object-contain"
                            />
                          ) : (
                            <Shield className="w-4 h-4 text-faint" />
                          )}
                        </div>
                        <span className="font-medium text-ink group-hover:text-blue-600 transition-colors truncate">
                          {match.homeTeam?.shortName || match.homeTeam?.name}
                        </span>
                      </div>

                      {/* Away Team */}
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-surface-2 rounded-lg flex items-center justify-center flex-shrink-0">
                          {match.awayTeam?.logoUrl ? (
                            <img
                              src={match.awayTeam.logoUrl}
                              alt={match.awayTeam.name}
                              className="w-6 h-6 object-contain"
                            />
                          ) : (
                            <Shield className="w-4 h-4 text-faint" />
                          )}
                        </div>
                        <span className="font-medium text-ink group-hover:text-blue-600 transition-colors truncate">
                          {match.awayTeam?.shortName || match.awayTeam?.name}
                        </span>
                      </div>
                    </div>

                    {/* Matchday */}
                    {match.matchday && (
                      <div className="mt-3 pt-3 border-t border-line text-xs text-muted">
                        Matchday {match.matchday}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
