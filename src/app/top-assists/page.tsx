import Link from "next/link";
import { Handshake, Shield, User, ChevronRight, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { getTopAssistsGlobal, getAllCompetitionSlugs, getCompetitionBySlug } from "@/lib/queries/leaderboards";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Top Assists 2025/26 – Football Assist Leaders",
  description:
    "Top assist providers across all major football competitions for the 2025/26 season. See assists, goals, and appearances for the leading playmakers.",
  openGraph: {
    title: "Top Assists 2025/26 – Football Assist Leaders | SportsDB",
    description:
      "Top assist providers across all major football competitions for the 2025/26 season.",
    url: `${BASE_URL}/top-assists`,
  },
  alternates: {
    canonical: `${BASE_URL}/top-assists`,
  },
};

export default async function TopAssistsPage() {
  const [leaders, competitionSlugs] = await Promise.all([
    getTopAssistsGlobal(),
    getAllCompetitionSlugs(),
  ]);

  const competitionsData = await Promise.all(
    competitionSlugs.map((s) => getCompetitionBySlug(s.slug))
  );
  const validCompetitions = competitionsData.filter(Boolean);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Top Assists", url: `${BASE_URL}/top-assists` },
        ]}
      />

      <div className="min-h-screen bg-neutral-50">
        <div className="bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 text-white">
          <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
            <div className="flex items-center gap-3 mb-4">
              <Handshake className="w-8 h-8" />
              <h1 className="text-3xl md:text-5xl font-bold">Top Assists</h1>
            </div>
            <p className="text-lg text-white/80 max-w-2xl">
              Leading assist providers across all major football competitions this season.
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {leaders.length === 0 ? (
            <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
              <Handshake className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-neutral-900 mb-2">No stats available yet</h2>
              <p className="text-neutral-500">
                Assist data will appear once the current season is underway.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-neutral-50 text-left text-sm text-neutral-500">
                      <th className="px-4 py-3 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Player</th>
                      <th className="px-4 py-3 font-medium">Team</th>
                      <th className="px-4 py-3 font-medium hidden md:table-cell">Competition</th>
                      <th className="px-4 py-3 font-medium text-center">Apps</th>
                      <th className="px-4 py-3 font-medium text-center">Assists</th>
                      <th className="px-4 py-3 font-medium text-center">Goals</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {leaders.map(({ stat, player, team, competition }, index) => (
                      <tr key={stat.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-neutral-400">{index + 1}</td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/players/${player.slug}`}
                            className="flex items-center gap-3 hover:text-blue-600 transition-colors"
                          >
                            <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                              {player.imageUrl ? (
                                <img src={player.imageUrl} alt={player.name} className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <User className="w-4 h-4 text-neutral-400" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium">{player.name}</div>
                              <div className="text-xs text-neutral-500">{player.nationality}</div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/teams/${team.slug}`}
                            className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                          >
                            {team.logoUrl ? (
                              <img src={team.logoUrl} alt={team.name} className="w-5 h-5 object-contain" />
                            ) : (
                              <Shield className="w-4 h-4 text-neutral-300" />
                            )}
                            <span className="text-sm">{team.shortName || team.name}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-600 hidden md:table-cell">
                          <Link
                            href={`/competitions/${competition.slug}`}
                            className="hover:text-blue-600 transition-colors"
                          >
                            {competition.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center text-neutral-600">{stat.appearances}</td>
                        <td className="px-4 py-3 text-center font-bold text-neutral-900">{stat.assists}</td>
                        <td className="px-4 py-3 text-center text-neutral-600">{stat.goals}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {validCompetitions.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-bold text-neutral-900 mb-4">Top Assists by Competition</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {validCompetitions.map((comp) => (
                  <Link
                    key={comp!.slug}
                    href={`/top-assists/${comp!.slug}`}
                    className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md transition-shadow flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <Handshake className="w-5 h-5 text-indigo-500" />
                      <span className="font-medium text-neutral-900 group-hover:text-blue-600 transition-colors">
                        {comp!.name}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-blue-600 transition-colors" />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
