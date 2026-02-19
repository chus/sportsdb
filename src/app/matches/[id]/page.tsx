import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Clock,
  Shield,
  Trophy,
  User,
} from "lucide-react";
import type { Metadata } from "next";
import { format } from "date-fns";
import {
  getMatchWithDetails,
  getMatchEventsWithPlayers,
  getMatchLineupsGrouped,
} from "@/lib/queries/matches";
import { MatchJsonLd, BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { RelatedMatches } from "@/components/entity/related-entities";
import { HeadToHead } from "@/components/match/head-to-head";
import { FormationView } from "@/components/match/formation-view";
import { MatchInternalLinks } from "@/components/seo/internal-links";

interface MatchPageProps {
  params: Promise<{ id: string }>;
}

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://sportsdb-nine.vercel.app";

export async function generateMetadata({
  params,
}: MatchPageProps): Promise<Metadata> {
  const { id } = await params;
  const match = await getMatchWithDetails(id);

  if (!match || !match.homeTeam || !match.awayTeam) {
    return { title: "Match Not Found" };
  }

  const homeTeam = match.homeTeam.shortName || match.homeTeam.name;
  const awayTeam = match.awayTeam.shortName || match.awayTeam.name;
  const score =
    match.status === "finished" || match.status === "live"
      ? `${match.homeScore ?? 0} - ${match.awayScore ?? 0}`
      : "vs";
  const title = `${homeTeam} ${score} ${awayTeam} | SportsDB`;
  const description = `${match.homeTeam.name} vs ${match.awayTeam.name}${
    match.competition ? ` - ${match.competition.name}` : ""
  }${match.venue ? ` at ${match.venue.name}` : ""}. Match events, lineups, and statistics.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/matches/${id}`,
      siteName: "SportsDB",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: `${BASE_URL}/matches/${id}`,
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
    player: { name: string; slug: string } | null;
    secondaryPlayer: { name: string; slug: string } | null;
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
          <Link
            href={`/players/${event.player.slug}`}
            className="font-medium hover:text-blue-600 transition-colors"
          >
            {event.player.name}
          </Link>
        )}
        {event.type === "substitution" && event.secondaryPlayer && (
          <span className="text-neutral-500 text-sm">
            {" "}
            for{" "}
            <Link
              href={`/players/${event.secondaryPlayer.slug}`}
              className="hover:text-blue-600 transition-colors"
            >
              {event.secondaryPlayer.name}
            </Link>
          </span>
        )}
        {event.type === "goal" && event.secondaryPlayer && (
          <span className="text-neutral-500 text-sm">
            {" "}
            (assist:{" "}
            <Link
              href={`/players/${event.secondaryPlayer.slug}`}
              className="hover:text-blue-600 transition-colors"
            >
              {event.secondaryPlayer.name}
            </Link>
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
  player: { name: string; slug: string; position: string };
  shirtNumber: number | null;
  isStarter: boolean;
  position: string | null;
  rating: string | null;
}) {
  return (
    <Link
      href={`/players/${player.slug}`}
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
    </Link>
  );
}

export default async function MatchPage({ params }: MatchPageProps) {
  const { id } = await params;

  const [match, events, lineups] = await Promise.all([
    getMatchWithDetails(id),
    getMatchEventsWithPlayers(id),
    getMatchLineupsGrouped(id),
  ]);

  if (!match || !match.homeTeam || !match.awayTeam) {
    notFound();
  }

  const { homeTeam, awayTeam, venue, competition, season } = match;
  const statusDisplay = getStatusDisplay(match.status, match.minute);

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
    { name: `${homeTeam.shortName || homeTeam.name} vs ${awayTeam.shortName || awayTeam.name}`, url: `${BASE_URL}/matches/${id}` },
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
        venue={venue ? { name: venue.name, url: `${BASE_URL}/venues/${venue.slug}` } : null}
        competition={competition ? { name: competition.name, url: `${BASE_URL}/competitions/${competition.slug}` } : null}
        matchUrl={`${BASE_URL}/matches/${id}`}
      />
      <BreadcrumbJsonLd items={breadcrumbItems} />
    <div className="min-h-screen bg-neutral-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Back button & Competition */}
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            {competition && (
              <Link
                href={`/competitions/${competition.slug}`}
                className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
              >
                <Trophy className="w-4 h-4" />
                <span>
                  {competition.name}
                  {season && ` ${season.label}`}
                </span>
              </Link>
            )}
          </div>

          {/* Match Score Display */}
          <div className="flex items-center justify-center gap-4 md:gap-8 py-8">
            {/* Home Team */}
            <Link
              href={`/teams/${homeTeam.slug}`}
              className="flex flex-col items-center gap-3 flex-1 max-w-48 group"
            >
              <div className="w-20 h-20 md:w-28 md:h-28 bg-white rounded-2xl flex items-center justify-center p-3 group-hover:shadow-lg transition-shadow">
                {homeTeam.logoUrl ? (
                  <img
                    src={homeTeam.logoUrl}
                    alt={homeTeam.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Shield className="w-12 h-12 md:w-16 md:h-16 text-neutral-300" />
                )}
              </div>
              <span className="text-center font-semibold group-hover:underline">
                {homeTeam.shortName || homeTeam.name}
              </span>
            </Link>

            {/* Score */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-3 md:gap-6">
                <span className="text-4xl md:text-6xl font-bold">
                  {match.homeScore ?? "-"}
                </span>
                <span className="text-2xl md:text-4xl text-white/60">:</span>
                <span className="text-4xl md:text-6xl font-bold">
                  {match.awayScore ?? "-"}
                </span>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${statusDisplay.className}`}
              >
                {statusDisplay.label}
              </span>
            </div>

            {/* Away Team */}
            <Link
              href={`/teams/${awayTeam.slug}`}
              className="flex flex-col items-center gap-3 flex-1 max-w-48 group"
            >
              <div className="w-20 h-20 md:w-28 md:h-28 bg-white rounded-2xl flex items-center justify-center p-3 group-hover:shadow-lg transition-shadow">
                {awayTeam.logoUrl ? (
                  <img
                    src={awayTeam.logoUrl}
                    alt={awayTeam.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Shield className="w-12 h-12 md:w-16 md:h-16 text-neutral-300" />
                )}
              </div>
              <span className="text-center font-semibold group-hover:underline">
                {awayTeam.shortName || awayTeam.name}
              </span>
            </Link>
          </div>

          {/* Match Info Bar */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/80">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>
                {format(new Date(match.scheduledAt), "EEEE, MMMM d, yyyy")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{format(new Date(match.scheduledAt), "HH:mm")}</span>
            </div>
            {venue && (
              <Link
                href={`/venues/${venue.slug}`}
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <MapPin className="w-4 h-4" />
                <span>{venue.name}</span>
              </Link>
            )}
            {match.attendance && (
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>{match.attendance.toLocaleString()} attendance</span>
              </div>
            )}
            {match.referee && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span>Referee: {match.referee}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Match Events Timeline */}
            <section className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-200">
                <h2 className="text-lg font-bold text-neutral-900">
                  Match Events
                </h2>
              </div>
              {events.length === 0 ? (
                <div className="p-8 text-center text-neutral-500">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
                  <p>
                    {match.status === "scheduled"
                      ? "Match has not started yet"
                      : "No events recorded"}
                  </p>
                </div>
              ) : (
                <div className="px-6 py-4">
                  <div className="flex items-center justify-between text-sm font-medium text-neutral-500 mb-4 pb-2 border-b border-neutral-100">
                    <span>{homeTeam.shortName || homeTeam.name}</span>
                    <span>{awayTeam.shortName || awayTeam.name}</span>
                  </div>
                  <div className="space-y-1">
                    {events.map((event) => (
                      <MatchEventItem
                        key={event.id}
                        event={event}
                        isHomeTeam={event.teamId === homeTeam.id}
                      />
                    ))}
                  </div>
                </div>
              )}
            </section>

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
                        <img
                          src={homeTeam.logoUrl}
                          alt={homeTeam.name}
                          className="w-8 h-8 object-contain"
                        />
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
                        <img
                          src={awayTeam.logoUrl}
                          alt={awayTeam.name}
                          className="w-8 h-8 object-contain"
                        />
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
            {/* Match Info Card */}
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <h3 className="text-sm font-medium text-neutral-500 mb-4">
                Match Info
              </h3>
              <dl className="space-y-3 text-sm">
                {competition && (
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">Competition</dt>
                    <dd className="font-medium text-neutral-900 text-right">
                      <Link
                        href={`/competitions/${competition.slug}`}
                        className="hover:text-blue-600 transition-colors"
                      >
                        {competition.name}
                      </Link>
                    </dd>
                  </div>
                )}
                {season && (
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">Season</dt>
                    <dd className="font-medium text-neutral-900">
                      {season.label}
                    </dd>
                  </div>
                )}
                {match.matchday && (
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">Matchday</dt>
                    <dd className="font-medium text-neutral-900">
                      {match.matchday}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-neutral-600">Date</dt>
                  <dd className="font-medium text-neutral-900">
                    {format(new Date(match.scheduledAt), "MMM d, yyyy")}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-600">Kick-off</dt>
                  <dd className="font-medium text-neutral-900">
                    {format(new Date(match.scheduledAt), "HH:mm")}
                  </dd>
                </div>
                {venue && (
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">Venue</dt>
                    <dd className="font-medium text-neutral-900 text-right">
                      <Link
                        href={`/venues/${venue.slug}`}
                        className="hover:text-blue-600 transition-colors"
                      >
                        {venue.name}
                      </Link>
                    </dd>
                  </div>
                )}
                {match.attendance && (
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">Attendance</dt>
                    <dd className="font-medium text-neutral-900">
                      {match.attendance.toLocaleString()}
                    </dd>
                  </div>
                )}
                {match.referee && (
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">Referee</dt>
                    <dd className="font-medium text-neutral-900">
                      {match.referee}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Goal Scorers Card */}
            {(homeEvents.filter((e) => e.type === "goal").length > 0 ||
              awayEvents.filter((e) => e.type === "goal").length > 0) && (
              <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <h3 className="text-sm font-medium text-neutral-500 mb-4">
                  Goals
                </h3>
                <div className="space-y-4">
                  {homeEvents.filter((e) => e.type === "goal" || e.type === "own_goal").length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {homeTeam.logoUrl ? (
                          <img
                            src={homeTeam.logoUrl}
                            alt={homeTeam.name}
                            className="w-5 h-5 object-contain"
                          />
                        ) : (
                          <Shield className="w-5 h-5 text-neutral-300" />
                        )}
                        <span className="text-xs font-medium text-neutral-600">
                          {homeTeam.shortName || homeTeam.name}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {homeEvents
                          .filter((e) => e.type === "goal" || e.type === "own_goal")
                          .map((e) => (
                            <div
                              key={e.id}
                              className="flex items-center justify-between text-sm"
                            >
                              {e.player ? (
                                <Link
                                  href={`/players/${e.player.slug}`}
                                  className="hover:text-blue-600 transition-colors"
                                >
                                  {e.player.name}
                                  {e.type === "own_goal" && " (OG)"}
                                </Link>
                              ) : (
                                <span>Unknown</span>
                              )}
                              <span className="text-neutral-500">
                                {e.minute}&apos;
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                  {awayEvents.filter((e) => e.type === "goal" || e.type === "own_goal").length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {awayTeam.logoUrl ? (
                          <img
                            src={awayTeam.logoUrl}
                            alt={awayTeam.name}
                            className="w-5 h-5 object-contain"
                          />
                        ) : (
                          <Shield className="w-5 h-5 text-neutral-300" />
                        )}
                        <span className="text-xs font-medium text-neutral-600">
                          {awayTeam.shortName || awayTeam.name}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {awayEvents
                          .filter((e) => e.type === "goal" || e.type === "own_goal")
                          .map((e) => (
                            <div
                              key={e.id}
                              className="flex items-center justify-between text-sm"
                            >
                              {e.player ? (
                                <Link
                                  href={`/players/${e.player.slug}`}
                                  className="hover:text-blue-600 transition-colors"
                                >
                                  {e.player.name}
                                  {e.type === "own_goal" && " (OG)"}
                                </Link>
                              ) : (
                                <span>Unknown</span>
                              )}
                              <span className="text-neutral-500">
                                {e.minute}&apos;
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cards Summary */}
            {events.filter(
              (e) => e.type === "yellow_card" || e.type === "red_card"
            ).length > 0 && (
              <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <h3 className="text-sm font-medium text-neutral-500 mb-4">
                  Cards
                </h3>
                <div className="space-y-2">
                  {events
                    .filter(
                      (e) => e.type === "yellow_card" || e.type === "red_card"
                    )
                    .map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span>
                            {e.type === "yellow_card" ? "🟨" : "🟥"}
                          </span>
                          {e.player ? (
                            <Link
                              href={`/players/${e.player.slug}`}
                              className="hover:text-blue-600 transition-colors"
                            >
                              {e.player.name}
                            </Link>
                          ) : (
                            <span>Unknown</span>
                          )}
                        </div>
                        <span className="text-neutral-500">{e.minute}&apos;</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

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
            <RelatedMatches matchId={id} />

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
