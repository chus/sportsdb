import { notFound } from "next/navigation";
import Link from "next/link";
import { Trophy, Shield, Target, Calendar, TrendingUp, ChevronRight } from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";

export const revalidate = 3600; // ISR: revalidate every hour
import type { Metadata } from "next";
import {
  getCompetitionBySlug,
  getCompetitionSeason,
  getStandings,
  getTopScorers,
  getCompetitionRecentAndUpcoming,
} from "@/lib/queries/competitions";
import { CompetitionJsonLd, BreadcrumbJsonLd, FAQJsonLd } from "@/components/seo/json-ld";
import { buildCompetitionFaqs, buildCompetitionAbout } from "@/lib/seo/entity-copy";
import { FollowButton } from "@/components/follow-button";
import { TournamentRecap } from "@/components/competition/tournament-recap";
import { CompetitionFixtures } from "@/components/matches/competition-fixtures";
import { TabPanel } from "@/components/ui/tab-navigation";
import { SidebarAd } from "@/components/ads/sidebar-ad";
import { PageTracker } from "@/components/analytics/page-tracker";
import { PageHeader } from "@/components/layout/page-header";
import { StandingsTable } from "@/components/competition/standings-table";
import { CompetitionTabs } from "./competition-tabs";
import { MatchdayCommunityPicks } from "@/components/games/matchday-community-picks";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { PlayerLink } from "@/components/player/player-link";

