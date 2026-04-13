import { Trophy, Database, Globe, Users, Zap, Shield, BarChart3, BookOpen } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { players, teams, competitions, matches, articles } from "@/lib/db/schema";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { sql, eq } from "drizzle-orm";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const metadata: Metadata = {
  title: "About DataSports – The International Sports Database",
  description: "Learn about DataSports, the structured canonical database for football. Our mission is to provide accurate, time-aware sports data for fans, researchers, and developers.",
  openGraph: {
    title: "About DataSports",
    description: "Learn about DataSports, the structured canonical database for football. Accurate, time-aware sports data for fans, researchers, and developers.",
    url: `${BASE_URL}/about`,
    siteName: "DataSports",
    type: "website",
  },
  alternates: {
    canonical: `${BASE_URL}/about`,
  },
};

export default async function AboutPage() {
  // Fetch real stats from the database
  const [playerCount, teamCount, compCount, matchCount, articleCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(players).then(r => r[0].count),
    db.select({ count: sql<number>`count(*)::int` }).from(teams).then(r => r[0].count),
    db.select({ count: sql<number>`count(*)::int` }).from(competitions).then(r => r[0].count),
    db.select({ count: sql<number>`count(*)::int` }).from(matches).then(r => r[0].count),
    db.select({ count: sql<number>`count(*)::int` }).from(articles).where(eq(articles.status, "published")).then(r => r[0].count),
  ]);

  function formatStat(n: number): string {
    if (n >= 10000) return `${Math.floor(n / 1000)}k+`;
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k+`;
    return `${n}+`;
  }

  const features = [
    {
      icon: Database,
      title: "Structured Data",
      description: "Canonical, normalized database schema designed for accuracy and consistency across all entities.",
    },
    {
      icon: Globe,
      title: "Global Coverage",
      description: "Comprehensive coverage of major football leagues across Europe, Americas, and beyond.",
    },
    {
      icon: Zap,
      title: "Time-Aware",
      description: "Historical data modeling with valid_from/valid_to dates for tracking player transfers, team changes, and more.",
    },
    {
      icon: BarChart3,
      title: "Deep Statistics",
      description: "Season stats, top scorers, assists leaders, standings, and form analysis for every competition we cover.",
    },
    {
      icon: BookOpen,
      title: "Editorial Coverage",
      description: "AI-assisted match reports, round recaps, and player spotlights reviewed against verified database records.",
    },
    {
      icon: Users,
      title: "Community Driven",
      description: "Built for fans, researchers, journalists, and developers who need reliable sports data.",
    },
  ];

  const stats = [
    { label: "Players", value: formatStat(playerCount) },
    { label: "Teams", value: formatStat(teamCount) },
    { label: "Competitions", value: formatStat(compCount) },
    { label: "Matches", value: formatStat(matchCount) },
    { label: "Articles", value: formatStat(articleCount) },
  ];

  return (
    <>
    <BreadcrumbJsonLd
      items={[
        { name: "Home", url: BASE_URL },
        { name: "About", url: `${BASE_URL}/about` },
      ]}
    />
    <div className="min-h-screen bg-neutral-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-2xl mb-6">
            <Trophy className="w-10 h-10" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            About DataSports
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto">
            The structured, canonical database for football. We&apos;re building the most accurate and comprehensive sports data platform.
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-neutral-900 mb-6">Our Mission</h2>
          <div className="prose prose-lg max-w-none text-neutral-600">
            <p>
              DataSports was created with a simple goal: to provide the most accurate, well-structured, and comprehensive football database available. We believe that sports data should be accessible, reliable, and useful for everyone—from casual fans to professional analysts.
            </p>
            <p>
              Unlike traditional sports websites that focus on news and opinions, DataSports is built as a true database. Every piece of information is carefully structured, linked, and time-stamped, allowing you to explore not just current data but the entire history of the sport.
            </p>
            <p>
              Our time-aware data model means you can see which players were on a team during any season, track career progressions, and understand how competitions have evolved over the years.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-neutral-900 mb-8 text-center">
            By the Numbers
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="text-center p-6 bg-neutral-50 rounded-xl"
              >
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-neutral-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-neutral-900 mb-8 text-center">
            What Makes Us Different
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-xl border border-neutral-200 p-6"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-neutral-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Competitions Section */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-neutral-900 mb-6">
            Competitions We Cover
          </h2>
          <div className="prose prose-lg max-w-none text-neutral-600">
            <p>
              DataSports tracks the world&apos;s most important football competitions, with full squad rosters, season statistics, match results, and standings for each. Our database currently covers:
            </p>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-1 not-prose mt-4">
              {[
                ["Premier League", "England"],
                ["La Liga", "Spain"],
                ["Bundesliga", "Germany"],
                ["Serie A", "Italy"],
                ["Ligue 1", "France"],
                ["UEFA Champions League", "Europe"],
                ["Championship", "England"],
                ["Eredivisie", "Netherlands"],
                ["Primeira Liga", "Portugal"],
                ["Liga Profesional", "Argentina"],
                ["Brasileir\u00e3o S\u00e9rie A", "Brazil"],
              ].map(([name, country]) => (
                <div key={name} className="flex items-center gap-2 py-2 text-neutral-700">
                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  <span className="font-medium">{name}</span>
                  <span className="text-neutral-400 text-sm">({country})</span>
                </div>
              ))}
            </div>
            <p className="mt-6">
              We also archive data from the FIFA World Cup and UEFA European Championship. New competitions are added regularly as our data partnerships expand.
            </p>
          </div>
        </div>
      </section>

      {/* Editorial Content Section */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-neutral-900 mb-6">
            Data-Driven Editorial
          </h2>
          <div className="prose prose-lg max-w-none text-neutral-600">
            <p>
              Every article published on DataSports is generated using AI and verified against our structured database. Match reports reference actual scorelines, goal scorers, and standings positions. Round recaps aggregate real results from every fixture in a matchday. Player spotlights are backed by verified career records and season statistics.
            </p>
            <p>
              This approach means our content is never speculative or opinion-based. Instead, every claim in every article can be traced back to a specific data point in our database. We publish match reports, round recaps, player spotlights, match previews, and season reviews across all the leagues we cover.
            </p>
            <p>
              For more detail on our data practices, see our{" "}
              <Link href="/methodology" className="text-blue-600 hover:underline">Methodology</Link> page.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-neutral-900 mb-4">
            Start Exploring
          </h2>
          <p className="text-lg text-neutral-600 mb-8">
            Dive into our comprehensive database of players, teams, and competitions.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/players"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Browse Players
            </Link>
            <Link
              href="/teams"
              className="px-6 py-3 bg-neutral-200 text-neutral-900 rounded-lg font-medium hover:bg-neutral-300 transition-colors"
            >
              Browse Teams
            </Link>
            <Link
              href="/contact"
              className="px-6 py-3 border border-neutral-300 text-neutral-700 rounded-lg font-medium hover:bg-neutral-50 transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
    </>
  );
}
