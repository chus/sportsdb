import { notFound } from "next/navigation";
import Link from "next/link";
import {
  User, Calendar, Ruler, Flag,
  Footprints, Shield, BarChart3
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
import { ProTeaserWithModal } from "@/components/subscription/pro-teaser-with-modal";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { buildPlayerAbout, buildPlayerFaqs } from "@/lib/seo/entity-copy";
import { scorePlayerPage } from "@/lib/seo/page-quality";
import { PageTracker } from "@/components/analytics/page-tracker";
import { PageHeader } from "@/components/layout/page-header";
import { TabPanel } from "@/components/ui/tab-navigation";
import { PlayerTabs } from "./player-tabs";
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
      {/* Compact Header */}
      <PageHeader
        title={player.name}
        subtitle={[
          player.nationality,
          age ? `${age} years` : null,
          player.heightCm ? `${player.heightCm}cm` : null,
          player.preferredFoot ? `${player.preferredFoot} foot` : null,
        ].filter(Boolean).join(" · ")}
        accentColor="bg-blue-700"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Players", href: "/search?type=player" },
          ...(currentTeam ? [{ label: currentTeam.name, href: `/teams/${currentTeam.slug}` }] : []),
          { label: player.name },
        ]}
        icon={
          <div className="relative w-20 h-20 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
            {player.imageUrl ? (
              <ImageWithFallback
                src={player.imageUrl}
                alt={player.name}
                fill
                sizes="80px"
                className="object-cover"
              />
            ) : (
              <User className="w-10 h-10 text-white/60" />
            )}
          </div>
        }
        badges={
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">
              {player.position}
            </span>
            {currentTeam && (
              <Link
                href={`/teams/${currentTeam.slug}`}
                className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium hover:bg-white/30 transition-colors flex items-center gap-1"
              >
                <Shield className="w-3 h-3" />
                {currentTeam.shortName || currentTeam.name}
              </Link>
            )}
            {shirtNumber && (
              <span className="px-2.5 py-1 bg-white/20 rounded-full text-xs font-bold">
                #{shirtNumber}
              </span>
            )}
          </div>
        }
        stats={totalApps > 0 ? [
          { label: "Apps", value: totalApps },
          { label: "Goals", value: totalGoals },
          { label: "Assists", value: totalAssists },
        ] : undefined}
        actions={
          <FollowButton entityType="player" entityId={player.id} entityName={player.name} variant="hero" />
        }
      />

      {/* Tab navigation + content */}
      <PlayerTabs
        statsCount={statsHistory.length}
        careerCount={career.length}
        matchCount={recentMatches.length}
      >
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-8">

                {/* === OVERVIEW TAB === */}
                <TabPanel tabId="overview" defaultTab="overview">
                  <>
                    {/* About */}
                    <section className="bg-white rounded-xl border border-neutral-200 p-6">
                      <h2 className="text-lg font-bold text-neutral-900 mb-3">About {player.name}</h2>
                      <div className="space-y-3 text-sm leading-7 text-neutral-700">
                        {aboutParagraphs.map((paragraph, i) => (
                          <p key={i}>{renderBioWithLinks(paragraph)}</p>
                        ))}
                      </div>
                    </section>

                    {/* Career Overview */}
                    {statsHistory.length > 0 && (
                      <section className="bg-white rounded-xl border border-neutral-200 p-6">
                        <h2 className="text-lg font-bold text-neutral-900 mb-4">Career Overview</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center p-3 bg-neutral-50 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">{totalApps}</div>
                            <div className="text-xs text-neutral-500 mt-1">Appearances</div>
                          </div>
                          <div className="text-center p-3 bg-neutral-50 rounded-lg">
                            <div className="text-2xl font-bold text-green-600">{totalGoals}</div>
                            <div className="text-xs text-neutral-500 mt-1">Goals</div>
                          </div>
                          <div className="text-center p-3 bg-neutral-50 rounded-lg">
                            <div className="text-2xl font-bold text-purple-600">{totalAssists}</div>
                            <div className="text-xs text-neutral-500 mt-1">Assists</div>
                          </div>
                          <div className="text-center p-3 bg-neutral-50 rounded-lg">
                            <div className="text-2xl font-bold text-orange-500">{totalMins.toLocaleString()}</div>
                            <div className="text-xs text-neutral-500 mt-1">Minutes</div>
                          </div>
                        </div>
                      </section>
                    )}

                    {/* Rankings */}
                    {rankings.length > 0 && (
                      <section className="bg-white rounded-xl border border-neutral-200 p-6">
                        <h2 className="text-lg font-bold text-neutral-900 mb-4">Current Season Rankings</h2>
                        <div className="space-y-3">
                          {rankings.map((r) => (
                            <div key={r.competitionSlug} className="border border-neutral-100 rounded-lg p-3">
                              <Link href={`/competitions/${r.competitionSlug}`} className="text-sm font-medium text-blue-600 hover:underline">
                                {r.competitionName}
                              </Link>
                              <div className="grid grid-cols-2 gap-3 mt-2">
                                {r.goals > 0 && (
                                  <Link href={`/top-scorers/${r.competitionSlug}`} className="flex items-center gap-2 group">
                                    <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center text-green-600 font-bold text-xs">#{r.goalsRank}</div>
                                    <div><div className="text-sm font-medium group-hover:text-blue-600">{r.goals} goals</div><div className="text-xs text-neutral-500">Top Scorers</div></div>
                                  </Link>
                                )}
                                {r.assists > 0 && (
                                  <Link href={`/top-assists/${r.competitionSlug}`} className="flex items-center gap-2 group">
                                    <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600 font-bold text-xs">#{r.assistsRank}</div>
                                    <div><div className="text-sm font-medium group-hover:text-blue-600">{r.assists} assists</div><div className="text-xs text-neutral-500">Top Assists</div></div>
                                  </Link>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Current Team */}
                    {currentTeam && (
                      <Link
                        href={`/teams/${currentTeam.slug}`}
                        className="flex items-center gap-4 bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md transition-shadow group"
                      >
                        <div className="w-14 h-14 bg-neutral-100 rounded-lg flex items-center justify-center">
                          {currentTeam.logoUrl ? (
                            <ImageWithFallback src={currentTeam.logoUrl} alt={currentTeam.name} width={40} height={40} className="w-10 h-10 object-contain" />
                          ) : (
                            <Shield className="w-7 h-7 text-neutral-400" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-neutral-900 group-hover:text-blue-600 transition-colors">{currentTeam.name}</div>
                          <div className="text-sm text-neutral-500">{currentTeam.country}</div>
                        </div>
                      </Link>
                    )}
                  </>
                </TabPanel>

                {/* === STATS TAB === */}
                <TabPanel tabId="stats" defaultTab="overview">
                  <>
                    {statsHistory.length > 0 ? (
                      <section>
                        <h2 className="text-lg font-bold text-neutral-900 mb-4">Season Statistics</h2>
                        <ProTeaserWithModal feature="historical_data" label="Unlock Full History">
                        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-neutral-50 text-left text-xs text-neutral-500 uppercase">
                                <th className="px-3 py-2.5 font-medium">Season</th>
                                <th className="px-3 py-2.5 font-medium">Team</th>
                                <th className="px-3 py-2.5 font-medium hidden sm:table-cell">Competition</th>
                                <th className="px-3 py-2.5 font-medium text-center">Apps</th>
                                <th className="px-3 py-2.5 font-medium text-center">Goals</th>
                                <th className="px-3 py-2.5 font-medium text-center">Assists</th>
                                <th className="px-3 py-2.5 font-medium text-center hidden sm:table-cell">Mins</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                              {statsHistory.map(({ stat, team, season, competition }) => (
                                <tr key={stat.id} className="hover:bg-neutral-50">
                                  <td className="px-3 py-2.5 font-medium text-neutral-900">{season.label}</td>
                                  <td className="px-3 py-2.5">
                                    <Link href={`/teams/${team.slug}`} className="flex items-center gap-2 hover:text-blue-600">
                                      {team.logoUrl ? <ImageWithFallback src={team.logoUrl} alt={team.name} width={18} height={18} className="w-[18px] h-[18px] object-contain" /> : <Shield className="w-4 h-4 text-neutral-300" />}
                                      <span className="hidden md:inline">{team.name}</span>
                                      <span className="md:hidden">{team.shortName || team.name}</span>
                                    </Link>
                                  </td>
                                  <td className="px-3 py-2.5 text-neutral-600 hidden sm:table-cell">
                                    <Link href={`/competitions/${competition.slug}`} className="hover:text-blue-600">{competition.name}</Link>
                                  </td>
                                  <td className="px-3 py-2.5 text-center text-neutral-600">{stat.appearances}</td>
                                  <td className="px-3 py-2.5 text-center font-medium text-neutral-900">{stat.goals}</td>
                                  <td className="px-3 py-2.5 text-center text-neutral-600">{stat.assists}</td>
                                  <td className="px-3 py-2.5 text-center text-neutral-500 hidden sm:table-cell">{stat.minutesPlayed.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-neutral-50 border-t border-neutral-200 font-medium">
                              <tr>
                                <td className="px-3 py-2.5" colSpan={2}>Career Total</td>
                                <td className="px-3 py-2.5 hidden sm:table-cell" />
                                <td className="px-3 py-2.5 text-center">{totalApps}</td>
                                <td className="px-3 py-2.5 text-center">{totalGoals}</td>
                                <td className="px-3 py-2.5 text-center">{totalAssists}</td>
                                <td className="px-3 py-2.5 text-center hidden sm:table-cell">{totalMins.toLocaleString()}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                        </ProTeaserWithModal>
                      </section>
                    ) : (
                      <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
                        <p className="text-neutral-500">No season statistics available yet.</p>
                      </div>
                    )}
                  </>
                </TabPanel>

                {/* === CAREER TAB === */}
                <TabPanel tabId="career" defaultTab="overview">
                  <>
                    {career.length > 0 ? (
                      <section>
                        <h2 className="text-lg font-bold text-neutral-900 mb-4">Career History</h2>
                        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden divide-y divide-neutral-100">
                          {career.map((entry) => (
                            <Link
                              key={entry.id}
                              href={`/teams/${entry.team.slug}`}
                              className="flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center">
                                  {entry.team.logoUrl ? (
                                    <ImageWithFallback src={entry.team.logoUrl} alt={entry.team.name} width={28} height={28} className="w-7 h-7 object-contain" />
                                  ) : (
                                    <Shield className="w-5 h-5 text-neutral-400" />
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium text-neutral-900 text-sm">{entry.team.name}</div>
                                  <div className="text-xs text-neutral-500">
                                    {entry.validFrom && format(new Date(entry.validFrom), "MMM yyyy")} → {entry.validTo ? format(new Date(entry.validTo), "MMM yyyy") : "Present"}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {entry.shirtNumber && <span className="text-xs text-neutral-500">#{entry.shirtNumber}</span>}
                                {entry.transferType && <span className="text-xs px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded">{entry.transferType}</span>}
                              </div>
                            </Link>
                          ))}
                        </div>
                      </section>
                    ) : (
                      <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
                        <p className="text-neutral-500">No career history available.</p>
                      </div>
                    )}
                  </>
                </TabPanel>

                {/* === NEWS TAB === */}
                <TabPanel tabId="news" defaultTab="overview">
                  <>
                    <RelatedArticles playerId={player.id} limit={10} />

                    {recentMatches.length > 0 && (
                      <section>
                        <h2 className="text-lg font-bold text-neutral-900 mb-4">Recent Appearances</h2>
                        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden divide-y divide-neutral-100">
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
                                    <span className="font-bold text-neutral-900">{m.match.homeScore} - {m.match.awayScore}</span>
                                  ) : (
                                    <span className="text-neutral-400">vs</span>
                                  )}
                                  <span className="font-medium text-neutral-900">{m.awayTeam.name}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500">
                                  <span>{m.competition.name}</span>
                                  {m.match.scheduledAt && <span>{format(new Date(m.match.scheduledAt), "MMM d, yyyy")}</span>}
                                </div>
                              </div>
                              <div className="text-right text-xs text-neutral-500">
                                <span className={m.lineup.isStarter ? "text-green-600 font-medium" : ""}>
                                  {m.lineup.isStarter ? "Starter" : "Sub"}
                                </span>
                                {m.lineup.minutesPlayed != null && <div>{m.lineup.minutesPlayed}&apos;</div>}
                              </div>
                            </Link>
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                </TabPanel>

                <BetweenContentAd />
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Quick Facts */}
                <div className="bg-white rounded-xl border border-neutral-200 p-5">
                  <h3 className="text-sm font-bold text-neutral-900 mb-3">Quick Facts</h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-neutral-500">Full Name</dt>
                      <dd className="font-medium text-neutral-900">{player.name}</dd>
                    </div>
                    {player.nationality && (
                      <div className="flex justify-between">
                        <dt className="text-neutral-500">Nationality</dt>
                        <dd className="font-medium text-neutral-900">{player.nationality}</dd>
                      </div>
                    )}
                    {player.secondNationality && (
                      <div className="flex justify-between">
                        <dt className="text-neutral-500">2nd Nationality</dt>
                        <dd className="font-medium text-neutral-900">{player.secondNationality}</dd>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <dt className="text-neutral-500">Position</dt>
                      <dd className="font-medium text-neutral-900">{player.position}</dd>
                    </div>
                    {player.dateOfBirth && (
                      <div className="flex justify-between">
                        <dt className="text-neutral-500">Date of Birth</dt>
                        <dd className="font-medium text-neutral-900">{format(new Date(player.dateOfBirth), "MMM d, yyyy")}</dd>
                      </div>
                    )}
                    {career.length > 0 && (
                      <div className="flex justify-between">
                        <dt className="text-neutral-500">Clubs</dt>
                        <dd className="font-medium text-neutral-900">{career.length}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                <SidebarUpgradeOrAd context="player" />

                <PlayerProfileSummary playerId={player.id} />

                {faqItems.length > 0 && (
                  <section className="bg-white rounded-xl border border-neutral-200 p-5">
                    <h3 className="text-sm font-bold text-neutral-900 mb-3">Player FAQ</h3>
                    <div className="space-y-2">
                      {faqItems.map((item) => (
                        <details key={item.question} className="group rounded-lg border border-neutral-200 px-3 py-2">
                          <summary className="cursor-pointer list-none text-sm font-medium text-neutral-900">{item.question}</summary>
                          <p className="mt-2 text-xs leading-5 text-neutral-600">{item.answer}</p>
                        </details>
                      ))}
                    </div>
                  </section>
                )}

                <RelatedPlayers playerId={player.id} />

                {/* Compare CTA */}
                <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
                  <h3 className="font-semibold text-neutral-900 text-sm mb-2">Compare Players</h3>
                  <p className="text-xs text-neutral-600 mb-3">
                    See how {player.name} stacks up against other players.
                  </p>
                  <Link
                    href={`/compare/players?p1=${player.slug}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    Compare
                  </Link>
                </div>

                <PlayerInternalLinks
                  playerId={player.id}
                  playerSlug={player.slug}
                  nationality={player.nationality}
                  position={player.position}
                />
              </div>
            </div>
          </div>
      </PlayerTabs>
    </div>
    </>
  );
}
