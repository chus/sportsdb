import { notFound } from "next/navigation";
import Link from "next/link";
import {
  User, MapPin, Calendar, Ruler, Flag,
  Footprints, Shield, ArrowLeft, Trophy
} from "lucide-react";
import type { Metadata } from "next";
import { getPlayerBySlug, getPlayerCurrentTeam, getPlayerCareer, getPlayerStatsHistory } from "@/lib/queries/players";
import { format, differenceInYears } from "date-fns";
import { PlayerJsonLd, BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { FollowButton } from "@/components/follow-button";
import { RelatedPlayers } from "@/components/entity/related-entities";
import { PlayerMatchPerformance } from "@/components/player/player-match-performance";
import { PlayerInternalLinks } from "@/components/seo/internal-links";
import { RelatedArticles } from "@/components/articles/related-articles";

interface PlayerPageProps {
  params: Promise<{ slug: string }>;
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://sportsdb-nine.vercel.app";

export async function generateMetadata({ params }: PlayerPageProps): Promise<Metadata> {
  const { slug } = await params;
  const player = await getPlayerBySlug(slug);

  if (!player) {
    return { title: "Player Not Found" };
  }

  const title = `${player.name} – Career, Teams & Stats | SportsDB`;
  const description = `${player.name} is a ${player.position}${player.nationality ? ` from ${player.nationality}` : ""}. View full career history, current team, and player profile on SportsDB.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/players/${slug}`,
      siteName: "SportsDB",
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

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number | null; icon?: React.ElementType }) {
  if (!value) return null;
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 text-neutral-500 text-sm mb-1">
        {Icon && <Icon className="w-4 h-4" />}
        {label}
      </div>
      <div className="text-xl font-semibold text-neutral-900">{value}</div>
    </div>
  );
}

