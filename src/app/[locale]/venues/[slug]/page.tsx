import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";

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
import { localizedAlternates } from "@/lib/seo/hreflang";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  getVenueBySlug,
  getVenueTeams,
  getVenueMatches,
} from "@/lib/queries/venues";
import { getTeamStats } from "@/lib/queries/teams";
import { BreadcrumbJsonLd, VenueJsonLd, FAQJsonLd } from "@/components/seo/json-ld";
import { buildVenueFaqs, buildVenueFaqsEs, buildVenueAbout, buildVenueAboutEs } from "@/lib/seo/entity-copy";
import { PageHeader } from "@/components/layout/page-header";
import { ExternalLinks } from "@/components/entity/external-links";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { PageTracker } from "@/components/analytics/page-tracker";

interface VenuePageProps {
  params: Promise<{ slug: string; locale: string }>;
}

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export async function generateMetadata({
  params,
}: VenuePageProps): Promise<Metadata> {
  const { slug } = await params;
  const venue = await getVenueBySlug(slug);

  if (!venue) {
    notFound();
  }

  // Thin page check: venue needs at least a city
  const isThin = !venue.city;

  const title = `${venue.name} – Stadium Info & History`;
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
    alternates: localizedAlternates(`/venues/${slug}`),
  };
}

