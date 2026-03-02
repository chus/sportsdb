"use client";

import Link from "next/link";
import { Sparkles, ArrowRight, Search } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LandingHero() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <section className="relative h-[600px] overflow-hidden">
      {/* Background image with overlay */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?w=1920&q=80"
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
      </div>

      <div className="relative h-full max-w-6xl mx-auto px-4 flex flex-col justify-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 backdrop-blur-sm text-blue-300 rounded-full text-sm font-semibold mb-6 w-fit">
          <Sparkles className="w-4 h-4" />
          Featured Match
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight max-w-4xl">
          Your Personal
          <span className="block bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Sports Universe
          </span>
        </h1>

        <p className="text-lg md:text-xl text-neutral-300 max-w-2xl mb-8 leading-relaxed">
          Follow your favorite players, teams, and competitions. Get
          personalized updates and explore the world&apos;s most comprehensive
          sports database.
        </p>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="max-w-xl mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search players, teams, competitions..."
              className="w-full pl-12 pr-4 py-4 text-base bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-white/15 transition-all"
            />
          </div>
        </form>

        {/* CTA Buttons */}
        {!isLoading && (
          <div className="flex flex-col sm:flex-row gap-4">
            {user ? (
              <>
                <Link
                  href="/feed"
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 group"
                >
                  My Feed
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/search"
                  className="px-8 py-4 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-lg font-semibold rounded-xl hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                >
                  <Search className="w-5 h-5" />
                  Explore
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 group"
                >
                  Start Following
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/login"
                  className="px-8 py-4 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-lg font-semibold rounded-xl hover:bg-white/20 transition-all flex items-center justify-center"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
