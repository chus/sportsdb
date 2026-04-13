import { notFound } from "next/navigation";
import Link from "next/link";

export const revalidate = 3600; // ISR: revalidate every hour

import {
  MapPin,
  Calendar,
  Users,
  Building,
  Shield,
  Clock,
  Trophy,
  ChevronRight,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import type { Metadata } from "next";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  getVenueBySlug,
  getVenueTeams,
  getVenueMatches,
} from "@/lib/queries/venues";
import { getTeamStats } from "@/lib/queries/teams";
import { BreadcrumbJsonLd, VenueJsonLd, FAQJsonLd } from "@/components/seo/json-ld";
import { buildVenueFaqs, buildVenueAbout } from "@/lib/seo/entity-copy";
import { PageHeader } from "@/components/layout/page-header";
import { ExternalLinks } from "@/components/entity/external-links";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";

interface VenuePageProps {
  params: Promise<{ slug: string }>;
}

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export async function generateMetadata({
  params,
}: VenuePageProps): Promise<Metadata> {
  const { slug } = await params;
  const venue = await getVenueBySlug(slug);

  if (!venue) {
    return {
      title: "Venue Not Found | DataSports",
      robots: { index: false, follow: false },
    };
  }

  // Thin page check: venue needs at least a city
  const isThin = !venue.city;

  const title = `${venue.name} – Stadium Info & History | DataSports`;
  const description = `${venue.name}${venue.city ? ` in ${venue.city}` : ""}${venue.country ? `, ${venue.country}` : ""}. Capacity: ${venue.capacity?.toLocaleString() || "N/A"}. View teams, matches, and stadium information.`;

  return {
    title,
    description,
    ...(isThin && { robots: { index: false, follow: true } }),
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/venues/${slug}`,
      siteName: "DataSports",
      type: "website",
      images: [
        {
          url: venue.imageUrl || `${BASE_URL}/venues/${slug}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: venue.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [venue.imageUrl || `${BASE_URL}/venues/${slug}/opengraph-image`],
    },
    alternates: {
      canonical: `${BASE_URL}/venues/${slug}`,
    },
  };
}

