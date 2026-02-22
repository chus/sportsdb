import Link from "next/link";
import { Calendar, ChevronRight, Shield } from "lucide-react";
import { getTeamMatches } from "@/lib/queries/matches";
import { format } from "date-fns";

interface TeamFixturesProps {
  teamId: string;
  limit?: number;
}

export async function TeamFixtures({ teamId, limit = 5 }: TeamFixturesProps) {
  const { recent, upcoming } = await getTeamMatches(teamId, limit);

  if (recent.length === 0 && upcoming.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Upcoming Fixtures */}
      {upcoming.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-neutral-500 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Upcoming Fixtures
            </h3>
          </div>
          <div className="space-y-3">
            {upcoming.map((match) => (
              <Link
                key={match.id}
                href={`/matches/${match.id}`}
                className="block p-3 bg-neutral-50 rounded-lg hover:bg-blue-50 transition-colors group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-neutral-500">
                    {match.competition?.name}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {format(new Date(match.scheduledAt), "EEE, MMM d")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {match.homeTeam?.logoUrl ? (
                      <img
                        src={match.homeTeam.logoUrl}
                        alt=""
                        className="w-5 h-5 object-contain"
                      />
                    ) : (
                      <Shield className="w-5 h-5 text-neutral-300" />
                    )}
                    <span
                      className={`text-sm truncate ${
                        match.homeTeamId === teamId ? "font-semibold" : ""
                      }`}
                    >
                      {match.homeTeam?.shortName || match.homeTeam?.name}
                    </span>
                  </div>
                  <span className="text-xs text-neutral-400 px-2">vs</span>
                  <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                    <span
                      className={`text-sm truncate ${
                        match.awayTeamId === teamId ? "font-semibold" : ""
                      }`}
                    >
                      {match.awayTeam?.shortName || match.awayTeam?.name}
                    </span>
                    {match.awayTeam?.logoUrl ? (
                      <img
                        src={match.awayTeam.logoUrl}
                        alt=""
                        className="w-5 h-5 object-contain"
                      />
                    ) : (
                      <Shield className="w-5 h-5 text-neutral-300" />
                    )}
                  </div>
                </div>
                <div className="text-xs text-center text-neutral-500 mt-2">
                  {format(new Date(match.scheduledAt), "h:mm a")}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Results */}
      {recent.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-neutral-500 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Recent Results
            </h3>
          </div>
          <div className="space-y-3">
            {recent.map((match) => {
              const isHome = match.homeTeamId === teamId;
              const teamScore = isHome ? match.homeScore : match.awayScore;
              const oppScore = isHome ? match.awayScore : match.homeScore;
              const result =
                teamScore !== null && oppScore !== null
                  ? teamScore > oppScore
                    ? "W"
                    : teamScore < oppScore
                    ? "L"
                    : "D"
                  : null;

              return (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="block p-3 bg-neutral-50 rounded-lg hover:bg-blue-50 transition-colors group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-neutral-500">
                      {match.competition?.name}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {format(new Date(match.scheduledAt), "MMM d")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {match.homeTeam?.logoUrl ? (
                        <img
                          src={match.homeTeam.logoUrl}
                          alt=""
                          className="w-5 h-5 object-contain"
                        />
                      ) : (
                        <Shield className="w-5 h-5 text-neutral-300" />
                      )}
                      <span
                        className={`text-sm truncate ${
                          match.homeTeamId === teamId ? "font-semibold" : ""
                        }`}
                      >
                        {match.homeTeam?.shortName || match.homeTeam?.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 px-3">
                      <span className="text-sm font-bold">{match.homeScore ?? "-"}</span>
                      <span className="text-neutral-400">-</span>
                      <span className="text-sm font-bold">{match.awayScore ?? "-"}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                      <span
                        className={`text-sm truncate ${
                          match.awayTeamId === teamId ? "font-semibold" : ""
                        }`}
                      >
                        {match.awayTeam?.shortName || match.awayTeam?.name}
                      </span>
                      {match.awayTeam?.logoUrl ? (
                        <img
                          src={match.awayTeam.logoUrl}
                          alt=""
                          className="w-5 h-5 object-contain"
                        />
                      ) : (
                        <Shield className="w-5 h-5 text-neutral-300" />
                      )}
                    </div>
                    {result && (
                      <span
                        className={`w-6 h-6 rounded flex items-center justify-center text-xs font-medium text-white ml-2 ${
                          result === "W"
                            ? "bg-green-500"
                            : result === "D"
                            ? "bg-neutral-400"
                            : "bg-red-500"
                        }`}
                      >
                        {result}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
