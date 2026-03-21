"use client";

import { useEffect, useState } from "react";
import {
  Shield,
  Users,
  Swords,
  Trophy,
  Calendar,
  FileText,
  BarChart3,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface TableCounts {
  teams: number;
  players: number;
  matches: number;
  competitions: number;
  seasons: number;
  articles: number;
  playerStats: number;
  matchEvents: number;
}

interface StatsResponse {
  tableCounts: TableCounts;
}

const tableCards = [
  {
    key: "teams" as const,
    label: "Teams",
    icon: Shield,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    key: "players" as const,
    label: "Players",
    icon: Users,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
  },
  {
    key: "matches" as const,
    label: "Matches",
    icon: Swords,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  {
    key: "competitions" as const,
    label: "Competitions",
    icon: Trophy,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  {
    key: "seasons" as const,
    label: "Seasons",
    icon: Calendar,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  {
    key: "articles" as const,
    label: "Articles",
    icon: FileText,
    color: "text-rose-600",
    bgColor: "bg-rose-50",
  },
  {
    key: "playerStats" as const,
    label: "Player Stats",
    icon: BarChart3,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
  },
  {
    key: "matchEvents" as const,
    label: "Match Events",
    icon: Zap,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
];

function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

export default function AdminDataPage() {
  const [tableCounts, setTableCounts] = useState<TableCounts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/admin/stats");
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Failed to fetch data");
        }
        const data: StatsResponse = await res.json();
        setTableCounts(data.tableCounts);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-neutral-900">Data</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Row counts across all main data tables.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {tableCards.map((card) => (
          <div
            key={card.key}
            className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className={cn("rounded-lg p-2.5", card.bgColor)}>
                <card.icon className={cn("h-5 w-5", card.color)} />
              </div>
              <span className="text-sm font-medium text-neutral-500">
                {card.label}
              </span>
            </div>
            <div className="mt-4">
              {loading ? (
                <div className="h-9 w-24 animate-pulse rounded-md bg-neutral-100" />
              ) : (
                <span className="text-3xl font-bold text-neutral-900">
                  {tableCounts ? formatNumber(tableCounts[card.key]) : "--"}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
