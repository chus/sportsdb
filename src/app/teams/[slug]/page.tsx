import { notFound } from "next/navigation";
import Link from "next/link";
import { Shield, Users } from "lucide-react";

export const revalidate = 3600; // ISR: revalidate every hour
import type { Metadata } from "next";
import { getTeamBySlug, getSquad, getTeamStats, getFormerPlayers } from "@/lib/queries/teams";
import { TeamJsonLd, BreadcrumbJsonLd, FAQJsonLd } from "@/components/seo/json-ld";
import { FollowButton } from "@/components/follow-button";
import { RelatedTeams } from "@/components/entity/related-entities";
import { TeamInternalLinks } from "@/components/seo/internal-links";
import { RelatedArticles } from "@/components/articles/related-articles";
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
import { playerTeamHistory, players, standings as standingsTable, competitionSeasons, seasons } from "@/lib/db/schema";
import { eq, and, isNull, ne, sql } from "drizzle-orm";

interface TeamPageProps {
  params: Promise<{ slug: string }>;
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

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
    hasMatches: true, // all teams we show have matches (sitemap-filtered)
  });
  const isThin = quality.isThin;

  const title = `${team.name} – Squad, Results & Standings 2025/26 | DataSports`;
  const description = `${team.name} squad, fixtures, results, and standings for the 2025/26 season. View full roster, recent matches, and league position.`;

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
  players: {
    player: {
      id: string;
      slug: string;
      name: string;
      nationality: string | null;
      position: string;
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
          <Link
            key={player.id}
            href={`/players/${player.slug}`}
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
  const competitionName = statsData[0]?.competitionName;

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
    shortName: team.shortName,
    city: team.city,
    country: team.country,
    foundedYear: team.foundedYear,
    squadSize: squad.length,
    formerPlayersCount: formerPlayers.length,
    seasonLabel,
    competitionName,
    standing,
  });
  const faqItems = buildTeamFaqs({
    name: team.name,
    city: team.city,
    country: team.country,
    foundedYear: team.foundedYear,
    squadSize: squad.length,
    seasonLabel,
    competitionName,
    goalsFor: standing?.goalsFor,
    goalsAgainst: standing?.goalsAgainst,
    standing,
  });

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
      {faqItems.length > 0 && <FAQJsonLd items={faqItems} />}
      <PageTracker entityType="team" entityId={team.id} />

    <div className="min-h-screen bg-neutral-50">
      {/* Compact Header */}
      <div className="text-white" style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, #1e1b4b 100%)` }}>
        <PageHeader
          title={team.name}
          subtitle={[team.city, team.country, team.foundedYear ? `Est. ${team.foundedYear}` : null].filter(Boolean).join(" · ")}
          accentColor=""
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Teams", href: "/search?type=team" },
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
              <div className="lg:col-span-2 space-y-8">

                {/* === OVERVIEW TAB === */}
                <TabPanel tabId="overview" defaultTab="overview">
                  <>
                    <section className="bg-white rounded-xl border border-neutral-200 p-6">
                      <h2 className="text-lg font-bold text-neutral-900 mb-3">About {team.name}</h2>
                      <div className="space-y-3 text-sm leading-7 text-neutral-700">
                        {aboutParagraphs.map((paragraph, i) => (
                          <p key={i}>{renderBioWithLinks(paragraph)}</p>
                        ))}
                      </div>
                    </section>

                    {/* Recent Form */}
                    {standing?.form && (
                      <div className="bg-white rounded-xl border border-neutral-200 p-5">
                        <h3 className="text-sm font-bold text-neutral-900 mb-3">Recent Form</h3>
                        <div className="flex gap-1.5">
                          {standing.form.split("").map((result, i) => (
                            <span key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white ${result === "W" ? "bg-green-500" : result === "D" ? "bg-neutral-400" : "bg-red-500"}`}>
                              {result}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Upcoming fixtures */}
                    <TeamFixtures teamId={team.id} limit={5} />
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
                        <Link key={player.id} href={`/players/${player.slug}`} className="flex items-center justify-between p-3 hover:bg-neutral-50 transition-colors group">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-500 text-xs font-medium">{shirtNumber || "—"}</div>
                            <div>
                              <div className="font-medium text-sm text-neutral-900 group-hover:text-blue-600">{player.name}</div>
                              <div className="text-xs text-neutral-500">{player.position} · {new Date(validFrom).getFullYear()}-{validTo ? new Date(validTo).getFullYear() : "Present"}</div>
                            </div>
                          </div>
                        </Link>
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

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Club Info */}
                <div className="bg-white rounded-xl border border-neutral-200 p-5">
                  <h3 className="text-sm font-bold text-neutral-900 mb-3">Club Info</h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between"><dt className="text-neutral-500">Full Name</dt><dd className="font-medium text-neutral-900 text-right">{team.name}</dd></div>
                    {team.shortName && <div className="flex justify-between"><dt className="text-neutral-500">Short Name</dt><dd className="font-medium text-neutral-900">{team.shortName}</dd></div>}
                    <div className="flex justify-between"><dt className="text-neutral-500">Country</dt><dd className="font-medium text-neutral-900">{team.country}</dd></div>
                    {team.city && <div className="flex justify-between"><dt className="text-neutral-500">City</dt><dd className="font-medium text-neutral-900">{team.city}</dd></div>}
                    {team.foundedYear && <div className="flex justify-between"><dt className="text-neutral-500">Founded</dt><dd className="font-medium text-neutral-900">{team.foundedYear}</dd></div>}
                  </dl>
                </div>

                <RelatedArticles teamId={team.id} limit={5} />

                <SidebarUpgradeOrAd context="team" />

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
