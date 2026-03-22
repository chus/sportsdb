import Link from "next/link";
import { TrendingUp, Search, Shield, User } from "lucide-react";
import type { Metadata } from "next";
import { getTrendingPlayers, getTrendingTeams, getTrendingSearches } from "@/lib/queries/trending";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { PageHeader } from "@/components/layout/page-header";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Trending – Popular Football Players & Teams | DataSports",
  description:
    "Discover the most trending football players, popular teams, and top searches right now on DataSports.",
  openGraph: {
    title: "Trending – Popular Football Players & Teams | DataSports",
    description:
      "Discover the most trending football players, popular teams, and top searches right now on DataSports.",
    url: `${BASE_URL}/trending`,
  },
  alternates: {
    canonical: `${BASE_URL}/trending`,
  },
};

export default async function TrendingPage() {
  const [trendingPlayers, trendingTeams, trendingSearches] = await Promise.all([
    getTrendingPlayers(10),
    getTrendingTeams(10),
    getTrendingSearches(15),
  ]);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Trending", url: `${BASE_URL}/trending` },
        ]}
      />

      <div className="min-h-screen bg-neutral-50">
        <PageHeader
          title="Trending Now"
          subtitle="The most viewed players, popular teams, and top searches in the last 24 hours"
          accentColor="bg-red-800"
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Trending" },
          ]}
          icon={<TrendingUp className="w-7 h-7 text-red-300" />}
        />

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Trending Players */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <User className="w-5 h-5 text-orange-500" />
                <h2 className="text-xl font-bold text-neutral-900">Trending Players</h2>
              </div>

              {trendingPlayers.length === 0 ? (
                <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
                  <TrendingUp className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                  <p className="text-neutral-500">No trending data yet. Check back soon!</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {trendingPlayers.map((player, index) => (
                    <Link
                      key={player.id}
                      href={`/players/${player.slug}`}
                      className="flex items-center gap-4 p-4 bg-white rounded-xl border border-neutral-200 hover:shadow-lg transition-shadow group"
                    >
                      <span className="text-2xl font-bold text-neutral-200 w-8">
                        {index + 1}
                      </span>
                      {player.imageUrl ? (
                        <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                          <ImageWithFallback
                            src={player.imageUrl}
                            alt={player.name}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-sm font-bold">{player.name.substring(0, 2).toUpperCase()}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-neutral-900 truncate group-hover:text-blue-600 transition-colors">
                          {player.name}
                        </div>
                        <div className="text-sm text-neutral-500">
                          {player.position}
                          {player.nationality && ` · ${player.nationality}`}
                        </div>
                      </div>
                      <div className="text-sm text-neutral-400 flex-shrink-0">
                        {player.views} views
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Trending Teams */}
              <div className="flex items-center gap-2 mt-10 mb-6">
                <Shield className="w-5 h-5 text-blue-500" />
                <h2 className="text-xl font-bold text-neutral-900">Popular Teams</h2>
              </div>

              {trendingTeams.length === 0 ? (
                <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
                  <Shield className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                  <p className="text-neutral-500">No team data yet. Check back soon!</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {trendingTeams.map((team, index) => (
                    <Link
                      key={team.id}
                      href={`/teams/${team.slug}`}
                      className="flex items-center gap-4 p-4 bg-white rounded-xl border border-neutral-200 hover:shadow-lg transition-shadow group"
                    >
                      <span className="text-2xl font-bold text-neutral-200 w-8">
                        {index + 1}
                      </span>
                      {team.logoUrl ? (
                        <div className="w-12 h-12 bg-neutral-100 rounded-lg flex items-center justify-center flex-shrink-0 p-2">
                          <ImageWithFallback
                            src={team.logoUrl}
                            alt={team.name}
                            width={32}
                            height={32}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-sm font-bold">{team.name.substring(0, 2).toUpperCase()}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-neutral-900 truncate group-hover:text-blue-600 transition-colors">
                          {team.name}
                        </div>
                        <div className="text-sm text-neutral-500">{team.country}</div>
                      </div>
                      <div className="text-sm text-neutral-400 flex-shrink-0">
                        {team.views} views
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar: Popular Searches */}
            <div>
              <div className="flex items-center gap-2 mb-6">
                <Search className="w-5 h-5 text-purple-500" />
                <h2 className="text-xl font-bold text-neutral-900">Popular Searches</h2>
              </div>

              {trendingSearches.length === 0 ? (
                <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
                  <Search className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                  <p className="text-neutral-500">No search data yet.</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-neutral-200 p-4">
                  <div className="space-y-1">
                    {trendingSearches.map((item, index) => (
                      <Link
                        key={item.query}
                        href={`/search?q=${encodeURIComponent(item.query)}`}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors group"
                      >
                        <span className="text-sm font-medium text-neutral-400 w-6">
                          {index + 1}
                        </span>
                        <span className="flex-1 font-medium text-neutral-900 group-hover:text-blue-600 transition-colors">
                          {item.query}
                        </span>
                        <span className="text-xs text-neutral-400">
                          {item.count}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
