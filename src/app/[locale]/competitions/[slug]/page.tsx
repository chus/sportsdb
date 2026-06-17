import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Trophy, Shield, Target, Calendar, TrendingUp, ChevronRight, Handshake } from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";

export const revalidate = 3600; // ISR: revalidate every hour
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { competitions } from "@/lib/db/schema";
import { localizedAlternates } from "@/lib/seo/hreflang";
import {
  getCompetitionBySlug,
  getCompetitionSeason,
  getStandings,
  getTopScorers,
  getTopAssists,
  getCompetitionRecentAndUpcoming,
} from "@/lib/queries/competitions";

// Pre-render all competitions at build time — only ~10–20 of them,
// they're hub pages with the highest traffic per page, and Googlebot's
// first request hits a cached HTML response instead of triggering ISR.
// On any DB error (missing DATABASE_URL on a preview build, etc.) fall
// back to runtime ISR so the build never breaks.
export async function generateStaticParams() {
  if (!process.env.DATABASE_URL) return [];
  try {
    const rows = await db.select({ slug: competitions.slug }).from(competitions);
    return rows.map((r) => ({ slug: r.slug }));
  } catch (err) {
    console.warn("[competitions/[slug] generateStaticParams] skipping pre-render:", err);
    return [];
  }
}
import { CompetitionJsonLd, BreadcrumbJsonLd, FAQJsonLd, ItemListJsonLd } from "@/components/seo/json-ld";
import { getCurrentSeasonLabel } from "@/lib/queries/leaderboards";
import { buildCompetitionFaqs, buildCompetitionFaqsEs, buildCompetitionAbout, buildCompetitionAboutEs } from "@/lib/seo/entity-copy";
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
  params: Promise<{ slug: string; locale: string }>;
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export async function generateMetadata({ params }: CompetitionPageProps): Promise<Metadata> {
  const { slug, locale } = await params;
  const competition = await getCompetitionBySlug(slug);

  if (!competition) {
    notFound();
  }

  const [seasonLabel, t] = await Promise.all([
    getCurrentSeasonLabel(),
    getTranslations({ locale, namespace: "meta.competition" }),
  ]);
  const title = t("titleSeasonal", { name: competition.name, season: seasonLabel });
  const description = t("description", { name: competition.name, season: seasonLabel });

  return {
    title,
    description,
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
      ...localizedAlternates(`/competitions/${slug}`),
      types: {
        "application/rss+xml": `${BASE_URL}/feed/${slug}.xml`,
      },
    },
    other: {
      ...(competition.updatedAt && { "article:modified_time": competition.updatedAt.toISOString() }),
    },
  };
}

