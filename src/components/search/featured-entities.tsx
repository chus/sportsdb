import Link from "next/link";
import { Users, Shield, Trophy, ArrowRight, GitCompare } from "lucide-react";
import { getFeaturedEntities } from "@/lib/queries/search";

const ENTITY_ROUTES: Record<string, string> = {
  player: "/players",
  team: "/teams",
  competition: "/competitions",
};

export async function FeaturedEntities() {
  const { players, teams, competitions } = await getFeaturedEntities(8);

  return (
    <div className="space-y-8">
      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
        <h3 className="font-semibold text-neutral-900 mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/compare/players"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg text-sm font-medium text-blue-700 hover:bg-blue-50 border border-blue-200 transition-colors"
          >
            <GitCompare className="w-4 h-4" />
            Compare Players
          </Link>
          <Link
            href="/search?type=competition"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg text-sm font-medium text-purple-700 hover:bg-purple-50 border border-purple-200 transition-colors"
          >
            <Trophy className="w-4 h-4" />
            Browse Leagues
          </Link>
        </div>
      </div>

      {/* Featured Competitions */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-purple-600" />
            Popular Competitions
          </h3>
          <Link
            href="/search?type=competition"
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {competitions.map((comp) => (
            <Link
              key={comp.id}
              href={`${ENTITY_ROUTES[comp.entityType]}/${comp.slug}`}
              className="p-4 bg-white border border-neutral-200 rounded-xl hover:shadow-md hover:border-purple-200 transition-all text-center group"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2 group-hover:bg-purple-200 transition-colors">
                <Trophy className="w-5 h-5 text-purple-600" />
              </div>
              <p className="font-medium text-sm text-neutral-900 truncate">
                {comp.name}
              </p>
              {comp.subtitle && (
                <p className="text-xs text-neutral-500 truncate">{comp.subtitle}</p>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Teams */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-600" />
            Featured Teams
          </h3>
          <Link
            href="/search?type=team"
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`${ENTITY_ROUTES[team.entityType]}/${team.slug}`}
              className="p-4 bg-white border border-neutral-200 rounded-xl hover:shadow-md hover:border-green-200 transition-all text-center group"
            >
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2 group-hover:bg-green-200 transition-colors">
                <Shield className="w-5 h-5 text-green-600" />
              </div>
              <p className="font-medium text-sm text-neutral-900 truncate">
                {team.name}
              </p>
              {team.subtitle && (
                <p className="text-xs text-neutral-500 truncate">{team.subtitle}</p>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Players */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Featured Players
          </h3>
          <Link
            href="/search?type=player"
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {players.map((player) => (
            <Link
              key={player.id}
              href={`${ENTITY_ROUTES[player.entityType]}/${player.slug}`}
              className="p-4 bg-white border border-neutral-200 rounded-xl hover:shadow-md hover:border-blue-200 transition-all text-center group"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2 group-hover:bg-blue-200 transition-colors">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <p className="font-medium text-sm text-neutral-900 truncate">
                {player.name}
              </p>
              {player.subtitle && (
                <p className="text-xs text-neutral-500 truncate">{player.subtitle}</p>
              )}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
