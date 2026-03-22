"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Plus, X, TrendingUp, Search, Loader2, Zap } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useSubscription } from "@/components/subscription/subscription-provider";
import { useUpgradeModal } from "@/components/subscription/upgrade-modal";
import { cn } from "@/lib/utils/cn";

interface Player {
  id: string;
  name: string;
  slug: string;
  position: string;
  imageUrl: string | null;
  teamName: string | null;
  stats?: {
    appearances: number;
    goals: number;
    assists: number;
    minutesPlayed: number;
  };
}

export function ComparePageContent() {
  const { subscription } = useSubscription();
  const { openUpgradeModal } = useUpgradeModal();
  const isPro = subscription?.tier === "pro";

  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [comparisonsToday, setComparisonsToday] = useState(0);
  const [comparisonLimit, setComparisonLimit] = useState(3);

  const canCompare = isPro || comparisonsToday < comparisonLimit;

  // Load server-side comparison usage on mount
  useEffect(() => {
    if (!isPro) {
      fetch("/api/comparisons/check")
        .then((res) => res.json())
        .then((data) => {
          if (typeof data.used === "number") setComparisonsToday(data.used);
          if (typeof data.limit === "number") setComparisonLimit(data.limit);
        })
        .catch(() => {});
    }
  }, [isPro]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchPlayers();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const searchPlayers = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}&type=player&limit=6`
      );
      if (res.ok) {
        const data = await res.json();
        const players = data.results?.players || [];
        // Filter out already selected players
        setSearchResults(
          players.filter(
            (p: Player) => !selectedPlayers.find((sp) => sp.id === p.id)
          )
        );
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const addPlayer = async (player: Player) => {
    if (selectedPlayers.length < 4) {
      if (!isPro) {
        try {
          const res = await fetch("/api/comparisons/increment", {
            method: "POST",
          });
          if (res.status === 429) {
            const data = await res.json();
            setComparisonsToday(data.used ?? comparisonLimit);
            openUpgradeModal("comparison_limit");
            return;
          }
          if (res.ok) {
            const data = await res.json();
            setComparisonsToday(data.used);
          }
        } catch {
          // Fall through — allow comparison on network error
        }
      }

      try {
        const statsRes = await fetch(`/api/players/stats?ids=${player.id}`);
        const statsData = statsRes.ok ? await statsRes.json() : null;
        const s = statsData?.stats?.[player.id];
        const playerWithStats = {
          ...player,
          stats: s
            ? { appearances: s.appearances, goals: s.goals, assists: s.assists, minutesPlayed: s.minutesPlayed }
            : { appearances: 0, goals: 0, assists: 0, minutesPlayed: 0 },
        };
        setSelectedPlayers([...selectedPlayers, playerWithStats]);
      } catch {
        setSelectedPlayers([...selectedPlayers, { ...player, stats: { appearances: 0, goals: 0, assists: 0, minutesPlayed: 0 } }]);
      }
      setSearchQuery("");
      setSearchResults([]);
    }
  };

  const removePlayer = (id: string) => {
    setSelectedPlayers(selectedPlayers.filter((p) => p.id !== id));
  };

  const getMaxValue = (key: keyof NonNullable<Player["stats"]>) => {
    const values = selectedPlayers
      .map((p) => p.stats?.[key] ?? 0)
      .filter((v) => typeof v === "number");
    return Math.max(...values, 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-neutral-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-neutral-700 hover:text-neutral-900"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </Link>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h1 className="font-bold text-lg">Player Comparison</h1>
            </div>
            <div className="w-20" />
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-neutral-900 mb-2">
            Compare Players Side-by-Side
          </h2>
          <p className="text-neutral-600">
            Add up to 4 players to compare their statistics
          </p>
          {!isPro && (
            <div className="mt-4 max-w-xs mx-auto">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-neutral-600">
                  {comparisonsToday}/{comparisonLimit} comparisons used
                </span>
                <Link
                  href="/pricing"
                  className="text-blue-600 font-medium hover:underline"
                >
                  Upgrade
                </Link>
              </div>
              <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    comparisonsToday >= comparisonLimit
                      ? "bg-red-500"
                      : comparisonsToday >= comparisonLimit - 1
                      ? "bg-amber-500"
                      : "bg-blue-500"
                  )}
                  style={{
                    width: `${(comparisonsToday / comparisonLimit) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Search Bar */}
        {selectedPlayers.length < 4 && canCompare && (
          <div className="relative max-w-md mx-auto mb-8">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for players to compare..."
              className="w-full pl-10 pr-4 py-3 border-2 border-neutral-200 rounded-lg focus:border-blue-500 focus:outline-none"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 animate-spin" />
            )}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="absolute top-full mt-2 left-0 right-0 bg-white rounded-lg shadow-xl border overflow-hidden z-10">
                {searchResults.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => addPlayer(player)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-neutral-50 text-left"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full overflow-hidden flex-shrink-0">
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
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-neutral-900 truncate">
                        {player.name}
                      </div>
                      <div className="text-sm text-neutral-500 truncate">
                        {player.teamName || "Free Agent"} • {player.position}
                      </div>
                    </div>
                    <Plus className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selected Players Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {selectedPlayers.map((player) => (
            <div
              key={player.id}
              className="bg-white rounded-2xl p-6 border-2 border-blue-500 shadow-lg relative"
            >
              <button
                onClick={() => removePlayer(player.id)}
                className="absolute top-3 right-3 p-1 bg-red-100 hover:bg-red-200 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-red-600" />
              </button>

              <div className="text-center mb-4">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full mx-auto mb-3 overflow-hidden">
                  {player.imageUrl ? (
                    <Image
                      src={player.imageUrl}
                      alt={player.name}
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-2xl font-bold">
                      {player.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <Link
                  href={`/players/${player.slug}`}
                  className="font-bold text-lg text-neutral-900 hover:text-blue-600 transition-colors"
                >
                  {player.name}
                </Link>
                <p className="text-sm text-neutral-600">
                  {player.teamName || "Free Agent"}
                </p>
                <p className="text-xs text-neutral-500">{player.position}</p>
              </div>
            </div>
          ))}

          {/* Add Player Slots */}
          {selectedPlayers.length < 4 &&
            Array.from({ length: 4 - selectedPlayers.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className={cn(
                  "bg-neutral-100 rounded-2xl p-6 border-2 border-dashed border-neutral-300 flex items-center justify-center min-h-[250px]",
                  !canCompare && "opacity-50"
                )}
              >
                <div className="text-center">
                  <Plus className="w-12 h-12 text-neutral-400 mx-auto mb-2" />
                  <p className="text-sm text-neutral-600">
                    {canCompare
                      ? "Search to add player"
                      : "Upgrade for more comparisons"}
                  </p>
                </div>
              </div>
            ))}
        </div>

        {/* Stats Comparison */}
        {selectedPlayers.length >= 2 && (
          <div className="bg-white rounded-2xl p-8 border border-neutral-200 shadow-sm">
            <h3 className="text-2xl font-bold mb-6">
              Season Statistics Comparison
            </h3>

            <div className="space-y-6">
              {/* Appearances */}
              <StatComparisonBar
                label="Appearances"
                players={selectedPlayers}
                statKey="appearances"
                maxValue={getMaxValue("appearances")}
              />

              {/* Goals */}
              <StatComparisonBar
                label="Goals"
                players={selectedPlayers}
                statKey="goals"
                maxValue={getMaxValue("goals")}
              />

              {/* Assists */}
              <StatComparisonBar
                label="Assists"
                players={selectedPlayers}
                statKey="assists"
                maxValue={getMaxValue("assists")}
              />

              {/* Minutes Played */}
              <StatComparisonBar
                label="Minutes Played"
                players={selectedPlayers}
                statKey="minutesPlayed"
                maxValue={getMaxValue("minutesPlayed")}
              />
            </div>
          </div>
        )}

        {!canCompare && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-8 text-center max-w-lg mx-auto mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold text-neutral-900 mb-2">
              Daily Limit Reached
            </h3>
            <p className="text-neutral-600 mb-6">
              You&apos;ve used all {comparisonLimit} free comparisons for today.
              Upgrade to Pro for unlimited player comparisons, advanced stats, and more.
            </p>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold"
            >
              <Zap className="w-5 h-5" />
              Upgrade to Pro — €8/year
            </Link>
          </div>
        )}

        {selectedPlayers.length < 2 && canCompare && (
          <div className="text-center py-12 text-neutral-500">
            Add at least 2 players to compare their statistics
          </div>
        )}
      </div>
    </div>
  );
}

function StatComparisonBar({
  label,
  players,
  statKey,
  maxValue,
}: {
  label: string;
  players: Player[];
  statKey: keyof NonNullable<Player["stats"]>;
  maxValue: number;
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium text-neutral-700">{label}</span>
        <span className="text-sm text-neutral-500">Higher is better</span>
      </div>
      <div className="space-y-2">
        {players.map((player) => {
          const value = player.stats?.[statKey] ?? 0;
          const isMax = value === maxValue && maxValue > 0;
          const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

          return (
            <div key={player.id} className="flex items-center gap-3">
              <span className="text-sm font-medium text-neutral-700 w-32 truncate">
                {player.name}
              </span>
              <div className="flex-1 h-10 bg-neutral-100 rounded-lg overflow-hidden relative">
                <div
                  className={cn(
                    "h-full transition-all duration-500 flex items-center justify-end pr-3",
                    isMax
                      ? "bg-gradient-to-r from-green-500 to-emerald-600"
                      : "bg-gradient-to-r from-blue-500 to-indigo-600"
                  )}
                  style={{ width: `${Math.max(percentage, 10)}%` }}
                >
                  <span className="text-white font-bold text-sm">{value}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
