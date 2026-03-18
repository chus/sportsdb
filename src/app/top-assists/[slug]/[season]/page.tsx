import Link from "next/link";
import { notFound } from "next/navigation";
import { Handshake, Shield, User } from "lucide-react";
import type { Metadata } from "next";
import {
  getTopAssistsForCompetitionSeason,
  getCompetitionSeasonLabels,
  getCompetitionBySlug,
  getAllCompetitionSlugs,
} from "@/lib/queries/leaderboards";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";

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
  if (!competition) return { title: "Not Found" };

  const title = `${competition.name} Top Assists ${seasonLabel} | SportsDB`;
  const description = `Top assist providers in the ${competition.name} for the ${seasonLabel} season. Assists, goals, and appearances.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/top-assists/${slug}/${season}`,
    },
    alternates: { canonical: `${BASE_URL}/top-assists/${slug}/${season}` },
  };
}

export default async function HistoricalTopAssistsPage({ params }: PageProps) {
  const { slug, season } = await params;
  const seasonLabel = season.replace("-", "/");
  const competition = await getCompetitionBySlug(slug);
  if (!competition) notFound();

  const [leaders, allSeasons] = await Promise.all([
    getTopAssistsForCompetitionSeason(slug, seasonLabel, 50),
    getCompetitionSeasonLabels(slug),
  ]);

  if (leaders.length === 0) notFound();

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Top Assists", url: `${BASE_URL}/top-assists` },
          { name: competition.name, url: `${BASE_URL}/top-assists/${slug}` },
          { name: seasonLabel, url: `${BASE_URL}/top-assists/${slug}/${season}` },
        ]}
      />

      <div className="min-h-screen bg-neutral-50">
        <div className="bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 text-white">
          <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
            <div className="flex items-center gap-3 mb-2">
              <Link href="/top-assists" className="text-white/70 hover:text-white transition-colors text-sm">
                Top Assists
              </Link>
              <span className="text-white/40">/</span>
              <Link href={`/top-assists/${slug}`} className="text-white/70 hover:text-white transition-colors text-sm">
                {competition.name}
              </Link>
              <span className="text-white/40">/</span>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <Handshake className="w-8 h-8" />
              <h1 className="text-3xl md:text-5xl font-bold">{competition.name} Top Assists {seasonLabel}</h1>
            </div>
            <p className="text-lg text-white/80 max-w-2xl">
              Leading assist providers in the {competition.name} during the {seasonLabel} season.
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
                  href={`/top-assists/${slug}/${sSafe}`}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-indigo-600 text-white"
                      : "bg-white border border-neutral-200 text-neutral-700 hover:border-indigo-300 hover:text-indigo-600"
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
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">Player</th>
                    <th className="px-4 py-3 font-medium">Team</th>
                    <th className="px-4 py-3 font-medium text-center">Apps</th>
                    <th className="px-4 py-3 font-medium text-center">Assists</th>
                    <th className="px-4 py-3 font-medium text-center">Goals</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {leaders.map(({ stat, player, team }, index) => (
                    <tr key={stat.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-neutral-400">{index + 1}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/players/${player.slug}`}
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
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/teams/${team.slug}`}
                          className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                        >
                          {team.logoUrl ? (
                            <ImageWithFallback src={team.logoUrl} alt={team.name} className="w-5 h-5 object-contain" width={20} height={20} />
                          ) : (
                            <Shield className="w-4 h-4 text-neutral-300" />
                          )}
                          <span className="text-sm">{team.shortName || team.name}</span>
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
        </div>
      </div>
    </>
  );
}
