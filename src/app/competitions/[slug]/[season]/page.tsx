import { notFound } from "next/navigation";
import Link from "next/link";
import { Trophy, ArrowLeft, Shield, Crown } from "lucide-react";
import type { Metadata } from "next";
import {
  getCompetitionBySlug,
  getHistoricalStandings,
  getAllSeasons,
} from "@/lib/queries/competitions";
import { CompetitionJsonLd, BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { FollowButton } from "@/components/follow-button";
import { SeasonSelector } from "@/components/time/season-selector";

interface CompetitionSeasonPageProps {
  params: Promise<{ slug: string; season: string }>;
}

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://sportsdb-nine.vercel.app";

export async function generateMetadata({
  params,
}: CompetitionSeasonPageProps): Promise<Metadata> {
  const { slug, season } = await params;
  const competition = await getCompetitionBySlug(slug);

  if (!competition) {
    return { title: "Competition Not Found" };
  }

  // Convert URL format to display format
  const displaySeason = season.replace("-", "/");
  const title = `${competition.name} ${displaySeason} – Standings & Stats | SportsDB`;
  const description = `${competition.name} ${displaySeason} season standings, teams, top scorers, and statistics on SportsDB.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/competitions/${slug}/${season}`,
      siteName: "SportsDB",
      type: "website",
      ...(competition.logoUrl && {
        images: [{ url: competition.logoUrl, alt: competition.name }],
      }),
    },
    twitter: {
      card: "summary",
      title,
      description,
      ...(competition.logoUrl && { images: [competition.logoUrl] }),
    },
    alternates: {
      canonical: `${BASE_URL}/competitions/${slug}/${season}`,
    },
  };
}

