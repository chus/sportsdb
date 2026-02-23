"use client";

import Link from "next/link";
import { Trophy, ArrowRight, Search } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

export function LandingHero() {
  const { user, isLoading } = useAuth();

  return (
    <section className="relative pt-20 pb-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 opacity-5" />

      <div className="max-w-6xl mx-auto px-4 relative">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold mb-6">
            <Trophy className="w-4 h-4" />
            The IMDb of Sports
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-neutral-900 mb-6 leading-tight">
            Your Personal
            <span className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Sports Universe
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-neutral-600 max-w-3xl mx-auto mb-12 leading-relaxed">
            Follow your favorite players, teams, and competitions. Get
            personalized updates and explore the world's most comprehensive
            sports database.
          </p>

          {!isLoading && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
                    className="px-8 py-4 bg-white border-2 border-neutral-200 text-neutral-900 text-lg font-semibold rounded-xl hover:border-blue-600 hover:text-blue-600 transition-all flex items-center justify-center gap-2"
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
                    className="px-8 py-4 bg-white border-2 border-neutral-200 text-neutral-900 text-lg font-semibold rounded-xl hover:border-blue-600 hover:text-blue-600 transition-all"
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
