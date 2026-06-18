import { Ban, BarChart3, Heart, Shield } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import { WebsiteJsonLd, OrganizationJsonLd } from "@/components/seo/json-ld";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { PageTracker } from "@/components/analytics/page-tracker";
import { SearchBar } from "@/components/search/search-bar";
import {
  getCompetitionSpotlight,
  getDailyTeamSpotlight,
  getFeaturedLeagues,
  getHeroBanner,
  getHomepageStats,
  getMatchOfTheDay,
  getStandoutPerformers,
  getTimelyArticles,
  getTopCompetitionsForHome,
  getWeekPreview,
} from "@/lib/queries/homepage";
import { HeroBannerSection } from "@/components/homepage/hero-banner";
import { HomepageGreeting } from "@/components/homepage/homepage-greeting";
import { MatchOfTheDayCard } from "@/components/homepage/match-of-the-day-card";
import { StandoutPerformers } from "@/components/homepage/standout-performers";
import { WeekPreview } from "@/components/homepage/week-preview";
import { CompetitionSpotlight } from "@/components/homepage/competition-spotlight";
import { LatestNewsStrip } from "@/components/homepage/latest-news-strip";
import { FeaturedLeagues } from "@/components/homepage/featured-leagues";
import { ExploreDatabase } from "@/components/homepage/explore-database";
import { TeamSpotlightSection } from "@/components/homepage/team-spotlight";
import { localizedAlternates } from "@/lib/seo/hreflang";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

// ISR: regenerate the homepage at most every 5 minutes.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "DataSports – The International Sports Database",
  description:
    "The comprehensive, structured database for football. Search across players, teams, competitions, and matches with time-aware data.",
  openGraph: {
    title: "DataSports – The International Sports Database",
    description:
      "The comprehensive, structured database for football. Search across players, teams, and competitions.",
    url: BASE_URL,
    siteName: "DataSports",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "DataSports – The International Sports Database",
    description:
      "The comprehensive, structured database for football. Search players, teams, competitions, and venues.",
  },
  alternates: localizedAlternates("/"),
  keywords: [
    "football",
    "soccer",
    "players",
    "teams",
    "competitions",
    "Premier League",
    "La Liga",
    "Bundesliga",
    "Serie A",
    "sports database",
    "World Cup 2026",
    "FIFA World Cup",
    "World Cup USA",
  ],
};

