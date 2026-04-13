import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy, Shield, User } from "lucide-react";
import type { Metadata } from "next";
import {
  getTopScorersForCompetition,
  getAllCompetitionSlugs,
  getCompetitionBySlug,
  getCompetitionSeasonLabels,
} from "@/lib/queries/leaderboards";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { PageHeader } from "@/components/layout/page-header";
import { PlayerLink } from "@/components/player/player-link";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllCompetitionSlugs();
  return slugs.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const competition = await getCompetitionBySlug(slug);
  if (!competition) return { title: "Not Found", robots: { index: false, follow: false } };

  const title = `${competition.name} Top Scorers 2025/26 – Goals & Stats | DataSports`;
  const description = `Top goal scorers in the ${competition.name} for the 2025/26 season. See goals, assists, and appearances.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/top-scorers/${slug}`,
    },
    alternates: { canonical: `${BASE_URL}/top-scorers/${slug}` },
  };
}

export default async function CompetitionTopScorersPage({ params }: PageProps) {
  const { slug } = await params;
  const competition = await getCompetitionBySlug(slug);
  if (!competition) notFound();

  const [scorers, allSeasons] = await Promise.all([
    getTopScorersForCompetition(slug, 50),
    getCompetitionSeasonLabels(slug),
  ]);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Top Scorers", url: `${BASE_URL}/top-scorers` },
          { name: competition.name, url: `${BASE_URL}/top-scorers/${slug}` },
        ]}
      />

      <div className="min-h-screen bg-neutral-50">
        <PageHeader
          title={`${competition.name} Top Scorers`}
          subtitle={`Leading goal scorers in the ${competition.name} this season`}
          accentColor="bg-orange-700"
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Top Scorers", href: "/top-scorers" },
            { label: competition.name },
          ]}
          icon={<Trophy className="w-7 h-7 text-orange-300" />}
        />

        <div className="max-w-7xl mx-auto px-4 py-8">
          {allSeasons.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-orange-600 text-white">
                Current
              </span>
              {allSeasons.map((s) => (
                <Link
                  key={s}
                  href={`/top-scorers/${slug}/${s.replace("/", "-")}`}
                  className="px-3 py-1.5 rounded-full text-sm font-medium bg-white border border-neutral-200 text-neutral-700 hover:border-orange-300 hover:text-orange-600 transition-colors"
                >
                  {s}
                </Link>
              ))}
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
                      <th className="px-2 sm:px-4 py-3 font-medium">#</th>
                      <th className="px-2 sm:px-4 py-3 font-medium">Player</th>
                      <th className="px-2 sm:px-4 py-3 font-medium">Team</th>
                      <th className="px-2 sm:px-4 py-3 font-medium text-center hidden sm:table-cell">Apps</th>
                      <th className="px-2 sm:px-4 py-3 font-medium text-center">Goals</th>
                      <th className="px-2 sm:px-4 py-3 font-medium text-center">Assists</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {scorers.map(({ stat, player, team }, index) => (
                      <tr key={stat.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-2 sm:px-4 py-3 font-medium text-neutral-400">{index + 1}</td>
                        <td className="px-2 sm:px-4 py-3">
                          <PlayerLink
                            slug={player.slug}
                            isLinkWorthy={player.isIndexable ?? false}
                            className="flex items-center gap-3 hover:text-blue-600 transition-colors"
                          >
                            <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                              {player.imageUrl ? (
                                <ImageWithFallback src={player.imageUrl} alt={player.name} className="w-8 h-8 rounded-full object-cover" width={32} height={32} />
                              ) : (
                                <User className="w-4 h-4 text-neutral-400" />
                              )}
                            </div>
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
                              <ImageWithFallback src={team.logoUrl} alt={team.name} className="w-5 h-5 object-contain" width={20} height={20} />
                            ) : (
                              <Shield className="w-4 h-4 text-neutral-300" />
                            )}
                            <span className="text-sm hidden md:inline">{team.name}</span>
                            <span className="text-sm md:hidden">{team.shortName || team.name}</span>
                          </Link>
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-center text-neutral-600 hidden sm:table-cell">{stat.appearances}</td>
                        <td className="px-2 sm:px-4 py-3 text-center font-bold text-neutral-900">{stat.goals}</td>
                        <td className="px-2 sm:px-4 py-3 text-center text-neutral-600">{stat.assists}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cross-links */}
          <div className="flex flex-wrap gap-3 mt-6">
            <Link
              href={`/competitions/${slug}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              <Trophy className="w-4 h-4" />
              {competition.name} Standings
            </Link>
            <Link
              href={`/top-assists/${slug}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              Top Assists →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
