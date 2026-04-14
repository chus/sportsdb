import Link from "next/link";
import { Trophy, Shield, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { getTopScorersGlobal, getAllCompetitionSlugs, getCompetitionBySlug, getCurrentSeasonLabel } from "@/lib/queries/leaderboards";
import { BreadcrumbJsonLd, ItemListJsonLd, CollectionPageJsonLd } from "@/components/seo/json-ld";
import { PageHeader } from "@/components/layout/page-header";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { PlayerLink } from "@/components/player/player-link";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const sl = await getCurrentSeasonLabel();
  const title = `Top Scorers ${sl} – Goals & Stats | DataSports`;
  const description = `Top scorers across all major football competitions for the ${sl} season. See goals, assists, and appearances for the leading strikers.`;
  return {
    title,
    description,
    openGraph: { title, description, url: `${BASE_URL}/top-scorers` },
    alternates: { canonical: `${BASE_URL}/top-scorers` },
  };
}

export default async function TopScorersPage() {
  const [scorers, competitionSlugs, seasonLabel] = await Promise.all([
    getTopScorersGlobal(),
    getAllCompetitionSlugs(),
    getCurrentSeasonLabel(),
  ]);

  // Get competition names for the links section
  const competitionsData = await Promise.all(
    competitionSlugs.map((s) => getCompetitionBySlug(s.slug))
  );
  const validCompetitions = competitionsData.filter(Boolean);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Top Scorers", url: `${BASE_URL}/top-scorers` },
        ]}
      />
      <CollectionPageJsonLd name={`Top Scorers ${seasonLabel}`} description={`Top scorers across all major football competitions for the ${seasonLabel} season.`} url={`${BASE_URL}/top-scorers`} />
      <ItemListJsonLd
        name={`Top Scorers ${seasonLabel}`}
        items={scorers.map((s, i) => ({
          position: i + 1,
          url: `${BASE_URL}/players/${s.player.slug}`,
          name: s.player.name,
          image: s.player.imageUrl,
        }))}
      />

      <div className="min-h-screen bg-neutral-50">
        <PageHeader
          title="Top Scorers"
          subtitle="Leading goal scorers across all major football competitions this season"
          accentColor="bg-orange-700"
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Top Scorers" },
          ]}
          icon={<Trophy className="w-7 h-7 text-orange-300" />}
        />

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Top 3 Podium + Stats Summary */}
          {scorers.length >= 3 && (
            <div className="mb-8">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <div className="bg-white rounded-xl border border-neutral-200 p-4">
                  <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Golden Boot Leader</div>
                  <div className="text-2xl font-bold text-neutral-900">{scorers[0].stat.goals} goals</div>
                  <div className="text-xs text-neutral-500">{scorers[0].player.name}</div>
                </div>
                <div className="bg-white rounded-xl border border-neutral-200 p-4">
                  <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Total Goals</div>
                  <div className="text-2xl font-bold text-neutral-900">{scorers.reduce((sum, s) => sum + (s.stat.goals ?? 0), 0)}</div>
                  <div className="text-xs text-neutral-500">across {scorers.length} players</div>
                </div>
                <div className="bg-white rounded-xl border border-neutral-200 p-4">
                  <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Avg Goals/Player</div>
                  <div className="text-2xl font-bold text-neutral-900">{(scorers.reduce((sum, s) => sum + (s.stat.goals ?? 0), 0) / scorers.length).toFixed(1)}</div>
                  <div className="text-xs text-neutral-500">this season</div>
                </div>
                <div className="bg-white rounded-xl border border-neutral-200 p-4">
                  <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Competitions</div>
                  <div className="text-2xl font-bold text-neutral-900">{new Set(scorers.map((s) => s.competition.slug)).size}</div>
                  <div className="text-xs text-neutral-500">leagues tracked</div>
                </div>
              </div>

              {/* Top 3 Podium */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {scorers.slice(0, 3).map((s, i) => (
                  <Link
                    key={s.stat.id}
                    href={`/players/${s.player.slug}`}
                    className={`bg-white rounded-xl border p-5 hover:shadow-lg transition-all group ${
                      i === 0 ? "border-amber-300 bg-gradient-to-br from-amber-50 to-white sm:row-start-1" : "border-neutral-200"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${
                          i === 0 ? "bg-amber-100" : i === 1 ? "bg-neutral-100" : "bg-orange-50"
                        }`}>
                          {s.player.imageUrl ? (
                            <ImageWithFallback src={s.player.imageUrl} alt={s.player.name} width={56} height={56} className="w-14 h-14 rounded-full object-cover" />
                          ) : (
                            <span className="text-lg font-bold text-neutral-400">{s.player.name.substring(0, 2).toUpperCase()}</span>
                          )}
                        </div>
                        <span className={`absolute -top-1 -right-1 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                          i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-neutral-400 text-white" : "bg-orange-400 text-white"
                        }`}>
                          {i + 1}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-neutral-900 group-hover:text-blue-600 transition-colors truncate">{s.player.name}</div>
                        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                          {s.team.logoUrl && <ImageWithFallback src={s.team.logoUrl} alt={s.team.name} width={14} height={14} className="w-3.5 h-3.5 object-contain" />}
                          {s.team.name}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`text-2xl font-bold ${i === 0 ? "text-amber-600" : "text-neutral-900"}`}>{s.stat.goals}</div>
                        <div className="text-[10px] text-neutral-500 uppercase">goals</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {scorers.length === 0 ? (
            <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
              <Trophy className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-neutral-900 mb-2">No stats available yet</h2>
              <p className="text-neutral-500">
                Top scorer data will appear once the current season is underway.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-neutral-50 text-left text-sm text-neutral-500">
                      <th scope="col" className="px-2 sm:px-4 py-3 font-medium">#</th>
                      <th scope="col" className="px-2 sm:px-4 py-3 font-medium">Player</th>
                      <th scope="col" className="px-2 sm:px-4 py-3 font-medium">Team</th>
                      <th scope="col" className="px-2 sm:px-4 py-3 font-medium hidden md:table-cell">Competition</th>
                      <th scope="col" className="px-2 sm:px-4 py-3 font-medium text-center hidden sm:table-cell">Apps</th>
                      <th scope="col" className="px-2 sm:px-4 py-3 font-medium text-center">Goals</th>
                      <th scope="col" className="px-2 sm:px-4 py-3 font-medium text-center">Assists</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {scorers.map(({ stat, player, team, competition }, index) => (
                      <tr key={stat.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-2 sm:px-4 py-3 font-medium text-neutral-400">
                          {index + 1}
                        </td>
                        <td className="px-2 sm:px-4 py-3">
                          <PlayerLink
                            slug={player.slug}
                            isLinkWorthy={player.isIndexable ?? false}
                            className="flex items-center gap-3 hover:text-blue-600 transition-colors"
                          >
                            {player.imageUrl ? (
                              <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                                <ImageWithFallback
                                  src={player.imageUrl}
                                  alt={player.name}
                                  width={32}
                                  height={32}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
                                <span className="text-white text-xs font-bold">{player.name.substring(0, 2).toUpperCase()}</span>
                              </div>
                            )}
                            <div>
                              <div className="font-medium">{player.name}</div>
                              <div className="text-xs text-neutral-500">{player.nationality}</div>
                            </div>
                          </PlayerLink>
                        </td>
                        <td className="px-2 sm:px-4 py-3">
                          <Link
                            href={`/teams/${team.slug}`}
                            className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                          >
                            {team.logoUrl ? (
                              <ImageWithFallback
                                src={team.logoUrl}
                                alt={team.name}
                                width={20}
                                height={20}
                                className="w-5 h-5 object-contain"
                              />
                            ) : (
                              <Shield className="w-4 h-4 text-neutral-300" />
                            )}
                            <span className="text-sm hidden md:inline">{team.name}</span>
                            <span className="text-sm md:hidden">{team.shortName || team.name}</span>
                          </Link>
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-sm text-neutral-600 hidden md:table-cell">
                          <Link
                            href={`/competitions/${competition.slug}`}
                            className="hover:text-blue-600 transition-colors"
                          >
                            {competition.name}
                          </Link>
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-center text-neutral-600 hidden sm:table-cell">
                          {stat.appearances}
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-center font-bold text-neutral-900">
                          {stat.goals}
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-center text-neutral-600">
                          {stat.assists}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Competition Links */}
          {validCompetitions.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-bold text-neutral-900 mb-4">Top Scorers by Competition</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {validCompetitions.map((comp) => (
                  <Link
                    key={comp!.slug}
                    href={`/top-scorers/${comp!.slug}`}
                    className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md transition-shadow flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <Trophy className="w-5 h-5 text-orange-500" />
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
