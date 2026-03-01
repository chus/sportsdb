import { Trophy, Search, Users, Shield, MapPin, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { players, teams, competitions, venues, matches } from "@/lib/db/schema";
import { count } from "drizzle-orm";
import { LiveMatchesSection } from "@/components/live/live-matches-section";
import { UpcomingMatches } from "@/components/matches/upcoming-matches";
import { WebsiteJsonLd, OrganizationJsonLd } from "@/components/seo/json-ld";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingStats } from "@/components/landing/landing-stats";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingBenefits } from "@/components/landing/landing-benefits";
import { LatestNews } from "@/components/news/latest-news";
import { BetweenContentAd } from "@/components/ads/between-content-ad";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const metadata: Metadata = {
  title: "SportsDB – The International Sports Database",
  description: "The structured, canonical database for football. Search across 7,000+ players, 180+ teams, and 8 competitions with time-aware data.",
  openGraph: {
    title: "SportsDB – The International Sports Database",
    description: "The structured, canonical database for football. Search across 7,000+ players, 180+ teams, and 8 competitions.",
    url: BASE_URL,
    siteName: "SportsDB",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "SportsDB – The International Sports Database",
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

async function getFeaturedTeams(limit = 6) {
  return db.select().from(teams).limit(limit);
}

async function getFeaturedPlayers(limit = 8) {
  return db.select().from(players).limit(limit);
}

async function getFeaturedCompetitions(limit = 6) {
  return db.select().from(competitions).limit(limit);
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return num.toString();
}

export default async function HomePage() {
  const t = await getTranslations();
  const [stats, featuredTeams, featuredPlayers, featuredCompetitions] = await Promise.all([
    getStats(),
    getFeaturedTeams(),
    getFeaturedPlayers(),
    getFeaturedCompetitions(),
  ]);

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
      {/* Landing Hero */}
      <LandingHero />

      {/* Stats */}
      <LandingStats
        players={stats.players}
        teams={stats.teams}
        competitions={stats.competitions}
        matches={stats.matches}
      />

      {/* Live Matches Section */}
      <div className="mt-12">
        <LiveMatchesSection />
      </div>

      {/* Upcoming Matches */}
      <UpcomingMatches limit={6} />

      <BetweenContentAd />

      {/* Latest News */}
      <LatestNews limit={4} />

      {/* Features */}
      <LandingFeatures />

      {/* Featured Competitions */}
      {featuredCompetitions.length > 0 && (
        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-neutral-900">{t("common.competitions")}</h2>
              <Link
                href="/search?type=competition"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                {t("common.viewAll")} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {featuredCompetitions.map((comp) => (
                <Link
                  key={comp.id}
                  href={`/competitions/${comp.slug}`}
                  className="p-4 bg-white rounded-xl border border-neutral-200 hover:shadow-lg hover:border-blue-200 transition-all group text-center"
                >
                  <div className="w-12 h-12 bg-neutral-100 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:bg-blue-50 transition-colors">
                    {comp.logoUrl ? (
                      <img src={comp.logoUrl} alt={comp.name} className="w-8 h-8 object-contain" />
                    ) : (
                      <Trophy className="w-6 h-6 text-neutral-400 group-hover:text-blue-500" />
                    )}
                  </div>
                  <div className="font-medium text-neutral-900 text-sm truncate group-hover:text-blue-600 transition-colors">
                    {comp.name}
                  </div>
                  <div className="text-xs text-neutral-500">{comp.country}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <BetweenContentAd />

      {/* Featured Teams */}
      {featuredTeams.length > 0 && (
        <section className="py-12 bg-neutral-50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-neutral-900">{t("home.featuredTeams")}</h2>
              <Link
                href="/search?type=team"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                {t("common.viewAll")} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {featuredTeams.map((team) => (
                <Link
                  key={team.id}
                  href={`/teams/${team.slug}`}
                  className="p-4 bg-white rounded-xl border border-neutral-200 hover:shadow-lg hover:border-blue-200 transition-all group text-center"
                >
                  <div className="w-14 h-14 bg-neutral-100 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:bg-blue-50 transition-colors p-2">
                    {team.logoUrl ? (
                      <img src={team.logoUrl} alt={team.name} className="w-full h-full object-contain" />
                    ) : (
                      <Shield className="w-8 h-8 text-neutral-400 group-hover:text-blue-500" />
                    )}
                  </div>
                  <div className="font-medium text-neutral-900 text-sm truncate group-hover:text-blue-600 transition-colors">
                    {team.shortName || team.name}
                  </div>
                  <div className="text-xs text-neutral-500">{team.country}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Players */}
      {featuredPlayers.length > 0 && (
        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-neutral-900">{t("home.featuredPlayers")}</h2>
              <Link
                href="/search?type=player"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                {t("common.viewAll")} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {featuredPlayers.map((player) => (
                <Link
                  key={player.id}
                  href={`/players/${player.slug}`}
                  className="flex items-center gap-4 p-4 bg-white rounded-xl border border-neutral-200 hover:shadow-lg hover:border-blue-200 transition-all group"
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

      {/* Benefits & CTA */}
      <LandingBenefits />
    </div>
    </>
  );
}