export default async function VenuePage({ params }: VenuePageProps) {
  const { slug, locale } = await params;

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

  const aboutArgs = {
    name: venue.name,
    city: venue.city,
    country: venue.country,
    capacity: venue.capacity,
    openedYear: venue.openedYear,
    currentTeamNames: currentTeams.map((t) => t.team.name),
    historicalTeamCount: historicalTeams.length,
    recentMatchCount: recentMatches.length,
    upcomingMatchCount: upcomingMatches.length,
  };
  const aboutParagraphs = locale === "es"
    ? buildVenueAboutEs(aboutArgs)
    : buildVenueAbout(aboutArgs);

  const faqArgs = {
    name: venue.name,
    city: venue.city,
    country: venue.country,
    capacity: venue.capacity,
    openedYear: venue.openedYear,
    homeTeamNames: currentTeams.map((t) => t.team.name),
  };
  const faqItems = locale === "es"
    ? buildVenueFaqsEs(faqArgs)
    : buildVenueFaqs(faqArgs);

  const subtitle = [
    venue.city,
    venue.country,
    venue.openedYear ? `Est. ${venue.openedYear}` : null,
  ].filter(Boolean).join(" · ");

  const nextMatch = upcomingMatches[0] ?? null;
  const lastMatch = recentMatches[0] ?? null;

  return (
    <>
    <PageTracker />
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
    <div className="min-h-screen bg-surface-2">
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
          <div className="w-14 h-14 bg-surface/20 rounded-xl flex items-center justify-center flex-shrink-0">
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
              <div className="bg-surface rounded-xl border border-line p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Shield className="w-3.5 h-3.5 text-blue-500" />
                  <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide">Home Teams</h3>
                </div>
                {currentTeams.length > 0 ? (
                  <div className="space-y-1.5">
                    {currentTeams.slice(0, 3).map(({ team }) => (
                      <Link key={team.id} href={`/teams/${team.slug}`} className="flex items-center gap-2 group">
                        {team.logoUrl ? (
                          <ImageWithFallback src={team.logoUrl} alt={team.name} width={20} height={20} className="w-5 h-5 object-contain" />
                        ) : (
                          <Shield className="w-5 h-5 text-faint" />
                        )}
                        <span className="text-xs font-medium text-ink truncate group-hover:text-blue-600">{team.shortName || team.name}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-faint">No data</p>
                )}
              </div>

              {/* Next Match */}
              {nextMatch ? (
                <Link
                  href={`/matches/${nextMatch.match.slug ?? nextMatch.match.id}`}
                  className="bg-surface rounded-xl border border-line p-4 hover:shadow-md hover:border-blue-200 transition-all"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                    <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide">Next Match</h3>
                  </div>
                  <div className="text-xs font-medium text-ink truncate">
                    {nextMatch.homeTeam.shortName || nextMatch.homeTeam.name} vs {nextMatch.awayTeam.shortName || nextMatch.awayTeam.name}
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    {format(new Date(nextMatch.match.scheduledAt), "EEE, MMM d")}
                  </p>
                  <p className="text-xs font-medium text-blue-600 mt-0.5">
                    {formatDistanceToNowStrict(new Date(nextMatch.match.scheduledAt), { addSuffix: true })}
                  </p>
                </Link>
              ) : (
                <div className="bg-surface rounded-xl border border-line p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Calendar className="w-3.5 h-3.5 text-faint" />
                    <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide">Next Match</h3>
                  </div>
                  <p className="text-sm text-faint">No upcoming</p>
                </div>
              )}

              {/* Last Result */}
              {lastMatch ? (
                <Link
                  href={`/matches/${lastMatch.match.slug ?? lastMatch.match.id}`}
                  className="bg-surface rounded-xl border border-line p-4 hover:shadow-md hover:border-blue-200 transition-all"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide">Last Result</h3>
                  </div>
                  <div className="text-lg font-black text-ink">
                    {lastMatch.match.homeScore}-{lastMatch.match.awayScore}
                  </div>
                  <p className="text-xs text-muted truncate">
                    {lastMatch.homeTeam.shortName || lastMatch.homeTeam.name} vs {lastMatch.awayTeam.shortName || lastMatch.awayTeam.name}
                  </p>
                </Link>
              ) : (
                <div className="bg-surface rounded-xl border border-line p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Trophy className="w-3.5 h-3.5 text-faint" />
                    <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide">Last Result</h3>
                  </div>
                  <p className="text-sm text-faint">No data</p>
                </div>
              )}

              {/* Capacity */}
              <div className="bg-surface rounded-xl border border-line p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Users className="w-3.5 h-3.5 text-green-500" />
                  <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide">Stadium</h3>
                </div>
                {venue.capacity ? (
                  <>
                    <div className="text-2xl font-black text-ink">{venue.capacity.toLocaleString()}</div>
                    <p className="text-xs text-muted">capacity</p>
                    {venue.openedYear && <p className="text-xs text-muted mt-0.5">Opened {venue.openedYear}</p>}
                  </>
                ) : (
                  <p className="text-sm text-faint">Not available</p>
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
                    className="bg-surface rounded-xl border border-line p-4 hover:shadow-md hover:border-blue-200 transition-all"
                  >
                    <div className="flex items-center gap-1.5 mb-3">
                      <Trophy className="w-3.5 h-3.5 text-amber-500" />
                      <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide">Home Team in League</h3>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {primaryTeam.logoUrl ? (
                          <ImageWithFallback src={primaryTeam.logoUrl} alt={primaryTeam.name} width={24} height={24} className="w-6 h-6 object-contain" />
                        ) : (
                          <Shield className="w-6 h-6 text-faint" />
                        )}
                        <span className="text-sm font-bold text-ink">{primaryTeam.shortName || primaryTeam.name}</span>
                      </div>
                      <span className="text-2xl font-black text-ink">{primaryStanding.position}<sup className="text-xs font-medium text-muted">{primaryStanding.position === 1 ? "st" : primaryStanding.position === 2 ? "nd" : primaryStanding.position === 3 ? "rd" : "th"}</sup></span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted">
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
                  <div className="bg-surface rounded-xl border border-line p-4">
                    <div className="flex items-center gap-1.5 mb-3">
                      <BarChart3 className="w-3.5 h-3.5 text-purple-500" />
                      <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide">Venue Stats</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-2 bg-surface-2 rounded-lg">
                        <div className="text-lg font-bold text-ink">{recentMatches.length}</div>
                        <div className="text-[10px] text-muted">Matches</div>
                      </div>
                      {avgGoals && (
                        <div className="text-center p-2 bg-surface-2 rounded-lg">
                          <div className="text-lg font-bold text-green-600">{avgGoals}</div>
                          <div className="text-[10px] text-muted">Goals/Match</div>
                        </div>
                      )}
                      {avgAttendance && (
                        <div className="text-center p-2 bg-surface-2 rounded-lg">
                          <div className="text-lg font-bold text-blue-600">{(avgAttendance / 1000).toFixed(1)}k</div>
                          <div className="text-[10px] text-muted">Avg Attend.</div>
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
                <h3 className="text-sm font-bold text-ink mb-3">Recent Results</h3>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                  {recentMatches.slice(0, 6).map(({ match, homeTeam, awayTeam }) => (
                    <Link
                      key={match.id}
                      href={`/matches/${match.slug ?? match.id}`}
                      className="flex-shrink-0 w-[160px] bg-surface rounded-lg border border-line p-3 hover:shadow-md hover:border-blue-200 transition-all"
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        {homeTeam.logoUrl ? (
                          <ImageWithFallback src={homeTeam.logoUrl} alt={homeTeam.name} width={16} height={16} className="w-4 h-4 object-contain" />
                        ) : (
                          <Shield className="w-4 h-4 text-faint" />
                        )}
                        <span className="text-xs text-ink truncate">{homeTeam.shortName || homeTeam.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        {awayTeam.logoUrl ? (
                          <ImageWithFallback src={awayTeam.logoUrl} alt={awayTeam.name} width={16} height={16} className="w-4 h-4 object-contain" />
                        ) : (
                          <Shield className="w-4 h-4 text-faint" />
                        )}
                        <span className="text-xs text-ink truncate">{awayTeam.shortName || awayTeam.name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-ink">
                          {match.homeScore}-{match.awayScore}
                        </span>
                        <span className="text-[10px] text-faint">
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
              <div className="bg-surface rounded-xl border border-line p-5">
                <h3 className="text-sm font-bold text-ink mb-3">Upcoming Matches</h3>
                <div className="space-y-2">
                  {upcomingMatches.slice(0, 5).map(({ match, homeTeam, awayTeam, competition }) => (
                    <Link
                      key={match.id}
                      href={`/matches/${match.slug ?? match.id}`}
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-surface-2 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {homeTeam.logoUrl ? (
                            <ImageWithFallback src={homeTeam.logoUrl} alt={homeTeam.name} width={20} height={20} className="w-5 h-5 object-contain flex-shrink-0" />
                          ) : (
                            <Shield className="w-5 h-5 text-faint flex-shrink-0" />
                          )}
                          <span className="text-xs font-medium text-ink truncate">{homeTeam.shortName || homeTeam.name}</span>
                        </div>
                        <span className="text-[10px] text-faint flex-shrink-0">vs</span>
                        <div className="flex items-center gap-1.5 min-w-0">
                          {awayTeam.logoUrl ? (
                            <ImageWithFallback src={awayTeam.logoUrl} alt={awayTeam.name} width={20} height={20} className="w-5 h-5 object-contain flex-shrink-0" />
                          ) : (
                            <Shield className="w-5 h-5 text-faint flex-shrink-0" />
                          )}
                          <span className="text-xs font-medium text-ink truncate">{awayTeam.shortName || awayTeam.name}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <div className="text-xs text-muted">{format(new Date(match.scheduledAt), "MMM d, HH:mm")}</div>
                        <div className="text-[10px] font-medium text-blue-600">
                          {formatDistanceToNowStrict(new Date(match.scheduledAt), { addSuffix: true })}
                        </div>
                        {competition && (
                          <div className="text-[10px] text-faint truncate max-w-[120px]">{competition.name}</div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* No matches message */}
            {recentMatches.length === 0 && upcomingMatches.length === 0 && (
              <section className="bg-surface rounded-xl border border-line p-8 text-center">
                <Clock className="w-12 h-12 text-faint mx-auto mb-4" />
                <p className="text-muted">No matches scheduled at this venue</p>
              </section>
            )}

            {/* About (below fold) */}
            {aboutParagraphs.length > 0 && (
              <section className="bg-surface rounded-xl border border-line p-6">
                <h2 className="text-lg font-bold text-ink mb-4">About {venue.name}</h2>
                <div className="space-y-4">
                  {aboutParagraphs.map((p, i) => (
                    <p key={i} className="text-ink leading-relaxed">{p}</p>
                  ))}
                </div>
              </section>
            )}

            {/* Current Teams (detailed) */}
            {currentTeams.length > 0 && (
              <section className="bg-surface rounded-xl border border-line overflow-hidden">
                <div className="px-6 py-4 border-b border-line">
                  <h2 className="text-lg font-bold text-ink">
                    Home Teams
                  </h2>
                </div>
                <div className="p-4">
                  <div className="grid sm:grid-cols-2 gap-3">
                    {currentTeams.map(({ team, validFrom }) => (
                      <Link
                        key={team.id}
                        href={`/teams/${team.slug}`}
                        className="flex items-center gap-4 p-4 bg-surface-2 rounded-lg hover:bg-surface-2 transition-colors group"
                      >
                        <div className="w-12 h-12 bg-surface rounded-lg flex items-center justify-center p-2">
                          {team.logoUrl ? (
                            <ImageWithFallback
                              src={team.logoUrl}
                              alt={team.name}
                              width={48}
                              height={48}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <Shield className="w-8 h-8 text-faint" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-ink truncate group-hover:text-blue-600 transition-colors">
                            {team.name}
                          </div>
                          <div className="text-sm text-muted">
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
              <div className="bg-surface rounded-xl border border-line p-4">
                <h3 className="text-sm font-medium text-muted mb-3 flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  League
                </h3>
                <Link
                  href={`/competitions/${primaryCompetitionSlug}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-2 transition-colors group"
                >
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-ink group-hover:text-blue-600 transition-colors">{primaryCompetitionName}</p>
                    <p className="text-xs text-muted">View standings & results</p>
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
              <div className="bg-surface rounded-xl border border-line p-6">
                <h3 className="text-sm font-medium text-muted mb-4">
                  Former Home Teams
                </h3>
                <div className="space-y-3">
                  {historicalTeams.map(({ team, validFrom, validTo }) => (
                    <Link
                      key={team.id}
                      href={`/teams/${team.slug}`}
                      className="flex items-center gap-3 p-2 hover:bg-surface-2 rounded-lg transition-colors group"
                    >
                      <div className="w-8 h-8 bg-surface-2 rounded flex items-center justify-center">
                        {team.logoUrl ? (
                          <img
                            src={team.logoUrl}
                            alt={team.name}
                            className="w-6 h-6 object-contain"
                          />
                        ) : (
                          <Shield className="w-5 h-5 text-faint" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-ink truncate group-hover:text-blue-600 transition-colors">
                          {team.name}
                        </div>
                        <div className="text-xs text-muted">
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
              <div className="bg-surface rounded-xl border border-line p-6">
                <h3 className="text-sm font-medium text-muted mb-4">
                  Location
                </h3>
                <div className="aspect-video bg-surface-2 rounded-lg flex items-center justify-center">
                  <MapPin className="w-8 h-8 text-faint" />
                </div>
                <p className="text-xs text-muted mt-2 text-center">
                  {venue.latitude}, {venue.longitude}
                </p>
              </div>
            )}

            {faqItems.length > 0 && (
              <section className="bg-surface rounded-xl border border-line p-5">
                <h3 className="text-sm font-bold text-ink mb-3">Venue FAQ</h3>
                <div className="space-y-2">
                  {faqItems.map((item) => (
                    <details
                      key={item.question}
                      className="group rounded-lg border border-line px-3 py-2"
                    >
                      <summary className="cursor-pointer list-none text-sm font-medium text-ink">
                        {item.question}
                      </summary>
                      <p className="mt-2 text-xs leading-5 text-muted">{item.answer}</p>
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
