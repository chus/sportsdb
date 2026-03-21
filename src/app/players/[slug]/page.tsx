import { notFound } from "next/navigation";
import Link from "next/link";
import {
  User, Calendar, Ruler, Flag,
  Footprints, Shield, ArrowLeft, BarChart3
} from "lucide-react";
import type { Metadata } from "next";
import { getPlayerBySlug, getPlayerCurrentTeam, getPlayerCareer, getPlayerStatsHistory, getPlayerRankings, getPlayerRecentMatches } from "@/lib/queries/players";
import { format, differenceInYears } from "date-fns";
import { PlayerJsonLd, BreadcrumbJsonLd, FAQJsonLd } from "@/components/seo/json-ld";
import { FollowButton } from "@/components/follow-button";
import { RelatedPlayers } from "@/components/entity/related-entities";
import { PlayerProfileSummary } from "@/components/player/player-profile-summary";
import { PlayerInternalLinks } from "@/components/seo/internal-links";
import { RelatedArticles } from "@/components/articles/related-articles";
import { BetweenContentAd } from "@/components/ads/between-content-ad";
import { SidebarUpgradeOrAd } from "@/components/subscription/sidebar-upgrade-or-ad";
import { ProTeaser } from "@/components/subscription/pro-teaser";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { buildPlayerAbout, buildPlayerFaqs } from "@/lib/seo/entity-copy";
import { scorePlayerPage } from "@/lib/seo/page-quality";
import { PageTracker } from "@/components/analytics/page-tracker";
import { db } from "@/lib/db";
import { matchLineups, articlePlayers } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export const revalidate = 3600; // ISR: revalidate every hour

