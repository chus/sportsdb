import { Ban, BarChart3, ChevronRight, Heart, Shield } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { userLeaguePreferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { WebsiteJsonLd, OrganizationJsonLd } from "@/components/seo/json-ld";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { PageTracker } from "@/components/analytics/page-tracker";
import { SearchBar } from "@/components/search/search-bar";
import {
  getCompetitionSpotlight,
  getHeroBanner,
  getHomepageStats,
  getMatchOfTheDay,
  getStandoutPerformers,
  getTimelyArticles,
  getTopCompetitionsForHome,
  getWeekPreview,
} from "@/lib/queries/homepage";
import { HeroBannerSection } from "@/components/homepage/hero-banner";
import { MatchOfTheDayCard } from "@/components/homepage/match-of-the-day-card";
import { StandoutPerformers } from "@/components/homepage/standout-performers";
import { WeekPreview } from "@/components/homepage/week-preview";
import { CompetitionSpotlight } from "@/components/homepage/competition-spotlight";
import { LatestNewsStrip } from "@/components/homepage/latest-news-strip";

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
  alternates: {
    canonical: BASE_URL,
  },
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

async function resolvePersonalization(
  user: Awaited<ReturnType<typeof getCurrentUser>>
): Promise<string[] | undefined> {
  if (!user || user.role !== "pro") return undefined;
  const prefs = await db
    .select({ competitionId: userLeaguePreferences.competitionId })
    .from(userLeaguePreferences)
    .where(eq(userLeaguePreferences.userId, user.id));
  if (!prefs.length) return undefined;
  return prefs.map((p) => p.competitionId);
}

export default async function HomePage() {
  const currentUser = await getCurrentUser();
  const personalizedIds = await resolvePersonalization(currentUser);

  const [
    hero,
    matchOfTheDay,
    performers,
    weekPreview,
    spotlight,
    articles,
    stats,
    topCompetitions,
  ] = await Promise.all([
    getHeroBanner({ personalizedCompetitionIds: personalizedIds }),
    getMatchOfTheDay(),
    getStandoutPerformers(30, 3),
    getWeekPreview(7),
    getCompetitionSpotlight(),
    getTimelyArticles(6),
    getHomepageStats(),
    getTopCompetitionsForHome(12),
  ]);

  const viewerName =
    currentUser?.name || currentUser?.email?.split("@")[0] || null;

  return (
    <>
      <WebsiteJsonLd
        url={BASE_URL}
        name="SportsDB"
        description="The International Sports Database - Search across players, teams, competitions, and venues."
        searchUrl={`${BASE_URL}/search?q={search_term_string}`}
      />
      <OrganizationJsonLd
        name="SportsDB"
        url={BASE_URL}
        description="The structured, canonical database for football. Search across players, teams, and competitions with time-aware data."
      />

      <div className="min-h-screen bg-neutral-50">
        <PageTracker />

        {/* Compact search header */}
        <section className="bg-neutral-900 text-white">
          <div className="max-w-7xl mx-auto px-4 py-10 md:py-14">
            <h1 className="text-3xl md:text-4xl font-bold mb-2 tracking-tight">
              {viewerName ? `Welcome back, ${viewerName}` : "The Sports Database"}
            </h1>
            <p className="text-neutral-400 mb-6 text-sm">
              {stats.players.toLocaleString()} players ·{" "}
              {stats.teams.toLocaleString()} teams ·{" "}
              {stats.matches.toLocaleString()} matches
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

        {/* This Week in Football */}
        {weekPreview.length > 0 && <WeekPreview data={weekPreview} />}

        {/* Competition Spotlight (rotating) */}
        {spotlight && <CompetitionSpotlight data={spotlight} />}

        {/* Latest News (timely-first) */}
        {articles.length > 0 && <LatestNewsStrip articles={articles} />}

        {/* Competition quick links */}
        {topCompetitions.length > 0 && (
          <section className="border-y border-neutral-200 bg-white">
            <div className="max-w-7xl mx-auto px-4 py-6">
              <h2 className="text-lg font-bold text-neutral-900 mb-4">
                Competitions
              </h2>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                {topCompetitions.map((comp) => (
                  <Link
                    key={comp.id}
                    href={`/competitions/${comp.slug}`}
                    className="flex items-center gap-2 px-4 py-2.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors flex-shrink-0"
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
                      <Shield className="w-4 h-4 text-neutral-400" />
                    )}
                    <span className="text-sm font-medium text-neutral-700 whitespace-nowrap">
                      {comp.name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Pro / Dashboard CTA */}
        {!currentUser && (
          <section className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
            <div className="max-w-7xl mx-auto px-4 py-12 text-center">
              <h2 className="text-2xl font-bold text-white mb-3">
                Unlock the Full Experience
              </h2>
              <p className="text-blue-100 mb-6 max-w-xl mx-auto text-sm">
                Ad-free browsing, advanced stats, unlimited follows and
                comparisons — all for less than a coffee per month.
              </p>
              <div className="flex items-center justify-center gap-6 mb-8">
                {[
                  { icon: Ban, label: "Ad-Free" },
                  { icon: BarChart3, label: "Advanced Stats" },
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
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-600 font-bold rounded-full hover:shadow-xl transition-all text-sm"
              >
                Go Pro — from &euro;8/year
              </Link>
            </div>
          </section>
        )}

        {currentUser && (
          <section className="max-w-7xl mx-auto px-4 py-12">
            <Link
              href="/dashboard"
              className="block bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-6 text-white hover:shadow-lg transition-shadow group"
            >
              <h3 className="font-bold text-xl mb-1 group-hover:underline">
                Your Dashboard
              </h3>
              <p className="text-sm text-blue-100 mb-3">
                Follow leagues, check standings, and see upcoming fixtures — all
                in one place.
              </p>
              <span className="inline-flex items-center gap-1 text-sm font-semibold">
                Open Dashboard <ChevronRight className="w-4 h-4" />
              </span>
            </Link>
          </section>
        )}
      </div>
    </>
  );
}