export default async function HomePage() {
  // No auth read on the server: keeps the homepage ISR-cacheable so Google
  // sees s-maxage instead of no-store. Pro personalization (followed leagues
  // in the hero, "Welcome back" greeting) is handled client-side after mount.
  const [
    hero,
    matchOfTheDay,
    performers,
    weekPreview,
    spotlight,
    articles,
    stats,
    topCompetitions,
    featuredLeagues,
    teamSpotlight,
  ] = await Promise.all([
    getHeroBanner(),
    getMatchOfTheDay(),
    getStandoutPerformers(30, 3),
    getWeekPreview(7),
    getCompetitionSpotlight(),
    getTimelyArticles(6),
    getHomepageStats(),
    getTopCompetitionsForHome(12),
    getFeaturedLeagues(6),
    getDailyTeamSpotlight(),
  ]);

  return (
    <>
      <WebsiteJsonLd
        url={BASE_URL}
        name="DataSports"
        description="The International Sports Database - Search across players, teams, competitions, and venues."
        searchUrl={`${BASE_URL}/search?q={search_term_string}`}
      />
      <OrganizationJsonLd
        name="DataSports"
        url={BASE_URL}
        description="The structured, canonical database for football. Search across players, teams, and competitions with time-aware data."
      />

      <div className="min-h-screen bg-surface-2">
        <PageTracker />

        {/* Compact search header */}
        <section className="bg-neutral-900 text-white">
          <div className="max-w-7xl mx-auto px-4 py-10 md:py-14">
            <h1 className="text-3xl md:text-4xl font-bold mb-2 tracking-tight">
              <HomepageGreeting fallback="The Sports Database" />
            </h1>
            <p className="text-faint mb-6 text-sm">
              {stats.players.toLocaleString()} players ·{" "}
              {stats.teams.toLocaleString()} teams ·{" "}
              {stats.matches > 0
                ? `${stats.matches.toLocaleString()} matches`
                : `${stats.competitions.toLocaleString()} competitions`}
            </p>
            <div className="max-w-xl">
              <SearchBar
                size="default"
                placeholder="Search players, teams, competitions..."
                variant="dark"
              />
            </div>
          </div>
        </section>

        {/* Hero: Live / Today / Upcoming */}
        <HeroBannerSection data={hero} />

        {/* Yesterday's highlights: Match of the Day + Standout Performers */}
        {(matchOfTheDay || performers.length > 0) && (
          <section className="max-w-7xl mx-auto px-4 py-12">
            <div className="grid lg:grid-cols-3 gap-6">
              {matchOfTheDay && (
                <div className="lg:col-span-2">
                  <MatchOfTheDayCard data={matchOfTheDay} />
                </div>
              )}
              {performers.length > 0 && (
                <div className={matchOfTheDay ? "" : "lg:col-span-3"}>
                  <StandoutPerformers data={performers} />
                </div>
              )}
            </div>
          </section>
        )}

        {/* Featured Leagues */}
        <FeaturedLeagues leagues={featuredLeagues} />

        {/* This Week in Football */}
        {weekPreview.length > 0 && <WeekPreview data={weekPreview} />}

        {/* Competition Spotlight (rotating) */}
        {spotlight && <CompetitionSpotlight data={spotlight} />}

        {/* Daily Team Spotlight */}
        {teamSpotlight && <TeamSpotlightSection data={teamSpotlight} />}

        {/* Latest News (timely-first) */}
        {articles.length > 0 && <LatestNewsStrip articles={articles} />}

        {/* Explore the Database */}
        <ExploreDatabase stats={stats} />

        {/* Competition quick links */}
        {topCompetitions.length > 0 && (
          <section className="border-y border-line bg-surface">
            <div className="max-w-7xl mx-auto px-4 py-6">
              <h2 className="text-lg font-bold text-ink mb-4">
                Competitions
              </h2>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                {topCompetitions.map((comp) => (
                  <Link
                    key={comp.id}
                    href={`/competitions/${comp.slug}`}
                    className="flex items-center gap-2 px-4 py-2.5 bg-surface-2 hover:bg-surface-2 border border-line rounded-lg transition-colors flex-shrink-0"
                  >
                    {comp.logoUrl ? (
                      <ImageWithFallback
                        src={comp.logoUrl}
                        alt={comp.name}
                        width={20}
                        height={20}
                        className="w-5 h-5 object-contain"
                      />
                    ) : (
                      <Shield className="w-4 h-4 text-faint" />
                    )}
                    <span className="text-sm font-medium text-ink whitespace-nowrap">
                      {comp.name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Pro CTA — always rendered so the page stays cacheable. Logged-in
            users get their Dashboard link from the navbar; no need for a
            duplicate CTA here. */}
        <section className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
          <div className="max-w-7xl mx-auto px-4 py-12 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">
              Unlock the Full Experience
            </h2>
            <p className="text-blue-100 mb-6 max-w-xl mx-auto text-sm">
              Ad-free browsing, unlimited follows and
              comparisons — all for less than a coffee per month.
            </p>
            <div className="flex items-center justify-center gap-6 mb-8">
              {[
                { icon: Ban, label: "Ad-Free" },
                { icon: BarChart3, label: "Unlimited Comparisons" },
                { icon: Heart, label: "Unlimited Follows" },
              ].map((f) => (
                <div key={f.label} className="text-white text-center">
                  <f.icon className="w-6 h-6 mx-auto mb-1" />
                  <span className="text-xs font-medium">{f.label}</span>
                </div>
              ))}
            </div>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-6 py-3 bg-surface text-blue-600 font-bold rounded-full hover:shadow-xl transition-all text-sm"
            >
              Go Pro — &euro;3/month
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
