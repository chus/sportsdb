import { Trophy, Database, Globe, Users, Zap, Shield } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const metadata: Metadata = {
  title: "About SportsDB – The International Sports Database",
  description: "Learn about SportsDB, the structured canonical database for football. Our mission is to provide accurate, time-aware sports data for fans, researchers, and developers.",
  openGraph: {
    title: "About SportsDB",
    description: "The structured canonical database for football. Accurate, time-aware sports data.",
    url: `${BASE_URL}/about`,
    siteName: "SportsDB",
    type: "website",
  },
  alternates: {
    canonical: `${BASE_URL}/about`,
  },
};

export default function AboutPage() {
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
      icon: Users,
      title: "Community Driven",
      description: "Built for fans, researchers, journalists, and developers who need reliable sports data.",
    },
  ];

  const stats = [
    { label: "Players", value: "7,000+" },
    { label: "Teams", value: "180+" },
    { label: "Competitions", value: "15+" },
    { label: "Matches", value: "10,000+" },
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-2xl mb-6">
            <Trophy className="w-10 h-10" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            About SportsDB
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
              SportsDB was created with a simple goal: to provide the most accurate, well-structured, and comprehensive football database available. We believe that sports data should be accessible, reliable, and useful for everyone—from casual fans to professional analysts.
            </p>
            <p>
              Unlike traditional sports websites that focus on news and opinions, SportsDB is built as a true database. Every piece of information is carefully structured, linked, and time-stamped, allowing you to explore not just current data but the entire history of the sport.
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
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

      {/* Tech Stack Section */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-neutral-900 mb-6">
            Built with Modern Technology
          </h2>
          <div className="prose prose-lg max-w-none text-neutral-600">
            <p>
              SportsDB is built using cutting-edge web technologies to ensure fast, reliable, and scalable performance:
            </p>
            <ul>
              <li><strong>Next.js 15</strong> – React framework with App Router for optimal performance</li>
              <li><strong>PostgreSQL</strong> – Robust relational database for structured sports data</li>
              <li><strong>Drizzle ORM</strong> – Type-safe database queries</li>
              <li><strong>Tailwind CSS</strong> – Modern, responsive design system</li>
              <li><strong>Vercel</strong> – Global edge deployment for fast load times</li>
            </ul>
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
              href="/search?type=player"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Browse Players
            </Link>
            <Link
              href="/search?type=team"
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
  );
}
