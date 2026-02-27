import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Users,
  Building,
  Shield,
  Clock,
} from "lucide-react";
import type { Metadata } from "next";
import { format } from "date-fns";
import {
  getVenueBySlug,
  getVenueTeams,
  getVenueMatches,
} from "@/lib/queries/venues";
import { getVenueImage } from "@/lib/utils/avatar";
import { BreadcrumbJsonLd, VenueJsonLd } from "@/components/seo/json-ld";

interface VenuePageProps {
  params: Promise<{ slug: string }>;
}

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://sportsdb-nine.vercel.app";

export async function generateMetadata({
  params,
}: VenuePageProps): Promise<Metadata> {
  const { slug } = await params;
  const venue = await getVenueBySlug(slug);

  if (!venue) {
    return { title: "Venue Not Found" };
  }

  const title = `${venue.name} – Stadium Info & Matches | SportsDB`;
  const description = `${venue.name}${venue.city ? ` in ${venue.city}` : ""}${venue.country ? `, ${venue.country}` : ""}. Capacity: ${venue.capacity?.toLocaleString() || "N/A"}. View teams, matches, and stadium information.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/venues/${slug}`,
      siteName: "SportsDB",
      type: "website",
      ...(venue.imageUrl && { images: [{ url: venue.imageUrl, alt: venue.name }] }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(venue.imageUrl && { images: [venue.imageUrl] }),
    },
    alternates: {
      canonical: `${BASE_URL}/venues/${slug}`,
    },
  };
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="text-2xl md:text-3xl font-bold text-white">{value}</div>
      <div className="text-sm text-white/70">{label}</div>
    </div>
  );
}

