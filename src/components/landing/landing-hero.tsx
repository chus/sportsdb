"use client";

import { Search, Sparkles, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface LandingHeroProps {
  stats?: {
    players: number;
    teams: number;
    competitions: number;
    matches: number;
  };
}

function formatStat(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M+";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K+";
  }
  return num.toString() + "+";
}

export function LandingHero({ stats }: LandingHeroProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <section className="relative overflow-hidden">
      {/* Dark gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-blue-950 to-indigo-950" />

      {/* Subtle decorative elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 py-24 md:py-32">
        <div className="max-w-3xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 rounded-full mb-8">
            <Sparkles className="w-4 h-4 text-blue-300" />
            <span className="text-sm font-semibold text-blue-100">The International Sports Database</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Every Player.
            <span className="block text-blue-400">Every Team.</span>
            <span className="block text-indigo-400">Every Match.</span>
          </h1>

          {/* Description */}
          <p className="text-xl text-neutral-300 mb-10 max-w-2xl leading-relaxed">
            The comprehensive, structured database for football. Search across players,
            teams, competitions, and matches with time-aware data.
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="max-w-2xl mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search players, teams, matches, competitions..."
                className="w-full pl-12 pr-32 py-4 text-base bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-white/15 transition-all"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-lg transition-all"
              >
                Search
              </button>
            </div>
          </form>

          {/* CTA */}
          <Link
            href="/search"
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
          >
            Explore the Database
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>

        {/* Stats counters */}
        {stats && (
          <div className="mt-16 pt-10 border-t border-white/10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div>
                <div className="text-3xl md:text-4xl font-bold text-white">{formatStat(stats.players)}</div>
                <div className="text-sm text-neutral-400 mt-1">Players</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-white">{formatStat(stats.teams)}</div>
                <div className="text-sm text-neutral-400 mt-1">Teams</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-white">{formatStat(stats.competitions)}</div>
                <div className="text-sm text-neutral-400 mt-1">Competitions</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-white">{formatStat(stats.matches)}</div>
                <div className="text-sm text-neutral-400 mt-1">Matches</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
