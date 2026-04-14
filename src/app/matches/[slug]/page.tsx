import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  Shield,
  Trophy,
  User,
  Target,
  TrendingUp,
} from "lucide-react";
import { PlayerLink } from "@/components/player/player-link";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import type { Metadata } from "next";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  getMatchWithDetailsBySlug,
  getMatchEventsWithPlayers,
  getMatchLineupsGrouped,
} from "@/lib/queries/matches";
import { getTeamStats, getTeamTopScorer } from "@/lib/queries/teams";
import { MatchJsonLd, BreadcrumbJsonLd, FAQJsonLd } from "@/components/seo/json-ld";
import { RelatedMatches } from "@/components/entity/related-entities";
import { HeadToHead } from "@/components/match/head-to-head";
import { FormationView } from "@/components/match/formation-view";
import { MatchSummary } from "@/components/match/match-summary";
import { MatchTimeline } from "@/components/match/match-timeline";
import { MatchStatBars } from "@/components/match/match-stat-bars";
import { MatchInternalLinks } from "@/components/seo/internal-links";
import { SidebarAd } from "@/components/ads/sidebar-ad";
import { MatchPredictionWidget } from "@/components/games/match-prediction-widget";
import { BetweenContentAd } from "@/components/ads/between-content-ad";
import { PageTracker } from "@/components/analytics/page-tracker";

