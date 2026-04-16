import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy, Shield, User } from "lucide-react";
import type { Metadata } from "next";
import {
  getTopScorersForCompetitionSeason,
  getCompetitionSeasonLabels,
  getCompetitionBySlug,
  getAllCompetitionSlugs,
  getCurrentSeasonUrlLabel,
} from "@/lib/queries/leaderboards";
import { BreadcrumbJsonLd, ItemListJsonLd } from "@/components/seo/json-ld";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { PlayerLink } from "@/components/player/player-link";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string; season: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllCompetitionSlugs();
  const params: { slug: string; season: string }[] = [];
  for (const { slug } of slugs) {
    const labels = await getCompetitionSeasonLabels(slug);
    for (const label of labels) {
      params.push({ slug, season: label.replace("/", "-") });
    }
  }
  return params;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, season } = await params;
  const seasonLabel = season.replace("-", "/");
  const competition = await getCompetitionBySlug(slug);
  if (!competition) return { title: "Not Found", robots: { index: false, follow: false } };

  const title = `${competition.name} Top Scorers ${seasonLabel}`;
  const description = `Top goal scorers in the ${competition.name} for the ${seasonLabel} season. Full rankings with goals, assists, and appearances for every player.`;

  // If the requested season is the current season, canonical points to /top-scorers/[slug]
  // to avoid duplicate content with the current-season hub page.
  const currentUrlLabel = await getCurrentSeasonUrlLabel(slug);
  const canonical = currentUrlLabel === season
    ? `${BASE_URL}/top-scorers/${slug}`
    : `${BASE_URL}/top-scorers/${slug}/${season}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/top-scorers/${slug}/${season}`,
    },
    alternates: { canonical },
  };
}

export default async function HistoricalTopScorersPage({ params }: PageProps) {
  const { slug, season } = await params;
  const seasonLabel = season.replace("-", "/");
  const competition = await getCompetitionBySlug(slug);
  if (!competition) notFound();

  const [scorers, allSeasons] = await Promise.all([
    getTopScorersForCompetitionSeason(slug, seasonLabel, 50),
    getCompetitionSeasonLabels(slug),
  ]);

  if (scorers.length === 0) notFound();

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Top Scorers", url: `${BASE_URL}/top-scorers` },
          { name: competition.name, url: `${BASE_URL}/top-scorers/${slug}` },
          { name: seasonLabel, url: `${BASE_URL}/top-scorers/${slug}/${season}` },
        ]}
      />
      <ItemListJsonLd
        name={`${competition.name} Top Scorers ${seasonLabel}`}
        items={scorers.slice(0, 20).map((s, i) => ({
          position: i + 1,
          url: `${BASE_URL}/players/${s.player.slug}`,
          name: `${s.player.name} (${s.stat.goals} goals)`,
          image: s.player.imageUrl,
        }))}
      />

      <div className="min-h-screen bg-neutral-50">
        <div className="bg-gradient-to-br from-yellow-500 via-orange-500 to-red-600 text-white">
          <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
            <div className="flex items-center gap-3 mb-2">
              <Link href="/top-scorers" className="text-white/70 hover:text-white transition-colors text-sm">
                Top Scorers
              </Link>
              <span className="text-white/40">/</span>
              <Link href={`/top-scorers/${slug}`} className="text-white/70 hover:text-white transition-colors text-sm">
                {competition.name}
              </Link>
              <span className="text-white/40">/</span>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <Trophy className="w-8 h-8" />
              <h1 className="text-3xl md:text-5xl font-bold">{competition.name} Top Scorers {seasonLabel}</h1>
            </div>
            <p className="text-lg text-white/80 max-w-2xl">
              Leading goal scorers in the {competition.name} during the {seasonLabel} season.
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Season Selector */}
          <div className="flex flex-wrap gap-2 mb-6">
            {allSeasons.map((s) => {
              const sSafe = s.replace("/", "-");
              const isActive = s === seasonLabel;
              return (
                <Link
                  key={s}
                  href={`/top-scorers/${slug}/${sSafe}`}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-orange-600 text-white"
                      : "bg-white border border-neutral-200 text-neutral-700 hover:border-orange-300 hover:text-orange-600"
                  }`}
                >
                  {s}
                </Link>
              );
            })}
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-neutral-50 text-left text-sm text-neutral-500">
                    <th scope="col" className="px-2 sm:px-4 py-3 font-medium">#</th>
                    <th scope="col" className="px-2 sm:px-4 py-3 font-medium">Player</th>
                    <th scope="col" className="px-2 sm:px-4 py-3 font-medium">Team</th>
                    <th scope="col" className="px-2 sm:px-4 py-3 font-medium text-center hidden sm:table-cell">Apps</th>
                    <th scope="col" className="px-2 sm:px-4 py-3 font-medium text-center">Goals</th>
                    <th scope="col" className="px-2 sm:px-4 py-3 font-medium text-center">Assists</th>
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
              href={`/top-assists/${slug}/${season}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              Top Assists {seasonLabel} →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