function PositionBadge({ position }: { position: string }) {
  const colors: Record<string, string> = {
    "Goalkeeper": "bg-yellow-100 text-yellow-800",
    "Defender": "bg-blue-100 text-blue-800",
    "Midfielder": "bg-green-100 text-green-800",
    "Forward": "bg-red-100 text-red-800",
  };
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors[position] || "bg-neutral-100 text-neutral-800"}`}>
      {position}
    </span>
  );
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { slug } = await params;

  const player = await getPlayerBySlug(slug);

  if (!player) {
    notFound();
  }

  const [currentTeamData, career, statsHistory] = await Promise.all([
    getPlayerCurrentTeam(player.id),
    getPlayerCareer(player.id),
    getPlayerStatsHistory(player.id),
  ]);

  const currentTeam = currentTeamData?.team;
  const shirtNumber = currentTeamData?.shirtNumber;

  // Calculate age
  const age = player.dateOfBirth
    ? differenceInYears(new Date(), new Date(player.dateOfBirth))
    : null;

  const playerUrl = `${BASE_URL}/players/${slug}`;
  const teamUrl = currentTeam ? `${BASE_URL}/teams/${currentTeam.slug}` : null;

  // Build breadcrumb items
  const breadcrumbItems = [
    { name: "Home", url: BASE_URL },
    { name: "Players", url: `${BASE_URL}/search?type=player` },
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
        height={player.heightCm}
        position={player.position}
        team={currentTeam && teamUrl ? { name: currentTeam.name, url: teamUrl } : null}
      />
    <div className="min-h-screen bg-neutral-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Back button */}
          <Link
            href="/search?type=player"
            className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            All Players
          </Link>

          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Player Avatar */}
            <div className="w-32 h-32 md:w-40 md:h-40 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              {player.imageUrl ? (
                <img
                  src={player.imageUrl}
                  alt={player.name}
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                <User className="w-16 h-16 md:w-20 md:h-20 text-white/60" />
              )}
            </div>

            {/* Player Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                {shirtNumber && (
                  <span className="text-4xl md:text-5xl font-bold text-white/30">
                    #{shirtNumber}
                  </span>
                )}
                <h1 className="text-3xl md:text-5xl font-bold">{player.name}</h1>
              </div>

              {player.knownAs && player.knownAs !== player.name && (
                <p className="text-xl text-white/80 mb-4">"{player.knownAs}"</p>
              )}

              <div className="flex flex-wrap items-center gap-4 mb-6">
                <PositionBadge position={player.position} />
                {currentTeam && (
                  <Link
                    href={`/teams/${currentTeam.slug}`}
                    className="flex items-center gap-2 text-white/90 hover:text-white transition-colors"
                  >
                    <Shield className="w-5 h-5" />
                    {currentTeam.name}
                  </Link>
                )}
                <FollowButton entityType="player" entityId={player.id} entityName={player.name} variant="hero" />
              </div>

              {/* Quick Stats Row */}
              <div className="flex flex-wrap gap-6 text-sm">
                {player.nationality && (
                  <div className="flex items-center gap-2">
                    <Flag className="w-4 h-4 text-white/60" />
                    <span>{player.nationality}</span>
                  </div>
                )}
                {age && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-white/60" />
                    <span>{age} years old</span>
                  </div>
                )}
                {player.heightCm && (
                  <div className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-white/60" />
                    <span>{player.heightCm} cm</span>
                  </div>
                )}
                {player.preferredFoot && (
                  <div className="flex items-center gap-2">
                    <Footprints className="w-4 h-4 text-white/60" />
                    <span>{player.preferredFoot} foot</span>
                  </div>
                )}
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
            {/* Stats Grid */}
            <section>
              <h2 className="text-xl font-bold text-neutral-900 mb-4">Player Info</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Position" value={player.position} icon={User} />
                <StatCard label="Nationality" value={player.nationality} icon={Flag} />
                <StatCard label="Age" value={age ? `${age} years` : null} icon={Calendar} />
                <StatCard label="Height" value={player.heightCm ? `${player.heightCm} cm` : null} icon={Ruler} />
                <StatCard label="Foot" value={player.preferredFoot} icon={Footprints} />
                <StatCard label="Status" value={player.status === "active" ? "Active" : player.status} />
                {shirtNumber && <StatCard label="Shirt Number" value={`#${shirtNumber}`} />}
                {player.dateOfBirth && (
                  <StatCard
                    label="Date of Birth"
                    value={format(new Date(player.dateOfBirth), "MMM d, yyyy")}
                    icon={Calendar}
                  />
                )}
              </div>
            </section>

            {/* Career History */}
            {career.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-neutral-900 mb-4">Career History</h2>
                <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                  <div className="divide-y divide-neutral-100">
                    {career.map((entry) => (
                      <Link
                        key={entry.id}
                        href={`/teams/${entry.team.slug}`}
                        className="flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-neutral-100 rounded-lg flex items-center justify-center">
                            {entry.team.logoUrl ? (
                              <img
                                src={entry.team.logoUrl}
                                alt={entry.team.name}
                                className="w-8 h-8 object-contain"
                              />
                            ) : (
                              <Shield className="w-6 h-6 text-neutral-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-neutral-900">{entry.team.name}</div>
                            <div className="text-sm text-neutral-500">
                              {entry.validFrom && format(new Date(entry.validFrom), "MMM yyyy")}
                              {" → "}
                              {entry.validTo ? format(new Date(entry.validTo), "MMM yyyy") : "Present"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {entry.shirtNumber && (
                            <span className="text-sm text-neutral-500">#{entry.shirtNumber}</span>
                          )}
                          {entry.transferType && (
                            <span className="text-xs px-2 py-1 bg-neutral-100 text-neutral-600 rounded">
                              {entry.transferType}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Stats History */}
            {statsHistory.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-neutral-900 mb-4">Season Statistics</h2>
                <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-neutral-50 text-left text-sm text-neutral-500">
                        <th className="px-4 py-3 font-medium">Season</th>
                        <th className="px-4 py-3 font-medium">Team</th>
                        <th className="px-4 py-3 font-medium">Competition</th>
                        <th className="px-4 py-3 font-medium text-center">Apps</th>
                        <th className="px-4 py-3 font-medium text-center">Goals</th>
                        <th className="px-4 py-3 font-medium text-center">Assists</th>
                        <th className="px-4 py-3 font-medium text-center">Mins</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {statsHistory.map(({ stat, team, season, competition }) => (
                        <tr key={stat.id} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-neutral-900">
                            {season.label}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/teams/${team.slug}`}
                              className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                            >
                              {team.logoUrl ? (
                                <img
                                  src={team.logoUrl}
                                  alt={team.name}
                                  className="w-5 h-5 object-contain"
                                />
                              ) : (
                                <Shield className="w-5 h-5 text-neutral-300" />
                              )}
                              <span className="text-sm">{team.shortName || team.name}</span>
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm text-neutral-600">
                            <Link
                              href={`/competitions/${competition.slug}`}
                              className="hover:text-blue-600 transition-colors"
                            >
                              {competition.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-center text-neutral-600">
                            {stat.appearances}
                          </td>
                          <td className="px-4 py-3 text-center font-medium text-neutral-900">
                            {stat.goals}
                          </td>
                          <td className="px-4 py-3 text-center text-neutral-600">
                            {stat.assists}
                          </td>
                          <td className="px-4 py-3 text-center text-neutral-500 text-sm">
                            {stat.minutesPlayed.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {statsHistory.length > 0 && (
                      <tfoot className="bg-neutral-50 border-t border-neutral-200">
                        <tr className="font-medium">
                          <td className="px-4 py-3" colSpan={3}>
                            Career Total
                          </td>
                          <td className="px-4 py-3 text-center">
                            {statsHistory.reduce((sum, s) => sum + s.stat.appearances, 0)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {statsHistory.reduce((sum, s) => sum + s.stat.goals, 0)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {statsHistory.reduce((sum, s) => sum + s.stat.assists, 0)}
                          </td>
                          <td className="px-4 py-3 text-center text-sm">
                            {statsHistory.reduce((sum, s) => sum + s.stat.minutesPlayed, 0).toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Current Team Card */}
            {currentTeam && (
              <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <h3 className="text-sm font-medium text-neutral-500 mb-4">Current Team</h3>
                <Link
                  href={`/teams/${currentTeam.slug}`}
                  className="flex items-center gap-4 group"
                >
                  <div className="w-16 h-16 bg-neutral-100 rounded-xl flex items-center justify-center group-hover:bg-neutral-200 transition-colors">
                    {currentTeam.logoUrl ? (
                      <img
                        src={currentTeam.logoUrl}
                        alt={currentTeam.name}
                        className="w-12 h-12 object-contain"
                      />
                    ) : (
                      <Shield className="w-8 h-8 text-neutral-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-neutral-900 group-hover:text-blue-600 transition-colors">
                      {currentTeam.name}
                    </div>
                    <div className="text-sm text-neutral-500">{currentTeam.country}</div>
                  </div>
                </Link>
              </div>
            )}

            {/* Quick Facts */}
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <h3 className="text-sm font-medium text-neutral-500 mb-4">Quick Facts</h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-neutral-600">Full Name</dt>
                  <dd className="font-medium text-neutral-900">{player.name}</dd>
                </div>
                {player.nationality && (
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">Nationality</dt>
                    <dd className="font-medium text-neutral-900">{player.nationality}</dd>
                  </div>
                )}
                {player.secondNationality && (
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">2nd Nationality</dt>
                    <dd className="font-medium text-neutral-900">{player.secondNationality}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-neutral-600">Position</dt>
                  <dd className="font-medium text-neutral-900">{player.position}</dd>
                </div>
                {career.length > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-neutral-600">Clubs</dt>
                    <dd className="font-medium text-neutral-900">{career.length}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Related Articles */}
            <RelatedArticles playerId={player.id} limit={5} />

            {/* Recent Match Performances */}
            <PlayerMatchPerformance playerId={player.id} limit={5} />

            {/* Related Players */}
            <RelatedPlayers playerId={player.id} />

            {/* Internal Links for SEO */}
            <PlayerInternalLinks
              playerId={player.id}
              playerSlug={player.slug}
              nationality={player.nationality}
              position={player.position}
            />
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