function MatchRow({
  match,
  homeTeam,
  awayTeam,
  competition,
}: {
  match: {
    id: string;
    scheduledAt: Date;
    status: string;
    homeScore: number | null;
    awayScore: number | null;
  };
  homeTeam: {
    name: string;
    shortName: string | null;
    slug: string;
    logoUrl: string | null;
  };
  awayTeam: {
    name: string;
    shortName: string | null;
    slug: string;
    logoUrl: string | null;
  };
  competition: {
    name: string;
    slug: string;
  };
}) {
  const isFinished = match.status === "finished";

  return (
    <Link
      href={`/matches/${match.id}`}
      className="flex items-center gap-4 p-4 hover:bg-neutral-50 rounded-lg transition-colors group"
    >
      {/* Date */}
      <div className="w-20 text-center flex-shrink-0">
        <div className="text-sm font-medium text-neutral-900">
          {format(new Date(match.scheduledAt), "MMM d")}
        </div>
        <div className="text-xs text-neutral-500">
          {format(new Date(match.scheduledAt), "HH:mm")}
        </div>
      </div>

      {/* Teams */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {homeTeam.logoUrl ? (
            <img
              src={homeTeam.logoUrl}
              alt={homeTeam.name}
              className="w-5 h-5 object-contain"
            />
          ) : (
            <Shield className="w-5 h-5 text-neutral-300" />
          )}
          <span className="font-medium truncate group-hover:text-blue-600 transition-colors">
            {homeTeam.shortName || homeTeam.name}
          </span>
          {isFinished && (
            <span className="ml-auto font-bold">{match.homeScore}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {awayTeam.logoUrl ? (
            <img
              src={awayTeam.logoUrl}
              alt={awayTeam.name}
              className="w-5 h-5 object-contain"
            />
          ) : (
            <Shield className="w-5 h-5 text-neutral-300" />
          )}
          <span className="font-medium truncate group-hover:text-blue-600 transition-colors">
            {awayTeam.shortName || awayTeam.name}
          </span>
          {isFinished && (
            <span className="ml-auto font-bold">{match.awayScore}</span>
          )}
        </div>
      </div>

      {/* Competition */}
      <div className="hidden sm:block text-right flex-shrink-0">
        <span className="text-xs text-neutral-500">{competition.name}</span>
      </div>
    </Link>
  );
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

  const { current: currentTeams, historical: historicalTeams } = teamsData;
  const { recent: recentMatches, upcoming: upcomingMatches } = matchesData;

  const heroImage = getVenueImage(venue, 1200);

  const venueUrl = `${BASE_URL}/venues/${slug}`;

  return (
    <>
    <BreadcrumbJsonLd
      items={[
        { name: "Home", url: BASE_URL },
        { name: "Venues", url: `${BASE_URL}/search?type=venue` },
        { name: venue.name, url: venueUrl },
      ]}
    />
    <VenueJsonLd
      name={venue.name}
      url={venueUrl}
      image={venue.imageUrl}
      address={{ city: venue.city, country: venue.country }}
      capacity={venue.capacity}
    />
    <div className="min-h-screen bg-neutral-50">
      {/* Hero Section */}
      <div
        className="relative text-white"
        style={{
          background: venue.imageUrl
            ? `linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.8)), url(${venue.imageUrl}) center/cover`
            : "linear-gradient(135deg, #6b7280 0%, #374151 100%)",
          minHeight: "400px",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Back button */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>

          <div className="flex flex-col gap-8 items-start pt-8">
            {/* Venue Icon */}
            <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <Building className="w-12 h-12 text-white" />
            </div>

            {/* Venue Info */}
            <div className="flex-1">
              <h1 className="text-3xl md:text-5xl font-bold mb-4">
                {venue.name}
              </h1>

              <div className="flex flex-wrap items-center gap-6 mb-6 text-sm">
                {(venue.city || venue.country) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-white/60" />
                    <span>
                      {venue.city
                        ? `${venue.city}${venue.country ? `, ${venue.country}` : ""}`
                        : venue.country}
                    </span>
                  </div>
                )}
                {venue.openedYear && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-white/60" />
                    <span>Opened {venue.openedYear}</span>
                  </div>
                )}
                {venue.capacity && (
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-white/60" />
                    <span>{venue.capacity.toLocaleString()} capacity</span>
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              <div className="flex flex-wrap gap-8 pt-4 border-t border-white/20">
                {venue.capacity && (
                  <StatBox
                    label="Capacity"
                    value={venue.capacity.toLocaleString()}
                  />
                )}
                {venue.openedYear && (
                  <StatBox label="Opened" value={venue.openedYear} />
                )}
                <StatBox label="Home Teams" value={currentTeams.length} />
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
            {/* Current Teams */}
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

            {/* Recent Matches */}
            {recentMatches.length > 0 && (
              <section className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-neutral-200">
                  <h2 className="text-lg font-bold text-neutral-900">
                    Recent Matches
                  </h2>
                </div>
                <div className="divide-y divide-neutral-100">
                  {recentMatches.map(({ match, homeTeam, awayTeam, competition }) => (
                    <MatchRow
                      key={match.id}
                      match={match}
                      homeTeam={homeTeam}
                      awayTeam={awayTeam}
                      competition={competition}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Upcoming Matches */}
            {upcomingMatches.length > 0 && (
              <section className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-neutral-200">
                  <h2 className="text-lg font-bold text-neutral-900">
                    Upcoming Matches
                  </h2>
                </div>
                <div className="divide-y divide-neutral-100">
                  {upcomingMatches.map(({ match, homeTeam, awayTeam, competition }) => (
                    <MatchRow
                      key={match.id}
                      match={match}
                      homeTeam={homeTeam}
                      awayTeam={awayTeam}
                      competition={competition}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* No matches message */}
            {recentMatches.length === 0 && upcomingMatches.length === 0 && (
              <section className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
                <Clock className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <p className="text-neutral-500">No matches scheduled at this venue</p>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Venue Info Card */}
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <h3 className="text-sm font-medium text-neutral-500 mb-4">
                Venue Info
              </h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-neutral-600">Full Name</dt>
                  <dd className="font-medium text-neutral-900 text-right">
                    {venue.name}
                  </dd>
                </div>
                {venue.city && (
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">City</dt>
                    <dd className="font-medium text-neutral-900">{venue.city}</dd>
                  </div>
                )}
                {venue.country && (
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">Country</dt>
                    <dd className="font-medium text-neutral-900">
                      {venue.country}
                    </dd>
                  </div>
                )}
                {venue.capacity && (
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">Capacity</dt>
                    <dd className="font-medium text-neutral-900">
                      {venue.capacity.toLocaleString()}
                    </dd>
                  </div>
                )}
                {venue.openedYear && (
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">Opened</dt>
                    <dd className="font-medium text-neutral-900">
                      {venue.openedYear}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

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
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
