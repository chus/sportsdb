import { redirect } from "next/navigation";
import Link from "next/link";
import { Heart, Trophy, Shield, Users, ArrowRight, Activity } from "lucide-react";
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
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <Activity className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Activity Feed</h1>
              <p className="text-white/80">
                {totalFollows > 0
                  ? `Following ${totalFollows} ${totalFollows === 1 ? "item" : "items"}`
                  : "Start following players, teams, and competitions"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4 mb-8 -mt-12">
          <div className="bg-white rounded-2xl p-5 border border-neutral-200 text-center shadow-lg">
            <div className="text-3xl font-bold text-blue-600">{followedTeams.length}</div>
            <div className="text-sm text-neutral-600 mt-1">Teams</div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-neutral-200 text-center shadow-lg">
            <div className="text-3xl font-bold text-green-600">{followedPlayers.length}</div>
            <div className="text-sm text-neutral-600 mt-1">Players</div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-neutral-200 text-center shadow-lg">
            <div className="text-3xl font-bold text-orange-600">{followedCompetitions.length}</div>
            <div className="text-sm text-neutral-600 mt-1">Competitions</div>
          </div>
        </div>

        {totalFollows === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-neutral-200 text-center shadow-sm">
            <div className="text-6xl mb-4">👀</div>
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">
              No followed entities yet
            </h2>
            <p className="text-neutral-600 mb-8 max-w-md mx-auto">
              Start following players, teams, or competitions to see personalized updates here
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/search?type=player"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
              >
                <Users className="w-5 h-5" />
                Find Players
              </Link>
              <Link
                href="/search?type=team"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-neutral-300 text-neutral-700 rounded-xl font-medium hover:bg-neutral-50 transition-colors"
              >
                <Shield className="w-5 h-5" />
                Find Teams
              </Link>
              <Link
                href="/search?type=competition"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-neutral-300 text-neutral-700 rounded-xl font-medium hover:bg-neutral-50 transition-colors"
              >
                <Trophy className="w-5 h-5" />
                Find Competitions
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Followed Teams */}
            {followedTeams.length > 0 && (
              <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-bold text-xl text-neutral-900 flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    Teams
                  </h2>
                  <Link
                    href="/search?type=team"
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Find more
                  </Link>
                </div>
                <div className="grid gap-3">
                  {followedTeams.map(({ team }) => (
                    <Link
                      key={team.id}
                      href={`/teams/${team.slug}`}
                      className="flex items-center gap-4 p-4 rounded-xl hover:bg-neutral-50 transition-colors group border border-neutral-100"
                    >
                      <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                        {team.logoUrl ? (
                          <img
                            src={team.logoUrl}
                            alt={team.name}
                            className="w-8 h-8 object-contain"
                          />
                        ) : (
                          <Shield className="w-6 h-6 text-neutral-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-neutral-900 truncate group-hover:text-blue-600 transition-colors">
                          {team.name}
                        </div>
                        <div className="text-sm text-neutral-500">{team.country}</div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-neutral-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Followed Players */}
            {followedPlayers.length > 0 && (
              <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-bold text-xl text-neutral-900 flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    Players
                  </h2>
                  <Link
                    href="/search?type=player"
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Find more
                  </Link>
                </div>
                <div className="grid gap-3">
                  {followedPlayers.map(({ player }) => (
                    <Link
                      key={player.id}
                      href={`/players/${player.slug}`}
                      className="flex items-center gap-4 p-4 rounded-xl hover:bg-neutral-50 transition-colors group border border-neutral-100"
                    >
                      <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center group-hover:bg-green-50 transition-colors">
                        <Users className="w-6 h-6 text-neutral-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-neutral-900 truncate group-hover:text-blue-600 transition-colors">
                          {player.name}
                        </div>
                        <div className="text-sm text-neutral-500">
                          {player.position} {player.nationality && `• ${player.nationality}`}
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-neutral-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Followed Competitions */}
            {followedCompetitions.length > 0 && (
              <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-bold text-xl text-neutral-900 flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-white" />
                    </div>
                    Competitions
                  </h2>
                  <Link
                    href="/search?type=competition"
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Find more
                  </Link>
                </div>
                <div className="grid gap-3">
                  {followedCompetitions.map(({ competition }) => (
                    <Link
                      key={competition.id}
                      href={`/competitions/${competition.slug}`}
                      className="flex items-center gap-4 p-4 rounded-xl hover:bg-neutral-50 transition-colors group border border-neutral-100"
                    >
                      <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center group-hover:bg-orange-50 transition-colors">
                        {competition.logoUrl ? (
                          <img
                            src={competition.logoUrl}
                            alt={competition.name}
                            className="w-8 h-8 object-contain"
                          />
                        ) : (
                          <Trophy className="w-6 h-6 text-neutral-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-neutral-900 truncate group-hover:text-blue-600 transition-colors">
                          {competition.name}
                        </div>
                        <div className="text-sm text-neutral-500">{competition.country}</div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-neutral-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
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
