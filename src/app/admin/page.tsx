"use client";

import { useEffect, useState } from "react";
import {
  Users,
  FileText,
  Trophy,
  CreditCard,
  TrendingUp,
  Clock,
} from "lucide-react";

interface AdminStats {
  totalUsers: number;
  articlesPublished: number;
  matchesTracked: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
  pendingArticles: number;
}

const statCards = [
  {
    key: "totalUsers" as const,
    label: "Total Users",
    icon: Users,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    key: "articlesPublished" as const,
    label: "Articles Published",
    icon: FileText,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
  },
  {
    key: "matchesTracked" as const,
    label: "Matches Tracked",
    icon: Trophy,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  {
    key: "activeSubscriptions" as const,
    label: "Active Subscriptions",
    icon: CreditCard,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  {
    key: "monthlyRevenue" as const,
    label: "Monthly Revenue (\u20ac)",
    icon: TrendingUp,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  {
    key: "pendingArticles" as const,
    label: "Pending Articles",
    icon: Clock,
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

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/admin/stats");
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Failed to fetch stats");
        }
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch stats");
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-neutral-900">Overview</h2>
        <p className="mt-1 text-sm text-neutral-500">
          A summary of your platform metrics.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => (
          <div
            key={card.key}
            className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className={`rounded-lg ${card.bgColor} p-2.5`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
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
                  {stats ? formatNumber(stats[card.key]) : "--"}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
