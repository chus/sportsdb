import { redirect } from "next/navigation";
import Link from "next/link";
import { Heart, Trophy, Shield, Users, ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getFollowedPlayers, getFollowedTeams, getFollowedCompetitions } from "@/lib/queries/follows";

export default async function FeedPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const [followedPlayers, followedTeams, followedCompetitions] = await Promise.all([
    getFollowedPlayers(user.id),
    getFollowedTeams(user.id),
    getFollowedCompetitions(user.id),
  ]);

  const totalFollows = followedPlayers.length + followedTeams.length + followedCompetitions.length;

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Heart className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">My Feed</h1>
              <p className="text-white/80">
                {totalFollows > 0
                  ? `Following ${totalFollows} ${totalFollows === 1 ? "item" : "items"}`
                  : "Start following players, teams, and competitions"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {totalFollows === 0 ? (
          <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
            <Heart className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-neutral-900 mb-2">
              Nothing followed yet
            </h2>
            <p className="text-neutral-600 mb-6 max-w-md mx-auto">
              Follow your favorite players, teams, and competitions to see updates here.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/search?type=player"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Users className="w-4 h-4" />
                Find Players
              </Link>
              <Link
                href="/search?type=team"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                <Shield className="w-4 h-4" />
                Find Teams
              </Link>
              <Link
                href="/search?type=competition"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                <Trophy className="w-4 h-4" />
                Find Competitions
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Followed Teams */}
            {followedTeams.length > 0 && (
              <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-neutral-900 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    Teams ({followedTeams.length})
                  </h2>
                  <Link
                    href="/search?type=team"
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Find more
                  </Link>
                </div>
                <div className="space-y-3">
                  {followedTeams.map(({ team }) => (
                    <Link
                      key={team.id}
                      href={`/teams/${team.slug}`}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors group"
                    >
                      <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center">
                        {team.logoUrl ? (
                          <img
                            src={team.logoUrl}
                            alt={team.name}
                            className="w-8 h-8 object-contain"
                          />
                        ) : (
                          <Shield className="w-5 h-5 text-neutral-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-neutral-900 truncate group-hover:text-blue-600 transition-colors">
                          {team.name}
                        </div>
                        <div className="text-sm text-neutral-500">{team.country}</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-blue-600 transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Followed Players */}
            {followedPlayers.length > 0 && (
              <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-neutral-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-green-600" />
                    Players ({followedPlayers.length})
                  </h2>
                  <Link
                    href="/search?type=player"
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Find more
                  </Link>
                </div>
                <div className="space-y-3">
                  {followedPlayers.map(({ player }) => (
                    <Link
                      key={player.id}
                      href={`/players/${player.slug}`}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors group"
                    >
                      <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-neutral-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-neutral-900 truncate group-hover:text-blue-600 transition-colors">
                          {player.name}
                        </div>
                        <div className="text-sm text-neutral-500">
                          {player.position} {player.nationality && `• ${player.nationality}`}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-blue-600 transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Followed Competitions */}
            {followedCompetitions.length > 0 && (
              <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-neutral-900 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-600" />
                    Competitions ({followedCompetitions.length})
                  </h2>
                  <Link
                    href="/search?type=competition"
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Find more
                  </Link>
                </div>
                <div className="space-y-3">
                  {followedCompetitions.map(({ competition }) => (
                    <Link
                      key={competition.id}
                      href={`/competitions/${competition.slug}`}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors group"
                    >
                      <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center">
                        {competition.logoUrl ? (
                          <img
                            src={competition.logoUrl}
                            alt={competition.name}
                            className="w-8 h-8 object-contain"
                          />
                        ) : (
                          <Trophy className="w-5 h-5 text-neutral-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-neutral-900 truncate group-hover:text-blue-600 transition-colors">
                          {competition.name}
                        </div>
                        <div className="text-sm text-neutral-500">{competition.country}</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-blue-600 transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
