"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  TrendingUp,
  Target,
  Activity,
  BarChart3,
  Lock,
  Loader2,
  Search,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useSubscription } from "@/components/subscription/subscription-provider";
import { cn } from "@/lib/utils/cn";

interface Player {
  id: string;
  name: string;
  slug: string;
  position: string;
  imageUrl: string | null;
  teamName: string | null;
}

export function AdvancedStatsContent() {
  const { subscription } = useSubscription();
  const isPro = subscription?.tier === "pro" || subscription?.tier === "ultimate";

  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedStat, setSelectedStat] = useState<"radar" | "heatmap" | "passing" | "xg">("radar");

  // Mock stats for demo
  const stats = {
    shooting: 95,
    passing: 92,
    dribbling: 98,
    defending: 35,
    physical: 70,
    pace: 85,
  };

  const advancedStats = {
    xG: 28.5,
    xA: 15.2,
    passCompletion: 87.3,
    progressivePasses: 245,
    keyPasses: 89,
    successfulDribbles: 156,
    ballRecoveries: 45,
    aerialDuelsWon: 23,
  };

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchPlayers();
    } else {
      setPlayers([]);
    }
  }, [searchQuery]);

  const searchPlayers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&type=player&limit=6`);
      if (res.ok) {
        const data = await res.json();
        setPlayers(data.results?.players || []);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  // Pro paywall
  if (!isPro) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 text-white">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-4xl font-bold">Advanced Stats</h1>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center max-w-2xl mx-auto">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Lock className="w-10 h-10 text-white" />
            </div>

            <h2 className="text-3xl font-bold text-neutral-900 mb-4">
              Unlock Advanced Stats
            </h2>
            <p className="text-lg text-neutral-600 mb-8">
              Get access to radar charts, heat maps, passing networks, xG
              analytics, and much more with a Pro subscription.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-blue-50 rounded-xl p-4">
                <Target className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-neutral-900">
                  Radar Charts
                </p>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <Activity className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-neutral-900">
                  Heat Maps
                </p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4">
                <TrendingUp className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-neutral-900">
                  xG Analytics
                </p>
              </div>
              <div className="bg-orange-50 rounded-xl p-4">
                <BarChart3 className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-neutral-900">
                  Passing Networks
                </p>
              </div>
            </div>

            <Link
              href="/pricing"
              className="inline-block px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold text-lg"
            >
              Upgrade to Pro - $4.99/month
            </Link>

            <p className="text-sm text-neutral-500 mt-4">
              Cancel anytime
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-6">
            <Link
              href="/"
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-4xl font-bold mb-2">Advanced Stats</h1>
              <p className="text-blue-100">
                {selectedPlayer
                  ? `${selectedPlayer.name} • 2024/25 Season`
                  : "Select a player to view their advanced statistics"}
              </p>
            </div>
          </div>

          {/* Player Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for a player..."
              className="w-full pl-10 pr-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60 animate-spin" />
            )}

            {/* Search Results */}
            {players.length > 0 && (
              <div className="absolute top-full mt-2 left-0 right-0 bg-white rounded-lg shadow-xl overflow-hidden z-10">
                {players.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => {
                      setSelectedPlayer(player);
                      setSearchQuery("");
                      setPlayers([]);
                    }}
                    className="w-full flex items-center gap-3 p-3 hover:bg-neutral-50 text-left"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full overflow-hidden">
                      {player.imageUrl && (
                        <Image
                          src={player.imageUrl}
                          alt={player.name}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-neutral-900">
                        {player.name}
                      </div>
                      <div className="text-sm text-neutral-500">
                        {player.teamName || "Free Agent"} • {player.position}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedPlayer ? (
        <>
          {/* Tabs */}
          <div className="bg-white border-b">
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex gap-6 overflow-x-auto">
                {(["radar", "heatmap", "passing", "xg"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSelectedStat(tab)}
                    className={cn(
                      "py-4 px-2 border-b-2 transition-colors whitespace-nowrap capitalize",
                      selectedStat === tab
                        ? "border-blue-600 text-blue-600 font-semibold"
                        : "border-transparent text-neutral-600 hover:text-neutral-900"
                    )}
                  >
                    {tab === "xg" ? "xG Analytics" : tab === "heatmap" ? "Heat Map" : tab === "passing" ? "Passing Network" : "Radar Chart"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="max-w-7xl mx-auto px-4 py-8">
            {selectedStat === "radar" && (
              <div className="grid md:grid-cols-2 gap-8">
                {/* Radar Chart */}
                <div className="bg-white rounded-xl p-8 shadow-sm border">
                  <h3 className="text-xl font-bold text-neutral-900 mb-6">
                    Player Attributes
                  </h3>
                  <div className="aspect-square max-w-md mx-auto">
                    <svg viewBox="0 0 400 400" className="w-full h-full">
                      {/* Background hexagon */}
                      <polygon
                        points="200,50 350,125 350,275 200,350 50,275 50,125"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="2"
                      />
                      <polygon
                        points="200,100 300,150 300,250 200,300 100,250 100,150"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="1"
                      />
                      <polygon
                        points="200,150 250,175 250,225 200,250 150,225 150,175"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="1"
                      />
                      {/* Data polygon */}
                      <polygon
                        points={`
                          200,${50 + (1 - stats.shooting / 100) * 150}
                          ${200 + (stats.passing / 100) * 150 * 0.866},${200 - (stats.passing / 100) * 150 * 0.5}
                          ${200 + (stats.dribbling / 100) * 150 * 0.866},${200 + (stats.dribbling / 100) * 150 * 0.5}
                          200,${200 + (stats.defending / 100) * 150}
                          ${200 - (stats.physical / 100) * 150 * 0.866},${200 + (stats.physical / 100) * 150 * 0.5}
                          ${200 - (stats.pace / 100) * 150 * 0.866},${200 - (stats.pace / 100) * 150 * 0.5}
                        `}
                        fill="rgba(59, 130, 246, 0.3)"
                        stroke="#3b82f6"
                        strokeWidth="2"
                      />
                      {/* Labels */}
                      <text x="200" y="35" textAnchor="middle" className="text-xs fill-neutral-600">Shooting</text>
                      <text x="365" y="130" textAnchor="start" className="text-xs fill-neutral-600">Passing</text>
                      <text x="365" y="280" textAnchor="start" className="text-xs fill-neutral-600">Dribbling</text>
                      <text x="200" y="380" textAnchor="middle" className="text-xs fill-neutral-600">Defending</text>
                      <text x="35" y="280" textAnchor="end" className="text-xs fill-neutral-600">Physical</text>
                      <text x="35" y="130" textAnchor="end" className="text-xs fill-neutral-600">Pace</text>
                    </svg>
                  </div>
                </div>

                {/* Stats Breakdown */}
                <div className="bg-white rounded-xl p-8 shadow-sm border">
                  <h3 className="text-xl font-bold text-neutral-900 mb-6">
                    Attribute Breakdown
                  </h3>
                  <div className="space-y-4">
                    {Object.entries(stats).map(([key, value]) => (
                      <div key={key}>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-medium text-neutral-700 capitalize">
                            {key}
                          </span>
                          <span className="text-sm font-bold text-neutral-900">
                            {value}/100
                          </span>
                        </div>
                        <div className="h-3 bg-neutral-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all"
                            style={{ width: `${value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {selectedStat === "heatmap" && (
              <div className="bg-white rounded-xl p-8 shadow-sm border">
                <h3 className="text-xl font-bold text-neutral-900 mb-6">
                  Touch Heat Map
                </h3>
                <div className="bg-gradient-to-b from-green-800 to-green-700 rounded-lg p-8 aspect-[2/3] max-w-2xl mx-auto relative overflow-hidden">
                  {/* Field markings */}
                  <div className="absolute inset-4 border-2 border-white/30 rounded" />
                  <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-white/30" />
                  <div className="absolute top-1/2 left-1/2 w-24 h-24 border-2 border-white/30 rounded-full -translate-x-1/2 -translate-y-1/2" />
                  {/* Heat points */}
                  <div className="absolute top-1/3 left-1/2 w-32 h-32 bg-red-500/70 rounded-full blur-2xl" />
                  <div className="absolute top-2/3 left-1/3 w-24 h-24 bg-orange-500/60 rounded-full blur-2xl" />
                  <div className="absolute top-1/2 left-2/3 w-28 h-28 bg-yellow-500/50 rounded-full blur-2xl" />
                  <div className="absolute top-1/4 left-3/4 w-20 h-20 bg-yellow-500/40 rounded-full blur-2xl" />
                </div>
                <div className="flex items-center justify-center gap-6 mt-6">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-red-500 rounded-full" />
                    <span className="text-sm text-neutral-600">High Activity</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-orange-500 rounded-full" />
                    <span className="text-sm text-neutral-600">Medium Activity</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-yellow-500 rounded-full" />
                    <span className="text-sm text-neutral-600">Low Activity</span>
                  </div>
                </div>
              </div>
            )}

            {selectedStat === "passing" && (
              <div className="bg-white rounded-xl p-8 shadow-sm border">
                <h3 className="text-xl font-bold text-neutral-900 mb-6">
                  Passing Network
                </h3>
                <div className="bg-gradient-to-b from-green-800 to-green-700 rounded-lg p-8 aspect-[2/3] max-w-2xl mx-auto relative">
                  {/* Player nodes */}
                  <div className="absolute top-1/4 left-1/2 w-12 h-12 bg-white rounded-full flex items-center justify-center font-bold text-sm -translate-x-1/2 shadow-lg">
                    10
                  </div>
                  <div className="absolute top-1/3 left-1/3 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center font-bold text-xs shadow-lg">
                    7
                  </div>
                  <div className="absolute top-1/3 left-2/3 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center font-bold text-xs shadow-lg">
                    11
                  </div>
                  <div className="absolute top-1/2 left-1/4 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center font-bold text-xs shadow-lg">
                    6
                  </div>
                  {/* Connection lines */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <line x1="50%" y1="25%" x2="33%" y2="33%" stroke="white" strokeWidth="4" opacity="0.6" />
                    <line x1="50%" y1="25%" x2="66%" y2="33%" stroke="white" strokeWidth="4" opacity="0.6" />
                    <line x1="50%" y1="25%" x2="25%" y2="50%" stroke="white" strokeWidth="2" opacity="0.4" />
                  </svg>
                </div>
                <p className="text-center text-sm text-neutral-600 mt-4">
                  Line thickness represents passing frequency
                </p>
              </div>
            )}

            {selectedStat === "xg" && (
              <div className="space-y-6">
                {/* xG Overview Cards */}
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl p-6 shadow-sm border">
                    <p className="text-sm text-neutral-600 mb-1">Expected Goals (xG)</p>
                    <p className="text-3xl font-bold text-blue-600">{advancedStats.xG}</p>
                  </div>
                  <div className="bg-white rounded-xl p-6 shadow-sm border">
                    <p className="text-sm text-neutral-600 mb-1">Expected Assists (xA)</p>
                    <p className="text-3xl font-bold text-green-600">{advancedStats.xA}</p>
                  </div>
                  <div className="bg-white rounded-xl p-6 shadow-sm border">
                    <p className="text-sm text-neutral-600 mb-1">Key Passes</p>
                    <p className="text-3xl font-bold text-purple-600">{advancedStats.keyPasses}</p>
                  </div>
                  <div className="bg-white rounded-xl p-6 shadow-sm border">
                    <p className="text-sm text-neutral-600 mb-1">Successful Dribbles</p>
                    <p className="text-3xl font-bold text-orange-600">{advancedStats.successfulDribbles}</p>
                  </div>
                </div>

                {/* More Advanced Stats */}
                <div className="bg-white rounded-xl p-8 shadow-sm border">
                  <h3 className="text-xl font-bold text-neutral-900 mb-6">
                    Advanced Metrics
                  </h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    {Object.entries(advancedStats).slice(2).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg"
                      >
                        <span className="text-sm font-medium text-neutral-700 capitalize">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </span>
                        <span className="text-2xl font-bold text-neutral-900">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <BarChart3 className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">
            Select a Player
          </h2>
          <p className="text-neutral-600">
            Use the search bar above to find a player and view their advanced statistics
          </p>
        </div>
      )}
    </div>
  );
}