interface MatchPageProps {
  params: Promise<{ slug: string }>;
}

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export async function generateMetadata({
  params,
}: MatchPageProps): Promise<Metadata> {
  const { slug } = await params;
  const match = await getMatchWithDetailsBySlug(slug);

  if (!match || !match.homeTeam || !match.awayTeam) {
    return {
      title: "Match Not Found | DataSports",
      robots: { index: false, follow: false },
    };
  }

  const homeTeam = match.homeTeam.shortName || match.homeTeam.name;
  const awayTeam = match.awayTeam.shortName || match.awayTeam.name;
  const score =
    match.status === "finished" || match.status === "live"
      ? `${match.homeScore ?? 0} - ${match.awayScore ?? 0}`
      : "vs";
  const title = `${homeTeam} ${score} ${awayTeam} | DataSports`;
  const description = `${match.homeTeam.name} vs ${match.awayTeam.name}${
    match.competition ? ` - ${match.competition.name}` : ""
  }${match.venue ? ` at ${match.venue.name}` : ""}. Match events, lineups, and statistics.`;

  // Only index finished matches with scores — scheduled/cancelled matches are thin
  const isIndexable = match.status === "finished" && match.homeScore != null && match.awayScore != null;

  const url = `${BASE_URL}/matches/${slug}`;

  return {
    title,
    description,
    ...(!isIndexable && { robots: { index: false, follow: true } }),
    openGraph: {
      title,
      description,
      url,
      siteName: "DataSports",
      type: "website",
      images: [
        {
          url: `${url}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${url}/opengraph-image`],
    },
    alternates: {
      canonical: url,
    },
  };
}

function getEventIcon(type: string): string {
  switch (type) {
    case "goal":
      return "⚽";
    case "own_goal":
      return "⚽ OG";
    case "penalty":
      return "⚽ P";
    case "penalty_missed":
      return "❌ P";
    case "yellow_card":
      return "🟨";
    case "red_card":
      return "🟥";
    case "substitution":
      return "🔄";
    default:
      return "•";
  }
}

function getStatusDisplay(
  status: string,
  minute?: number | null
): { label: string; className: string } {
  switch (status) {
    case "live":
      return {
        label: minute ? `${minute}'` : "LIVE",
        className: "bg-red-500 text-white animate-pulse",
      };
    case "half_time":
      return {
        label: "HT",
        className: "bg-orange-500 text-white",
      };
    case "finished":
      return {
        label: "FT",
        className: "bg-neutral-800 text-white",
      };
    case "scheduled":
      return {
        label: "Upcoming",
        className: "bg-blue-500 text-white",
      };
    case "postponed":
      return {
        label: "Postponed",
        className: "bg-neutral-500 text-white",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        className: "bg-neutral-500 text-white",
      };
    default:
      return {
        label: status,
        className: "bg-neutral-500 text-white",
      };
  }
}

function MatchEventItem({
  event,
  isHomeTeam,
}: {
  event: {
    type: string;
    minute: number;
    addedTime: number | null;
    player: { name: string; slug: string; isIndexable: boolean } | null;
    secondaryPlayer: { name: string; slug: string; isIndexable: boolean } | null;
    description: string | null;
  };
  isHomeTeam: boolean;
}) {
  const minuteDisplay = event.addedTime
    ? `${event.minute}+${event.addedTime}'`
    : `${event.minute}'`;

  return (
    <div
      className={`flex items-center gap-3 py-2 ${
        isHomeTeam ? "flex-row" : "flex-row-reverse"
      }`}
    >
      <div className={`flex-1 ${isHomeTeam ? "text-right" : "text-left"}`}>
        {event.player && (
          <PlayerLink
            slug={event.player.slug}
            isLinkWorthy={event.player.isIndexable ?? false}
            className="font-medium hover:text-blue-600 transition-colors"
          >
            {event.player.name}
          </PlayerLink>
        )}
        {event.type === "substitution" && event.secondaryPlayer && (
          <span className="text-neutral-500 text-sm">
            {" "}
            for{" "}
            <PlayerLink
              slug={event.secondaryPlayer.slug}
              isLinkWorthy={event.secondaryPlayer.isIndexable ?? false}
              className="hover:text-blue-600 transition-colors"
            >
              {event.secondaryPlayer.name}
            </PlayerLink>
          </span>
        )}
        {event.type === "goal" && event.secondaryPlayer && (
          <span className="text-neutral-500 text-sm">
            {" "}
            (assist:{" "}
            <PlayerLink
              slug={event.secondaryPlayer.slug}
              isLinkWorthy={event.secondaryPlayer.isIndexable ?? false}
              className="hover:text-blue-600 transition-colors"
            >
              {event.secondaryPlayer.name}
            </PlayerLink>
            )
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-lg">{getEventIcon(event.type)}</span>
        <span className="text-sm font-medium text-neutral-600 w-12 text-center">
          {minuteDisplay}
        </span>
      </div>
      <div className={`flex-1 ${isHomeTeam ? "text-left" : "text-right"}`} />
    </div>
  );
}

function LineupPlayer({
  player,
  shirtNumber,
  isStarter,
  position,
  rating,
}: {
  player: { name: string; slug: string; position: string; isIndexable: boolean | null };
  shirtNumber: number | null;
  isStarter: boolean;
  position: string | null;
  rating: string | null;
}) {
  return (
    <PlayerLink
      slug={player.slug}
      isLinkWorthy={player.isIndexable ?? false}
      className="flex items-center gap-3 p-2 hover:bg-neutral-50 rounded-lg transition-colors group"
    >
      <div className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center text-sm font-medium text-neutral-600 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
        {shirtNumber || "—"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-neutral-900 truncate group-hover:text-blue-600 transition-colors">
          {player.name}
        </div>
        <div className="text-xs text-neutral-500">
          {position || player.position}
        </div>
      </div>
      {rating && (
        <div
          className={`px-2 py-0.5 rounded text-sm font-medium ${
            parseFloat(rating) >= 7
              ? "bg-green-100 text-green-700"
              : parseFloat(rating) >= 6
                ? "bg-yellow-100 text-yellow-700"
                : "bg-red-100 text-red-700"
          }`}
        >
          {parseFloat(rating).toFixed(1)}
        </div>
      )}
    </PlayerLink>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function buildMatchFaqs({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  status,
  scheduledAt,
  venue,
  competition,
  goalScorers,
}: {
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  scheduledAt: Date;
  venue: string | null;
  competition: string | null;
  goalScorers: string[];
}): { question: string; answer: string }[] {
  const faqs: { question: string; answer: string }[] = [];
  const vs = `${homeTeam} vs ${awayTeam}`;

  if (status === "finished" && homeScore !== null && awayScore !== null) {
    faqs.push({
      question: `What was the final score of ${vs}?`,
      answer: `${homeTeam} ${homeScore}–${awayScore} ${awayTeam}.`,
    });
    if (goalScorers.length > 0) {
      const unique = [...new Set(goalScorers)];
      faqs.push({
        question: `Who scored in ${vs}?`,
        answer: `The goal scorers were ${unique.join(", ")}.`,
      });
    }
  }

  if (status === "scheduled") {
    faqs.push({
      question: `When is ${vs}?`,
      answer: `The match is scheduled for ${format(new Date(scheduledAt), "EEEE, MMMM d, yyyy 'at' h:mm a")}.`,
    });
  }

  if (venue) {
    faqs.push({
      question: `Where is ${vs} being played?`,
      answer: `The match ${status === "finished" ? "was" : "is"} played at ${venue}.`,
    });
  }

  if (competition) {
    faqs.push({
      question: `What competition is ${vs} part of?`,
      answer: `This match is part of the ${competition}.`,
    });
  }

  return faqs;
}

export default async function MatchPage({ params }: MatchPageProps) {
  const { slug } = await params;

  const match = await getMatchWithDetailsBySlug(slug);
  if (!match || !match.homeTeam || !match.awayTeam) {
    notFound();
  }

  const matchId = match.id;
  const matchUrl = `${BASE_URL}/matches/${slug}`;

  const [events, lineups] = await Promise.all([
    getMatchEventsWithPlayers(matchId),
    getMatchLineupsGrouped(matchId),
  ]);

  const { homeTeam, awayTeam, venue, competition, season } = match;
  const statusDisplay = getStatusDisplay(match.status, match.minute);

  // Fetch team standings for context
  const [homeTeamStats, awayTeamStats] = await Promise.all([
    getTeamStats(homeTeam.id),
    getTeamStats(awayTeam.id),
  ]);
  const homeStanding = homeTeamStats[0]?.standing;
  const awayStanding = awayTeamStats[0]?.standing;

  // For scheduled matches, get top scorers
  let homeTopScorer: Awaited<ReturnType<typeof getTeamTopScorer>> | null = null;
  let awayTopScorer: Awaited<ReturnType<typeof getTeamTopScorer>> | null = null;
  if (match.status === "scheduled" && match.competitionSeasonId) {
    [homeTopScorer, awayTopScorer] = await Promise.all([
      getTeamTopScorer(homeTeam.id, match.competitionSeasonId),
      getTeamTopScorer(awayTeam.id, match.competitionSeasonId),
    ]);
  }

  // Separate events by team
  const homeEvents = events.filter((e) => e.teamId === homeTeam.id);
  const awayEvents = events.filter((e) => e.teamId === awayTeam.id);

  // Get lineups for each team
  const homeLineups = lineups.get(homeTeam.id);
  const awayLineups = lineups.get(awayTeam.id);

  // Calculate goal counts
  const homeGoals = events.filter(
    (e) =>
      (e.type === "goal" || e.type === "penalty") && e.teamId === homeTeam.id
  ).length;
  const awayGoals = events.filter(
    (e) =>
      (e.type === "goal" || e.type === "penalty") && e.teamId === awayTeam.id
  ).length;

  // Build breadcrumb items
  const breadcrumbItems = [
    { name: "Home", url: BASE_URL },
    ...(competition
      ? [{ name: competition.name, url: `${BASE_URL}/competitions/${competition.slug}` }]
      : []),
    { name: `${homeTeam.shortName || homeTeam.name} vs ${awayTeam.shortName || awayTeam.name}`, url: matchUrl },
  ];

  return (
    <>
      <MatchJsonLd
        homeTeam={{ name: homeTeam.name, url: `${BASE_URL}/teams/${homeTeam.slug}` }}
        awayTeam={{ name: awayTeam.name, url: `${BASE_URL}/teams/${awayTeam.slug}` }}
        homeScore={match.homeScore}
        awayScore={match.awayScore}
        scheduledAt={match.scheduledAt.toISOString()}
        status={match.status}
        venue={venue ? { name: venue.name, url: `${BASE_URL}/venues/${venue.slug}`, city: venue.city, country: venue.country } : null}
        competition={competition ? { name: competition.name, url: `${BASE_URL}/competitions/${competition.slug}` } : null}
        matchUrl={matchUrl}
      />
      <BreadcrumbJsonLd items={breadcrumbItems} />
      <FAQJsonLd items={buildMatchFaqs({
        homeTeam: homeTeam.name,
        awayTeam: awayTeam.name,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        status: match.status,
        scheduledAt: match.scheduledAt,
        venue: venue?.name ?? null,
        competition: competition?.name ?? null,
        goalScorers: events
          .filter((e) => e.type === "goal" || e.type === "penalty")
          .map((e) => e.player?.name)
          .filter(Boolean) as string[],
      })} />
      <PageTracker entityType="match" entityId={matchId} />
    <div className="min-h-screen bg-neutral-50">
      {/* Scoreboard Header */}
      <div className="bg-neutral-900 text-white">
        <div className="max-w-7xl mx-auto px-4">
          {/* Breadcrumb row */}
          <nav className="flex items-center gap-2 pt-4 pb-2 text-xs text-neutral-400">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            {competition && (
              <>
                <span>/</span>
                <Link href={`/competitions/${competition.slug}`} className="hover:text-white transition-colors">
                  {competition.name}
                </Link>
              </>
            )}
            <span>/</span>
            <span className="text-neutral-300">{homeTeam.shortName || homeTeam.name} vs {awayTeam.shortName || awayTeam.name}</span>
          </nav>

          {/* Scoreboard */}
          <h1 className="text-center text-sm text-neutral-400 pt-2 font-medium">
            {homeTeam.name} vs {awayTeam.name}
            {match.homeScore != null && match.awayScore != null ? ` – ${match.homeScore}-${match.awayScore}` : ""}
            {competition ? ` | ${competition.name}` : ""}
          </h1>
          <div className="flex items-center justify-center gap-4 md:gap-10 py-6">
            {/* Home Team */}
            <Link
              href={`/teams/${homeTeam.slug}`}
              className="flex items-center gap-3 md:gap-4 flex-1 justify-end group"
            >
              <span className="text-right font-semibold text-sm md:text-lg group-hover:text-blue-400 transition-colors">
                {homeTeam.shortName || homeTeam.name}
              </span>
              <div className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-xl flex items-center justify-center p-1.5 flex-shrink-0">
                {homeTeam.logoUrl ? (
                  <ImageWithFallback src={homeTeam.logoUrl} alt={homeTeam.name} width={48} height={48} className="w-full h-full object-contain" />
                ) : (
                  <Shield className="w-8 h-8 text-neutral-300" />
                )}
              </div>
            </Link>

            {/* Score */}
            <div className="flex flex-col items-center gap-1.5 min-w-[120px]">
              <div className="flex items-center gap-3 md:gap-5">
                <span className="text-4xl md:text-5xl font-bold tabular-nums">
                  {match.homeScore ?? "-"}
                </span>
                <span className="text-xl md:text-2xl text-neutral-500">-</span>
                <span className="text-4xl md:text-5xl font-bold tabular-nums">
                  {match.awayScore ?? "-"}
                </span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusDisplay.className}`}>
                {statusDisplay.label}
              </span>
            </div>

            {/* Away Team */}
            <Link
              href={`/teams/${awayTeam.slug}`}
              className="flex items-center gap-3 md:gap-4 flex-1 group"
            >
              <div className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-xl flex items-center justify-center p-1.5 flex-shrink-0">
                {awayTeam.logoUrl ? (
                  <ImageWithFallback src={awayTeam.logoUrl} alt={awayTeam.name} width={48} height={48} className="w-full h-full object-contain" />
                ) : (
                  <Shield className="w-8 h-8 text-neutral-300" />
                )}
              </div>
              <span className="font-semibold text-sm md:text-lg group-hover:text-blue-400 transition-colors">
                {awayTeam.shortName || awayTeam.name}
              </span>
            </Link>
          </div>

          {/* Match Info Bar */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 pb-4 text-xs text-neutral-400">
            {competition && (
              <Link href={`/competitions/${competition.slug}`} className="flex items-center gap-1.5 hover:text-white transition-colors">
                <Trophy className="w-3.5 h-3.5" />
                <span>{competition.name}{season ? ` · ${season.label}` : ""}{match.matchday ? ` · MD ${match.matchday}` : ""}</span>
              </Link>
            )}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{format(new Date(match.scheduledAt), "EEE, MMM d, yyyy · HH:mm")}</span>
            </div>
            {venue && (
              <Link href={`/venues/${venue.slug}`} className="flex items-center gap-1.5 hover:text-white transition-colors">
                <MapPin className="w-3.5 h-3.5" />
                <span>{venue.name}</span>
              </Link>
            )}
            {match.attendance && (
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>{match.attendance.toLocaleString()}</span>
              </div>
            )}
            {match.referee && (
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>{match.referee}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scheduled Match Dashboard */}
      {match.status === "scheduled" && (
        <div className="max-w-7xl mx-auto px-4 pt-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Countdown */}
            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Kickoff</h3>
              </div>
              <div className="text-lg font-black text-neutral-900">
                {formatDistanceToNowStrict(new Date(match.scheduledAt), { addSuffix: true })}
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">{format(new Date(match.scheduledAt), "EEE, MMM d · h:mm a")}</p>
            </div>

            {/* League Positions */}
            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Standings</h3>
              </div>
              {homeStanding && awayStanding ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-neutral-700 truncate">{homeTeam.shortName || homeTeam.name}</span>
                    <span className="font-bold text-neutral-900 flex-shrink-0 ml-1">{ordinal(homeStanding.position)} · {homeStanding.points}pts</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-neutral-700 truncate">{awayTeam.shortName || awayTeam.name}</span>
                    <span className="font-bold text-neutral-900 flex-shrink-0 ml-1">{ordinal(awayStanding.position)} · {awayStanding.points}pts</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-neutral-400">No data</p>
              )}
            </div>

            {/* Form */}
            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Form</h3>
              </div>
              {homeStanding?.form || awayStanding?.form ? (
                <div className="space-y-2">
                  {homeStanding?.form && (
                    <div>
                      <p className="text-[10px] text-neutral-500 mb-1">{homeTeam.shortName || homeTeam.name}</p>
                      <div className="flex gap-1">
                        {homeStanding.form.split("").slice(-5).map((r, i) => (
                          <span key={i} className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white ${r === "W" ? "bg-green-500" : r === "D" ? "bg-neutral-400" : "bg-red-500"}`}>{r}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {awayStanding?.form && (
                    <div>
                      <p className="text-[10px] text-neutral-500 mb-1">{awayTeam.shortName || awayTeam.name}</p>
                      <div className="flex gap-1">
                        {awayStanding.form.split("").slice(-5).map((r, i) => (
                          <span key={i} className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white ${r === "W" ? "bg-green-500" : r === "D" ? "bg-neutral-400" : "bg-red-500"}`}>{r}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-neutral-400">No data</p>
              )}
            </div>

            {/* Top Scorers */}
            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Target className="w-3.5 h-3.5 text-red-500" />
                <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Dangermen</h3>
              </div>
              {homeTopScorer || awayTopScorer ? (
                <div className="space-y-1.5">
                  {homeTopScorer && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-neutral-900 truncate">{homeTopScorer.player.name}</span>
                      <span className="text-neutral-500 flex-shrink-0 ml-1">{homeTopScorer.goals}G {homeTopScorer.assists}A</span>
                    </div>
                  )}
                  {awayTopScorer && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-neutral-900 truncate">{awayTopScorer.player.name}</span>
                      <span className="text-neutral-500 flex-shrink-0 ml-1">{awayTopScorer.goals}G {awayTopScorer.assists}A</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-neutral-400">No data</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Finished Match Dashboard — 4 cards */}
      {match.status === "finished" && (
        <div className="max-w-7xl mx-auto px-4 pt-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Goal Scorers */}
            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-sm">⚽</span>
                <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Goals</h3>
              </div>
              {homeEvents.filter((e) => e.type === "goal" || e.type === "own_goal" || e.type === "penalty").length > 0 ||
               awayEvents.filter((e) => e.type === "goal" || e.type === "own_goal" || e.type === "penalty").length > 0 ? (
                <div className="space-y-1.5">
                  {[...homeEvents, ...awayEvents]
                    .filter((e) => e.type === "goal" || e.type === "own_goal" || e.type === "penalty")
                    .sort((a, b) => a.minute - b.minute)
                    .slice(0, 4)
                    .map((e) => (
                      <div key={e.id} className="flex items-center justify-between text-xs">
                        <span className="font-medium text-neutral-900 truncate">
                          {e.player?.name ?? "Unknown"}
                          {e.type === "own_goal" && " (OG)"}
                          {e.type === "penalty" && " (P)"}
                        </span>
                        <span className="text-neutral-500 flex-shrink-0 ml-1">{e.minute}&apos;</span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-400">No goals</p>
              )}
            </div>

            {/* Cards */}
            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-sm">🟨</span>
                <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Cards</h3>
              </div>
              {(() => {
                const homeYellows = homeEvents.filter((e) => e.type === "yellow_card").length;
                const homeReds = homeEvents.filter((e) => e.type === "red_card").length;
                const awayYellows = awayEvents.filter((e) => e.type === "yellow_card").length;
                const awayReds = awayEvents.filter((e) => e.type === "red_card").length;
                const total = homeYellows + homeReds + awayYellows + awayReds;
                return total > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-700 font-medium">{homeTeam.shortName || homeTeam.name}</span>
                      <span className="text-neutral-500">{homeYellows > 0 ? `🟨${homeYellows}` : ""} {homeReds > 0 ? `🟥${homeReds}` : ""}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-700 font-medium">{awayTeam.shortName || awayTeam.name}</span>
                      <span className="text-neutral-500">{awayYellows > 0 ? `🟨${awayYellows}` : ""} {awayReds > 0 ? `🟥${awayReds}` : ""}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400">No cards</p>
                );
              })()}
            </div>

            {/* Competition */}
            {competition ? (
              <Link
                href={`/competitions/${competition.slug}`}
                className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md hover:border-blue-200 transition-all"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Competition</h3>
                </div>
                <div className="text-sm font-bold text-neutral-900 truncate">{competition.name}</div>
                <p className="text-xs text-neutral-500">
                  {season ? season.label : ""}{match.matchday ? ` · Matchday ${match.matchday}` : ""}
                </p>
              </Link>
            ) : (
              <div className="bg-white rounded-xl border border-neutral-200 p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Trophy className="w-3.5 h-3.5 text-neutral-400" />
                  <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Competition</h3>
                </div>
                <p className="text-sm text-neutral-400">Unknown</p>
              </div>
            )}

            {/* Venue */}
            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <MapPin className="w-3.5 h-3.5 text-blue-500" />
                <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Venue</h3>
              </div>
              {venue ? (
                <>
                  <div className="text-sm font-bold text-neutral-900 truncate">{venue.name}</div>
                  <p className="text-xs text-neutral-500">
                    {[venue.city, match.attendance ? `${match.attendance.toLocaleString()} att.` : null].filter(Boolean).join(" · ")}
                  </p>
                </>
              ) : (
                <p className="text-sm text-neutral-400">Not available</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Form & Standings Context Strip */}
      {(homeStanding || awayStanding) && (
        <div className="max-w-7xl mx-auto px-4 pt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Standings */}
            {homeStanding && awayStanding && (
              <div className="bg-white rounded-xl border border-neutral-200 p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">League Position</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {homeTeam.logoUrl ? (
                        <ImageWithFallback src={homeTeam.logoUrl} alt={homeTeam.name} width={20} height={20} className="w-5 h-5 object-contain" />
                      ) : (
                        <Shield className="w-5 h-5 text-neutral-300" />
                      )}
                      <span className="text-xs font-medium text-neutral-900">{homeTeam.shortName || homeTeam.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-neutral-900">{ordinal(homeStanding.position)}</span>
                      <span className="text-xs text-neutral-500 ml-1.5">{homeStanding.points}pts · {homeStanding.won}W {homeStanding.drawn}D {homeStanding.lost}L</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {awayTeam.logoUrl ? (
                        <ImageWithFallback src={awayTeam.logoUrl} alt={awayTeam.name} width={20} height={20} className="w-5 h-5 object-contain" />
                      ) : (
                        <Shield className="w-5 h-5 text-neutral-300" />
                      )}
                      <span className="text-xs font-medium text-neutral-900">{awayTeam.shortName || awayTeam.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-neutral-900">{ordinal(awayStanding.position)}</span>
                      <span className="text-xs text-neutral-500 ml-1.5">{awayStanding.points}pts · {awayStanding.won}W {awayStanding.drawn}D {awayStanding.lost}L</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Form */}
            {(homeStanding?.form || awayStanding?.form) && (
              <div className="bg-white rounded-xl border border-neutral-200 p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                  <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Recent Form</h3>
                </div>
                <div className="space-y-2.5">
                  {homeStanding?.form && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-neutral-700 w-20 truncate">{homeTeam.shortName || homeTeam.name}</span>
                      <div className="flex gap-1">
                        {homeStanding.form.split("").slice(-5).map((r, i) => (
                          <span key={i} className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white ${r === "W" ? "bg-green-500" : r === "D" ? "bg-neutral-400" : "bg-red-500"}`}>{r}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {awayStanding?.form && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-neutral-700 w-20 truncate">{awayTeam.shortName || awayTeam.name}</span>
                      <div className="flex gap-1">
                        {awayStanding.form.split("").slice(-5).map((r, i) => (
                          <span key={i} className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white ${r === "W" ? "bg-green-500" : r === "D" ? "bg-neutral-400" : "bg-red-500"}`}>{r}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Match Stats (moved up) */}
            {events.length > 0 ? (
              <>
                <MatchStatBars
                  homeTeamName={homeTeam.shortName || homeTeam.name}
                  awayTeamName={awayTeam.shortName || awayTeam.name}
                  homeTeamLogo={homeTeam.logoUrl}
                  awayTeamLogo={awayTeam.logoUrl}
                  events={events}
                  homeTeamId={homeTeam.id}
                  awayTeamId={awayTeam.id}
                />
                <MatchTimeline
                  events={events}
                  homeTeamId={homeTeam.id}
                  awayTeamId={awayTeam.id}
                  homeTeamName={homeTeam.shortName || homeTeam.name}
                  awayTeamName={awayTeam.shortName || awayTeam.name}
                />
              </>
            ) : (
              <section className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-neutral-200">
                  <h2 className="text-lg font-bold text-neutral-900">
                    Match Events
                  </h2>
                </div>
                <div className="p-8 text-center text-neutral-500">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
                  <p>
                    {match.status === "scheduled"
                      ? "Match has not started yet"
                      : "No events recorded"}
                  </p>
                </div>
              </section>
            )}

            <BetweenContentAd />

            {/* AI Match Summary */}
            {match.status === "finished" && (
              <MatchSummary matchId={matchId} />
            )}

            {/* Formation View */}
            {homeLineups && awayLineups && (
              <FormationView
                homeTeam={{
                  name: homeTeam.name,
                  shortName: homeTeam.shortName,
                  primaryColor: homeTeam.primaryColor,
                  players: homeLineups.starters.map(({ lineup, player }) => ({
                    id: player.id,
                    name: player.name,
                    slug: player.slug,
                    position: lineup.position || player.position,
                    shirtNumber: lineup.shirtNumber,
                    isIndexable: player.isIndexable,
                  })),
                }}
                awayTeam={{
                  name: awayTeam.name,
                  shortName: awayTeam.shortName,
                  primaryColor: awayTeam.primaryColor,
                  players: awayLineups.starters.map(({ lineup, player }) => ({
                    id: player.id,
                    name: player.name,
                    slug: player.slug,
                    position: lineup.position || player.position,
                    shirtNumber: lineup.shirtNumber,
                    isIndexable: player.isIndexable,
                  })),
                }}
              />
            )}

            {/* Lineups */}
            {(homeLineups || awayLineups) && (
              <section className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-neutral-200">
                  <h2 className="text-lg font-bold text-neutral-900">Lineups</h2>
                </div>
                <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-200">
                  {/* Home Team Lineup */}
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-4">
                      {homeTeam.logoUrl ? (
                        <ImageWithFallback src={homeTeam.logoUrl} alt={homeTeam.name} width={32} height={32} className="w-8 h-8 object-contain" />
                      ) : (
                        <Shield className="w-8 h-8 text-neutral-300" />
                      )}
                      <h3 className="font-semibold text-neutral-900">
                        {homeTeam.shortName || homeTeam.name}
                      </h3>
                    </div>
                    {homeLineups ? (
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
                            Starting XI
                          </h4>
                          <div className="space-y-1">
                            {homeLineups.starters.map(({ lineup, player }) => (
                              <LineupPlayer
                                key={lineup.id}
                                player={player}
                                shirtNumber={lineup.shirtNumber}
                                isStarter={true}
                                position={lineup.position}
                                rating={lineup.rating}
                              />
                            ))}
                          </div>
                        </div>
                        {homeLineups.substitutes.length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
                              Substitutes
                            </h4>
                            <div className="space-y-1">
                              {homeLineups.substitutes.map(
                                ({ lineup, player }) => (
                                  <LineupPlayer
                                    key={lineup.id}
                                    player={player}
                                    shirtNumber={lineup.shirtNumber}
                                    isStarter={false}
                                    position={lineup.position}
                                    rating={lineup.rating}
                                  />
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-neutral-500 text-sm">
                        Lineup not available
                      </p>
                    )}
                  </div>

                  {/* Away Team Lineup */}
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-4">
                      {awayTeam.logoUrl ? (
                        <ImageWithFallback src={awayTeam.logoUrl} alt={awayTeam.name} width={32} height={32} className="w-8 h-8 object-contain" />
                      ) : (
                        <Shield className="w-8 h-8 text-neutral-300" />
                      )}
                      <h3 className="font-semibold text-neutral-900">
                        {awayTeam.shortName || awayTeam.name}
                      </h3>
                    </div>
                    {awayLineups ? (
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
                            Starting XI
                          </h4>
                          <div className="space-y-1">
                            {awayLineups.starters.map(({ lineup, player }) => (
                              <LineupPlayer
                                key={lineup.id}
                                player={player}
                                shirtNumber={lineup.shirtNumber}
                                isStarter={true}
                                position={lineup.position}
                                rating={lineup.rating}
                              />
                            ))}
                          </div>
                        </div>
                        {awayLineups.substitutes.length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
                              Substitutes
                            </h4>
                            <div className="space-y-1">
                              {awayLineups.substitutes.map(
                                ({ lineup, player }) => (
                                  <LineupPlayer
                                    key={lineup.id}
                                    player={player}
                                    shirtNumber={lineup.shirtNumber}
                                    isStarter={false}
                                    position={lineup.position}
                                    rating={lineup.rating}
                                  />
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-neutral-500 text-sm">
                        Lineup not available
                      </p>
                    )}
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Prediction Widget */}
            <MatchPredictionWidget
              matchId={matchId}
              matchStatus={match.status}
              homeTeamName={homeTeam.shortName || homeTeam.name}
              awayTeamName={awayTeam.shortName || awayTeam.name}
              homeScore={match.homeScore}
              awayScore={match.awayScore}
            />

            <SidebarAd />

            {/* Head to Head */}
            <HeadToHead
              team1Id={homeTeam.id}
              team2Id={awayTeam.id}
              team1Name={homeTeam.shortName || homeTeam.name}
              team2Name={awayTeam.shortName || awayTeam.name}
              team1Logo={homeTeam.logoUrl}
              team2Logo={awayTeam.logoUrl}
            />

            {/* Related Matches */}
            <RelatedMatches matchId={matchId} />

            {/* Internal Links for SEO */}
            <MatchInternalLinks
              competitionSlug={competition?.slug}
              competitionName={competition?.name}
            />
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
