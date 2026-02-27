import { notFound } from "next/navigation";
import Link from "next/link";
import { Trophy, ArrowLeft, Shield, Users, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import {
  getCompetitionBySlug,
  getCompetitionSeason,
  getStandings,
  getTopScorers,
} from "@/lib/queries/competitions";
import { CompetitionJsonLd, BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { FollowButton } from "@/components/follow-button";
import { TournamentRecap } from "@/components/competition/tournament-recap";
import { CompetitionFixtures } from "@/components/matches/competition-fixtures";
import { SidebarAd } from "@/components/ads/sidebar-ad";

interface CompetitionPageProps {
  params: Promise<{ slug: string }>;
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://sportsdb-nine.vercel.app";

export async function generateMetadata({ params }: CompetitionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const competition = await getCompetitionBySlug(slug);

  if (!competition) {
    return { title: "Competition Not Found" };
  }

  const title = `${competition.name} – Standings, Teams & Stats | SportsDB`;
  const description = `${competition.name}${competition.country ? ` (${competition.country})` : ""} standings, teams, top scorers, and statistics on SportsDB.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/competitions/${slug}`,
      siteName: "SportsDB",
      type: "website",
      ...(competition.logoUrl && { images: [{ url: competition.logoUrl, alt: competition.name }] }),
    },
    twitter: {
      card: "summary",
      title,
      description,
      ...(competition.logoUrl && { images: [competition.logoUrl] }),
    },
    alternates: {
      canonical: `${BASE_URL}/competitions/${slug}`,
    },
  };
}

export default async function CompetitionPage({ params }: CompetitionPageProps) {
  const { slug } = await params;

  const competition = await getCompetitionBySlug(slug);

  if (!competition) {
    notFound();
  }

  const competitionSeason = await getCompetitionSeason(slug);

  const [standingsData, topScorers] = competitionSeason
    ? await Promise.all([
        getStandings(competitionSeason.competitionSeason.id),
        getTopScorers(competitionSeason.competitionSeason.id, 10),
      ])
    : [[], []];

  const competitionUrl = `${BASE_URL}/competitions/${slug}`;

  return (
    <>
      <CompetitionJsonLd
        name={competition.name}
        url={competitionUrl}
        logo={competition.logoUrl}
        location={competition.country}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Competitions", url: `${BASE_URL}/search?type=competition` },
          { name: competition.name, url: competitionUrl },
        ]}
      />
      <div className="min-h-screen bg-neutral-50">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 text-white">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <Link
              href="/search?type=competition"
              className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              All Competitions
            </Link>

            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="w-24 h-24 md:w-32 md:h-32 bg-white rounded-2xl flex items-center justify-center flex-shrink-0 p-4">
                {competition.logoUrl ? (
                  <img
                    src={competition.logoUrl}
                    alt={competition.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Trophy className="w-12 h-12 md:w-16 md:h-16 text-indigo-300" />
                )}
              </div>

              <div className="flex-1">
                <h1 className="text-3xl md:text-5xl font-bold mb-2">{competition.name}</h1>
                {competition.country && (
                  <p className="text-xl text-white/80 mb-4">{competition.country}</p>
                )}
                <div className="flex flex-wrap items-center gap-4">
                  {competitionSeason && (
                    <>
                      <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                        Season {competitionSeason.season.label}
                      </span>
                      <span className="text-white/70">
                        {standingsData.length} teams
                      </span>
                    </>
                  )}
                  <FollowButton entityType="competition" entityId={competition.id} entityName={competition.name} variant="hero" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Standings */}
            <div className="lg:col-span-2">
              <h2 className="text-xl font-bold text-neutral-900 mb-4">Standings</h2>

              {standingsData.length === 0 ? (
                <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
                  <Trophy className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                  <p className="text-neutral-500">No standings data available</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-neutral-50 text-left text-sm text-neutral-500">
                        <th className="px-4 py-3 font-medium">#</th>
                        <th className="px-4 py-3 font-medium">Team</th>
                        <th className="px-4 py-3 font-medium text-center">P</th>
                        <th className="px-4 py-3 font-medium text-center">W</th>
                        <th className="px-4 py-3 font-medium text-center">D</th>
                        <th className="px-4 py-3 font-medium text-center">L</th>
                        <th className="px-4 py-3 font-medium text-center">GD</th>
                        <th className="px-4 py-3 font-medium text-center">Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {standingsData.map(({ standing, team }) => (
                        <tr key={team.id} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-neutral-900">
                            {standing.position}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/teams/${team.slug}`}
                              className="flex items-center gap-3 hover:text-blue-600 transition-colors"
                            >
                              <div className="w-8 h-8 bg-neutral-100 rounded flex items-center justify-center">
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
                              <span className="font-medium">{team.shortName || team.name}</span>
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-center text-neutral-600">{standing.played}</td>
                          <td className="px-4 py-3 text-center text-neutral-600">{standing.won}</td>
                          <td className="px-4 py-3 text-center text-neutral-600">{standing.drawn}</td>
                          <td className="px-4 py-3 text-center text-neutral-600">{standing.lost}</td>
                          <td className={`px-4 py-3 text-center font-medium ${
                            standing.goalDifference > 0 ? "text-green-600" :
                            standing.goalDifference < 0 ? "text-red-600" : "text-neutral-600"
                          }`}>
                            {standing.goalDifference > 0 ? "+" : ""}{standing.goalDifference}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-neutral-900">
                            {standing.points}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Fixtures */}
              {competitionSeason && (
                <div className="mt-8">
                  <h2 className="text-xl font-bold text-neutral-900 mb-4">Fixtures & Results</h2>
                  <CompetitionFixtures
                    competitionSeasonId={competitionSeason.competitionSeason.id}
                    limit={30}
                  />
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Tournament Recap */}
              {competitionSeason && (
                <TournamentRecap competitionSeasonId={competitionSeason.competitionSeason.id} />
              )}

              {/* Top Scorers */}
              {topScorers.length > 0 && (
                <div className="bg-white rounded-xl border border-neutral-200 p-6">
                  <h3 className="text-sm font-medium text-neutral-500 mb-4">Top Scorers</h3>
                  <div className="space-y-3">
                    {topScorers.map(({ stat, player, team }, index) => (
                      <Link
                        key={player.id}
                        href={`/players/${player.slug}`}
                        className="flex items-center gap-3 group"
                      >
                        <span className="w-6 text-sm font-medium text-neutral-400">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-neutral-900 truncate group-hover:text-blue-600 transition-colors">
                            {player.name}
                          </div>
                          <div className="text-xs text-neutral-500 truncate">
                            {team.shortName || team.name}
                          </div>
                        </div>
                        <span className="font-bold text-neutral-900">{stat.goals}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <SidebarAd />

              {/* Competition Info */}
              <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <h3 className="text-sm font-medium text-neutral-500 mb-4">Competition Info</h3>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">Name</dt>
                    <dd className="font-medium text-neutral-900">{competition.name}</dd>
                  </div>
                  {competition.country && (
                    <div className="flex justify-between">
                      <dt className="text-neutral-600">Country</dt>
                      <dd className="font-medium text-neutral-900">{competition.country}</dd>
                    </div>
                  )}
                  {competition.type && (
                    <div className="flex justify-between">
                      <dt className="text-neutral-600">Type</dt>
                      <dd className="font-medium text-neutral-900 capitalize">{competition.type}</dd>
                    </div>
                  )}
                  {competitionSeason && (
                    <div className="flex justify-between">
                      <dt className="text-neutral-600">Current Season</dt>
                      <dd className="font-medium text-neutral-900">{competitionSeason.season.label}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">Teams</dt>
                    <dd className="font-medium text-neutral-900">{standingsData.length}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