export default async function CompetitionPage({ params }: CompetitionPageProps) {
  const { slug, locale } = await params;

  const competition = await getCompetitionBySlug(slug);

  if (!competition) {
    notFound();
  }

  let competitionSeason: Awaited<ReturnType<typeof getCompetitionSeason>> = null;
  let standingsData: Awaited<ReturnType<typeof getStandings>> = [];
  let topScorers: Awaited<ReturnType<typeof getTopScorers>> = [];
  let topAssists: Awaited<ReturnType<typeof getTopAssists>> = [];
  let matchesData: Awaited<ReturnType<typeof getCompetitionRecentAndUpcoming>> = { recent: [], upcoming: [] };

  try {
    competitionSeason = await getCompetitionSeason(slug);
    if (competitionSeason) {
      [standingsData, topScorers, topAssists, matchesData] = await Promise.all([
        getStandings(competitionSeason.competitionSeason.id),
        getTopScorers(competitionSeason.competitionSeason.id, 10),
        getTopAssists(competitionSeason.competitionSeason.id, 10),
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
  const aboutArgs = {
    name: competition.name,
    country: competition.country,
    type: competition.type,
    seasonLabel: competitionSeason?.season.label,
    teamCount: standingsData.length,
    leader,
    topScorer,
  };
  const aboutParagraphs = locale === "es"
    ? buildCompetitionAboutEs(aboutArgs)
    : buildCompetitionAbout(aboutArgs);

  const faqArgs = {
    name: competition.name,
    country: competition.country,
    teamCount: standingsData.length,
    seasonLabel: competitionSeason?.season.label,
    leader,
    topScorer,
  };
  const faqItems = locale === "es"
    ? buildCompetitionFaqsEs(faqArgs)
    : buildCompetitionFaqs(faqArgs);

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
      {standingsData.length > 0 && (
        <ItemListJsonLd
          name={`${competition.name} Standings`}
          items={standingsData.map((s, i) => ({
            position: i + 1,
            url: `${BASE_URL}/teams/${s.team.slug}`,
            name: s.team.name,
            image: s.team.logoUrl,
          }))}
        />
      )}
      <PageTracker entityType="competition" entityId={competition.id} />

      <div className="min-h-screen bg-surface-2">
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
            <div className="w-14 h-14 bg-surface rounded-xl flex items-center justify-center flex-shrink-0 p-2">
              {competition.logoUrl ? (
                <ImageWithFallback src={competition.logoUrl} alt={competition.name} width={40} height={40} className="w-10 h-10 object-contain" priority />
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
        {competition.updatedAt && (
          <p className="text-xs text-faint mt-2 max-w-7xl mx-auto px-4">
            Updated {formatDistanceToNowStrict(new Date(competition.updatedAt), { addSuffix: true })}
          </p>
        )}

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
                          className="bg-surface rounded-xl border border-line p-4 hover:shadow-md hover:border-blue-200 transition-all"
                        >
                          <div className="flex items-center gap-1.5 mb-2">
                            <Trophy className="w-3.5 h-3.5 text-amber-500" />
                            <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide">Leader</h3>
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            {standingsData[0].team.logoUrl ? (
                              <ImageWithFallback src={standingsData[0].team.logoUrl} alt={standingsData[0].team.name} width={24} height={24} className="w-6 h-6 object-contain" />
                            ) : (
                              <Shield className="w-6 h-6 text-faint" />
                            )}
                            <span className="text-sm font-bold text-ink truncate">{standingsData[0].team.shortName || standingsData[0].team.name}</span>
                          </div>
                          <p className="text-xs text-muted">{standingsData[0].standing.points} pts · {standingsData[0].standing.won}W {standingsData[0].standing.drawn}D {standingsData[0].standing.lost}L</p>
                        </Link>

                        {/* Top Scorer */}
                        {topScorers.length > 0 ? (
                          <PlayerLink
                            slug={topScorers[0].player.slug}
                            isLinkWorthy={topScorers[0].player.isIndexable ?? false}
                            className="bg-surface rounded-xl border border-line p-4 hover:shadow-md hover:border-blue-200 transition-all"
                          >
                            <div className="flex items-center gap-1.5 mb-2">
                              <Target className="w-3.5 h-3.5 text-red-500" />
                              <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide">Top Scorer</h3>
                            </div>
                            <div className="text-2xl font-black text-ink">{topScorers[0].stat.goals}</div>
                            <p className="text-xs text-muted">goals</p>
                            <p className="text-sm font-medium text-ink truncate mt-0.5">{topScorers[0].player.name}</p>
                          </PlayerLink>
                        ) : (
                          <div className="bg-surface rounded-xl border border-line p-4">
                            <div className="flex items-center gap-1.5 mb-2">
                              <Target className="w-3.5 h-3.5 text-faint" />
                              <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide">Top Scorer</h3>
                            </div>
                            <p className="text-sm text-faint">No data</p>
                          </div>
                        )}

                        {/* Matchday */}
                        <div className="bg-surface rounded-xl border border-line p-4">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Calendar className="w-3.5 h-3.5 text-blue-500" />
                            <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide">Progress</h3>
                          </div>
                          <div className="text-2xl font-black text-ink">MD {standingsData[0].standing.played}</div>
                          <p className="text-xs text-muted">{standingsData.length} teams</p>
                          <p className="text-xs text-muted mt-0.5">{competitionSeason?.season.label}</p>
                        </div>

                        {/* Top Form */}
                        {(() => {
                          const bestForm = standingsData.find(s => s.standing.form && s.standing.form.length >= 3);
                          return bestForm?.standing.form ? (
                            <div className="bg-surface rounded-xl border border-line p-4">
                              <div className="flex items-center gap-1.5 mb-2">
                                <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                                <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide">Best Form</h3>
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
                              <p className="text-xs text-muted truncate">{bestForm.team.shortName || bestForm.team.name}</p>
                            </div>
                          ) : (
                            <div className="bg-surface rounded-xl border border-line p-4">
                              <div className="flex items-center gap-1.5 mb-2">
                                <TrendingUp className="w-3.5 h-3.5 text-faint" />
                                <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide">Best Form</h3>
                              </div>
                              <p className="text-sm text-faint">No data</p>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Recent Results Strip */}
                    {matchesData.recent.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-ink">Recent Results</h3>
                          <Link href={`/competitions/${slug}?tab=fixtures`} className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-0.5">
                            All fixtures <ChevronRight className="w-3 h-3" />
                          </Link>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                          {matchesData.recent.map((match) => (
                            <Link
                              key={match.id}
                              href={`/matches/${match.slug ?? match.id}`}
                              className="flex-shrink-0 w-[160px] bg-surface rounded-lg border border-line p-3 hover:shadow-md hover:border-blue-200 transition-all"
                            >
                              <div className="flex items-center gap-1.5 mb-1.5">
                                {match.homeTeam.logoUrl ? (
                                  <ImageWithFallback src={match.homeTeam.logoUrl} alt={match.homeTeam.name} width={16} height={16} className="w-4 h-4 object-contain" />
                                ) : (
                                  <Shield className="w-4 h-4 text-faint" />
                                )}
                                <span className="text-[11px] font-medium text-ink truncate">{match.homeTeam.shortName || match.homeTeam.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5 mb-2">
                                {match.awayTeam.logoUrl ? (
                                  <ImageWithFallback src={match.awayTeam.logoUrl} alt={match.awayTeam.name} width={16} height={16} className="w-4 h-4 object-contain" />
                                ) : (
                                  <Shield className="w-4 h-4 text-faint" />
                                )}
                                <span className="text-[11px] font-medium text-ink truncate">{match.awayTeam.shortName || match.awayTeam.name}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-lg font-bold text-ink">
                                  {match.homeScore}-{match.awayScore}
                                </span>
                                {match.matchday && (
                                  <span className="text-[10px] text-faint">MD {match.matchday}</span>
                                )}
                              </div>
                              <p className="text-[10px] text-faint mt-1">{format(new Date(match.scheduledAt), "MMM d")}</p>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Upcoming Fixtures */}
                    {matchesData.upcoming.length > 0 && (
                      <div className="bg-surface rounded-xl border border-line p-5">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-ink">Upcoming Fixtures</h3>
                        </div>
                        <div className="space-y-2">
                          {matchesData.upcoming.map((match) => (
                            <Link
                              key={match.id}
                              href={`/matches/${match.slug ?? match.id}`}
                              className="flex items-center justify-between p-2.5 rounded-lg hover:bg-surface-2 transition-colors"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {match.homeTeam.logoUrl ? (
                                    <ImageWithFallback src={match.homeTeam.logoUrl} alt={match.homeTeam.name} width={20} height={20} className="w-5 h-5 object-contain flex-shrink-0" />
                                  ) : (
                                    <Shield className="w-5 h-5 text-faint flex-shrink-0" />
                                  )}
                                  <span className="text-xs font-medium text-ink truncate">{match.homeTeam.shortName || match.homeTeam.name}</span>
                                </div>
                                <span className="text-[10px] text-faint flex-shrink-0">vs</span>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {match.awayTeam.logoUrl ? (
                                    <ImageWithFallback src={match.awayTeam.logoUrl} alt={match.awayTeam.name} width={20} height={20} className="w-5 h-5 object-contain flex-shrink-0" />
                                  ) : (
                                    <Shield className="w-5 h-5 text-faint flex-shrink-0" />
                                  )}
                                  <span className="text-xs font-medium text-ink truncate">{match.awayTeam.shortName || match.awayTeam.name}</span>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0 ml-3">
                                <div className="text-xs text-muted">{format(new Date(match.scheduledAt), "MMM d, HH:mm")}</div>
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
                      <div className="bg-surface rounded-xl border border-line p-5">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-ink">Top Scorers</h3>
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
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-2 transition-colors"
                            >
                              <span className="w-6 h-6 bg-surface-2 rounded-full flex items-center justify-center text-xs font-bold text-muted">{index + 1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-ink truncate">{player.name}</div>
                                <div className="text-[11px] text-muted">{team.shortName || team.name}</div>
                              </div>
                              <div className="text-right">
                                <span className="text-lg font-black text-ink">{stat.goals}</span>
                                <span className="text-[10px] text-muted ml-1">goals</span>
                              </div>
                            </PlayerLink>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top 3 Assists Mini-list */}
                    {topAssists.length > 0 && (
                      <div className="bg-surface rounded-xl border border-line p-5">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-ink">Top Assists</h3>
                          <Link href={`/top-assists/${slug}`} className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-0.5">
                            Full list <ChevronRight className="w-3 h-3" />
                          </Link>
                        </div>
                        <div className="space-y-2">
                          {topAssists.slice(0, 3).map(({ stat, player, team }, index) => (
                            <PlayerLink
                              key={player.id}
                              slug={player.slug}
                              isLinkWorthy={player.isIndexable ?? false}
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-2 transition-colors"
                            >
                              <span className="w-6 h-6 bg-surface-2 rounded-full flex items-center justify-center text-xs font-bold text-muted">{index + 1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-ink truncate">{player.name}</div>
                                <div className="text-[11px] text-muted">{team.shortName || team.name}</div>
                              </div>
                              <div className="text-right">
                                <span className="text-lg font-black text-ink">{stat.assists}</span>
                                <span className="text-[10px] text-muted ml-1">assists</span>
                              </div>
                            </PlayerLink>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Standings Table */}
                    {standingsData.length === 0 ? (
                      <div className="bg-surface rounded-xl border border-line p-8 text-center">
                        <Trophy className="w-12 h-12 text-faint mx-auto mb-4" />
                        <p className="text-muted">No standings data available</p>
                      </div>
                    ) : (
                      <div className="bg-surface rounded-xl border border-line overflow-hidden">
                        <StandingsTable standings={standingsData} />
                      </div>
                    )}

                    {/* About (below standings) */}
                    {aboutParagraphs.length > 0 && (
                      <section className="bg-surface rounded-xl border border-line p-6">
                        <h2 className="text-lg font-bold text-ink mb-3">About {competition.name}</h2>
                        <div className="space-y-3 text-sm leading-7 text-ink">
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
                    <div className="bg-surface rounded-xl border border-line p-8 text-center">
                      <p className="text-muted">No fixture data available</p>
                    </div>
                  )}
                </TabPanel>

                {/* === TOP SCORERS TAB === */}
                <TabPanel tabId="scorers" defaultTab="standings">
                  {topScorers.length > 0 ? (
                    <div className="bg-surface rounded-xl border border-line overflow-hidden">
                      <div className="divide-y divide-line">
                        {topScorers.map(({ stat, player, team }, index) => (
                          <PlayerLink
                            key={player.id}
                            slug={player.slug}
                            isLinkWorthy={player.isIndexable ?? false}
                            className="flex items-center gap-3 p-4 hover:bg-surface-2 transition-colors group"
                          >
                            <span className="w-8 text-center text-sm font-bold text-faint">{index + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-ink group-hover:text-blue-600 transition-colors">{player.name}</div>
                              <div className="text-xs text-muted">{team.name}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-ink">{stat.goals}</div>
                              <div className="text-xs text-muted">goals</div>
                            </div>
                          </PlayerLink>
                        ))}
                      </div>
                      <div className="border-t border-line p-4">
                        <Link href={`/top-scorers/${slug}`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                          View full Top Scorers table →
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-surface rounded-xl border border-line p-8 text-center">
                      <p className="text-muted">No top scorer data available</p>
                    </div>
                  )}
                </TabPanel>

                {/* === TOP ASSISTS TAB === */}
                <TabPanel tabId="assists" defaultTab="standings">
                  {topAssists.length > 0 ? (
                    <div className="bg-surface rounded-xl border border-line overflow-hidden">
                      <div className="divide-y divide-line">
                        {topAssists.map(({ stat, player, team }, index) => (
                          <PlayerLink
                            key={player.id}
                            slug={player.slug}
                            isLinkWorthy={player.isIndexable ?? false}
                            className="flex items-center gap-3 p-4 hover:bg-surface-2 transition-colors group"
                          >
                            <span className="w-8 text-center text-sm font-bold text-faint">{index + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-ink group-hover:text-blue-600 transition-colors">{player.name}</div>
                              <div className="text-xs text-muted">{team.name}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-ink">{stat.assists}</div>
                              <div className="text-xs text-muted">assists</div>
                            </div>
                          </PlayerLink>
                        ))}
                      </div>
                      <div className="border-t border-line p-4">
                        <Link href={`/top-assists/${slug}`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                          View full Top Assists table →
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-surface rounded-xl border border-line p-8 text-center">
                      <p className="text-muted">No top assist data available</p>
                    </div>
                  )}
                </TabPanel>

                {/* === PREDICTIONS TAB === */}
                <TabPanel tabId="predictions" defaultTab="standings">
                  {competitionSeason ? (
                    <div className="bg-surface rounded-xl border border-line p-6">
                      <MatchdayCommunityPicks
                        competitionSeasonId={competitionSeason.competitionSeason.id}
                      />
                    </div>
                  ) : (
                    <div className="bg-surface rounded-xl border border-line p-8 text-center">
                      <p className="text-muted">No prediction data available</p>
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
                  <section className="bg-surface rounded-xl border border-line p-5">
                    <h3 className="text-sm font-bold text-ink mb-3">FAQ</h3>
                    <div className="space-y-2">
                      {faqItems.map((item) => (
                        <details key={item.question} className="group rounded-lg border border-line px-3 py-2">
                          <summary className="cursor-pointer list-none text-sm font-medium text-ink">{item.question}</summary>
                          <p className="mt-2 text-xs leading-5 text-muted">{item.answer}</p>
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