interface PlayerPageProps {
  params: Promise<{ slug: string }>;
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export async function generateMetadata({ params }: PlayerPageProps): Promise<Metadata> {
  const { slug } = await params;
  const player = await getPlayerBySlug(slug);

  if (!player) {
    return { title: "Player Not Found" };
  }

  const [currentTeamData, statsHistory, career, lineupCountResult, articleCountResult] = await Promise.all([
    getPlayerCurrentTeam(player.id),
    getPlayerStatsHistory(player.id),
    getPlayerCareer(player.id),
    db.select({ count: sql<number>`count(*)` }).from(matchLineups).where(eq(matchLineups.playerId, player.id)),
    db.select({ count: sql<number>`count(*)` }).from(articlePlayers).where(eq(articlePlayers.playerId, player.id)),
  ]);

  // Multi-signal thin page scoring
  const quality = scorePlayerPage({
    position: player.position,
    nationality: player.nationality,
    dateOfBirth: player.dateOfBirth,
    heightCm: player.heightCm,
    preferredFoot: player.preferredFoot,
    imageUrl: player.imageUrl,
    careerCount: career.length,
    hasCurrentTeam: !!currentTeamData,
    statsCount: statsHistory.length,
    lineupCount: Number(lineupCountResult[0]?.count ?? 0),
    articleCount: Number(articleCountResult[0]?.count ?? 0),
  });
  const isThin = quality.isThin;

  const currentTeam = currentTeamData?.team;
  const totalGoals = statsHistory.reduce((sum, s) => sum + s.stat.goals, 0);
  const totalAssists = statsHistory.reduce((sum, s) => sum + s.stat.assists, 0);
  const totalApps = statsHistory.reduce((sum, s) => sum + s.stat.appearances, 0);

  const title = `${player.name} – Stats, Goals & Career History 2025/26 | DataSports`;

  // Build data-rich description
  const statsParts: string[] = [];
  if (totalGoals > 0) statsParts.push(`${totalGoals} goals`);
  if (totalAssists > 0) statsParts.push(`${totalAssists} assists`);
  if (totalApps > 0) statsParts.push(`in ${totalApps} appearances`);

  const statsStr = statsParts.length > 0 ? statsParts.join(" and ") : "";
  const teamStr = currentTeam ? ` for ${currentTeam.name}` : "";
  const description = statsStr
    ? `${player.name} has ${statsStr}${teamStr}. Full career history, season stats, and player profile.`
    : `${player.name} is a ${player.position}${player.nationality ? ` from ${player.nationality}` : ""}. View career history, teams, and stats on DataSports.`;

  return {
    title,
    description,
    ...(isThin && { robots: { index: false, follow: true } }),
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/players/${slug}`,
      siteName: "DataSports",
      type: "profile",
      ...(player.imageUrl && { images: [{ url: player.imageUrl, alt: player.name }] }),
    },
    twitter: {
      card: "summary",
      title,
      description,
      ...(player.imageUrl && { images: [player.imageUrl] }),
    },
    alternates: {
      canonical: `${BASE_URL}/players/${slug}`,
    },
  };
}

function renderBioWithLinks(text: string) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    const match = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (match) return <Link key={i} href={match[2]} className="text-blue-600 font-medium hover:underline">{match[1]}</Link>;
    return <span key={i}>{part}</span>;
  });
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number | null; icon?: React.ElementType }) {
  if (!value) return null;
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 text-neutral-500 text-sm mb-1">
        {Icon && <Icon className="w-4 h-4" />}
        {label}
      </div>
      <div className="text-xl font-semibold text-neutral-900">{value}</div>
    </div>
  );
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { slug } = await params;

  const player = await getPlayerBySlug(slug);

  if (!player || player.position === "Unknown") {
    notFound();
  }

  const [currentTeamData, career, statsHistory, rankings, recentMatches] = await Promise.all([
    getPlayerCurrentTeam(player.id),
    getPlayerCareer(player.id),
    getPlayerStatsHistory(player.id),
    getPlayerRankings(player.id),
    getPlayerRecentMatches(player.id, 5),
  ]);

  const currentTeam = currentTeamData?.team;
  const shirtNumber = currentTeamData?.shirtNumber;

  // Calculate age
  const age = player.dateOfBirth
    ? differenceInYears(new Date(), new Date(player.dateOfBirth))
    : null;
  const totalApps = statsHistory.reduce((sum, s) => sum + s.stat.appearances, 0);
  const totalGoals = statsHistory.reduce((sum, s) => sum + s.stat.goals, 0);
  const totalAssists = statsHistory.reduce((sum, s) => sum + s.stat.assists, 0);
  const totalMins = statsHistory.reduce((sum, s) => sum + s.stat.minutesPlayed, 0);

  const playerUrl = `${BASE_URL}/players/${slug}`;
  const teamUrl = currentTeam ? `${BASE_URL}/teams/${currentTeam.slug}` : null;
  // Build current season stats from most recent stats entry
  const currentSeasonStats = statsHistory.length > 0
    ? {
        appearances: statsHistory[0].stat.appearances,
        goals: statsHistory[0].stat.goals,
        assists: statsHistory[0].stat.assists,
        competition: statsHistory[0].competition.name,
      }
    : null;

  const aboutParagraphs = buildPlayerAbout({
    name: player.name,
    knownAs: player.knownAs,
    nationality: player.nationality,
    position: player.position,
    currentTeamName: currentTeam?.name,
    currentTeamSlug: currentTeam?.slug,
    career: career.map((c) => ({
      teamName: c.team.name,
      teamSlug: c.team.slug,
      validFrom: c.validFrom,
      validTo: c.validTo,
    })),
    currentSeasonStats,
    age,
    totalAppearances: totalApps,
    totalGoals,
    totalAssists,
  });
  const faqItems = buildPlayerFaqs({
    name: player.name,
    nationality: player.nationality,
    position: player.position,
    currentTeamName: currentTeam?.name,
    age,
    dateOfBirth: player.dateOfBirth,
    preferredFoot: player.preferredFoot,
    totalGoals,
    totalAssists,
    totalApps: totalApps,
    heightCm: player.heightCm,
    careerTeams: career.length > 1 ? career.map((c) => c.team.name) : undefined,
  });

  // Build breadcrumb items
  const breadcrumbItems = [
    { name: "Home", url: BASE_URL },
    { name: "Players", url: `${BASE_URL}/search?type=player` },
    ...(currentTeam
      ? [{ name: currentTeam.name, url: `${BASE_URL}/teams/${currentTeam.slug}` }]
      : []),
    { name: player.name, url: playerUrl },
  ];

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbItems} />
      <PlayerJsonLd
        name={player.name}
        url={playerUrl}
        image={player.imageUrl}
        nationality={player.nationality}
        birthDate={player.dateOfBirth}
        height={player.heightCm}
        position={player.position}
        team={currentTeam && teamUrl ? { name: currentTeam.name, url: teamUrl } : null}
      />
      {faqItems.length > 0 && <FAQJsonLd items={faqItems} />}
      <PageTracker entityType="player" entityId={player.id} />
    <div className="min-h-screen bg-neutral-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Back button */}
          <Link
            href="/search?type=player"
            className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            All Players
          </Link>

          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Player Avatar */}
            <div className="relative w-32 h-32 md:w-40 md:h-40 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              {player.imageUrl ? (
                <ImageWithFallback
                  src={player.imageUrl}
                  alt={player.name}
                  fill
                  sizes="160px"
                  className="object-cover rounded-2xl"
                />
              ) : (
                <User className="w-16 h-16 md:w-20 md:h-20 text-white/60" />
              )}
              {shirtNumber && (
                <div className="absolute -bottom-2 -right-2 w-14 h-14 bg-white text-blue-600 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg">
                  {shirtNumber}
                </div>
              )}
            </div>

            {/* Player Info */}
            <div className="flex-1">
              <h1 className="text-3xl md:text-5xl font-bold mb-2">{player.name}</h1>

              {player.knownAs && player.knownAs !== player.name && (
                <p className="text-xl text-white/80 mb-4">&ldquo;{player.knownAs}&rdquo;</p>
              )}

              <div className="flex flex-wrap items-center gap-3 mb-6">
                <span className={`px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium text-white`}>
                  {player.position}
                </span>
                {currentTeam && (
                  <Link
                    href={`/teams/${currentTeam.slug}`}
                    className="flex items-center gap-2 px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium text-white hover:bg-white/30 transition-colors"
                  >
                    <Shield className="w-4 h-4" />
                    {currentTeam.name}
                  </Link>
                )}
                <FollowButton entityType="player" entityId={player.id} entityName={player.name} variant="hero" />
              </div>

              {/* Quick Stats Row */}
              <div className="flex flex-wrap gap-6 text-sm">
                {player.nationality && (
                  <div className="flex items-center gap-2">
                    <Flag className="w-4 h-4 text-white/60" />
                    <span>{player.nationality}</span>
                  </div>
                )}
                {age && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-white/60" />
                    <span>{age} years old</span>
                  </div>
                )}
                {player.heightCm && (
                  <div className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-white/60" />
                    <span>{player.heightCm} cm</span>
                  </div>
                )}
                {player.preferredFoot && (
                  <div className="flex items-center gap-2">
                    <Footprints className="w-4 h-4 text-white/60" />
                    <span>{player.preferredFoot} foot</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Stats Grid */}
            <section>
              <h2 className="text-xl font-bold text-neutral-900 mb-4">Player Info</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Position" value={player.position} icon={User} />
                <StatCard label="Nationality" value={player.nationality} icon={Flag} />
                <StatCard label="Age" value={age ? `${age} years` : null} icon={Calendar} />
                <StatCard label="Height" value={player.heightCm ? `${player.heightCm} cm` : null} icon={Ruler} />
                <StatCard label="Foot" value={player.preferredFoot} icon={Footprints} />
                <StatCard label="Status" value={player.status === "active" ? "Active" : player.status} />
                {shirtNumber && <StatCard label="Shirt Number" value={`#${shirtNumber}`} />}
                {player.dateOfBirth && (
                  <StatCard
                    label="Date of Birth"
                    value={format(new Date(player.dateOfBirth), "MMM d, yyyy")}
                    icon={Calendar}
                  />
                )}
              </div>
            </section>

            <section className="bg-white rounded-xl border border-neutral-200 p-6">
              <h2 className="text-xl font-bold text-neutral-900 mb-4">About {player.name}</h2>
              <div className="space-y-4 text-base leading-8 text-neutral-700">
                {aboutParagraphs.map((paragraph, i) => (
                  <p key={i}>{renderBioWithLinks(paragraph)}</p>
                ))}
              </div>
            </section>

            {/* Season Stats Summary */}
            {statsHistory.length > 0 && (() => {
              return (
                <section className="bg-white rounded-xl border border-neutral-200 p-6">
                  <h2 className="text-xl font-bold text-neutral-900 mb-6">Career Overview</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">{totalApps}</div>
                      <div className="text-sm text-neutral-500 mt-1">Appearances</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">{totalGoals}</div>
                      <div className="text-sm text-neutral-500 mt-1">Goals</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-purple-600">{totalAssists}</div>
                      <div className="text-sm text-neutral-500 mt-1">Assists</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-orange-500">{totalMins.toLocaleString()}</div>
                      <div className="text-sm text-neutral-500 mt-1">Minutes</div>
                    </div>
                  </div>
                  {totalApps > 0 && (
                    <div>
                      <div className="flex justify-between text-sm text-neutral-500 mb-2">
                        <span>Goals per Appearance</span>
                        <span className="font-medium text-neutral-900">{(totalGoals / totalApps).toFixed(2)}</span>
                      </div>
                      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                          style={{ width: `${Math.min((totalGoals / totalApps) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </section>
              );
            })()}

            {/* Competition Rankings */}
            {rankings.length > 0 && (
              <section className="bg-white rounded-xl border border-neutral-200 p-6">
                <h2 className="text-xl font-bold text-neutral-900 mb-4">Current Season Rankings</h2>
                <div className="space-y-4">
                  {rankings.map((r) => (
                    <div key={r.competitionSlug} className="border border-neutral-100 rounded-lg p-4">
                      <Link
                        href={`/competitions/${r.competitionSlug}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        {r.competitionName}
                      </Link>
                      <div className="grid grid-cols-2 gap-4 mt-3">
                        {r.goals > 0 && (
                          <Link
                            href={`/top-scorers/${r.competitionSlug}`}
                            className="flex items-center gap-3 group"
                          >
                            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-green-600 font-bold text-sm">
                              #{r.goalsRank}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-neutral-900 group-hover:text-blue-600 transition-colors">
                                {r.goals} goals
                              </div>
                              <div className="text-xs text-neutral-500">Top Scorers</div>
                            </div>
                          </Link>
                        )}
                        {r.assists > 0 && (
                          <Link
                            href={`/top-assists/${r.competitionSlug}`}
                            className="flex items-center gap-3 group"
                          >
                            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600 font-bold text-sm">
                              #{r.assistsRank}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-neutral-900 group-hover:text-blue-600 transition-colors">
                                {r.assists} assists
                              </div>
                              <div className="text-xs text-neutral-500">Top Assists</div>
                            </div>
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Career History */}
            {career.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-neutral-900 mb-4">Career History</h2>
                <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                  <div className="divide-y divide-neutral-100">
                    {career.map((entry) => (
                      <Link
                        key={entry.id}
                        href={`/teams/${entry.team.slug}`}
                        className="flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-neutral-100 rounded-lg flex items-center justify-center">
                            {entry.team.logoUrl ? (
                              <ImageWithFallback
                                src={entry.team.logoUrl}
                                alt={entry.team.name}
                                width={32}
                                height={32}
                                className="w-8 h-8 object-contain"
                              />
                            ) : (
                              <Shield className="w-6 h-6 text-neutral-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-neutral-900">{entry.team.name}</div>
                            <div className="text-sm text-neutral-500">
                              {entry.validFrom && format(new Date(entry.validFrom), "MMM yyyy")}
                              {" → "}
                              {entry.validTo ? format(new Date(entry.validTo), "MMM yyyy") : "Present"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {entry.shirtNumber && (
                            <span className="text-sm text-neutral-500">#{entry.shirtNumber}</span>
                          )}
                          {entry.transferType && (
                            <span className="text-xs px-2 py-1 bg-neutral-100 text-neutral-600 rounded">
                              {entry.transferType}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </section>
            )}

            <BetweenContentAd />

            {/* Stats History */}
            {statsHistory.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-neutral-900 mb-4">Season Statistics</h2>
                <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-neutral-50 text-left text-sm text-neutral-500">
                        <th className="px-4 py-3 font-medium">Season</th>
                        <th className="px-4 py-3 font-medium">Team</th>
                        <th className="px-4 py-3 font-medium">Competition</th>
                        <th className="px-4 py-3 font-medium text-center">Apps</th>
                        <th className="px-4 py-3 font-medium text-center">Goals</th>
                        <th className="px-4 py-3 font-medium text-center">Assists</th>
                        <th className="px-4 py-3 font-medium text-center">Mins</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {statsHistory.map(({ stat, team, season, competition }) => (
                        <tr key={stat.id} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-neutral-900">
                            {season.label}
                          </td>
                          <td className="px-4 py-3">
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
                                <Shield className="w-5 h-5 text-neutral-300" />
                              )}
                              <span className="text-sm">{team.shortName || team.name}</span>
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm text-neutral-600">
                            <Link
                              href={`/competitions/${competition.slug}`}
                              className="hover:text-blue-600 transition-colors"
                            >
                              {competition.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-center text-neutral-600">
                            {stat.appearances}
                          </td>
                          <td className="px-4 py-3 text-center font-medium text-neutral-900">
                            {stat.goals}
                          </td>
                          <td className="px-4 py-3 text-center text-neutral-600">
                            {stat.assists}
                          </td>
                          <td className="px-4 py-3 text-center text-neutral-500 text-sm">
                            {stat.minutesPlayed.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {statsHistory.length > 0 && (
                      <tfoot className="bg-neutral-50 border-t border-neutral-200">
                        <tr className="font-medium">
                          <td className="px-4 py-3" colSpan={3}>
                            Career Total
                          </td>
                          <td className="px-4 py-3 text-center">
                            {statsHistory.reduce((sum, s) => sum + s.stat.appearances, 0)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {statsHistory.reduce((sum, s) => sum + s.stat.goals, 0)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {statsHistory.reduce((sum, s) => sum + s.stat.assists, 0)}
                          </td>
                          <td className="px-4 py-3 text-center text-sm">
                            {statsHistory.reduce((sum, s) => sum + s.stat.minutesPlayed, 0).toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </section>
            )}
            {/* Recent Match Appearances */}
            {recentMatches.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-neutral-900 mb-4">Recent Appearances</h2>
                <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                  <div className="divide-y divide-neutral-100">
                    {recentMatches.map((m) => (
                      <Link
                        key={m.match.id}
                        href={`/matches/${m.match.id}`}
                        className="flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-neutral-900">{m.homeTeam.name}</span>
                            {m.match.status === "finished" ? (
                              <span className="font-bold text-neutral-900">
                                {m.match.homeScore} - {m.match.awayScore}
                              </span>
                            ) : (
                              <span className="text-neutral-400">vs</span>
                            )}
                            <span className="font-medium text-neutral-900">{m.awayTeam.name}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500">
                            <span>{m.competition.name}</span>
                            {m.match.scheduledAt && (
                              <span>{format(new Date(m.match.scheduledAt), "MMM d, yyyy")}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-xs text-neutral-500">
                          <span className={m.lineup.isStarter ? "text-green-600 font-medium" : "text-neutral-500"}>
                            {m.lineup.isStarter ? "Starter" : "Sub"}
                          </span>
                          {m.lineup.minutesPlayed != null && (
                            <div>{m.lineup.minutesPlayed}&apos;</div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Current Team Card */}
            {currentTeam && (
              <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <h3 className="text-sm font-medium text-neutral-500 mb-4">Current Team</h3>
                <Link
                  href={`/teams/${currentTeam.slug}`}
                  className="flex items-center gap-4 group"
                >
                  <div className="w-16 h-16 bg-neutral-100 rounded-xl flex items-center justify-center group-hover:bg-neutral-200 transition-colors">
                    {currentTeam.logoUrl ? (
                      <ImageWithFallback
                        src={currentTeam.logoUrl}
                        alt={currentTeam.name}
                        width={48}
                        height={48}
                        className="w-12 h-12 object-contain"
                      />
                    ) : (
                      <Shield className="w-8 h-8 text-neutral-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-neutral-900 group-hover:text-blue-600 transition-colors">
                      {currentTeam.name}
                    </div>
                    <div className="text-sm text-neutral-500">{currentTeam.country}</div>
                  </div>
                </Link>
              </div>
            )}

            {/* Quick Facts */}
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <h3 className="text-sm font-medium text-neutral-500 mb-4">Quick Facts</h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-neutral-600">Full Name</dt>
                  <dd className="font-medium text-neutral-900">{player.name}</dd>
                </div>
                {player.nationality && (
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">Nationality</dt>
                    <dd className="font-medium text-neutral-900">{player.nationality}</dd>
                  </div>
                )}
                {player.secondNationality && (
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">2nd Nationality</dt>
                    <dd className="font-medium text-neutral-900">{player.secondNationality}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-neutral-600">Position</dt>
                  <dd className="font-medium text-neutral-900">{player.position}</dd>
                </div>
                {career.length > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">Clubs</dt>
                    <dd className="font-medium text-neutral-900">{career.length}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Related Articles */}
            <RelatedArticles playerId={player.id} limit={5} />

            <SidebarUpgradeOrAd context="player" />

            {/* Player Profile Summary */}
            <PlayerProfileSummary playerId={player.id} />

            {faqItems.length > 0 && (
              <section className="bg-white rounded-xl border border-neutral-200 p-6">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Player FAQ</h3>
                <div className="space-y-3">
                  {faqItems.map((item) => (
                    <details
                      key={item.question}
                      className="group rounded-lg border border-neutral-200 px-4 py-3"
                    >
                      <summary className="cursor-pointer list-none font-medium text-neutral-900">
                        {item.question}
                      </summary>
                      <p className="mt-3 text-sm leading-6 text-neutral-600">{item.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {/* Related Players */}
            <RelatedPlayers playerId={player.id} />

            {/* Compare CTA */}
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
              <h3 className="font-semibold text-neutral-900 mb-2">Compare Players</h3>
              <p className="text-sm text-neutral-600 mb-4">
                See how {player.name} stacks up against other players with side-by-side stats comparison.
              </p>
              <Link
                href={`/compare/players?p1=${player.slug}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                Compare
              </Link>
            </div>

            {/* Internal Links for SEO */}
            <PlayerInternalLinks
              playerId={player.id}
              playerSlug={player.slug}
              nationality={player.nationality}
              position={player.position}
            />
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
