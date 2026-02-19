import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Shield, MapPin, Calendar, Users, Trophy,
  ArrowLeft, Building, TrendingUp
} from "lucide-react";
import type { Metadata } from "next";
import { getTeamBySlug, getSquad, getTeamStats, getFormerPlayers } from "@/lib/queries/teams";
import { TeamJsonLd, BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { FollowButton } from "@/components/follow-button";
import { RelatedTeams } from "@/components/entity/related-entities";
import { TeamInternalLinks } from "@/components/seo/internal-links";

interface TeamPageProps {
  params: Promise<{ slug: string }>;
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://sportsdb-nine.vercel.app";

export async function generateMetadata({ params }: TeamPageProps): Promise<Metadata> {
  const { slug } = await params;
  const team = await getTeamBySlug(slug);

  if (!team) {
    return { title: "Team Not Found" };
  }

  const title = `${team.name} – Squad, Stats & Info | SportsDB`;
  const description = `${team.name}${team.city ? ` based in ${team.city}` : ""}${team.country ? `, ${team.country}` : ""}. View full squad, standings, and club information on SportsDB.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/teams/${slug}`,
      siteName: "SportsDB",
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

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="text-2xl md:text-3xl font-bold text-white">{value}</div>
      <div className="text-sm text-white/70">{label}</div>
    </div>
  );
}

function PositionGroup({
  title,
  players,
}: {
  title: string;
  players: { player: any; shirtNumber: number | null }[];
}) {
  if (players.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-3">
        {title} ({players.length})
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {players.map(({ player, shirtNumber }) => (
          <Link
            key={player.id}
            href={`/players/${player.slug}`}
            className="flex items-center gap-3 p-3 bg-white rounded-lg border border-neutral-200 hover:shadow-md hover:border-blue-200 transition-all group"
          >
            <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-500 font-medium group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
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
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function TeamPage({ params }: TeamPageProps) {
  const { slug } = await params;

  const team = await getTeamBySlug(slug);

  if (!team) {
    notFound();
  }

  const [squad, statsData, formerPlayers] = await Promise.all([
    getSquad(team.id),
    getTeamStats(team.id),
    getFormerPlayers(team.id, 10),
  ]);

  const standing = statsData[0]?.standing;
  const seasonLabel = statsData[0]?.seasonLabel;

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

  // Breadcrumb items
  const breadcrumbItems = [
    { name: "Home", url: BASE_URL },
    { name: "Teams", url: `${BASE_URL}/search?type=team` },
    { name: team.name, url: teamUrl },
  ];

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbItems} />
      <TeamJsonLd
        name={team.name}
        url={teamUrl}
        logo={team.logoUrl}
        location={{ city: team.city, country: team.country }}
        foundingDate={team.foundedYear}
        memberCount={squad.length}
      />
    <div className="min-h-screen bg-neutral-50">
      {/* Hero Section */}
      <div
        className="text-white"
        style={{
          background: `linear-gradient(135deg, ${primaryColor} 0%, #1e1b4b 100%)`,
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Back button */}
          <Link
            href="/search?type=team"
            className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            All Teams
          </Link>

          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Team Logo */}
            <div className="w-32 h-32 md:w-40 md:h-40 bg-white rounded-2xl flex items-center justify-center flex-shrink-0 p-4">
              {team.logoUrl ? (
                <img
                  src={team.logoUrl}
                  alt={team.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <Shield className="w-16 h-16 md:w-20 md:h-20 text-neutral-300" />
              )}
            </div>

            {/* Team Info */}
            <div className="flex-1">
              <h1 className="text-3xl md:text-5xl font-bold mb-2">{team.name}</h1>
              {team.shortName && team.shortName !== team.name && (
                <p className="text-xl text-white/80 mb-4">{team.shortName}</p>
              )}

              <div className="flex flex-wrap items-center gap-6 mb-6 text-sm">
                {team.country && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-white/60" />
                    <span>{team.city ? `${team.city}, ${team.country}` : team.country}</span>
                  </div>
                )}
                {team.foundedYear && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-white/60" />
                    <span>Founded {team.foundedYear}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-white/60" />
                  <span>{squad.length} Players</span>
                </div>
                <FollowButton entityType="team" entityId={team.id} entityName={team.name} variant="hero" />
              </div>

              {/* Standing Stats */}
              {standing && (
                <div className="flex flex-wrap gap-8 mt-4 pt-4 border-t border-white/20">
                  <StatBox label="Position" value={`#${standing.position}`} />
                  <StatBox label="Points" value={standing.points} />
                  <StatBox label="Played" value={standing.played} />
                  <StatBox label="Won" value={standing.won} />
                  <StatBox label="Drawn" value={standing.drawn} />
                  <StatBox label="Lost" value={standing.lost} />
                  <StatBox label="GD" value={standing.goalDifference > 0 ? `+${standing.goalDifference}` : standing.goalDifference} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content - Squad */}
          <div className="lg:col-span-2 space-y-8">
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-neutral-900">
                  Squad {seasonLabel && `(${seasonLabel})`}
                </h2>
                <span className="text-sm text-neutral-500">{squad.length} players</span>
              </div>

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
            </section>

            {/* Former Players */}
            {formerPlayers.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-neutral-900 mb-4">Former Players</h2>
                <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                  <div className="divide-y divide-neutral-100">
                    {formerPlayers.map(({ player, shirtNumber, validFrom, validTo }) => (
                      <Link
                        key={player.id}
                        href={`/players/${player.slug}`}
                        className="flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-500 font-medium group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                            {shirtNumber || "—"}
                          </div>
                          <div>
                            <div className="font-medium text-neutral-900 group-hover:text-blue-600 transition-colors">
                              {player.name}
                            </div>
                            <div className="text-sm text-neutral-500">
                              {player.position} • {new Date(validFrom).getFullYear()} - {validTo ? new Date(validTo).getFullYear() : "Present"}
                            </div>
                          </div>
                        </div>
                        {player.nationality && (
                          <span className="text-sm text-neutral-500 hidden sm:block">
                            {player.nationality}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Club Info Card */}
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <h3 className="text-sm font-medium text-neutral-500 mb-4">Club Info</h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-neutral-600">Full Name</dt>
                  <dd className="font-medium text-neutral-900 text-right">{team.name}</dd>
                </div>
                {team.shortName && (
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">Short Name</dt>
                    <dd className="font-medium text-neutral-900">{team.shortName}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-neutral-600">Country</dt>
                  <dd className="font-medium text-neutral-900">{team.country}</dd>
                </div>
                {team.city && (
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">City</dt>
                    <dd className="font-medium text-neutral-900">{team.city}</dd>
                  </div>
                )}
                {team.foundedYear && (
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">Founded</dt>
                    <dd className="font-medium text-neutral-900">{team.foundedYear}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Season Stats Card */}
            {standing && (
              <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <h3 className="text-sm font-medium text-neutral-500 mb-4">
                  {seasonLabel} Stats
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-600">League Position</span>
                    <span className="text-2xl font-bold text-neutral-900">
                      #{standing.position}
                    </span>
                  </div>
                  <div className="h-px bg-neutral-100" />
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-semibold text-green-600">{standing.won}</div>
                      <div className="text-xs text-neutral-500">Won</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-neutral-600">{standing.drawn}</div>
                      <div className="text-xs text-neutral-500">Drawn</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-red-600">{standing.lost}</div>
                      <div className="text-xs text-neutral-500">Lost</div>
                    </div>
                  </div>
                  <div className="h-px bg-neutral-100" />
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-600">Goals For</span>
                    <span className="font-medium">{standing.goalsFor}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-600">Goals Against</span>
                    <span className="font-medium">{standing.goalsAgainst}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-600">Goal Difference</span>
                    <span className={`font-medium ${standing.goalDifference > 0 ? "text-green-600" : standing.goalDifference < 0 ? "text-red-600" : ""}`}>
                      {standing.goalDifference > 0 ? "+" : ""}{standing.goalDifference}
                    </span>
                  </div>
                  {standing.form && (
                    <>
                      <div className="h-px bg-neutral-100" />
                      <div>
                        <div className="text-xs text-neutral-500 mb-2">Recent Form</div>
                        <div className="flex gap-1">
                          {standing.form.split("").map((result, i) => (
                            <span
                              key={i}
                              className={`w-6 h-6 rounded flex items-center justify-center text-xs font-medium text-white ${
                                result === "W"
                                  ? "bg-green-500"
                                  : result === "D"
                                  ? "bg-neutral-400"
                                  : "bg-red-500"
                              }`}
                            >
                              {result}
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Squad Stats */}
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <h3 className="text-sm font-medium text-neutral-500 mb-4">Squad Breakdown</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-neutral-600">Goalkeepers</span>
                  <span className="font-medium text-neutral-900">{goalkeepers.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Defenders</span>
                  <span className="font-medium text-neutral-900">{defenders.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Midfielders</span>
                  <span className="font-medium text-neutral-900">{midfielders.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Forwards</span>
                  <span className="font-medium text-neutral-900">{forwards.length}</span>
                </div>
              </div>
            </div>

            {/* Related Teams */}
            <RelatedTeams teamId={team.id} />

            {/* Internal Links for SEO */}
            <TeamInternalLinks teamId={team.id} country={team.country} />
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
