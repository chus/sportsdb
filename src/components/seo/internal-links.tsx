import Link from "next/link";
import { Users, Shield, Trophy, MapPin, GitCompare, TrendingUp } from "lucide-react";
import { db } from "@/lib/db";
import { players, teams, competitions } from "@/lib/db/schema";
import { eq, and, ne, sql, desc } from "drizzle-orm";

interface InternalLinksProps {
  entityType: "player" | "team" | "competition" | "match";
  entityId: string;
  nationality?: string | null;
  country?: string | null;
  position?: string | null;
  competitionId?: string | null;
}

/**
 * Get players from the same country (for player pages)
 */
async function getPlayersByNationality(nationality: string, excludeId: string, limit = 6) {
  return db
    .select({
      id: players.id,
      name: players.name,
      slug: players.slug,
      position: players.position,
      imageUrl: players.imageUrl,
    })
    .from(players)
    .where(and(eq(players.nationality, nationality), ne(players.id, excludeId)))
    .orderBy(desc(players.popularityScore))
    .limit(limit);
}

/**
 * Get players by position (for player pages)
 */
async function getPlayersByPosition(position: string, excludeId: string, limit = 6) {
  return db
    .select({
      id: players.id,
      name: players.name,
      slug: players.slug,
      position: players.position,
      imageUrl: players.imageUrl,
    })
    .from(players)
    .where(and(eq(players.position, position), ne(players.id, excludeId)))
    .orderBy(desc(players.popularityScore))
    .limit(limit);
}

/**
 * Get top players overall (for various pages)
 */
async function getTopPlayers(limit = 8) {
  return db
    .select({
      id: players.id,
      name: players.name,
      slug: players.slug,
      position: players.position,
      imageUrl: players.imageUrl,
    })
    .from(players)
    .orderBy(desc(players.popularityScore))
    .limit(limit);
}

/**
 * Get teams from the same country
 */
async function getTeamsByCountry(country: string, excludeId: string, limit = 6) {
  return db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      logoUrl: teams.logoUrl,
    })
    .from(teams)
    .where(and(eq(teams.country, country), ne(teams.id, excludeId)))
    .orderBy(teams.name)
    .limit(limit);
}