interface CompetitionPageProps {
  params: Promise<{ slug: string }>;
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export async function generateMetadata({ params }: CompetitionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const competition = await getCompetitionBySlug(slug);

  if (!competition) {
    notFound();
  }

  // Thin page check: competition needs at least one season
  const competitionSeason = await getCompetitionSeason(slug);
  const isThin = !competitionSeason;

  const title = `${competition.name} Standings & Results 2025/26 | DataSports`;
  const description = `Full ${competition.name} 2025/26 standings, fixtures, results, and top scorers. Updated regularly.`;

  return {
    title,
    description,
    ...(isThin && { robots: { index: false, follow: true } }),
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/competitions/${slug}`,
      siteName: "DataSports",
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

  let competitionSeason: Awaited<ReturnType<typeof getCompetitionSeason>> = null;
  let standingsData: Awaited<ReturnType<typeof getStandings>> = [];
  let topScorers: Awaited<ReturnType<typeof getTopScorers>> = [];
  let matchesData: Awaited<ReturnType<typeof getCompetitionRecentAndUpcoming>> = { recent: [], upcoming: [] };

  try {
    competitionSeason = await getCompetitionSeason(slug);
    if (competitionSeason) {
      [standingsData, topScorers, matchesData] = await Promise.all([
        getStandings(competitionSeason.competitionSeason.id),
        getTopScorers(competitionSeason.competitionSeason.id, 10),
        getCompetitionRecentAndUpcoming(competitionSeason.competitionSeason.id, 6, 3),
      ]);
    }
  } catch (e) {
    console.error(`[CompetitionPage] Error loading data for ${slug}:`, e);
  }

  // Hard 404 for competitions with no season data at all
  if (!competitionSeason && standingsData.length === 0) {
    notFound();
  }

  const competitionUrl = `${BASE_URL}/competitions/${slug}`;

  const leader = standingsData.length > 0
    ? { name: standingsData[0].team.shortName || standingsData[0].team.name, points: standingsData[0].standing.points }
    : null;
  const topScorer = topScorers.length > 0
    ? { name: topScorers[0].player.name, goals: topScorers[0].stat.goals, teamName: topScorers[0].team.shortName || topScorers[0].team.name }
    : null;
  const aboutParagraphs = buildCompetitionAbout({
    name: competition.name,
    country: competition.country,
    type: competition.type,
    seasonLabel: competitionSeason?.season.label,
    teamCount: standingsData.length,
    leader,
    topScorer,
  });

  const faqItems = buildCompetitionFaqs({
    name: competition.name,
    country: competition.country,
    teamCount: standingsData.length,
    seasonLabel: competitionSeason?.season.label,
    leader,
    topScorer,
  });

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
          { name: "Competitions", url: `${BASE_URL}/competitions` },
          { name: competition.name, url: competitionUrl },
        ]}
      />
      {faqItems.length > 0 && <FAQJsonLd items={faqItems} />}
      <PageTracker entityType="competition" entityId={competition.id} />

      <div className="min-h-screen bg-neutral-50">
        {/* Compact Header */}
        <PageHeader
          title={competition.name}
          subtitle={[competition.country, competitionSeason ? `Season ${competitionSeason.season.label}` : null, `${standingsData.length} teams`].filter(Boolean).join(" · ")}
          accentColor="bg-indigo-800"
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Competitions", href: "/competitions" },
            { label: competition.name },
          ]}
          icon={
            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center flex-shrink-0 p-2">
              {competition.logoUrl ? (
                <ImageWithFallback src={competition.logoUrl} alt={competition.name} width={40} height={40} className="w-10 h-10 object-contain" />
              ) : (
                <Trophy className="w-7 h-7 text-indigo-300" />
              )}
            </div>
          }
          stats={standingsData.length > 0 ? [
            { label: "Teams", value: standingsData.length },
            ...(leader ? [{ label: "Leader", value: `${leader.name}` }] : []),
            ...(topScorer ? [{ label: "Top Scorer", value: `${topScorer.name} (${topScorer.goals})` }] : []),
          ] : undefined}
          actions={
            <FollowButton entityType="competition" entityId={competition.id} entityName={competition.name} variant="hero" />
          }
        />

        {/* Tabs */}
        <CompetitionTabs teamCount={standingsData.length}>
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                {/* === STANDINGS TAB === */}
                <TabPanel tabId="standings" defaultTab="standings">
                  <div className="space-y-6">
                    {/* Data Dashboard — 4 cards */}
                    {standingsData.length > 0 && (
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Leader */}
                        <Link
                          href={`/teams/${standingsData[0].team.slug}`}
                          className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md hover:border-blue-200 transition-all"
                        >
                          <div className="flex items-center gap-1.5 mb-2">
                            <Trophy className="w-3.5 h-3.5 text-amber-500" />
                            <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Leader</h3>
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            {standingsData[0].team.logoUrl ? (
                              <ImageWithFallback src={standingsData[0].team.logoUrl} alt={standingsData[0].team.name} width={24} height={24} className="w-6 h-6 object-contain" />
                            ) : (
                              <Shield className="w-6 h-6 text-neutral-300" />
                            )}
                            <span className="text-sm font-bold text-neutral-900 truncate">{standingsData[0].team.shortName || standingsData[0].team.name}</span>
                          </div>
                          <p className="text-xs text-neutral-500">{standingsData[0].standing.points} pts · {standingsData[0].standing.won}W {standingsData[0].standing.drawn}D {standingsData[0].standing.lost}L</p>
                        </Link>

                        {/* Top Scorer */}
                        {topScorers.length > 0 ? (
                          <PlayerLink
                            slug={topScorers[0].player.slug}
                            isLinkWorthy={topScorers[0].player.isIndexable ?? false}
                            className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md hover:border-blue-200 transition-all"
                          >
                            <div className="flex items-center gap-1.5 mb-2">
                              <Target className="w-3.5 h-3.5 text-red-500" />
                              <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Top Scorer</h3>
                            </div>
                            <div className="text-2xl font-black text-neutral-900">{topScorers[0].stat.goals}</div>
                            <p className="text-xs text-neutral-500">goals</p>
                            <p className="text-sm font-medium text-neutral-900 truncate mt-0.5">{topScorers[0].player.name}</p>
                          </PlayerLink>
                        ) : (
                          <div className="bg-white rounded-xl border border-neutral-200 p-4">
                            <div className="flex items-center gap-1.5 mb-2">
                              <Target className="w-3.5 h-3.5 text-neutral-400" />
                              <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Top Scorer</h3>
                            </div>
                            <p className="text-sm text-neutral-400">No data</p>
                          </div>
                        )}

                        {/* Matchday */}
                        <div className="bg-white rounded-xl border border-neutral-200 p-4">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Calendar className="w-3.5 h-3.5 text-blue-500" />
                            <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Progress</h3>
                          </div>
                          <div className="text-2xl font-black text-neutral-900">MD {standingsData[0].standing.played}</div>
                          <p className="text-xs text-neutral-500">{standingsData.length} teams</p>
                          <p className="text-xs text-neutral-500 mt-0.5">{competitionSeason?.season.label}</p>
                        </div>

                        {/* Top Form */}
                        {(() => {
                          const bestForm = standingsData.find(s => s.standing.form && s.standing.form.length >= 3);
                          return bestForm?.standing.form ? (
                            <div className="bg-white rounded-xl border border-neutral-200 p-4">
                              <div className="flex items-center gap-1.5 mb-2">
                                <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                                <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Best Form</h3>
                              </div>
                              <div className="flex gap-1.5 mt-1 mb-1.5">
                                {bestForm.standing.form.split("").slice(-5).map((result, i) => (
                                  <span
                                    key={i}
                                    className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white ${
                                      result === "W" ? "bg-green-500" : result === "D" ? "bg-neutral-400" : "bg-red-500"
                                    }`}
                                  >
                                    {result}
                                  </span>
                                ))}
                              </div>
                              <p className="text-xs text-neutral-500 truncate">{bestForm.team.shortName || bestForm.team.name}</p>
                            </div>
                          ) : (
                            <div className="bg-white rounded-xl border border-neutral-200 p-4">
                              <div className="flex items-center gap-1.5 mb-2">
                                <TrendingUp className="w-3.5 h-3.5 text-neutral-400" />
                                <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Best Form</h3>
                              </div>
                              <p className="text-sm text-neutral-400">No data</p>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Recent Results Strip */}
                    {matchesData.recent.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-neutral-900">Recent Results</h3>
                          <Link href={`/competitions/${slug}?tab=fixtures`} className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-0.5">
                            All fixtures <ChevronRight className="w-3 h-3" />
                          </Link>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                          {matchesData.recent.map((match) => (
                            <Link
                              key={match.id}
                              href={`/matches/${match.slug ?? match.id}`}
                              className="flex-shrink-0 w-[160px] bg-white rounded-lg border border-neutral-200 p-3 hover:shadow-md hover:border-blue-200 transition-all"
                            >
                              <div className="flex items-center gap-1.5 mb-1.5">
                                {match.homeTeam.logoUrl ? (
                                  <img src={match.homeTeam.logoUrl} alt={match.homeTeam.name} className="w-4 h-4 object-contain" />
                                ) : (
                                  <Shield className="w-4 h-4 text-neutral-300" />
                                )}
                                <span className="text-[11px] font-medium text-neutral-700 truncate">{match.homeTeam.shortName || match.homeTeam.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5 mb-2">
                                {match.awayTeam.logoUrl ? (
                                  <img src={match.awayTeam.logoUrl} alt={match.awayTeam.name} className="w-4 h-4 object-contain" />
                                ) : (
                                  <Shield className="w-4 h-4 text-neutral-300" />
                                )}
                                <span className="text-[11px] font-medium text-neutral-700 truncate">{match.awayTeam.shortName || match.awayTeam.name}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-lg font-bold text-neutral-900">
                                  {match.homeScore}-{match.awayScore}
                                </span>
                                {match.matchday && (
                                  <span className="text-[10px] text-neutral-400">MD {match.matchday}</span>
                                )}
                              </div>
                              <p className="text-[10px] text-neutral-400 mt-1">{format(new Date(match.scheduledAt), "MMM d")}</p>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Upcoming Fixtures */}
                    {matchesData.upcoming.length > 0 && (
                      <div className="bg-white rounded-xl border border-neutral-200 p-5">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-neutral-900">Upcoming Fixtures</h3>
                        </div>
                        <div className="space-y-2">
                          {matchesData.upcoming.map((match) => (
                            <Link
                              key={match.id}
                              href={`/matches/${match.slug ?? match.id}`}
                              className="flex items-center justify-between p-2.5 rounded-lg hover:bg-neutral-50 transition-colors"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {match.homeTeam.logoUrl ? (
                                    <img src={match.homeTeam.logoUrl} alt={match.homeTeam.name} className="w-5 h-5 object-contain flex-shrink-0" />
                                  ) : (
                                    <Shield className="w-5 h-5 text-neutral-300 flex-shrink-0" />
                                  )}
                                  <span className="text-xs font-medium text-neutral-900 truncate">{match.homeTeam.shortName || match.homeTeam.name}</span>
                                </div>
                                <span className="text-[10px] text-neutral-400 flex-shrink-0">vs</span>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {match.awayTeam.logoUrl ? (
                                    <img src={match.awayTeam.logoUrl} alt={match.awayTeam.name} className="w-5 h-5 object-contain flex-shrink-0" />
                                  ) : (
                                    <Shield className="w-5 h-5 text-neutral-300 flex-shrink-0" />
                                  )}
                                  <span className="text-xs font-medium text-neutral-900 truncate">{match.awayTeam.shortName || match.awayTeam.name}</span>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0 ml-3">
                                <div className="text-xs text-neutral-500">{format(new Date(match.scheduledAt), "MMM d, HH:mm")}</div>
                                <div className="text-[10px] font-medium text-blue-600">
                                  {formatDistanceToNowStrict(new Date(match.scheduledAt), { addSuffix: true })}
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top 3 Scorers Mini-list */}
                    {topScorers.length > 0 && (
                      <div className="bg-white rounded-xl border border-neutral-200 p-5">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-neutral-900">Top Scorers</h3>
                          <Link href={`/top-scorers/${slug}`} className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-0.5">
                            Full list <ChevronRight className="w-3 h-3" />
                          </Link>
                        </div>
                        <div className="space-y-2">
                          {topScorers.slice(0, 3).map(({ stat, player, team }, index) => (
                            <PlayerLink
                              key={player.id}
                              slug={player.slug}
                              isLinkWorthy={player.isIndexable ?? false}
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 transition-colors"
                            >
                              <span className="w-6 h-6 bg-neutral-100 rounded-full flex items-center justify-center text-xs font-bold text-neutral-500">{index + 1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-neutral-900 truncate">{player.name}</div>
                                <div className="text-[11px] text-neutral-500">{team.shortName || team.name}</div>
                              </div>
                              <div className="text-right">
                                <span className="text-lg font-black text-neutral-900">{stat.goals}</span>
                                <span className="text-[10px] text-neutral-500 ml-1">goals</span>
                              </div>
                            </PlayerLink>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Standings Table */}
                    {standingsData.length === 0 ? (
                      <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
                        <Trophy className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                        <p className="text-neutral-500">No standings data available</p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                        <StandingsTable standings={standingsData} />
                      </div>
                    )}

                    {/* About (below standings) */}
                    {aboutParagraphs.length > 0 && (
                      <section className="bg-white rounded-xl border border-neutral-200 p-6">
                        <h2 className="text-lg font-bold text-neutral-900 mb-3">About {competition.name}</h2>
                        <div className="space-y-3 text-sm leading-7 text-neutral-700">
                          {aboutParagraphs.map((p, i) => (
                            <p key={i}>{p}</p>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                </TabPanel>

                {/* === FIXTURES TAB === */}
                <TabPanel tabId="fixtures" defaultTab="standings">
                  {competitionSeason ? (
                    <CompetitionFixtures
                      competitionSeasonId={competitionSeason.competitionSeason.id}
                      limit={50}
                    />
                  ) : (
                    <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
                      <p className="text-neutral-500">No fixture data available</p>
                    </div>
                  )}
                </TabPanel>

                {/* === TOP SCORERS TAB === */}
                <TabPanel tabId="scorers" defaultTab="standings">
                  {topScorers.length > 0 ? (
                    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                      <div className="divide-y divide-neutral-100">
                        {topScorers.map(({ stat, player, team }, index) => (
                          <PlayerLink
                            key={player.id}
                            slug={player.slug}
                            isLinkWorthy={player.isIndexable ?? false}
                            className="flex items-center gap-3 p-4 hover:bg-neutral-50 transition-colors group"
                          >
                            <span className="w-8 text-center text-sm font-bold text-neutral-400">{index + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-neutral-900 group-hover:text-blue-600 transition-colors">{player.name}</div>
                              <div className="text-xs text-neutral-500">{team.name}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-neutral-900">{stat.goals}</div>
                              <div className="text-xs text-neutral-500">goals</div>
                            </div>
                          </PlayerLink>
                        ))}
                      </div>
                      <div className="border-t border-neutral-200 p-4">
                        <Link href={`/top-scorers/${slug}`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                          View full Top Scorers table →
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
                      <p className="text-neutral-500">No top scorer data available</p>
                    </div>
                  )}
                </TabPanel>

                {/* === PREDICTIONS TAB === */}
                <TabPanel tabId="predictions" defaultTab="standings">
                  {competitionSeason ? (
                    <div className="bg-white rounded-xl border border-neutral-200 p-6">
                      <MatchdayCommunityPicks
                        competitionSeasonId={competitionSeason.competitionSeason.id}
                      />
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
                      <p className="text-neutral-500">No prediction data available</p>
                    </div>
                  )}
                </TabPanel>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {competitionSeason && (
                  <TournamentRecap competitionSeasonId={competitionSeason.competitionSeason.id} />
                )}

                {faqItems.length > 0 && (
                  <section className="bg-white rounded-xl border border-neutral-200 p-5">
                    <h3 className="text-sm font-bold text-neutral-900 mb-3">FAQ</h3>
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

                <SidebarAd />
              </div>
            </div>
          </div>
        </CompetitionTabs>
      </div>
    </>
  );
}
