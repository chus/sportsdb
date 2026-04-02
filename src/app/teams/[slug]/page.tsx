import { notFound } from "next/navigation";
import Link from "next/link";
import { Shield, Users, Calendar, Trophy, TrendingUp, Target, ChevronRight, ArrowRightLeft, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";

export const revalidate = 3600; // ISR: revalidate every hour
import type { Metadata } from "next";
import { getTeamBySlug, getSquad, getTeamStats, getFormerPlayers, getTeamTopScorer, getTeamTransfers } from "@/lib/queries/teams";
import { getTeamMatches } from "@/lib/queries/matches";
import { TeamJsonLd, BreadcrumbJsonLd, FAQJsonLd } from "@/components/seo/json-ld";
import { FollowButton } from "@/components/follow-button";
import { RelatedTeams } from "@/components/entity/related-entities";
import { TeamInternalLinks } from "@/components/seo/internal-links";
import { ExternalLinks } from "@/components/entity/external-links";
import { RelatedArticles } from "@/components/articles/related-articles";
import { PlayerLink } from "@/components/player/player-link";
import { TeamFixtures } from "@/components/team/team-fixtures";
import { BetweenContentAd } from "@/components/ads/between-content-ad";
import { SidebarUpgradeOrAd } from "@/components/subscription/sidebar-upgrade-or-ad";
import { ProTeaser } from "@/components/subscription/pro-teaser";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { buildTeamAbout, buildTeamFaqs } from "@/lib/seo/entity-copy";
import { scoreTeamPage } from "@/lib/seo/page-quality";
import { PageTracker } from "@/components/analytics/page-tracker";
import { PageHeader } from "@/components/layout/page-header";
import { TabPanel } from "@/components/ui/tab-navigation";
import { TeamTabs } from "./team-tabs";
import { db } from "@/lib/db";
import { playerTeamHistory, players, standings as standingsTable, competitionSeasons, seasons, teamVenueHistory, venues, teams as teamsTable } from "@/lib/db/schema";
import { eq, and, isNull, ne, sql, asc } from "drizzle-orm";

interface TeamPageProps {
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

export async function generateMetadata({ params }: TeamPageProps): Promise<Metadata> {
  const { slug } = await params;
  const team = await getTeamBySlug(slug);

  if (!team) {
    return { title: "Team Not Found" };
  }

  // Multi-signal thin page scoring
  const [squadCountResult, standingsCountResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)` })
      .from(playerTeamHistory)
      .innerJoin(players, eq(players.id, playerTeamHistory.playerId))
      .where(and(
        eq(playerTeamHistory.teamId, team.id),
        isNull(playerTeamHistory.validTo),
        ne(players.position, "Unknown")
      )),
    db.select({ count: sql<number>`count(*)` })
      .from(standingsTable)
      .innerJoin(competitionSeasons, eq(competitionSeasons.id, standingsTable.competitionSeasonId))
      .innerJoin(seasons, eq(seasons.id, competitionSeasons.seasonId))
      .where(and(eq(standingsTable.teamId, team.id), eq(seasons.isCurrent, true))),
  ]);

  const quality = scoreTeamPage({
    country: team.country,
    city: team.city,
    foundedYear: team.foundedYear,
    logoUrl: team.logoUrl,
    squadSize: Number(squadCountResult[0]?.count ?? 0),
    hasStandings: Number(standingsCountResult[0]?.count ?? 0) > 0,
    hasMatches: true,
  });
  const isThin = quality.isThin;

  const title = `${team.name} – Squad, Results & Standings 2025/26 | DataSports`;
  const mvStr = team.squadMarketValue ? ` Squad value: ${formatMarketValue(team.squadMarketValue)}.` : "";
  const description = `${team.name} squad, fixtures, results, and standings for the 2025/26 season.${mvStr} View full roster, recent matches, and league position.`;

  return {
    title,
    description,
    ...(isThin && { robots: { index: false, follow: true } }),
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/teams/${slug}`,
      siteName: "DataSports",
      type: "website",
      ...(team.logoUrl && { images: [{ url: team.logoUrl, alt: team.name }] }),
    },
    twitter: {
      card: "summary",
      title,
      description,
      ...(team.logoUrl && { images: [team.logoUrl] }),
    },
    alternates: {
      canonical: `${BASE_URL}/teams/${slug}`,
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

function PositionGroup({
  title,
  players,
}: {
  title: string;
  players: {
    player: {
      id: string;
      slug: string;
      name: string;
      nationality: string | null;
      position: string;
      isIndexable: boolean | null;
    };
    shirtNumber: number | null;
  }[];
}) {
  if (players.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">
        {title} <span className="text-neutral-400">({players.length})</span>
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {players.map(({ player, shirtNumber }) => (
          <PlayerLink
            key={player.id}
            slug={player.slug}
            isLinkWorthy={player.isIndexable ?? false}
            className="flex items-center gap-3 p-3 bg-white rounded-lg border border-neutral-100 hover:shadow-md hover:border-blue-200 transition-all group"
          >
            <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-bold text-neutral-700 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
              {shirtNumber || "—"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-neutral-900 truncate group-hover:text-blue-600 transition-colors">
                {player.name}
              </div>
              <div className="text-sm text-neutral-500 truncate">
                {player.nationality || player.position}
              </div>
            </div>
          </PlayerLink>
        ))}
      </div>
    </div>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default async function TeamPage({ params }: TeamPageProps) {
  const { slug } = await params;

  const team = await getTeamBySlug(slug);

  if (!team) {
    notFound();
  }

  // Quick quality check for hard 404 on truly empty team pages
  const [squadCountCheck, standingsCountCheck] = await Promise.all([
    db.select({ count: sql<number>`count(*)` })
      .from(playerTeamHistory)
      .innerJoin(players, eq(players.id, playerTeamHistory.playerId))
      .where(and(eq(playerTeamHistory.teamId, team.id), isNull(playerTeamHistory.validTo), ne(players.position, "Unknown"))),
    db.select({ count: sql<number>`count(*)` })
      .from(standingsTable)
      .innerJoin(competitionSeasons, eq(competitionSeasons.id, standingsTable.competitionSeasonId))
      .innerJoin(seasons, eq(seasons.id, competitionSeasons.seasonId))
      .where(and(eq(standingsTable.teamId, team.id), eq(seasons.isCurrent, true))),
  ]);
  const teamQuality = scoreTeamPage({
    country: team.country,
    city: team.city,
    foundedYear: team.foundedYear,
    logoUrl: team.logoUrl,
    squadSize: Number(squadCountCheck[0]?.count ?? 0),
    hasStandings: Number(standingsCountCheck[0]?.count ?? 0) > 0,
    hasMatches: true,
  });
  if (teamQuality.shouldReturn404) {
    notFound();
  }

  const [squad, statsData, formerPlayers, matchesData, teamTransfers] = await Promise.all([
    getSquad(team.id),
    getTeamStats(team.id),
    getFormerPlayers(team.id, 10),
    getTeamMatches(team.id, 5),
    getTeamTransfers(team.id, 10),
  ]);

  const standing = statsData[0]?.standing;
  const seasonLabel = statsData[0]?.seasonLabel;
  const competitionName = statsData[0]?.competitionName;
  const competitionSlug = statsData[0]?.competitionSlug;

  // Fetch top scorer, venue, and league leader (needs competitionSeasonId from standing)
  const [topScorer, venueResult, leaderResult] = await Promise.all([
    standing
      ? getTeamTopScorer(team.id, standing.competitionSeasonId)
      : Promise.resolve(null),
    db
      .select({ name: venues.name, capacity: venues.capacity })
      .from(teamVenueHistory)
      .innerJoin(venues, eq(venues.id, teamVenueHistory.venueId))
      .where(and(eq(teamVenueHistory.teamId, team.id), isNull(teamVenueHistory.validTo)))
      .limit(1),
    standing
      ? db
          .select({ teamName: teamsTable.name, points: standingsTable.points })
          .from(standingsTable)
          .innerJoin(teamsTable, eq(teamsTable.id, standingsTable.teamId))
          .where(eq(standingsTable.competitionSeasonId, standing.competitionSeasonId))
          .orderBy(asc(standingsTable.position))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const venue = venueResult[0] ?? null;
  const leader = leaderResult[0] ?? null;

  const nextMatch = matchesData.upcoming[0] ?? null;
  const recentMatches = matchesData.recent.slice(0, 5);

  // Guard: skip city if it's a number (data quality bug)
  const safeCity = team.city && !/^\d+$/.test(team.city) ? team.city : null;
  // Guard: skip shortName if truncated mid-word (15 char API limit)
  const safeShortName = team.shortName && team.shortName.length < 15 ? team.shortName : null;

  // Group players by position
  const goalkeepers = squad.filter((p) => p.player.position === "Goalkeeper");
  const defenders = squad.filter((p) => p.player.position === "Defender");
  const midfielders = squad.filter((p) => p.player.position === "Midfielder");
  const forwards = squad.filter((p) => p.player.position === "Forward");
  const unknown = squad.filter(
    (p) => !["Goalkeeper", "Defender", "Midfielder", "Forward"].includes(p.player.position)
  );

  // Team colors for gradient
  const primaryColor = team.primaryColor || "#2563eb";

  const teamUrl = `${BASE_URL}/teams/${slug}`;
  const aboutParagraphs = buildTeamAbout({
    name: team.name,
    shortName: safeShortName,
    city: safeCity,
    country: team.country,
    foundedYear: team.foundedYear,
    squadSize: squad.length,
    formerPlayersCount: formerPlayers.length,
    seasonLabel,
    competitionName,
    standing: standing ? {
      ...standing,
      played: standing.played,
      goalsFor: standing.goalsFor,
      goalsAgainst: standing.goalsAgainst,
      form: standing.form,
    } : null,
    leaderName: leader?.teamName ?? null,
    leaderPoints: leader?.points ?? null,
    topScorer: topScorer ? { name: topScorer.player.name, goals: topScorer.goals } : null,
    venueName: venue?.name ?? null,
    venueCapacity: venue?.capacity ?? null,
    coachName: team.coachName,
    squadMarketValue: team.squadMarketValue,
  });
  const faqItems = buildTeamFaqs({
    name: team.name,
    city: safeCity,
    country: team.country,
    foundedYear: team.foundedYear,
    squadSize: squad.length,
    seasonLabel,
    competitionName,
    goalsFor: standing?.goalsFor,
    goalsAgainst: standing?.goalsAgainst,
    standing,
    coachName: team.coachName,
    squadMarketValue: team.squadMarketValue,
  });

  // Breadcrumb items
  const breadcrumbItems = [
    { name: "Home", url: BASE_URL },
    { name: "Teams", url: `${BASE_URL}/teams` },
    { name: team.name, url: teamUrl },
  ];

  // Subtitle with safe values
  const subtitle = [safeCity, team.country, team.foundedYear ? `Est. ${team.foundedYear}` : null]
    .filter(Boolean)
    .join(" · ");

  // League position badge for header
  const positionBadge = standing && competitionName
    ? `${ordinal(standing.position)} in ${competitionName}`
    : null;

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbItems} />
      <TeamJsonLd
        name={team.name}
        url={teamUrl}
        logo={team.logoUrl}
        location={{ city: safeCity, country: team.country }}
        foundingDate={team.foundedYear}
        memberCount={squad.length}
      />
      {faqItems.length > 0 && <FAQJsonLd items={faqItems} />}
      <PageTracker entityType="team" entityId={team.id} />

    <div className="min-h-screen bg-neutral-50">
      {/* Compact Header */}
      <div className="text-white" style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, #1e1b4b 100%)` }}>
        <PageHeader
          title={team.name}
          subtitle={subtitle}
          accentColor=""
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Teams", href: "/teams" },
            { label: team.name },
          ]}
          icon={
            <div className="relative w-16 h-16 bg-white rounded-xl flex items-center justify-center flex-shrink-0 p-2">
              {team.logoUrl ? (
                <ImageWithFallback src={team.logoUrl} alt={team.name} fill sizes="64px" className="object-contain" />
              ) : (
                <Shield className="w-8 h-8 text-neutral-300" />
              )}
            </div>
          }
          badges={
            <div className="flex items-center gap-2 flex-wrap">
              {positionBadge && (
                <span className="text-xs font-semibold bg-white/20 px-2.5 py-1 rounded-full">
                  {positionBadge}
                </span>
              )}
              {team.coachName && (
                <span className="text-xs font-medium bg-white/20 px-2.5 py-1 rounded-full">
                  Coach: {team.coachName}
                </span>
              )}
              {team.squadMarketValue && (
                <span className="text-xs font-bold bg-emerald-500/30 px-2.5 py-1 rounded-full">
                  Squad: {formatMarketValue(team.squadMarketValue)}
                </span>
              )}
            </div>
          }
          stats={standing ? [
            { label: "Pos", value: `#${standing.position}` },
            { label: "Pts", value: standing.points },
            { label: "W-D-L", value: `${standing.won}-${standing.drawn}-${standing.lost}` },
            { label: "GD", value: standing.goalDifference > 0 ? `+${standing.goalDifference}` : standing.goalDifference },
          ] : undefined}
          actions={
            <FollowButton entityType="team" entityId={team.id} entityName={team.name} variant="hero" />
          }
        />
      </div>

      {/* Tabs */}
      <TeamTabs squadCount={squad.length}>
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-6">

                {/* === OVERVIEW TAB === */}
                <TabPanel tabId="overview" defaultTab="overview">
                  <>
                    {/* Data Dashboard — 4 cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Next Match */}
                      {nextMatch ? (
                        <Link
                          href={`/matches/${nextMatch.id}`}
                          className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md hover:border-blue-200 transition-all"
                        >
                          <div className="flex items-center gap-1.5 mb-2">
                            <Calendar className="w-3.5 h-3.5 text-blue-500" />
                            <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Next Match</h3>
                          </div>
                          {(() => {
                            const isHome = nextMatch.homeTeamId === team.id;
                            const opponent = isHome ? nextMatch.awayTeam : nextMatch.homeTeam;
                            const matchDate = new Date(nextMatch.scheduledAt);
                            return (
                              <>
                                <div className="flex items-center gap-2 mb-1.5">
                                  {opponent?.logoUrl ? (
                                    <img src={opponent.logoUrl} alt="" className="w-6 h-6 object-contain" />
                                  ) : (
                                    <Shield className="w-6 h-6 text-neutral-300" />
                                  )}
                                  <span className="text-sm font-bold text-neutral-900 truncate">
                                    {isHome ? "vs" : "@"} {opponent?.shortName || opponent?.name}
                                  </span>
                                </div>
                                <p className="text-xs text-neutral-500">
                                  {format(matchDate, "EEE, MMM d · h:mm a")}
                                </p>
                                <p className="text-xs font-medium text-blue-600 mt-1">
                                  {formatDistanceToNowStrict(matchDate, { addSuffix: true })}
                                </p>
                              </>
                            );
                          })()}
                        </Link>
                      ) : (
                        <div className="bg-white rounded-xl border border-neutral-200 p-4">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                            <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Next Match</h3>
                          </div>
                          <p className="text-sm text-neutral-400">No upcoming fixtures</p>
                        </div>
                      )}

                      {/* League Position */}
                      {standing && competitionSlug ? (
                        <Link
                          href={`/competitions/${competitionSlug}`}
                          className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md hover:border-blue-200 transition-all"
                        >
                          <div className="flex items-center gap-1.5 mb-2">
                            <Trophy className="w-3.5 h-3.5 text-amber-500" />
                            <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">League Pos.</h3>
                          </div>
                          <div className="text-3xl font-black text-neutral-900">{ordinal(standing.position)}</div>
                          <p className="text-xs text-neutral-500 truncate">{competitionName}</p>
                          <p className="text-xs font-medium text-neutral-700 mt-0.5">{standing.points} pts</p>
                        </Link>
                      ) : (
                        <div className="bg-white rounded-xl border border-neutral-200 p-4">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Trophy className="w-3.5 h-3.5 text-neutral-400" />
                            <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">League Pos.</h3>
                          </div>
                          <p className="text-sm text-neutral-400">No standings data</p>
                        </div>
                      )}

                      {/* Form */}
                      <div className="bg-white rounded-xl border border-neutral-200 p-4">
                        <div className="flex items-center gap-1.5 mb-2">
                          <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                          <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Form</h3>
                        </div>
                        {standing?.form ? (
                          <div className="flex gap-1.5 mt-1">
                            {standing.form.split("").slice(-5).map((result, i) => {
                              const recentMatch = recentMatches[i];
                              const scoreTitle = recentMatch
                                ? `${recentMatch.homeTeam?.shortName || recentMatch.homeTeam?.name} ${recentMatch.homeScore}-${recentMatch.awayScore} ${recentMatch.awayTeam?.shortName || recentMatch.awayTeam?.name}`
                                : undefined;
                              return (
                                <span
                                  key={i}
                                  title={scoreTitle}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white cursor-default ${
                                    result === "W" ? "bg-green-500" : result === "D" ? "bg-neutral-400" : "bg-red-500"
                                  }`}
                                >
                                  {result}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-neutral-400">No data</p>
                        )}
                      </div>

                      {/* Top Scorer */}
                      {topScorer ? (
                        <Link
                          href={`/players/${topScorer.player.slug}`}
                          className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md hover:border-blue-200 transition-all"
                        >
                          <div className="flex items-center gap-1.5 mb-2">
                            <Target className="w-3.5 h-3.5 text-red-500" />
                            <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Top Scorer</h3>
                          </div>
                          <div className="text-2xl font-black text-neutral-900">{topScorer.goals}</div>
                          <p className="text-xs text-neutral-500">goals</p>
                          <p className="text-sm font-medium text-neutral-900 truncate mt-0.5">{topScorer.player.name}</p>
                        </Link>
                      ) : (
                        <div className="bg-white rounded-xl border border-neutral-200 p-4">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Target className="w-3.5 h-3.5 text-neutral-400" />
                            <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Top Scorer</h3>
                          </div>
                          <p className="text-sm text-neutral-400">No data</p>
                        </div>
                      )}
                    </div>

                    {/* Recent Results Strip */}
                    {recentMatches.length > 0 && (
                      <div>
                        <h3 className="text-sm font-bold text-neutral-900 mb-3">Recent Results</h3>
                        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                          {recentMatches.map((match) => {
                            const isHome = match.homeTeamId === team.id;
                            const opponent = isHome ? match.awayTeam : match.homeTeam;
                            const teamScore = isHome ? match.homeScore : match.awayScore;
                            const oppScore = isHome ? match.awayScore : match.homeScore;
                            const result =
                              teamScore !== null && oppScore !== null
                                ? teamScore > oppScore ? "W" : teamScore < oppScore ? "L" : "D"
                                : null;

                            return (
                              <Link
                                key={match.id}
                                href={`/matches/${match.id}`}
                                className="flex-shrink-0 w-[140px] bg-white rounded-lg border border-neutral-200 p-3 hover:shadow-md hover:border-blue-200 transition-all"
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  {opponent?.logoUrl ? (
                                    <img src={opponent.logoUrl} alt="" className="w-5 h-5 object-contain" />
                                  ) : (
                                    <Shield className="w-5 h-5 text-neutral-300" />
                                  )}
                                  <span className="text-xs font-medium text-neutral-700 truncate">
                                    {opponent?.shortName || opponent?.name}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-lg font-bold text-neutral-900">
                                    {match.homeScore}-{match.awayScore}
                                  </span>
                                  {result && (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                      result === "W" ? "bg-green-100 text-green-700"
                                        : result === "D" ? "bg-yellow-100 text-yellow-700"
                                        : "bg-red-100 text-red-700"
                                    }`}>
                                      {result}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-neutral-400 mt-1">
                                  {format(new Date(match.scheduledAt), "MMM d")}
                                </p>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Upcoming fixtures */}
                    {matchesData.upcoming.length > 0 && (
                      <div className="bg-white rounded-xl border border-neutral-200 p-5">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-neutral-900">Upcoming Fixtures</h3>
                          <Link href={`/teams/${slug}?tab=fixtures`} className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-0.5">
                            View all <ChevronRight className="w-3 h-3" />
                          </Link>
                        </div>
                        <div className="space-y-2">
                          {matchesData.upcoming.slice(0, 3).map((match) => {
                            const isHome = match.homeTeamId === team.id;
                            const opponent = isHome ? match.awayTeam : match.homeTeam;
                            return (
                              <Link key={match.id} href={`/matches/${match.id}`} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-neutral-50 transition-colors">
                                <div className="flex items-center gap-2">
                                  {opponent?.logoUrl ? (
                                    <img src={opponent.logoUrl} alt="" className="w-5 h-5 object-contain" />
                                  ) : (
                                    <Shield className="w-5 h-5 text-neutral-300" />
                                  )}
                                  <span className="text-sm text-neutral-900">
                                    {isHome ? "vs" : "@"} {opponent?.shortName || opponent?.name}
                                  </span>
                                </div>
                                <span className="text-xs text-neutral-500">{format(new Date(match.scheduledAt), "MMM d")}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Recent Transfers */}
                    {teamTransfers.length > 0 && (
                      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100">
                          <h3 className="text-sm font-bold text-neutral-900">Recent Transfers</h3>
                        </div>
                        <div className="divide-y divide-neutral-100">
                          {teamTransfers.slice(0, 5).map((t) => {
                            const isIncoming = t.toTeamId === team.id;
                            const otherTeam = isIncoming ? t.fromTeam : t.toTeam;
                            return (
                              <div key={t.id} className="flex items-center justify-between px-4 py-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isIncoming ? "bg-green-100" : "bg-red-100"}`}>
                                    {isIncoming ? (
                                      <ArrowDownLeft className="w-3.5 h-3.5 text-green-600" />
                                    ) : (
                                      <ArrowUpRight className="w-3.5 h-3.5 text-red-600" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <Link href={`/players/${t.player.slug}`} className="text-sm font-medium text-neutral-900 hover:text-blue-600 truncate block">
                                      {t.player.name}
                                    </Link>
                                    <div className="flex items-center gap-1 text-xs text-neutral-500">
                                      <span>{isIncoming ? "from" : "to"}</span>
                                      {otherTeam.name ? (
                                        <Link href={`/teams/${otherTeam.slug}`} className="hover:text-blue-600 truncate">{otherTeam.name}</Link>
                                      ) : (
                                        <span>Unknown</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0 ml-3">
                                  {t.transferFeeEur != null && t.transferFeeEur > 0 && (
                                    <div className="text-sm font-bold text-neutral-900">{formatMarketValue(t.transferFeeEur)}</div>
                                  )}
                                  {t.transferFeeEur === 0 && (
                                    <div className="text-xs font-medium text-green-600">Free</div>
                                  )}
                                  <div className="text-[10px] text-neutral-400">
                                    {t.transferDate && format(new Date(t.transferDate), "MMM yyyy")}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* About (moved below fold) */}
                    {aboutParagraphs.length > 0 && (
                      <section className="bg-white rounded-xl border border-neutral-200 p-6">
                        <h2 className="text-lg font-bold text-neutral-900 mb-3">About {team.name}</h2>
                        <div className="space-y-3 text-sm leading-7 text-neutral-700">
                          {aboutParagraphs.map((paragraph, i) => (
                            <p key={i}>{renderBioWithLinks(paragraph)}</p>
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                </TabPanel>

                {/* === SQUAD TAB === */}
                <TabPanel tabId="squad" defaultTab="overview">
                  <>
                    {squad.length === 0 ? (
                      <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
                        <Users className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                        <p className="text-neutral-500">No squad data available</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <PositionGroup title="Goalkeepers" players={goalkeepers} />
                        <PositionGroup title="Defenders" players={defenders} />
                        <PositionGroup title="Midfielders" players={midfielders} />
                        <PositionGroup title="Forwards" players={forwards} />
                        <PositionGroup title="Other" players={unknown} />
                      </div>
                    )}
                  </>
                </TabPanel>

                {/* === FIXTURES TAB === */}
                <TabPanel tabId="fixtures" defaultTab="overview">
                  <TeamFixtures teamId={team.id} limit={50} />
                </TabPanel>

                {/* === STATS TAB === */}
                <TabPanel tabId="stats" defaultTab="overview">
                  <>
                    {standing && (
                      <div className="bg-white rounded-xl border border-neutral-200 p-6">
                        <h2 className="text-lg font-bold text-neutral-900 mb-4">{seasonLabel} Season Stats</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                          <div className="text-center p-3 bg-neutral-50 rounded-lg">
                            <div className="text-2xl font-bold">#{standing.position}</div>
                            <div className="text-xs text-neutral-500">Position</div>
                          </div>
                          <div className="text-center p-3 bg-neutral-50 rounded-lg">
                            <div className="text-2xl font-bold">{standing.points}</div>
                            <div className="text-xs text-neutral-500">Points</div>
                          </div>
                          <div className="text-center p-3 bg-neutral-50 rounded-lg">
                            <div className="text-2xl font-bold text-green-600">{standing.goalsFor}</div>
                            <div className="text-xs text-neutral-500">Goals For</div>
                          </div>
                          <div className="text-center p-3 bg-neutral-50 rounded-lg">
                            <div className="text-2xl font-bold text-red-600">{standing.goalsAgainst}</div>
                            <div className="text-xs text-neutral-500">Goals Against</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="p-3 bg-green-50 rounded-lg"><div className="text-lg font-bold text-green-600">{standing.won}</div><div className="text-xs text-neutral-500">Won</div></div>
                          <div className="p-3 bg-neutral-50 rounded-lg"><div className="text-lg font-bold text-neutral-600">{standing.drawn}</div><div className="text-xs text-neutral-500">Drawn</div></div>
                          <div className="p-3 bg-red-50 rounded-lg"><div className="text-lg font-bold text-red-600">{standing.lost}</div><div className="text-xs text-neutral-500">Lost</div></div>
                        </div>
                      </div>
                    )}

                    {/* Squad Breakdown */}
                    <div className="bg-white rounded-xl border border-neutral-200 p-5">
                      <h3 className="text-sm font-bold text-neutral-900 mb-3">Squad Breakdown</h3>
                      <div className="space-y-2 text-sm">
                        {[
                          { label: "Goalkeepers", count: goalkeepers.length },
                          { label: "Defenders", count: defenders.length },
                          { label: "Midfielders", count: midfielders.length },
                          { label: "Forwards", count: forwards.length },
                        ].map(({ label, count }) => (
                          <div key={label} className="flex justify-between">
                            <span className="text-neutral-600">{label}</span>
                            <span className="font-medium text-neutral-900">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Former Players */}
                    {formerPlayers.length > 0 && (() => {
                      const visiblePlayers = formerPlayers.slice(0, 3);
                      const hiddenPlayers = formerPlayers.slice(3);
                      const renderPlayerRow = ({ player, shirtNumber, validFrom, validTo }: typeof formerPlayers[number]) => (
                        <PlayerLink key={player.id} slug={player.slug} isLinkWorthy={player.isIndexable ?? false} className="flex items-center justify-between p-3 hover:bg-neutral-50 transition-colors group">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-500 text-xs font-medium">{shirtNumber || "—"}</div>
                            <div>
                              <div className="font-medium text-sm text-neutral-900 group-hover:text-blue-600">{player.name}</div>
                              <div className="text-xs text-neutral-500">{player.position} · {new Date(validFrom).getFullYear()}-{validTo ? new Date(validTo).getFullYear() : "Present"}</div>
                            </div>
                          </div>
                        </PlayerLink>
                      );
                      return (
                        <section>
                          <h2 className="text-lg font-bold text-neutral-900 mb-4">Former Players</h2>
                          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden divide-y divide-neutral-100">
                            {visiblePlayers.map(renderPlayerRow)}
                            {hiddenPlayers.length > 0 && (
                              <ProTeaser label={`Unlock all ${formerPlayers.length} former players`}>
                                <div className="divide-y divide-neutral-100">{hiddenPlayers.map(renderPlayerRow)}</div>
                              </ProTeaser>
                            )}
                          </div>
                        </section>
                      );
                    })()}
                  </>
                </TabPanel>

                <BetweenContentAd />
              </div>

              {/* Sidebar — reordered: Articles → FAQ → Upgrade → Related → Links */}
              <div className="space-y-6">
                <RelatedArticles teamId={team.id} limit={5} />

                {faqItems.length > 0 && (
                  <section className="bg-white rounded-xl border border-neutral-200 p-5">
                    <h3 className="text-sm font-bold text-neutral-900 mb-3">Team FAQ</h3>
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
                  wikipediaUrl={team.wikipediaUrl}
                  websiteUrl={team.websiteUrl}
                  instagramHandle={team.instagramHandle}
                  twitterHandle={team.twitterHandle}
                  entityName={team.name}
                />

                <SidebarUpgradeOrAd context="team" />

                <RelatedTeams teamId={team.id} />
                <TeamInternalLinks teamId={team.id} country={team.country} />
              </div>
            </div>
          </div>
      </TeamTabs>
    </div>
    </>
  );
}
