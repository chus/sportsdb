import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  User, Calendar, Shield, BarChart3,
  Trophy, Target, TrendingUp, ChevronRight, ArrowRightLeft
} from "lucide-react";
import type { Metadata } from "next";
import { getPlayerBySlug, getPlayerCurrentTeam, getPlayerCareer, getPlayerStatsHistory, getPlayerRankings, getPlayerRecentMatches, getPlayerQuality, getPlayerTransfers } from "@/lib/queries/players";
import { getCurrentSeasonLabel } from "@/lib/queries/leaderboards";
import { getTeamMatches } from "@/lib/queries/matches";
import { format, differenceInYears, formatDistanceToNowStrict } from "date-fns";
import { PlayerJsonLd, BreadcrumbJsonLd, FAQJsonLd } from "@/components/seo/json-ld";
import { FollowButton } from "@/components/follow-button";
import { RelatedPlayers } from "@/components/entity/related-entities";
import { PlayerProfileSummary } from "@/components/player/player-profile-summary";
import { PlayerInternalLinks } from "@/components/seo/internal-links";
import { ExternalLinks } from "@/components/entity/external-links";
import { RelatedArticles } from "@/components/articles/related-articles";
import { BetweenContentAd } from "@/components/ads/between-content-ad";
import { SidebarUpgradeOrAd } from "@/components/subscription/sidebar-upgrade-or-ad";
import { ProTeaserWithModal } from "@/components/subscription/pro-teaser-with-modal";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { buildPlayerAbout, buildPlayerFaqs } from "@/lib/seo/entity-copy";
import { PageTracker } from "@/components/analytics/page-tracker";
import { PageHeader } from "@/components/layout/page-header";
import { TabPanel } from "@/components/ui/tab-navigation";
import { PlayerTabs } from "./player-tabs";

export const revalidate = 3600; // ISR: revalidate every hour