export async function PlayerInternalLinks({
  playerId,
  playerSlug,
  nationality,
  position,
}: {
  playerId: string;
  playerSlug: string;
  nationality?: string | null;
  position?: string | null;
}) {
  const [countryPlayers, positionPlayers] = await Promise.all([
    nationality ? getPlayersByNationality(nationality, playerId) : Promise.resolve([]),
    position ? getPlayersByPosition(position, playerId) : Promise.resolve([]),
  ]);

  if (countryPlayers.length === 0 && positionPlayers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Compare CTA */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
        <Link
          href={`/compare/players?p1=${playerSlug}`}
          className="flex items-center gap-3 text-blue-700 hover:text-blue-800"
        >
          <GitCompare className="w-5 h-5" />
          <span className="font-medium">Compare with other players</span>
        </Link>
      </div>

      {/* Players from same country */}
      {countryPlayers.length > 0 && nationality && (
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <h3 className="text-sm font-medium text-neutral-500 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            More players from {nationality}
          </h3>
          <div className="space-y-2">
            {countryPlayers.slice(0, 5).map((player) => (
              <Link
                key={player.id}
                href={`/players/${player.slug}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                <div className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center">
                  {player.imageUrl ? (
                    <img
                      src={player.imageUrl}
                      alt={player.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <Users className="w-4 h-4 text-neutral-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">
                    {player.name}
                  </p>
                  <p className="text-xs text-neutral-500">{player.position}</p>
                </div>
              </Link>
            ))}
          </div>
          <Link
            href={`/search?type=player&q=${encodeURIComponent(nationality)}`}
            className="block mt-3 text-sm text-blue-600 hover:text-blue-700"
          >
            View all {nationality} players →
          </Link>
        </div>
      )}

      {/* Players in same position */}
      {positionPlayers.length > 0 && position && (
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <h3 className="text-sm font-medium text-neutral-500 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Top {position}s
          </h3>
          <div className="space-y-2">
            {positionPlayers.slice(0, 5).map((player) => (
              <Link
                key={player.id}
                href={`/players/${player.slug}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                <div className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center">
                  {player.imageUrl ? (
                    <img
                      src={player.imageUrl}
                      alt={player.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <Users className="w-4 h-4 text-neutral-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">
                    {player.name}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export async function TeamInternalLinks({
  teamId,
  country,
}: {
  teamId: string;
  country?: string | null;
}) {
  const [countryTeams, topPlayers] = await Promise.all([
    country ? getTeamsByCountry(country, teamId) : Promise.resolve([]),
    getTopPlayers(6),
  ]);

  return (
    <div className="space-y-6">
      {/* Teams from same country */}
      {countryTeams.length > 0 && country && (
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <h3 className="text-sm font-medium text-neutral-500 mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            More teams from {country}
          </h3>
          <div className="space-y-2">
            {countryTeams.map((team) => (
              <Link
                key={team.id}
                href={`/teams/${team.slug}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center">
                  {team.logoUrl ? (
                    <img
                      src={team.logoUrl}
                      alt={team.name}
                      className="w-6 h-6 object-contain"
                    />
                  ) : (
                    <Shield className="w-4 h-4 text-neutral-400" />
                  )}
                </div>
                <span className="text-sm font-medium text-neutral-900">
                  {team.name}
                </span>
              </Link>
            ))}
          </div>
          <Link
            href={`/search?type=team&q=${encodeURIComponent(country)}`}
            className="block mt-3 text-sm text-blue-600 hover:text-blue-700"
          >
            View all {country} teams →
          </Link>
        </div>
      )}

      {/* Popular players */}
      <div className="bg-white rounded-xl border border-neutral-200 p-4">
        <h3 className="text-sm font-medium text-neutral-500 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Popular Players
        </h3>
        <div className="space-y-2">
          {topPlayers.map((player) => (
            <Link
              key={player.id}
              href={`/players/${player.slug}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              <div className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center">
                {player.imageUrl ? (
                  <img
                    src={player.imageUrl}
                    alt={player.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <Users className="w-4 h-4 text-neutral-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">
                  {player.name}
                </p>
                <p className="text-xs text-neutral-500">{player.position}</p>
              </div>
            </Link>
          ))}
        </div>
        <Link
          href="/search?type=player"
          className="block mt-3 text-sm text-blue-600 hover:text-blue-700"
        >
          Browse all players →
        </Link>
      </div>

      {/* Compare players CTA */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
        <Link
          href="/compare/players"
          className="flex items-center gap-3 text-blue-700 hover:text-blue-800"
        >
          <GitCompare className="w-5 h-5" />
          <span className="font-medium">Compare players head-to-head</span>
        </Link>
      </div>
    </div>
  );
}

export async function MatchInternalLinks({
  competitionSlug,
  competitionName,
}: {
  competitionSlug?: string | null;
  competitionName?: string | null;
}) {
  const topPlayers = await getTopPlayers(6);

  return (
    <div className="space-y-6">
      {/* Competition link */}
      {competitionSlug && competitionName && (
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <h3 className="text-sm font-medium text-neutral-500 mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Competition
          </h3>
          <Link
            href={`/competitions/${competitionSlug}`}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Trophy className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-neutral-900">{competitionName}</p>
              <p className="text-xs text-neutral-500">View standings & fixtures</p>
            </div>
          </Link>
        </div>
      )}

      {/* Popular players */}
      <div className="bg-white rounded-xl border border-neutral-200 p-4">
        <h3 className="text-sm font-medium text-neutral-500 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Popular Players
        </h3>
        <div className="space-y-2">
          {topPlayers.map((player) => (
            <Link
              key={player.id}
              href={`/players/${player.slug}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              <div className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center">
                {player.imageUrl ? (
                  <img
                    src={player.imageUrl}
                    alt={player.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <Users className="w-4 h-4 text-neutral-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">
                  {player.name}
                </p>
                <p className="text-xs text-neutral-500">{player.position}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
