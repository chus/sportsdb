import { notFound } from "next/navigation";
import Link from "next/link";
import { Trophy } from "lucide-react";

export const revalidate = 3600; // ISR: revalidate every hour
import type { Metadata } from "next";
import {
  getCompetitionBySlug,
  getCompetitionSeason,
  getStandings,
  getTopScorers,
} from "@/lib/queries/competitions";
import { CompetitionJsonLd, BreadcrumbJsonLd, FAQJsonLd } from "@/components/seo/json-ld";
import { buildCompetitionFaqs, buildCompetitionAbout } from "@/lib/seo/entity-copy";
import { FollowButton } from "@/components/follow-button";
import { TournamentRecap } from "@/components/competition/tournament-recap";
import { CompetitionFixtures } from "@/components/matches/competition-fixtures";
import { TabPanel } from "@/components/ui/tab-navigation";
import { SidebarAd } from "@/components/ads/sidebar-ad";
import { PageTracker } from "@/components/analytics/page-tracker";
import { PageHeader } from "@/components/layout/page-header";
import { StandingsTable } from "@/components/competition/standings-table";
import { CompetitionTabs } from "./competition-tabs";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { PlayerLink } from "@/components/player/player-link";

interface CompetitionPageProps {
  params: Promise<{ slug: string }>;
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export async function generateMetadata({ params }: CompetitionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const competition = await getCompetitionBySlug(slug);

  if (!competition) {
    return { title: "Competition Not Found" };
  }

  // Thin page check: competition needs at least one season
  const competitionSeason = await getCompetitionSeason(slug);
  const isThin = !competitionSeason;

  const title = `${competition.name} Standings & Results 2025/26 | DataSports`;
  const description = `Full ${competition.name} 2025/26 standings, fixtures, results, and top scorers. Updated regularly.`;

  return {
    title,
    description,
    ...(isThin && { robots: { index: false, follow: true } }),
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/competitions/${slug}`,
      siteName: "DataSports",
      type: "website",
      ...(competition.logoUrl && { images: [{ url: competition.logoUrl, alt: competition.name }] }),
    },
    twitter: {
      card: "summary",
      title,
      description,
      ...(competition.logoUrl && { images: [competition.logoUrl] }),
    },
    alternates: {
      canonical: `${BASE_URL}/competitions/${slug}`,
    },
  };
}

export default async function CompetitionPage({ params }: CompetitionPageProps) {
  const { slug } = await params;

  const competition = await getCompetitionBySlug(slug);

  if (!competition) {
    notFound();
  }

  let competitionSeason: Awaited<ReturnType<typeof getCompetitionSeason>> = null;
  let standingsData: Awaited<ReturnType<typeof getStandings>> = [];
  let topScorers: Awaited<ReturnType<typeof getTopScorers>> = [];

  try {
    competitionSeason = await getCompetitionSeason(slug);
    if (competitionSeason) {
      [standingsData, topScorers] = await Promise.all([
        getStandings(competitionSeason.competitionSeason.id),
        getTopScorers(competitionSeason.competitionSeason.id, 10),
      ]);
    }
  } catch (e) {
    console.error(`[CompetitionPage] Error loading data for ${slug}:`, e);
  }

  const competitionUrl = `${BASE_URL}/competitions/${slug}`;

  const leader = standingsData.length > 0
    ? { name: standingsData[0].team.shortName || standingsData[0].team.name, points: standingsData[0].standing.points }
    : null;
  const topScorer = topScorers.length > 0
    ? { name: topScorers[0].player.name, goals: topScorers[0].stat.goals, teamName: topScorers[0].team.shortName || topScorers[0].team.name }
    : null;
  const aboutParagraphs = buildCompetitionAbout({
    name: competition.name,
    country: competition.country,
    type: competition.type,
    seasonLabel: competitionSeason?.season.label,
    teamCount: standingsData.length,
    leader,
    topScorer,
  });

  const faqItems = buildCompetitionFaqs({
    name: competition.name,
    country: competition.country,
    teamCount: standingsData.length,
    seasonLabel: competitionSeason?.season.label,
    leader,
    topScorer,
  });

  return (
    <>
      <CompetitionJsonLd
        name={competition.name}
        url={competitionUrl}
        logo={competition.logoUrl}
        location={competition.country}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Competitions", url: `${BASE_URL}/search?type=competition` },
          { name: competition.name, url: competitionUrl },
        ]}
      />
      {faqItems.length > 0 && <FAQJsonLd items={faqItems} />}
      <PageTracker entityType="competition" entityId={competition.id} />

      <div className="min-h-screen bg-neutral-50">
        {/* Compact Header */}
        <PageHeader
          title={competition.name}
          subtitle={[competition.country, competitionSeason ? `Season ${competitionSeason.season.label}` : null, `${standingsData.length} teams`].filter(Boolean).join(" · ")}
          accentColor="bg-indigo-800"
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Competitions", href: "/search?type=competition" },
            { label: competition.name },
          ]}
          icon={
            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center flex-shrink-0 p-2">
              {competition.logoUrl ? (
                <ImageWithFallback src={competition.logoUrl} alt={competition.name} width={40} height={40} className="w-10 h-10 object-contain" />
              ) : (
                <Trophy className="w-7 h-7 text-indigo-300" />
              )}
            </div>
          }
          actions={
            <FollowButton entityType="competition" entityId={competition.id} entityName={competition.name} variant="hero" />
          }
        />

        {/* Tabs */}
        <CompetitionTabs teamCount={standingsData.length}>
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                {/* === STANDINGS TAB === */}
                <TabPanel tabId="standings" defaultTab="standings">
                  <div className="space-y-8">
                    {standingsData.length === 0 ? (
                      <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
                        <Trophy className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                        <p className="text-neutral-500">No standings data available</p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                        <StandingsTable standings={standingsData} />
                      </div>
                    )}

                    {aboutParagraphs.length > 0 && (
                      <section className="bg-white rounded-xl border border-neutral-200 p-6">
                        <h2 className="text-lg font-bold text-neutral-900 mb-3">About {competition.name}</h2>
                        <div className="space-y-3 text-sm leading-7 text-neutral-700">
                          {aboutParagraphs.map((p, i) => (
                            <p key={i}>{p}</p>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                </TabPanel>

                {/* === FIXTURES TAB === */}
                <TabPanel tabId="fixtures" defaultTab="standings">
                  {competitionSeason ? (
                    <CompetitionFixtures
                      competitionSeasonId={competitionSeason.competitionSeason.id}
                      limit={50}
                    />
                  ) : (
                    <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
                      <p className="text-neutral-500">No fixture data available</p>
                    </div>
                  )}
                </TabPanel>

                {/* === TOP SCORERS TAB === */}
                <TabPanel tabId="scorers" defaultTab="standings">
                  {topScorers.length > 0 ? (
                    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                      <div className="divide-y divide-neutral-100">
                        {topScorers.map(({ stat, player, team }, index) => (
                          <PlayerLink
                            key={player.id}
                            slug={player.slug}
                            isLinkWorthy={player.isIndexable ?? false}
                            className="flex items-center gap-3 p-4 hover:bg-neutral-50 transition-colors group"
                          >
                            <span className="w-8 text-center text-sm font-bold text-neutral-400">{index + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-neutral-900 group-hover:text-blue-600 transition-colors">{player.name}</div>
                              <div className="text-xs text-neutral-500">{team.name}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-neutral-900">{stat.goals}</div>
                              <div className="text-xs text-neutral-500">goals</div>
                            </div>
                          </PlayerLink>
                        ))}
                      </div>
                      <div className="border-t border-neutral-200 p-4">
                        <Link href={`/top-scorers/${slug}`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                          View full Top Scorers table →
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
                      <p className="text-neutral-500">No top scorer data available</p>
                    </div>
                  )}
                </TabPanel>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {competitionSeason && (
                  <TournamentRecap competitionSeasonId={competitionSeason.competitionSeason.id} />
                )}

                {faqItems.length > 0 && (
                  <section className="bg-white rounded-xl border border-neutral-200 p-5">
                    <h3 className="text-sm font-bold text-neutral-900 mb-3">FAQ</h3>
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

                <SidebarAd />
              </div>
            </div>
          </div>
        </CompetitionTabs>
      </div>
    </>
  );
}
