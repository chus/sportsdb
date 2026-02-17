"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { TrendingUp, Target, Clock, AlertTriangle } from "lucide-react";
import { EntitySeasonSelector } from "@/components/time/entity-season-selector";

interface StatEntry {
  stat: {
    appearances: number;
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    minutesPlayed: number;
  };
  competition: {
    id: string;
    name: string;
    slug: string;
  };
  season: {
    id: string;
    label: string;
    isCurrent: boolean;
  };
  team: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
  };
}

interface PlayerStatsSectionProps {
  playerId: string;
  initialStats: StatEntry[];
  initialTotals: {
    appearances: number;
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    minutesPlayed: number;
  };
}

export function PlayerStatsSection({
  playerId,
  initialStats,
  initialTotals,
}: PlayerStatsSectionProps) {
  const [stats, setStats] = useState<StatEntry[]>(initialStats);
  const [totals, setTotals] = useState(initialTotals);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStats = useCallback(async (seasonId: string | null) => {
    setIsLoading(true);
    try {
      const url = seasonId
        ? `/api/players/${playerId}/stats?season_id=${seasonId}`
        : `/api/players/${playerId}/stats`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setTotals(data.totals);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setIsLoading(false);
    }
  }, [playerId]);

  const handleSeasonChange = (seasonId: string | null) => {
    setSelectedSeasonId(seasonId);
    fetchStats(seasonId);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-neutral-900">Statistics</h2>
        <EntitySeasonSelector
          selectedSeasonId={selectedSeasonId}
          onSeasonChange={handleSeasonChange}
          variant="compact"
        />
      </div>

      {/* Stats Summary */}
      <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 ${isLoading ? "opacity-50" : ""}`}>
        <div className="bg-white rounded-xl border border-neutral-200 p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-neutral-500 uppercase tracking-wide">Apps</span>
          </div>
          <div className="text-2xl font-bold text-neutral-900">{totals.appearances}</div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Target className="w-4 h-4 text-green-500" />
            <span className="text-xs text-neutral-500 uppercase tracking-wide">Goals</span>
          </div>
          <div className="text-2xl font-bold text-neutral-900">{totals.goals}</div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-purple-500" />
            <span className="text-xs text-neutral-500 uppercase tracking-wide">Assists</span>
          </div>
          <div className="text-2xl font-bold text-neutral-900">{totals.assists}</div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-orange-500" />
            <span className="text-xs text-neutral-500 uppercase tracking-wide">Minutes</span>
          </div>
          <div className="text-2xl font-bold text-neutral-900">{totals.minutesPlayed.toLocaleString()}</div>
        </div>
      </div>

      {/* Stats Table */}
      {stats.length > 0 && (
        <div className={`bg-white rounded-xl border border-neutral-200 overflow-hidden ${isLoading ? "opacity-50" : ""}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-neutral-500">Season</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-500">Competition</th>
                  <th className="px-4 py-3 text-left font-medium text-neutral-500">Team</th>
                  <th className="px-4 py-3 text-center font-medium text-neutral-500">Apps</th>
                  <th className="px-4 py-3 text-center font-medium text-neutral-500">Goals</th>
                  <th className="px-4 py-3 text-center font-medium text-neutral-500">Assists</th>
                  <th className="px-4 py-3 text-center font-medium text-neutral-500">
                    <span className="inline-block w-4 h-4 bg-yellow-400 rounded-sm" title="Yellow Cards" />
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-neutral-500">
                    <span className="inline-block w-4 h-4 bg-red-500 rounded-sm" title="Red Cards" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {stats.map((entry, index) => (
                  <tr key={`${entry.season.id}-${entry.competition.id}-${index}`} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <span className="font-medium">{entry.season.label}</span>
                      {entry.season.isCurrent && (
                        <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                          Current
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/competitions/${entry.competition.slug}`}
                        className="text-blue-600 hover:underline"
                      >
                        {entry.competition.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/teams/${entry.team.slug}`}
                        className="flex items-center gap-2 text-neutral-700 hover:text-blue-600"
                      >
                        {entry.team.logoUrl && (
                          <img
                            src={entry.team.logoUrl}
                            alt={entry.team.name}
                            className="w-5 h-5 object-contain"
                          />
                        )}
                        {entry.team.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-center">{entry.stat.appearances}</td>
                    <td className="px-4 py-3 text-center font-medium text-green-600">
                      {entry.stat.goals > 0 ? entry.stat.goals : "-"}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-purple-600">
                      {entry.stat.assists > 0 ? entry.stat.assists : "-"}
                    </td>
                    <td className="px-4 py-3 text-center text-yellow-600">
                      {entry.stat.yellowCards > 0 ? entry.stat.yellowCards : "-"}
                    </td>
                    <td className="px-4 py-3 text-center text-red-600">
                      {entry.stat.redCards > 0 ? entry.stat.redCards : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stats.length === 0 && !isLoading && (
        <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
          <p className="text-neutral-500">No statistics available for this season</p>
        </div>
      )}
    </section>
  );
}
