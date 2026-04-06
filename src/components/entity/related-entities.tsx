import Link from "next/link";
import { Shield, Calendar } from "lucide-react";
import { format } from "date-fns";
import {
  getRelatedPlayers,
  getRelatedTeams,
  getRelatedMatches,
} from "@/lib/queries/related";
import { PlayerLink } from "@/components/player/player-link";

interface RelatedPlayersProps {
  playerId: string;
  limit?: number;
}

export async function RelatedPlayers({ playerId, limit = 6 }: RelatedPlayersProps) {
  const relatedPlayers = await getRelatedPlayers(playerId, limit);

  if (relatedPlayers.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <h3 className="text-sm font-medium text-neutral-500 mb-4">
        Similar Players
      </h3>
      <div className="space-y-3">
        {relatedPlayers.map((player) => (
          <PlayerLink
            key={player.id}
            slug={player.slug}
            isLinkWorthy={player.isIndexable ?? false}
            className="flex items-center gap-3 group"
          >
            {player.imageUrl ? (
              <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-blue-50 transition-colors">
                <img
                  src={player.imageUrl}
                  alt={player.name}
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">{player.name.substring(0, 2).toUpperCase()}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-neutral-900 truncate group-hover:text-blue-600 transition-colors">
                {player.name}
              </div>
              <div className="text-xs text-neutral-500 truncate">
                {player.position}
                {player.nationality && ` · ${player.nationality}`}
              </div>
            </div>
          </PlayerLink>
        ))}
      </div>
    </div>
  );
}

interface RelatedTeamsProps {
  teamId: string;
  limit?: number;
}

export async function RelatedTeams({ teamId, limit = 6 }: RelatedTeamsProps) {
  const relatedTeams = await getRelatedTeams(teamId, limit);

  if (relatedTeams.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <h3 className="text-sm font-medium text-neutral-500 mb-4">
        Teams in Same League
      </h3>
      <div className="space-y-3">
        {relatedTeams.map((team) => (
          <Link
            key={team.id}
            href={`/teams/${team.slug}`}
            className="flex items-center gap-3 group"
          >
            {team.logoUrl ? (
              <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-blue-50 transition-colors p-1">
                <img
                  src={team.logoUrl}
                  alt={team.name}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">{team.name.substring(0, 2).toUpperCase()}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-neutral-900 truncate group-hover:text-blue-600 transition-colors">
                {team.name}
              </div>
              {team.country && (
                <div className="text-xs text-neutral-500">{team.country}</div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

interface RelatedMatchesProps {
  matchId: string;
  limit?: number;
}

export async function RelatedMatches({ matchId, limit = 4 }: RelatedMatchesProps) {
  const relatedMatches = await getRelatedMatches(matchId, limit);

  if (relatedMatches.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <h3 className="text-sm font-medium text-neutral-500 mb-4">
        Other Matches
      </h3>
      <div className="space-y-3">
        {relatedMatches.map((match) => (
          <Link
            key={match.id}
            href={`/matches/${match.slug ?? match.id}`}
            className="block p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {match.homeTeam.logoUrl ? (
                  <img
                    src={match.homeTeam.logoUrl}
                    alt={match.homeTeam.name}
                    className="w-5 h-5 object-contain"
                  />
                ) : (
                  <Shield className="w-5 h-5 text-neutral-300" />
                )}
                <span className="truncate">{match.homeTeam.name}</span>
              </div>
              <div className="px-3 font-medium">
                {match.status === "finished" ||
                match.status === "live" ||
                match.status === "half_time"
                  ? `${match.homeScore ?? 0} - ${match.awayScore ?? 0}`
                  : "vs"}
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                <span className="truncate">{match.awayTeam.name}</span>
                {match.awayTeam.logoUrl ? (
                  <img
                    src={match.awayTeam.logoUrl}
                    alt={match.awayTeam.name}
                    className="w-5 h-5 object-contain"
                  />
                ) : (
                  <Shield className="w-5 h-5 text-neutral-300" />
                )}
              </div>
            </div>
            <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-neutral-500">
              <Calendar className="w-3 h-3" />
              {format(new Date(match.scheduledAt), "MMM d, HH:mm")}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
