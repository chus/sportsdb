import { Users, Shield, ArrowRight, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { players, teams, competitions, venues, matches } from "@/lib/db/schema";
import { count } from "drizzle-orm";
import { LiveMatchesSection } from "@/components/live/live-matches-section";
import { WebsiteJsonLd, OrganizationJsonLd } from "@/components/seo/json-ld";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingStats } from "@/components/landing/landing-stats";
import { LandingFeatures } from "@/components/landing/landing-features";
import { BetweenContentAd } from "@/components/ads/between-content-ad";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const metadata: Metadata = {
  title: "DataSports – The International Sports Database",
  description: "The structured, canonical database for football. Search across 7,000+ players, 180+ teams, and 8 competitions with time-aware data.",
  openGraph: {
    title: "DataSports – The International Sports Database",
    description: "The structured, canonical database for football. Search across 7,000+ players, 180+ teams, and 8 competitions.",
    url: BASE_URL,
    siteName: "DataSports",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "DataSports – The International Sports Database",
    description: "The structured, canonical database for football. Search players, teams, competitions, and venues.",
  },
  alternates: {
    canonical: BASE_URL,
  },
  keywords: ["football", "soccer", "players", "teams", "competitions", "Premier League", "La Liga", "Bundesliga", "Serie A", "sports database"],
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
  return db.select().from(players).limit(limit);
}

export default async function HomePage() {
  const t = await getTranslations();
  const [stats, featuredTeams, featuredPlayers] = await Promise.all([
    getStats(),
    getFeaturedTeams(),
    getFeaturedPlayers(),
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
    <div className="min-h-screen">
      {/* Hero */}
      <LandingHero />

      {/* Live Matches */}
      <LiveMatchesSection />

      {/* Explore Features */}
      <LandingFeatures />

      <BetweenContentAd />

      {/* Trending Players */}
      {featuredPlayers.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                </div>
                <h2 className="text-3xl font-bold text-neutral-900">{t("home.featuredPlayers")}</h2>
              </div>
              <Link
                href="/search?type=player"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                {t("common.viewAll")} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredPlayers.map((player) => (
                <Link
                  key={player.id}
                  href={`/players/${player.slug}`}
                  className="flex items-center gap-4 p-4 bg-white rounded-xl border border-neutral-200 hover:shadow-xl hover:border-blue-200 hover:-translate-y-0.5 transition-all duration-200 group"
                >
                  <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-blue-50 transition-colors">
                    <Users className="w-6 h-6 text-neutral-400 group-hover:text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-neutral-900 truncate group-hover:text-blue-600 transition-colors">
                      {player.name}
                    </div>
                    <div className="text-sm text-neutral-500 truncate">
                      {player.position} {player.nationality && `• ${player.nationality}`}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Top Teams */}
      {featuredTeams.length > 0 && (
        <section className="py-16 bg-neutral-50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-3xl font-bold text-neutral-900">{t("home.featuredTeams")}</h2>
              </div>
              <Link
                href="/search?type=team"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                {t("common.viewAll")} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {featuredTeams.map((team) => (
                <Link
                  key={team.id}
                  href={`/teams/${team.slug}`}
                  className="p-6 bg-white rounded-xl border border-neutral-200 hover:shadow-xl hover:border-blue-200 hover:-translate-y-0.5 transition-all duration-200 group text-center"
                >
                  <div className="w-16 h-16 bg-neutral-100 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-50 transition-colors p-2">
                    {team.logoUrl ? (
                      <img src={team.logoUrl} alt={team.name} className="w-full h-full object-contain" />
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

      <BetweenContentAd />

      {/* Premium Stats */}
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