export default async function CompetitionSeasonPage({
  params,
}: CompetitionSeasonPageProps) {
  const { slug, season } = await params;

  const competition = await getCompetitionBySlug(slug);

  if (!competition) {
    notFound();
  }

  const [data, allSeasons] = await Promise.all([
    getHistoricalStandings(slug, season),
    getAllSeasons(competition.id),
  ]);

  if (!data) {
    notFound();
  }

  const {
    competitionSeason,
    season: seasonData,
    standings: standingsData,
    topScorers,
  } = data;

  // Prepare seasons for selector
  const seasonsForSelector = allSeasons.map((s) => ({
    label: s.season.label,
    urlLabel: s.season.label.replace("/", "-"),
    isCurrent: s.season.isCurrent,
  }));

  const isCompleted = competitionSeason.status === "completed";
  const championTeamId = competitionSeason.championTeamId;

  const competitionUrl = `${BASE_URL}/competitions/${slug}/${season}`;

  return (
    <>
      <CompetitionJsonLd
        name={`${competition.name} ${seasonData.label}`}
        url={competitionUrl}
        logo={competition.logoUrl}
        location={competition.country}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Competitions", url: `${BASE_URL}/search?type=competition` },
          { name: competition.name, url: `${BASE_URL}/competitions/${slug}` },
          { name: seasonData.label, url: competitionUrl },
        ]}
      />
      <div className="min-h-screen bg-neutral-50">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 text-white">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-6">
              <Link
                href={`/competitions/${slug}`}
                className="inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {competition.name}
              </Link>

              {/* Season Selector */}
              <SeasonSelector
                seasons={seasonsForSelector}
                currentSeason={seasonData.label}
                competitionSlug={slug}
              />
            </div>

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
                <h1 className="text-3xl md:text-5xl font-bold mb-2">
                  {competition.name}
                </h1>
                <p className="text-xl text-white/80 mb-4">
                  {seasonData.label} Season
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  {competition.country && (
                    <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                      {competition.country}
                    </span>
                  )}
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${
                      isCompleted
                        ? "bg-neutral-800 text-white"
                        : competitionSeason.status === "in_progress"
                          ? "bg-green-500 text-white"
                          : "bg-blue-500 text-white"
                    }`}
                  >
                    {isCompleted
                      ? "Completed"
                      : competitionSeason.status === "in_progress"
                        ? "In Progress"
                        : "Scheduled"}
                  </span>
                  <span className="text-white/70">
                    {standingsData.length} teams
                  </span>
                  <FollowButton
                    entityType="competition"
                    entityId={competition.id}
                    entityName={competition.name}
                    variant="hero"
                  />
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
              <h2 className="text-xl font-bold text-neutral-900 mb-4">
                Standings
              </h2>

              {standingsData.length === 0 ? (
                <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
                  <Trophy className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                  <p className="text-neutral-500">
                    No standings data available for this season
                  </p>
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
                        <th className="px-4 py-3 font-medium text-center">
                          Pts
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {standingsData.map(({ standing, team }) => {
                        const isChampion =
                          isCompleted &&
                          (championTeamId === team.id ||
                            standing.position === 1);
                        return (
                          <tr
                            key={team.id}
                            className={`hover:bg-neutral-50 transition-colors ${
                              isChampion ? "bg-yellow-50" : ""
                            }`}
                          >
                            <td className="px-4 py-3 font-medium text-neutral-900">
                              <div className="flex items-center gap-2">
                                {isChampion && (
                                  <Crown className="w-4 h-4 text-yellow-500" />
                                )}
                                {standing.position}
                              </div>
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
                                <span
                                  className={`font-medium ${isChampion ? "text-yellow-700" : ""}`}
                                >
                                  {team.shortName || team.name}
                                  {isChampion && (
                                    <span className="ml-2 text-xs text-yellow-600 font-normal">
                                      Champion
                                    </span>
                                  )}
                                </span>
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-center text-neutral-600">
                              {standing.played}
                            </td>
                            <td className="px-4 py-3 text-center text-neutral-600">
                              {standing.won}
                            </td>
                            <td className="px-4 py-3 text-center text-neutral-600">
                              {standing.drawn}
                            </td>
                            <td className="px-4 py-3 text-center text-neutral-600">
                              {standing.lost}
                            </td>
                            <td
                              className={`px-4 py-3 text-center font-medium ${
                                standing.goalDifference > 0
                                  ? "text-green-600"
                                  : standing.goalDifference < 0
                                    ? "text-red-600"
                                    : "text-neutral-600"
                              }`}
                            >
                              {standing.goalDifference > 0 ? "+" : ""}
                              {standing.goalDifference}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-neutral-900">
                              {standing.points}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Top Scorers */}
              {topScorers.length > 0 && (
                <div className="bg-white rounded-xl border border-neutral-200 p-6">
                  <h3 className="text-sm font-medium text-neutral-500 mb-4">
                    Top Scorers
                  </h3>
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
                        <span className="font-bold text-neutral-900">
                          {stat.goals}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Season Info */}
              <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <h3 className="text-sm font-medium text-neutral-500 mb-4">
                  Season Info
                </h3>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">Competition</dt>
                    <dd className="font-medium text-neutral-900">
                      {competition.name}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">Season</dt>
                    <dd className="font-medium text-neutral-900">
                      {seasonData.label}
                    </dd>
                  </div>
                  {competition.country && (
                    <div className="flex justify-between">
                      <dt className="text-neutral-600">Country</dt>
                      <dd className="font-medium text-neutral-900">
                        {competition.country}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">Status</dt>
                    <dd className="font-medium text-neutral-900 capitalize">
                      {competitionSeason.status.replace("_", " ")}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">Teams</dt>
                    <dd className="font-medium text-neutral-900">
                      {standingsData.length}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">Start Date</dt>
                    <dd className="font-medium text-neutral-900">
                      {new Date(seasonData.startDate).toLocaleDateString()}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">End Date</dt>
                    <dd className="font-medium text-neutral-900">
                      {new Date(seasonData.endDate).toLocaleDateString()}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Other Seasons */}
              {seasonsForSelector.length > 1 && (
                <div className="bg-white rounded-xl border border-neutral-200 p-6">
                  <h3 className="text-sm font-medium text-neutral-500 mb-4">
                    Other Seasons
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {seasonsForSelector
                      .filter((s) => s.label !== seasonData.label)
                      .map((s) => (
                        <Link
                          key={s.label}
                          href={`/competitions/${slug}/${s.urlLabel}`}
                          className="px-3 py-1.5 text-sm bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                        >
                          {s.label}
                          {s.isCurrent && (
                            <span className="ml-1 text-xs text-green-600">
                              (Current)
                            </span>
                          )}
                        </Link>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