interface PlayerPageProps {
  params: Promise<{ slug: string }>;
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

function formatMarketValue(valueEur: number): string {
  if (valueEur >= 1_000_000) {
    const millions = valueEur / 1_000_000;
    return `€${millions >= 10 ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }
  if (valueEur >= 1_000) return `€${(valueEur / 1_000).toFixed(0)}K`;
  return `€${valueEur.toLocaleString()}`;
}

export async function generateMetadata({ params }: PlayerPageProps): Promise<Metadata> {
  const { slug } = await params;
  const player = await getPlayerBySlug(slug);

  if (!player || player.position === "Unknown") {
    return {
      title: "Player Not Found | DataSports",
      robots: { index: false, follow: false },
    };
  }

  const quality = await getPlayerQuality(player);

  if (quality.shouldReturn404) {
    return {
      title: "Player Not Found | DataSports",
      robots: { index: false, follow: false },
    };
  }

  const [currentTeamData, statsHistory] = await Promise.all([
    getPlayerCurrentTeam(player.id),
    getPlayerStatsHistory(player.id),
  ]);
  const isThin = quality.isThin;

  const currentTeam = currentTeamData?.team;
  const totalGoals = statsHistory.reduce((sum, s) => sum + s.stat.goals, 0);
  const totalAssists = statsHistory.reduce((sum, s) => sum + s.stat.assists, 0);
  const totalApps = statsHistory.reduce((sum, s) => sum + s.stat.appearances, 0);

  const seasonLabel = await getCurrentSeasonLabel();
  const title = `${player.name} – Stats, Goals & Career History ${seasonLabel} | DataSports`;

  // Build data-rich description
  const statsParts: string[] = [];
  if (totalGoals > 0) statsParts.push(`${totalGoals} goals`);
  if (totalAssists > 0) statsParts.push(`${totalAssists} assists`);
  if (totalApps > 0) statsParts.push(`in ${totalApps} appearances`);

  const statsStr = statsParts.length > 0 ? statsParts.join(" and ") : "";
  const teamStr = currentTeam ? ` for ${currentTeam.name}` : "";
  const mvStr = player.marketValueEur ? ` Valued at ${formatMarketValue(player.marketValueEur)}.` : "";
  const description = statsStr
    ? `${player.name} has ${statsStr}${teamStr}.${mvStr} Full career history, season stats, and player profile.`
    : `${player.name} is a ${player.position}${player.nationality ? ` from ${player.nationality}` : ""}.${mvStr} View career history, teams, and stats on DataSports.`;

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


export default async function PlayerPage({ params }: PlayerPageProps) {
  const { slug } = await params;

  const player = await getPlayerBySlug(slug);

  if (!player || player.position === "Unknown") {
    notFound();
  }

  const quality = await getPlayerQuality(player);
  if (quality.shouldReturn404) {
    notFound();
  }

  const [currentTeamData, career, statsHistory, rankings, recentMatches, transferHistory] = await Promise.all([
    getPlayerCurrentTeam(player.id),
    getPlayerCareer(player.id),
    getPlayerStatsHistory(player.id),
    getPlayerRankings(player.id),
    getPlayerRecentMatches(player.id, 5),
    getPlayerTransfers(player.id),
  ]);

  const currentTeam = currentTeamData?.team;
  const shirtNumber = currentTeamData?.shirtNumber;

  // Fetch upcoming match for player's team
  const teamMatchesData = currentTeam
    ? await getTeamMatches(currentTeam.id, 1)
    : { recent: [], upcoming: [] };
  const nextMatch = teamMatchesData.upcoming[0] ?? null;

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
    marketValueEur: player.marketValueEur,
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
    marketValueEur: player.marketValueEur,
  });

  // Build breadcrumb items
  const breadcrumbItems = [
    { name: "Home", url: BASE_URL },
    { name: "Players", url: `${BASE_URL}/players` },
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
        birthPlace={player.placeOfBirth}
        height={player.heightCm}
        position={player.position}
        team={currentTeam && teamUrl ? { name: currentTeam.name, url: teamUrl } : null}
        competition={rankings[0] ? { name: rankings[0].competitionName, url: `${BASE_URL}/competitions/${rankings[0].competitionSlug}` } : null}
        sameAs={[
          player.wikipediaUrl,
          player.websiteUrl,
          player.instagramHandle && `https://instagram.com/${player.instagramHandle}`,
          player.twitterHandle && `https://x.com/${player.twitterHandle}`,
        ].filter(Boolean) as string[]}
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
          { label: "Players", href: "/players" },
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
            {player.marketValueEur && (
              <span className="px-3 py-1 bg-emerald-500/30 rounded-full text-xs font-bold">
                {formatMarketValue(player.marketValueEur)}
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
                    {/* Data Dashboard — 4 cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Current Season */}
                      {currentSeasonStats ? (
                        <div className="bg-white rounded-xl border border-neutral-200 p-4">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Target className="w-3.5 h-3.5 text-green-500" />
                            <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">This Season</h3>
                          </div>
                          <div className="text-2xl font-black text-neutral-900">{currentSeasonStats.goals}</div>
                          <p className="text-xs text-neutral-500">goals · {currentSeasonStats.assists} assists</p>
                          <p className="text-xs text-neutral-500 mt-0.5">{currentSeasonStats.appearances} apps</p>
                        </div>
                      ) : (
                        <div className="bg-white rounded-xl border border-neutral-200 p-4">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Target className="w-3.5 h-3.5 text-neutral-400" />
                            <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">This Season</h3>
                          </div>
                          <p className="text-sm text-neutral-400">No data</p>
                        </div>
                      )}

                      {/* Rankings */}
                      {rankings.length > 0 ? (
                        <Link
                          href={`/top-scorers/${rankings[0].competitionSlug}`}
                          className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md hover:border-blue-200 transition-all"
                        >
                          <div className="flex items-center gap-1.5 mb-2">
                            <Trophy className="w-3.5 h-3.5 text-amber-500" />
                            <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Ranking</h3>
                          </div>
                          <div className="flex items-baseline gap-2">
                            {rankings[0].goals > 0 && (
                              <div>
                                <span className="text-2xl font-black text-neutral-900">#{rankings[0].goalsRank}</span>
                                <p className="text-xs text-neutral-500">goals</p>
                              </div>
                            )}
                            {rankings[0].assists > 0 && (
                              <div>
                                <span className="text-2xl font-black text-neutral-900">#{rankings[0].assistsRank}</span>
                                <p className="text-xs text-neutral-500">assists</p>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-neutral-500 truncate mt-0.5">{rankings[0].competitionName}</p>
                        </Link>
                      ) : null}

                      {/* Competition */}
                      {rankings[0] ? (
                        <Link
                          href={`/competitions/${rankings[0].competitionSlug}`}
                          className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md hover:border-blue-200 transition-all"
                        >
                          <div className="flex items-center gap-1.5 mb-2">
                            <Trophy className="w-3.5 h-3.5 text-purple-500" />
                            <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">League</h3>
                          </div>
                          <span className="text-sm font-bold text-neutral-900 truncate">{rankings[0].competitionName}</span>
                          <p className="text-xs text-neutral-500 mt-0.5">View standings & results</p>
                        </Link>
                      ) : (
                        <div className="bg-white rounded-xl border border-neutral-200 p-4">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Trophy className="w-3.5 h-3.5 text-neutral-400" />
                            <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Ranking</h3>
                          </div>
                          <p className="text-sm text-neutral-400">No data</p>
                        </div>
                      )}

                      {/* Current Team */}
                      {currentTeam ? (
                        <Link
                          href={`/teams/${currentTeam.slug}`}
                          className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md hover:border-blue-200 transition-all"
                        >
                          <div className="flex items-center gap-1.5 mb-2">
                            <Shield className="w-3.5 h-3.5 text-blue-500" />
                            <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Club</h3>
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            {currentTeam.logoUrl ? (
                              <ImageWithFallback src={currentTeam.logoUrl} alt={currentTeam.name} width={24} height={24} className="w-6 h-6 object-contain" />
                            ) : (
                              <Shield className="w-6 h-6 text-neutral-300" />
                            )}
                            <span className="text-sm font-bold text-neutral-900 truncate">{currentTeam.shortName || currentTeam.name}</span>
                          </div>
                          <p className="text-xs text-neutral-500">{currentTeam.country}</p>
                        </Link>
                      ) : (
                        <div className="bg-white rounded-xl border border-neutral-200 p-4">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Shield className="w-3.5 h-3.5 text-neutral-400" />
                            <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Club</h3>
                          </div>
                          <p className="text-sm text-neutral-400">Free agent</p>
                        </div>
                      )}

                      {/* Recent Form */}
                      <div className="bg-white rounded-xl border border-neutral-200 p-4">
                        <div className="flex items-center gap-1.5 mb-2">
                          <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                          <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Form</h3>
                        </div>
                        {recentMatches.length > 0 && currentTeamData ? (
                          <div className="flex gap-1.5 mt-1">
                            {recentMatches.slice(0, 5).map((m, i) => {
                              const playerTeamId = currentTeamData.team.id;
                              const isHome = m.match.status === "finished" && m.homeTeam.name; // always has data
                              // Determine if player's team won
                              const homeScore = m.match.homeScore ?? 0;
                              const awayScore = m.match.awayScore ?? 0;
                              // Figure out which side the player's team is on
                              const isPlayerHome = m.homeTeam.slug === currentTeam?.slug;
                              const teamScore = isPlayerHome ? homeScore : awayScore;
                              const oppScore = isPlayerHome ? awayScore : homeScore;
                              const result = m.match.status === "finished"
                                ? teamScore > oppScore ? "W" : teamScore < oppScore ? "L" : "D"
                                : null;
                              return result ? (
                                <span
                                  key={i}
                                  title={`${m.homeTeam.name} ${homeScore}-${awayScore} ${m.awayTeam.name}`}
                                  className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white cursor-default ${
                                    result === "W" ? "bg-green-500" : result === "D" ? "bg-neutral-400" : "bg-red-500"
                                  }`}
                                >
                                  {result}
                                </span>
                              ) : null;
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-neutral-400">No data</p>
                        )}
                      </div>
                    </div>

                    {/* Recent Appearances Strip */}
                    {recentMatches.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-neutral-900">Recent Appearances</h3>
                          <Link href={`/players/${slug}?tab=news`} className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-0.5">
                            View all <ChevronRight className="w-3 h-3" />
                          </Link>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                          {recentMatches.map((m) => (
                            <Link
                              key={m.match.id}
                              href={`/matches/${m.match.slug ?? m.match.id}`}
                              className="flex-shrink-0 w-[160px] bg-white rounded-lg border border-neutral-200 p-3 hover:shadow-md hover:border-blue-200 transition-all"
                            >
                              <div className="flex items-center gap-1.5 text-xs text-neutral-700 mb-1.5">
                                <span className="font-medium truncate">{m.homeTeam.name}</span>
                                {m.match.status === "finished" ? (
                                  <span className="font-bold text-neutral-900 flex-shrink-0">{m.match.homeScore}-{m.match.awayScore}</span>
                                ) : (
                                  <span className="text-neutral-400 flex-shrink-0">vs</span>
                                )}
                                <span className="font-medium truncate">{m.awayTeam.name}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className={`text-[10px] font-medium ${m.lineup.isStarter ? "text-green-600" : "text-neutral-500"}`}>
                                  {m.lineup.isStarter ? "Starter" : "Sub"}
                                  {m.lineup.minutesPlayed != null && ` · ${m.lineup.minutesPlayed}'`}
                                </span>
                              </div>
                              <p className="text-[10px] text-neutral-400 mt-1">
                                {m.match.scheduledAt && format(new Date(m.match.scheduledAt), "MMM d")}
                              </p>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Upcoming Match */}
                    {nextMatch && currentTeam && (
                      <Link
                        href={`/matches/${nextMatch.slug ?? nextMatch.id}`}
                        className="block bg-white rounded-xl border border-neutral-200 p-5 hover:shadow-md hover:border-blue-200 transition-all"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-neutral-900">Upcoming Match</h3>
                          <span className="text-xs font-medium text-blue-600">
                            {formatDistanceToNowStrict(new Date(nextMatch.scheduledAt), { addSuffix: true })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {nextMatch.homeTeam?.logoUrl ? (
                              <ImageWithFallback src={nextMatch.homeTeam.logoUrl} alt={nextMatch.homeTeam.name} width={24} height={24} className="w-6 h-6 object-contain" />
                            ) : (
                              <Shield className="w-6 h-6 text-neutral-300" />
                            )}
                            <span className="text-sm font-medium text-neutral-900">{nextMatch.homeTeam?.shortName || nextMatch.homeTeam?.name}</span>
                          </div>
                          <span className="text-xs text-neutral-400 px-3">vs</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-neutral-900">{nextMatch.awayTeam?.shortName || nextMatch.awayTeam?.name}</span>
                            {nextMatch.awayTeam?.logoUrl ? (
                              <ImageWithFallback src={nextMatch.awayTeam.logoUrl} alt={nextMatch.awayTeam.name} width={24} height={24} className="w-6 h-6 object-contain" />
                            ) : (
                              <Shield className="w-6 h-6 text-neutral-300" />
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-neutral-500 mt-2 text-center">
                          {format(new Date(nextMatch.scheduledAt), "EEE, MMM d · h:mm a")}
                          {nextMatch.competition && <span> · {nextMatch.competition.name}</span>}
                        </p>
                      </Link>
                    )}

                    {/* Recent Seasons mini-table */}
                    {statsHistory.length > 0 && (
                      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100">
                          <h3 className="text-sm font-bold text-neutral-900">Season Stats</h3>
                          <Link href={`/players/${slug}?tab=stats`} className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-0.5">
                            Full stats <ChevronRight className="w-3 h-3" />
                          </Link>
                        </div>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-neutral-50 text-left text-[10px] text-neutral-500 uppercase">
                              <th className="px-3 py-2 font-medium">Season</th>
                              <th className="px-3 py-2 font-medium">Team</th>
                              <th className="px-3 py-2 font-medium text-center">Apps</th>
                              <th className="px-3 py-2 font-medium text-center">G</th>
                              <th className="px-3 py-2 font-medium text-center">A</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-50">
                            {statsHistory.slice(0, 3).map(({ stat, team, season }) => (
                              <tr key={stat.id} className="hover:bg-neutral-50">
                                <td className="px-3 py-2 font-medium text-neutral-700">{season.label}</td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-1.5">
                                    {team.logoUrl ? (
                                      <ImageWithFallback src={team.logoUrl} alt={team.name} width={16} height={16} className="w-4 h-4 object-contain" />
                                    ) : (
                                      <Shield className="w-4 h-4 text-neutral-300" />
                                    )}
                                    <span className="text-neutral-700 truncate">{team.shortName || team.name}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-center text-neutral-600">{stat.appearances}</td>
                                <td className="px-3 py-2 text-center font-bold text-neutral-900">{stat.goals}</td>
                                <td className="px-3 py-2 text-center text-neutral-600">{stat.assists}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="border-t border-neutral-200 bg-neutral-50">
                            <tr className="font-medium text-neutral-900">
                              <td className="px-3 py-2" colSpan={2}>Career Total</td>
                              <td className="px-3 py-2 text-center">{totalApps}</td>
                              <td className="px-3 py-2 text-center font-bold">{totalGoals}</td>
                              <td className="px-3 py-2 text-center">{totalAssists}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}

                    {/* Career Path mini-list */}
                    {career.length > 0 && (
                      <div className="bg-white rounded-xl border border-neutral-200 p-5">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-neutral-900">Career Path</h3>
                          {career.length > 3 && (
                            <Link href={`/players/${slug}?tab=career`} className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-0.5">
                              Full history <ChevronRight className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                        <div className="space-y-2">
                          {career.slice(0, 3).map((entry) => (
                            <Link
                              key={entry.id}
                              href={`/teams/${entry.team.slug}`}
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 transition-colors"
                            >
                              <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                {entry.team.logoUrl ? (
                                  <ImageWithFallback src={entry.team.logoUrl} alt={entry.team.name} width={20} height={20} className="w-5 h-5 object-contain" />
                                ) : (
                                  <Shield className="w-4 h-4 text-neutral-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-neutral-900 truncate">{entry.team.name}</div>
                                <div className="text-[11px] text-neutral-500">
                                  {entry.validFrom && format(new Date(entry.validFrom), "MMM yyyy")} → {entry.validTo ? format(new Date(entry.validTo), "MMM yyyy") : "Present"}
                                </div>
                              </div>
                              {entry.shirtNumber && (
                                <span className="text-xs text-neutral-400 flex-shrink-0">#{entry.shirtNumber}</span>
                              )}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* About (moved below fold) */}
                    {aboutParagraphs.length > 0 && (
                      <section className="bg-white rounded-xl border border-neutral-200 p-6">
                        <h2 className="text-lg font-bold text-neutral-900 mb-3">About {player.name}</h2>
                        <div className="space-y-3 text-sm leading-7 text-neutral-700">
                          {aboutParagraphs.map((paragraph, i) => (
                            <p key={i}>{renderBioWithLinks(paragraph)}</p>
                          ))}
                        </div>
                      </section>
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

                    {/* Transfer History */}
                    {transferHistory.length > 0 && (
                      <section className="mt-8">
                        <h2 className="text-lg font-bold text-neutral-900 mb-4">Transfer History</h2>
                        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden divide-y divide-neutral-100">
                          {transferHistory.map((t) => (
                            <div key={t.id} className="flex items-center justify-between p-4">
                              <div className="flex items-center gap-2 min-w-0">
                                {t.fromTeam.name ? (
                                  <Link href={`/teams/${t.fromTeam.slug}`} className="flex items-center gap-1.5 hover:text-blue-600 min-w-0">
                                    {t.fromTeam.logoUrl && (
                                      <ImageWithFallback src={t.fromTeam.logoUrl} alt={t.fromTeam.name} width={20} height={20} className="w-5 h-5 object-contain flex-shrink-0" />
                                    )}
                                    <span className="text-sm text-neutral-700 truncate">{t.fromTeam.name}</span>
                                  </Link>
                                ) : (
                                  <span className="text-sm text-neutral-400">Unknown</span>
                                )}
                                <ArrowRightLeft className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0 mx-1" />
                                <Link href={`/teams/${t.toTeam.slug}`} className="flex items-center gap-1.5 hover:text-blue-600 min-w-0">
                                  {t.toTeam.logoUrl && (
                                    <ImageWithFallback src={t.toTeam.logoUrl} alt={t.toTeam.name} width={20} height={20} className="w-5 h-5 object-contain flex-shrink-0" />
                                  )}
                                  <span className="text-sm font-medium text-neutral-900 truncate">{t.toTeam.name}</span>
                                </Link>
                              </div>
                              <div className="text-right flex-shrink-0 ml-3">
                                {t.transferFeeEur != null && t.transferFeeEur > 0 && (
                                  <div className="text-sm font-bold text-neutral-900">{formatMarketValue(t.transferFeeEur)}</div>
                                )}
                                {t.transferFeeEur === 0 && (
                                  <div className="text-xs font-medium text-green-600">Free transfer</div>
                                )}
                                <div className="text-xs text-neutral-500">
                                  {t.transferDate && format(new Date(t.transferDate), "MMM d, yyyy")}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
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
                              href={`/matches/${m.match.slug ?? m.match.id}`}
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

                <ExternalLinks
                  wikipediaUrl={player.wikipediaUrl}
                  websiteUrl={player.websiteUrl}
                  instagramHandle={player.instagramHandle}
                  twitterHandle={player.twitterHandle}
                  entityName={player.name}
                />

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
