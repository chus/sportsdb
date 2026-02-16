import { Trophy, Search, Users, Shield, MapPin, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { players, teams, competitions, venues } from "@/lib/db/schema";
import { count } from "drizzle-orm";
import { LiveMatchesSection } from "@/components/live/live-matches-section";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://sportsdb-nine.vercel.app";

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

  return {
    players: playersCount.count,
    teams: teamsCount.count,
    competitions: competitionsCount.count,
    venues: venuesCount.count,
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
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      {/* Hero Section */}
      <section className="relative h-[550px] bg-gradient-to-br from-neutral-900 via-blue-950 to-indigo-950 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="relative h-full max-w-7xl mx-auto px-4 flex flex-col items-center justify-center text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full mb-6">
            <Trophy className="w-4 h-4 text-blue-300" />
            <span className="text-sm font-medium text-blue-100">
              {t("home.heroTagline")}
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            {t("home.heroTitle1")}
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              {t("home.heroTitle2")}
            </span>
          </h1>

          <p className="text-lg text-neutral-300 max-w-2xl mb-8">
            {t("home.heroDescription")}
          </p>

          {/* Search CTA */}
          <div className="w-full max-w-xl">
            <Link
              href="/search"
              className="flex items-center gap-3 w-full px-6 py-4 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] text-left group"
            >
              <Search className="w-5 h-5 text-neutral-400 group-hover:text-blue-500 transition-colors" />
              <span className="text-neutral-500 flex-1">
                {t("home.searchPlaceholder")}
              </span>
              <ArrowRight className="w-5 h-5 text-neutral-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
            </Link>
          </div>
        </div>
      </section>

      {/* Live Matches Section */}
      <LiveMatchesSection />

      {/* Stats Section */}
      <section className="py-12 -mt-16 relative z-10">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Trophy, label: t("common.competitions"), value: stats.competitions, href: "/search?type=competition" },
              { icon: Shield, label: t("common.teams"), value: stats.teams, href: "/search?type=team" },
              { icon: Users, label: t("common.players"), value: stats.players, href: "/search?type=player" },
              { icon: MapPin, label: t("common.venues"), value: stats.venues, href: "/search?type=venue" },
            ].map((stat) => (
              <Link
                key={stat.label}
                href={stat.href}
                className="text-center p-6 bg-white rounded-xl border border-neutral-200 shadow-lg hover:shadow-xl hover:border-blue-200 transition-all group"
              >
                <stat.icon className="w-8 h-8 text-blue-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <div className="text-3xl font-bold text-neutral-900 mb-1">
                  {formatNumber(stat.value)}
                </div>
                <div className="text-sm text-neutral-500">{stat.label}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

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

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {t("home.readyToExplore")}
          </h2>
          <p className="text-lg text-white/80 mb-8">
            {t("home.exploreDescription", {
              players: formatNumber(stats.players),
              teams: formatNumber(stats.teams),
              competitions: formatNumber(stats.competitions)
            })}
          </p>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 font-semibold rounded-xl hover:bg-neutral-100 transition-colors"
          >
            <Search className="w-5 h-5" />
            {t("home.startSearching")}
          </Link>
        </div>
      </section>
    </div>
  );
}
