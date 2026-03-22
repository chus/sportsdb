import { TrendingUp, ChevronRight, Shield, Ban, BarChart3, Heart, Search } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { players, teams, competitions, matches } from "@/lib/db/schema";
import { count, ne, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { LiveMatchesSection } from "@/components/live/live-matches-section";
import { WebsiteJsonLd, OrganizationJsonLd } from "@/components/seo/json-ld";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { PageTracker } from "@/components/analytics/page-tracker";
import { SearchBar } from "@/components/search/search-bar";
import { getPublishedArticles } from "@/lib/queries/articles";
import { getCompetitionSeason, getStandings } from "@/lib/queries/competitions";
import { StandingsTable } from "@/components/competition/standings-table";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const metadata: Metadata = {
  title: "DataSports – The International Sports Database",
  description: "The comprehensive, structured database for football. Search across players, teams, competitions, and matches with time-aware data.",
  openGraph: {
    title: "DataSports – The International Sports Database",
    description: "The comprehensive, structured database for football. Search across players, teams, and competitions.",
    url: BASE_URL,
    siteName: "DataSports",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "DataSports – The International Sports Database",
    description: "The comprehensive, structured database for football. Search players, teams, competitions, and venues.",
  },
  alternates: {
    canonical: BASE_URL,
  },
  keywords: ["football", "soccer", "players", "teams", "competitions", "Premier League", "La Liga", "Bundesliga", "Serie A", "sports database", "World Cup 2026", "FIFA World Cup", "World Cup USA"],
};

async function getStats() {
  const [playersCount] = await db.select({ count: count() }).from(players);
  const [teamsCount] = await db.select({ count: count() }).from(teams);
  const [competitionsCount] = await db.select({ count: count() }).from(competitions);
  const [matchesCount] = await db.select({ count: count() }).from(matches);

  return {
    players: playersCount.count,
    teams: teamsCount.count,
    competitions: competitionsCount.count,
    matches: matchesCount.count,
  };
}

async function getTrendingPlayers(limit = 6) {
  return db
    .select()
    .from(players)
    .where(ne(players.position, "Unknown"))
    .orderBy(desc(players.popularityScore))
    .limit(limit);
}

async function getTopCompetitions() {
  return db
    .select()
    .from(competitions)
    .limit(12);
}

async function getPremierLeagueStandings() {
  const cs = await getCompetitionSeason("premier-league");
  if (!cs) return null;
  const standingsData = await getStandings(cs.competitionSeason.id);
  return { standings: standingsData, season: cs.season };
}

export default async function HomePage() {
  const [stats, trendingPlayers, recentArticles, plStandings, topCompetitions, currentUser] =
    await Promise.all([
      getStats(),
      getTrendingPlayers(),
      getPublishedArticles(5),
      getPremierLeagueStandings(),
      getTopCompetitions(),
      getCurrentUser(),
    ]);

  const viewerName = currentUser?.name || currentUser?.email?.split("@")[0] || null;

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
              {stats.players.toLocaleString()} players · {stats.teams.toLocaleString()} teams · {stats.matches.toLocaleString()} matches
            </p>
            <div className="max-w-xl">
              <SearchBar size="default" placeholder="Search players, teams, competitions..." variant="dark" />
            </div>
          </div>
        </section>

        {/* Live Matches */}
        <LiveMatchesSection />

        {/* Main content grid */}
        <section className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left column — Articles */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-neutral-900">Latest News</h2>
                <Link
                  href="/news"
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  View All <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {recentArticles.length > 0 && (
                <div className="space-y-0">
                  {/* Featured article */}
                  <Link
                    href={`/news/${recentArticles[0].article.slug}`}
                    className="block bg-white rounded-xl border border-neutral-200 overflow-hidden hover:shadow-lg transition-shadow mb-4 group"
                  >
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        {recentArticles[0].competition && (
                          <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            {recentArticles[0].competition.name}
                          </span>
                        )}
                        <span className="text-xs text-neutral-400">
                          {recentArticles[0].article.publishedAt
                            ? new Date(recentArticles[0].article.publishedAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })
                            : ""}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-neutral-900 group-hover:text-blue-600 transition-colors mb-2">
                        {recentArticles[0].article.title}
                      </h3>
                      {recentArticles[0].article.excerpt && (
                        <p className="text-sm text-neutral-600 line-clamp-2">
                          {recentArticles[0].article.excerpt}
                        </p>
                      )}
                    </div>
                  </Link>

                  {/* Article list */}
                  <div className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-100">
                    {recentArticles.slice(1).map(({ article, competition }) => (
                      <Link
                        key={article.id}
                        href={`/news/${article.slug}`}
                        className="flex items-start gap-4 p-4 hover:bg-neutral-50 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {competition && (
                              <span className="text-xs font-medium text-blue-600">
                                {competition.name}
                              </span>
                            )}
                            <span className="text-xs text-neutral-400">
                              {article.publishedAt
                                ? new Date(article.publishedAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })
                                : ""}
                            </span>
                          </div>
                          <h4 className="font-semibold text-sm text-neutral-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                            {article.title}
                          </h4>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending Players */}
              {trendingPlayers.length > 0 && (
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-orange-500" />
                      <h2 className="text-lg font-bold text-neutral-900">Trending Players</h2>
                    </div>
                    <Link
                      href="/trending"
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      See all <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {trendingPlayers.map((player) => (
                      <Link
                        key={player.id}
                        href={`/players/${player.slug}`}
                        className="flex items-center gap-3 p-3 bg-white rounded-xl border border-neutral-200 hover:shadow-md transition-shadow group"
                      >
                        <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center flex-shrink-0">
                          {player.imageUrl ? (
                            <ImageWithFallback
                              src={player.imageUrl}
                              alt={player.name}
                              width={40}
                              height={40}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-bold text-neutral-500">
                              {player.name.substring(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-neutral-900 truncate group-hover:text-blue-600 transition-colors">
                            {player.name}
                          </div>
                          <div className="text-xs text-neutral-500 truncate">
                            {player.position}{player.nationality && ` · ${player.nationality}`}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right sidebar */}
            <div className="space-y-6">
              {/* Standings snapshot */}
              {plStandings && plStandings.standings.length > 0 && (
                <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
                    <h3 className="font-bold text-sm text-neutral-900">Premier League</h3>
                    <Link
                      href="/competitions/premier-league"
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      Full Table
                    </Link>
                  </div>
                  <StandingsTable
                    standings={plStandings.standings}
                    compact
                    limit={8}
                  />
                </div>
              )}

              {/* Quick CTA */}
              {!currentUser && (
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-5 text-white">
                  <h3 className="font-bold text-lg mb-2">Create a free account</h3>
                  <p className="text-sm text-blue-100 mb-4">
                    Follow teams, track players, and get personalized updates.
                  </p>
                  <Link
                    href="/signup"
                    className="inline-block px-5 py-2.5 bg-white text-blue-600 font-semibold text-sm rounded-lg hover:shadow-lg transition-shadow"
                  >
                    Sign Up Free
                  </Link>
                </div>
              )}

              {currentUser && (
                <div className="bg-white rounded-xl border border-neutral-200 p-5">
                  <h3 className="font-bold text-sm text-neutral-900 mb-3">Quick Links</h3>
                  <div className="space-y-2">
                    <Link href="/dashboard" className="flex items-center gap-2 text-sm text-neutral-600 hover:text-blue-600 transition-colors">
                      <ChevronRight className="w-4 h-4" /> Dashboard
                    </Link>
                    <Link href="/news" className="flex items-center gap-2 text-sm text-neutral-600 hover:text-blue-600 transition-colors">
                      <ChevronRight className="w-4 h-4" /> Latest News
                    </Link>
                    <Link href="/trending" className="flex items-center gap-2 text-sm text-neutral-600 hover:text-blue-600 transition-colors">
                      <ChevronRight className="w-4 h-4" /> Trending
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Competition quick links */}
        {topCompetitions.length > 0 && (
          <section className="border-y border-neutral-200 bg-white">
            <div className="max-w-7xl mx-auto px-4 py-6">
              <h2 className="text-lg font-bold text-neutral-900 mb-4">Competitions</h2>
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

        {/* Go Pro Section */}
        <section className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
          <div className="max-w-7xl mx-auto px-4 py-12 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">Unlock the Full Experience</h2>
            <p className="text-blue-100 mb-6 max-w-xl mx-auto text-sm">
              Ad-free browsing, advanced stats, unlimited follows and comparisons — all for less than a coffee per month.
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
      </div>
    </>
  );
}
