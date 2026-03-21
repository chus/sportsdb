import { TrendingUp, Users, ChevronRight, Shield, Ban, BarChart3, Heart } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { players, teams, competitions, venues, matches } from "@/lib/db/schema";
import { count, ne, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { LiveMatchesSection } from "@/components/live/live-matches-section";
import { WebsiteJsonLd, OrganizationJsonLd } from "@/components/seo/json-ld";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingStats } from "@/components/landing/landing-stats";
import { LandingFeatures } from "@/components/landing/landing-features";
import { WorldCupBanner } from "@/components/landing/world-cup-banner";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { PageTracker } from "@/components/analytics/page-tracker";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const metadata: Metadata = {
  title: "SportsDB – The International Sports Database",
  description: "The comprehensive, structured database for football. Search across players, teams, competitions, and matches with time-aware data.",
  openGraph: {
    title: "SportsDB – The International Sports Database",
    description: "The comprehensive, structured database for football. Search across players, teams, and competitions.",
    url: BASE_URL,
    siteName: "SportsDB",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "SportsDB – The International Sports Database",
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
  const [venuesCount] = await db.select({ count: count() }).from(venues);
  const [matchesCount] = await db.select({ count: count() }).from(matches);

  return {
    players: playersCount.count,
    teams: teamsCount.count,
    competitions: competitionsCount.count,
    venues: venuesCount.count,
    matches: matchesCount.count,
  };
}

async function getFeaturedTeams(limit = 8) {
  return db.select().from(teams).limit(limit);
}

async function getFeaturedPlayers(limit = 8) {
  return db
    .select()
    .from(players)
    .where(ne(players.position, "Unknown"))
    .orderBy(desc(players.popularityScore))
    .limit(limit);
}

export default async function HomePage() {
  const [stats, featuredTeams, featuredPlayers, currentUser] = await Promise.all([
    getStats(),
    getFeaturedTeams(),
    getFeaturedPlayers(),
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
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <PageTracker />
      {/* Hero Section */}
      <LandingHero
        stats={stats}
        isAuthenticated={!!currentUser}
        viewerName={viewerName}
      />

      {/* World Cup 2026 Banner */}
      <WorldCupBanner />

      {/* Live Matches */}
      <LiveMatchesSection />

      <section className="border-y border-neutral-200 bg-white/80">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {currentUser ? (
            <div className="grid gap-6 rounded-3xl border border-neutral-200 bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-6 md:grid-cols-[1.4fr_1fr] md:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
                  Personalized Home
                </p>
                <h2 className="mt-2 text-2xl font-bold text-neutral-900">
                  {viewerName ? `${viewerName}, your football workspace is ready.` : "Your football workspace is ready."}
                </h2>
                <p className="mt-3 max-w-2xl text-neutral-600">
                  Jump back into the parts of SportsDB that matter most: account settings, live coverage, and the latest reporting.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 md:justify-end">
                <Link
                  href="/account"
                  className="rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Open Account
                </Link>
                <Link
                  href="/news"
                  className="rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-800 transition-colors hover:border-blue-300 hover:text-blue-600"
                >
                  Browse News
                </Link>
                <Link
                  href="/trending"
                  className="rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-800 transition-colors hover:border-blue-300 hover:text-blue-600"
                >
                  See Trending
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 rounded-3xl border border-neutral-200 bg-gradient-to-r from-amber-50 via-white to-blue-50 p-6 md:grid-cols-[1.3fr_1fr] md:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">
                  Free Account
                </p>
                <h2 className="mt-2 text-2xl font-bold text-neutral-900">
                  Follow clubs, track players, and come back to the stories you care about.
                </h2>
                <p className="mt-3 max-w-2xl text-neutral-600">
                  A SportsDB account lets you follow entities, build a football habit, and turn search traffic into repeat visits.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 md:justify-end">
                <Link
                  href="/signup"
                  className="rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Create Free Account
                </Link>
                <Link
                  href="/login"
                  className="rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-800 transition-colors hover:border-blue-300 hover:text-blue-600"
                >
                  Sign In
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Trending Players */}
      {featuredPlayers.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-6 h-6 text-orange-500" />
                  <h2 className="text-3xl font-bold text-neutral-900">Trending Players</h2>
                </div>
                <p className="text-neutral-600">Most searched this week</p>
              </div>
              <Link
                href="/search?type=player"
                className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                See all
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredPlayers.map((player) => (
                <Link
                  key={player.id}
                  href={`/players/${player.slug}`}
                  className="flex items-center gap-4 p-4 bg-white rounded-xl border border-neutral-200 hover:shadow-xl hover:border-neutral-300 hover:-translate-y-1 transition-all duration-200 group"
                >
                  <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-blue-50 transition-colors">
                    <Users className="w-6 h-6 text-neutral-400 group-hover:text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-neutral-900 truncate group-hover:text-blue-600 transition-colors">
                      {player.name}
                    </div>
                    <div className="text-sm text-neutral-500 truncate">
                      {player.position} {player.nationality && `· ${player.nationality}`}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Exploration Hooks */}
      <LandingFeatures />

      {/* Go Pro Section */}
      <section className="py-16 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Unlock the Full Experience</h2>
          <p className="text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
            Get ad-free browsing, advanced player stats, unlimited follows and comparisons — all for less than a coffee per month.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10 max-w-3xl mx-auto">
            {[
              { icon: Ban, label: "Ad-Free", desc: "Clean, distraction-free experience" },
              { icon: BarChart3, label: "Advanced Stats", desc: "Deep analytics and radar charts" },
              { icon: Heart, label: "Unlimited Follows", desc: "Follow all the players you want" },
            ].map((f) => (
              <div key={f.label} className="bg-white/10 backdrop-blur-sm rounded-xl p-5 text-white">
                <f.icon className="w-8 h-8 mx-auto mb-3" />
                <h3 className="font-semibold text-lg mb-1">{f.label}</h3>
                <p className="text-sm text-blue-100">{f.desc}</p>
              </div>
            ))}
          </div>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 font-bold rounded-full hover:shadow-xl hover:-translate-y-0.5 transition-all text-lg"
          >
            Go Pro — from €8/year
          </Link>
        </div>
      </section>

      {/* Top Teams */}
      {featuredTeams.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-6 h-6 text-blue-500" />
                  <h2 className="text-3xl font-bold text-neutral-900">Top Teams</h2>
                </div>
                <p className="text-neutral-600">Elite clubs from around the world</p>
              </div>
              <Link
                href="/search?type=team"
                className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                See all teams
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredTeams.map((team) => (
                <Link
                  key={team.id}
                  href={`/teams/${team.slug}`}
                  className="p-6 bg-white rounded-xl border border-neutral-200 hover:shadow-xl hover:border-neutral-300 hover:-translate-y-1 transition-all duration-200 group text-center"
                >
                  <div className="relative w-16 h-16 bg-neutral-100 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-50 transition-colors p-2">
                    {team.logoUrl ? (
                      <ImageWithFallback
                        src={team.logoUrl}
                        alt={`${team.name} logo`}
                        fill
                        sizes="64px"
                        className="object-contain"
                      />
                    ) : (
                      <Shield className="w-8 h-8 text-neutral-400 group-hover:text-blue-500" />
                    )}
                  </div>
                  <div className="font-medium text-neutral-900 text-sm truncate group-hover:text-blue-600 transition-colors">
                    {team.shortName || team.name}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">{team.country}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Premium Statistics */}
      <LandingStats
        players={stats.players}
        teams={stats.teams}
        competitions={stats.competitions}
        matches={stats.matches}
      />
    </div>
    </>
  );
}