export default async function VenuePage({ params }: VenuePageProps) {
  const { slug } = await params;

  const venue = await getVenueBySlug(slug);

  if (!venue) {
    notFound();
  }

  const [teamsData, matchesData] = await Promise.all([
    getVenueTeams(venue.id),
    getVenueMatches(venue.id),
  ]);

  // Hard 404 for truly empty venue pages (no city, no teams, no matches)
  if (!venue.city && teamsData.current.length === 0 && matchesData.recent.length === 0 && matchesData.upcoming.length === 0) {
    notFound();
  }

  const { current: currentTeams, historical: historicalTeams } = teamsData;
  const { recent: recentMatches, upcoming: upcomingMatches } = matchesData;

  // Fetch standings for primary home team
  const primaryTeam = currentTeams[0]?.team ?? null;
  const primaryTeamStats = primaryTeam ? await getTeamStats(primaryTeam.id) : [];
  const primaryStanding = primaryTeamStats[0]?.standing;
  const primaryCompetitionName = primaryTeamStats[0]?.competitionName;
  const primaryCompetitionSlug = primaryTeamStats[0]?.competitionSlug;

  // Compute venue aggregate stats
  const totalGoals = recentMatches.reduce((sum, m) => sum + (m.match.homeScore ?? 0) + (m.match.awayScore ?? 0), 0);
  const avgGoals = recentMatches.length > 0 ? (totalGoals / recentMatches.length).toFixed(1) : null;
  const matchesWithAttendance = recentMatches.filter(m => m.match.attendance && m.match.attendance > 0);
  const avgAttendance = matchesWithAttendance.length > 0
    ? Math.round(matchesWithAttendance.reduce((sum, m) => sum + (m.match.attendance ?? 0), 0) / matchesWithAttendance.length)
    : null;

  const venueUrl = `${BASE_URL}/venues/${slug}`;

  const aboutParagraphs = buildVenueAbout({
    name: venue.name,
    city: venue.city,
    country: venue.country,
    capacity: venue.capacity,
    openedYear: venue.openedYear,
    currentTeamNames: currentTeams.map((t) => t.team.name),
    historicalTeamCount: historicalTeams.length,
    recentMatchCount: recentMatches.length,
    upcomingMatchCount: upcomingMatches.length,
  });

  const faqItems = buildVenueFaqs({
    name: venue.name,
    city: venue.city,
    country: venue.country,
    capacity: venue.capacity,
    openedYear: venue.openedYear,
    homeTeamNames: currentTeams.map((t) => t.team.name),
  });

  const subtitle = [
    venue.city,
    venue.country,
    venue.openedYear ? `Est. ${venue.openedYear}` : null,
  ].filter(Boolean).join(" · ");

  const nextMatch = upcomingMatches[0] ?? null;
  const lastMatch = recentMatches[0] ?? null;

  return (
    <>
    <BreadcrumbJsonLd
      items={[
        { name: "Home", url: BASE_URL },
        { name: "Venues", url: `${BASE_URL}/venues` },
        { name: venue.name, url: venueUrl },
      ]}
    />
    <VenueJsonLd
      name={venue.name}
      url={venueUrl}
      image={venue.imageUrl}
      address={{ city: venue.city, country: venue.country }}
      capacity={venue.capacity}
      geo={{ latitude: venue.latitude ? Number(venue.latitude) : null, longitude: venue.longitude ? Number(venue.longitude) : null }}
      events={upcomingMatches.slice(0, 5).map((m) => ({
        name: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
        startDate: new Date(m.match.scheduledAt).toISOString(),
        ...(m.match.slug && { url: `${BASE_URL}/matches/${m.match.slug}` }),
      }))}
    />
    {faqItems.length > 0 && <FAQJsonLd items={faqItems} />}
    <div className="min-h-screen bg-neutral-50">
      {/* Compact Header */}
      <PageHeader
        title={venue.name}
        subtitle={subtitle}
        accentColor="bg-neutral-800"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Venues", href: "/venues" },
          { label: venue.name },
        ]}
        icon={
          <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Building className="w-7 h-7 text-white/80" />
          </div>
        }
        stats={[
          ...(venue.capacity ? [{ label: "Capacity", value: venue.capacity.toLocaleString() }] : []),
          { label: "Home Teams", value: currentTeams.length },
          { label: "Matches", value: recentMatches.length + upcomingMatches.length },
        ]}
      />

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Data Dashboard — 4 cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Home Teams */}
              <div className="bg-white rounded-xl border border-neutral-200 p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Shield className="w-3.5 h-3.5 text-blue-500" />
                  <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Home Teams</h3>
                </div>
                {currentTeams.length > 0 ? (
                  <div className="space-y-1.5">
                    {currentTeams.slice(0, 3).map(({ team }) => (
                      <Link key={team.id} href={`/teams/${team.slug}`} className="flex items-center gap-2 group">
                        {team.logoUrl ? (
                          <ImageWithFallback src={team.logoUrl} alt={team.name} width={20} height={20} className="w-5 h-5 object-contain" />
                        ) : (
                          <Shield className="w-5 h-5 text-neutral-300" />
                        )}
                        <span className="text-xs font-medium text-neutral-900 truncate group-hover:text-blue-600">{team.shortName || team.name}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400">No data</p>
                )}
              </div>

              {/* Next Match */}
              {nextMatch ? (
                <Link
                  href={`/matches/${nextMatch.match.slug ?? nextMatch.match.id}`}
                  className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md hover:border-blue-200 transition-all"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                    <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Next Match</h3>
                  </div>
                  <div className="text-xs font-medium text-neutral-900 truncate">
                    {nextMatch.homeTeam.shortName || nextMatch.homeTeam.name} vs {nextMatch.awayTeam.shortName || nextMatch.awayTeam.name}
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {format(new Date(nextMatch.match.scheduledAt), "EEE, MMM d")}
                  </p>
                  <p className="text-xs font-medium text-blue-600 mt-0.5">
                    {formatDistanceToNowStrict(new Date(nextMatch.match.scheduledAt), { addSuffix: true })}
                  </p>
                </Link>
              ) : (
                <div className="bg-white rounded-xl border border-neutral-200 p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                    <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Next Match</h3>
                  </div>
                  <p className="text-sm text-neutral-400">No upcoming</p>
                </div>
              )}

              {/* Last Result */}
              {lastMatch ? (
                <Link
                  href={`/matches/${lastMatch.match.slug ?? lastMatch.match.id}`}
                  className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md hover:border-blue-200 transition-all"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Last Result</h3>
                  </div>
                  <div className="text-lg font-black text-neutral-900">
                    {lastMatch.match.homeScore}-{lastMatch.match.awayScore}
                  </div>
                  <p className="text-xs text-neutral-500 truncate">
                    {lastMatch.homeTeam.shortName || lastMatch.homeTeam.name} vs {lastMatch.awayTeam.shortName || lastMatch.awayTeam.name}
                  </p>
                </Link>
              ) : (
                <div className="bg-white rounded-xl border border-neutral-200 p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Trophy className="w-3.5 h-3.5 text-neutral-400" />
                    <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Last Result</h3>
                  </div>
                  <p className="text-sm text-neutral-400">No data</p>
                </div>
              )}

              {/* Capacity */}
              <div className="bg-white rounded-xl border border-neutral-200 p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Users className="w-3.5 h-3.5 text-green-500" />
                  <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Stadium</h3>
                </div>
                {venue.capacity ? (
                  <>
                    <div className="text-2xl font-black text-neutral-900">{venue.capacity.toLocaleString()}</div>
                    <p className="text-xs text-neutral-500">capacity</p>
                    {venue.openedYear && <p className="text-xs text-neutral-500 mt-0.5">Opened {venue.openedYear}</p>}
                  </>
                ) : (
                  <p className="text-sm text-neutral-400">Not available</p>
                )}
              </div>
            </div>

            {/* Home Team Context + Venue Stats */}
            {(primaryStanding || avgGoals) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Home Team Standings */}
                {primaryStanding && primaryTeam && (
                  <Link
                    href={`/competitions/${primaryCompetitionSlug}`}
                    className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md hover:border-blue-200 transition-all"
                  >
                    <div className="flex items-center gap-1.5 mb-3">
                      <Trophy className="w-3.5 h-3.5 text-amber-500" />
                      <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Home Team in League</h3>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {primaryTeam.logoUrl ? (
                          <ImageWithFallback src={primaryTeam.logoUrl} alt={primaryTeam.name} width={24} height={24} className="w-6 h-6 object-contain" />
                        ) : (
                          <Shield className="w-6 h-6 text-neutral-300" />
                        )}
                        <span className="text-sm font-bold text-neutral-900">{primaryTeam.shortName || primaryTeam.name}</span>
                      </div>
                      <span className="text-2xl font-black text-neutral-900">{primaryStanding.position}<sup className="text-xs font-medium text-neutral-500">{primaryStanding.position === 1 ? "st" : primaryStanding.position === 2 ? "nd" : primaryStanding.position === 3 ? "rd" : "th"}</sup></span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-neutral-500">
                      <span>{primaryCompetitionName}</span>
                      <span>{primaryStanding.points}pts · {primaryStanding.won}W {primaryStanding.drawn}D {primaryStanding.lost}L</span>
                    </div>
                    {primaryStanding.form && (
                      <div className="flex gap-1 mt-2">
                        {primaryStanding.form.split("").slice(-5).map((r, i) => (
                          <span key={i} className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white ${r === "W" ? "bg-green-500" : r === "D" ? "bg-neutral-400" : "bg-red-500"}`}>{r}</span>
                        ))}
                      </div>
                    )}
                  </Link>
                )}

                {/* Venue Stats */}
                {(avgGoals || avgAttendance) && (
                  <div className="bg-white rounded-xl border border-neutral-200 p-4">
                    <div className="flex items-center gap-1.5 mb-3">
                      <BarChart3 className="w-3.5 h-3.5 text-purple-500" />
                      <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Venue Stats</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-2 bg-neutral-50 rounded-lg">
                        <div className="text-lg font-bold text-neutral-900">{recentMatches.length}</div>
                        <div className="text-[10px] text-neutral-500">Matches</div>
                      </div>
                      {avgGoals && (
                        <div className="text-center p-2 bg-neutral-50 rounded-lg">
                          <div className="text-lg font-bold text-green-600">{avgGoals}</div>
                          <div className="text-[10px] text-neutral-500">Goals/Match</div>
                        </div>
                      )}
                      {avgAttendance && (
                        <div className="text-center p-2 bg-neutral-50 rounded-lg">
                          <div className="text-lg font-bold text-blue-600">{(avgAttendance / 1000).toFixed(1)}k</div>
                          <div className="text-[10px] text-neutral-500">Avg Attend.</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Recent Results Strip */}
            {recentMatches.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-neutral-900 mb-3">Recent Results</h3>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                  {recentMatches.slice(0, 6).map(({ match, homeTeam, awayTeam }) => (
                    <Link
                      key={match.id}
                      href={`/matches/${match.slug ?? match.id}`}
                      className="flex-shrink-0 w-[160px] bg-white rounded-lg border border-neutral-200 p-3 hover:shadow-md hover:border-blue-200 transition-all"
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        {homeTeam.logoUrl ? (
                          <ImageWithFallback src={homeTeam.logoUrl} alt={homeTeam.name} width={16} height={16} className="w-4 h-4 object-contain" />
                        ) : (
                          <Shield className="w-4 h-4 text-neutral-300" />
                        )}
                        <span className="text-xs text-neutral-700 truncate">{homeTeam.shortName || homeTeam.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        {awayTeam.logoUrl ? (
                          <ImageWithFallback src={awayTeam.logoUrl} alt={awayTeam.name} width={16} height={16} className="w-4 h-4 object-contain" />
                        ) : (
                          <Shield className="w-4 h-4 text-neutral-300" />
                        )}
                        <span className="text-xs text-neutral-700 truncate">{awayTeam.shortName || awayTeam.name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-neutral-900">
                          {match.homeScore}-{match.awayScore}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          {format(new Date(match.scheduledAt), "MMM d")}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Matches */}
            {upcomingMatches.length > 0 && (
              <div className="bg-white rounded-xl border border-neutral-200 p-5">
                <h3 className="text-sm font-bold text-neutral-900 mb-3">Upcoming Matches</h3>
                <div className="space-y-2">
                  {upcomingMatches.slice(0, 5).map(({ match, homeTeam, awayTeam, competition }) => (
                    <Link
                      key={match.id}
                      href={`/matches/${match.slug ?? match.id}`}
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-neutral-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {homeTeam.logoUrl ? (
                            <ImageWithFallback src={homeTeam.logoUrl} alt={homeTeam.name} width={20} height={20} className="w-5 h-5 object-contain flex-shrink-0" />
                          ) : (
                            <Shield className="w-5 h-5 text-neutral-300 flex-shrink-0" />
                          )}
                          <span className="text-xs font-medium text-neutral-900 truncate">{homeTeam.shortName || homeTeam.name}</span>
                        </div>
                        <span className="text-[10px] text-neutral-400 flex-shrink-0">vs</span>
                        <div className="flex items-center gap-1.5 min-w-0">
                          {awayTeam.logoUrl ? (
                            <ImageWithFallback src={awayTeam.logoUrl} alt={awayTeam.name} width={20} height={20} className="w-5 h-5 object-contain flex-shrink-0" />
                          ) : (
                            <Shield className="w-5 h-5 text-neutral-300 flex-shrink-0" />
                          )}
                          <span className="text-xs font-medium text-neutral-900 truncate">{awayTeam.shortName || awayTeam.name}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <div className="text-xs text-neutral-500">{format(new Date(match.scheduledAt), "MMM d, HH:mm")}</div>
                        <div className="text-[10px] font-medium text-blue-600">
                          {formatDistanceToNowStrict(new Date(match.scheduledAt), { addSuffix: true })}
                        </div>
                        {competition && (
                          <div className="text-[10px] text-neutral-400 truncate max-w-[120px]">{competition.name}</div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* No matches message */}
            {recentMatches.length === 0 && upcomingMatches.length === 0 && (
              <section className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
                <Clock className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <p className="text-neutral-500">No matches scheduled at this venue</p>
              </section>
            )}

            {/* About (below fold) */}
            {aboutParagraphs.length > 0 && (
              <section className="bg-white rounded-xl border border-neutral-200 p-6">
                <h2 className="text-lg font-bold text-neutral-900 mb-4">About {venue.name}</h2>
                <div className="space-y-4">
                  {aboutParagraphs.map((p, i) => (
                    <p key={i} className="text-neutral-700 leading-relaxed">{p}</p>
                  ))}
                </div>
              </section>
            )}

            {/* Current Teams (detailed) */}
            {currentTeams.length > 0 && (
              <section className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-neutral-200">
                  <h2 className="text-lg font-bold text-neutral-900">
                    Home Teams
                  </h2>
                </div>
                <div className="p-4">
                  <div className="grid sm:grid-cols-2 gap-3">
                    {currentTeams.map(({ team, validFrom }) => (
                      <Link
                        key={team.id}
                        href={`/teams/${team.slug}`}
                        className="flex items-center gap-4 p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors group"
                      >
                        <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center p-2">
                          {team.logoUrl ? (
                            <img
                              src={team.logoUrl}
                              alt={team.name}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <Shield className="w-8 h-8 text-neutral-300" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-neutral-900 truncate group-hover:text-blue-600 transition-colors">
                            {team.name}
                          </div>
                          <div className="text-sm text-neutral-500">
                            Since {new Date(validFrom).getFullYear()}
                          </div>
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
            {/* Competition & Leaderboard Links */}
            {primaryCompetitionSlug && primaryCompetitionName && (
              <div className="bg-white rounded-xl border border-neutral-200 p-4">
                <h3 className="text-sm font-medium text-neutral-500 mb-3 flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  League
                </h3>
                <Link
                  href={`/competitions/${primaryCompetitionSlug}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 transition-colors group"
                >
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900 group-hover:text-blue-600 transition-colors">{primaryCompetitionName}</p>
                    <p className="text-xs text-neutral-500">View standings & results</p>
                  </div>
                </Link>
                <div className="flex gap-2 mt-3">
                  <Link
                    href={`/top-scorers/${primaryCompetitionSlug}`}
                    className="flex-1 text-center text-xs font-medium text-blue-600 bg-blue-50 rounded-lg py-2 hover:bg-blue-100 transition-colors"
                  >
                    Top Scorers
                  </Link>
                  <Link
                    href={`/top-assists/${primaryCompetitionSlug}`}
                    className="flex-1 text-center text-xs font-medium text-blue-600 bg-blue-50 rounded-lg py-2 hover:bg-blue-100 transition-colors"
                  >
                    Top Assists
                  </Link>
                </div>
              </div>
            )}

            <ExternalLinks
              wikipediaUrl={venue.wikipediaUrl}
              entityName={venue.name}
            />

            {/* Historical Teams */}
            {historicalTeams.length > 0 && (
              <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <h3 className="text-sm font-medium text-neutral-500 mb-4">
                  Former Home Teams
                </h3>
                <div className="space-y-3">
                  {historicalTeams.map(({ team, validFrom, validTo }) => (
                    <Link
                      key={team.id}
                      href={`/teams/${team.slug}`}
                      className="flex items-center gap-3 p-2 hover:bg-neutral-50 rounded-lg transition-colors group"
                    >
                      <div className="w-8 h-8 bg-neutral-100 rounded flex items-center justify-center">
                        {team.logoUrl ? (
                          <img
                            src={team.logoUrl}
                            alt={team.name}
                            className="w-6 h-6 object-contain"
                          />
                        ) : (
                          <Shield className="w-5 h-5 text-neutral-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-neutral-900 truncate group-hover:text-blue-600 transition-colors">
                          {team.name}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {new Date(validFrom).getFullYear()} -{" "}
                          {validTo ? new Date(validTo).getFullYear() : "Present"}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Location Card */}
            {(venue.latitude || venue.longitude) && (
              <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <h3 className="text-sm font-medium text-neutral-500 mb-4">
                  Location
                </h3>
                <div className="aspect-video bg-neutral-100 rounded-lg flex items-center justify-center">
                  <MapPin className="w-8 h-8 text-neutral-400" />
                </div>
                <p className="text-xs text-neutral-500 mt-2 text-center">
                  {venue.latitude}, {venue.longitude}
                </p>
              </div>
            )}

            {faqItems.length > 0 && (
              <section className="bg-white rounded-xl border border-neutral-200 p-5">
                <h3 className="text-sm font-bold text-neutral-900 mb-3">Venue FAQ</h3>
                <div className="space-y-2">
                  {faqItems.map((item) => (
                    <details
                      key={item.question}
                      className="group rounded-lg border border-neutral-200 px-3 py-2"
                    >
                      <summary className="cursor-pointer list-none text-sm font-medium text-neutral-900">
                        {item.question}
                      </summary>
                      <p className="mt-2 text-xs leading-5 text-neutral-600">{item.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
