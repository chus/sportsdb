"use client";

import { useEffect, useState } from "react";
import {
  Target,
  Vote,
  Brain,
  TrendingUp,
  Users,
  Zap,
  Loader2,
  BarChart3,
} from "lucide-react";

interface GameStats {
  total30d: number;
  last7d: number;
  uniquePlayers: number;
}

interface DailyEntry {
  day: string;
  prode: number;
  pickem: number;
  challenge: number;
}

interface FunnelEntry {
  shown: number;
  clicked: number;
  dismissed: number;
}

interface AnalyticsData {
  engagement: {
    prode: GameStats;
    pickem: GameStats;
    challenge: GameStats;
  };
  dailyEngagement: DailyEntry[];
  conversionFunnel: Record<string, FunnelEntry>;
  pickemTrial: {
    freePickers: number;
    converted: number;
  };
}

export default function AdminGamesPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/games/analytics")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-red-600">Failed to load analytics</p>
      </div>
    );
  }

  const { engagement, dailyEngagement, conversionFunnel, pickemTrial } = data;
  const maxDaily = Math.max(
    ...dailyEngagement.map((d) => d.prode + d.pickem + d.challenge),
    1
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 mb-1">
          Games Analytics
        </h1>
        <p className="text-neutral-500 text-sm">Last 30 days</p>
      </div>

      {/* Engagement cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <StatCard
          icon={<Target className="w-5 h-5 text-blue-600" />}
          title="Score Predictions"
          total={engagement.prode.total30d}
          last7d={engagement.prode.last7d}
          uniquePlayers={engagement.prode.uniquePlayers}
          color="blue"
        />
        <StatCard
          icon={<Vote className="w-5 h-5 text-indigo-600" />}
          title="Pick'em"
          total={engagement.pickem.total30d}
          last7d={engagement.pickem.last7d}
          uniquePlayers={engagement.pickem.uniquePlayers}
          color="indigo"
        />
        <StatCard
          icon={<Brain className="w-5 h-5 text-purple-600" />}
          title="Daily Challenge"
          total={engagement.challenge.total30d}
          last7d={engagement.challenge.last7d}
          uniquePlayers={engagement.challenge.uniquePlayers}
          color="purple"
        />
      </div>

      {/* Daily engagement chart */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-5 h-5 text-neutral-500" />
          <h2 className="font-bold text-neutral-900">
            Daily Engagement (14 days)
          </h2>
        </div>
        <div className="flex items-end gap-1 h-40">
          {dailyEngagement.map((day) => {
            const total = day.prode + day.pickem + day.challenge;
            const heightPct = (total / maxDaily) * 100;
            const date = new Date(day.day);
            return (
              <div
                key={day.day}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <span className="text-[10px] text-neutral-400 font-mono">
                  {total}
                </span>
                <div className="w-full flex flex-col gap-0.5" style={{ height: `${heightPct}%` }}>
                  {day.prode > 0 && (
                    <div
                      className="bg-blue-500 rounded-t-sm"
                      style={{ flex: day.prode }}
                    />
                  )}
                  {day.pickem > 0 && (
                    <div
                      className="bg-indigo-500"
                      style={{ flex: day.pickem }}
                    />
                  )}
                  {day.challenge > 0 && (
                    <div
                      className="bg-purple-500 rounded-b-sm"
                      style={{ flex: day.challenge }}
                    />
                  )}
                </div>
                <span className="text-[9px] text-neutral-400">
                  {date.getDate()}/{date.getMonth() + 1}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-4 text-xs text-neutral-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-blue-500 rounded-sm" />
            Prode
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-indigo-500 rounded-sm" />
            Pick&apos;em
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-purple-500 rounded-sm" />
            Challenge
          </div>
        </div>
      </div>

      {/* Conversion funnel */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-neutral-500" />
            <h2 className="font-bold text-neutral-900">Conversion Funnel</h2>
          </div>
          <div className="space-y-4">
            {Object.entries(conversionFunnel).map(([gameType, funnel]) => {
              const clickRate =
                funnel.shown > 0
                  ? ((funnel.clicked / funnel.shown) * 100).toFixed(1)
                  : "0";
              return (
                <div key={gameType} className="space-y-2">
                  <h3 className="text-sm font-semibold text-neutral-700">
                    {gameType.replace("games_", "").replace("_", " ")}
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-neutral-50 rounded-lg p-2">
                      <p className="text-lg font-bold text-neutral-900">
                        {funnel.shown}
                      </p>
                      <p className="text-[10px] text-neutral-500">Shown</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2">
                      <p className="text-lg font-bold text-blue-700">
                        {funnel.clicked}
                      </p>
                      <p className="text-[10px] text-neutral-500">Clicked</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2">
                      <p className="text-lg font-bold text-green-700">
                        {clickRate}%
                      </p>
                      <p className="text-[10px] text-neutral-500">CTR</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {Object.keys(conversionFunnel).length === 0 && (
              <p className="text-neutral-500 text-sm text-center py-4">
                No conversion data yet
              </p>
            )}
          </div>
        </div>

        {/* Pick'em trial effectiveness */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Zap className="w-5 h-5 text-neutral-500" />
            <h2 className="font-bold text-neutral-900">
              Pick&apos;em Trial
            </h2>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-neutral-50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-neutral-900">
                  {pickemTrial.freePickers}
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  Free pick users
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-green-700">
                  {pickemTrial.converted}
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  Converted to Pro
                </p>
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">
                {pickemTrial.freePickers > 0
                  ? (
                      (pickemTrial.converted / pickemTrial.freePickers) *
                      100
                    ).toFixed(1)
                  : "0"}
                %
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Trial → Pro conversion rate
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  title,
  total,
  last7d,
  uniquePlayers,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  total: number;
  last7d: number;
  uniquePlayers: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="font-semibold text-neutral-900 text-sm">{title}</h3>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-neutral-500">30-day total</span>
          <span className="font-bold text-neutral-900">{total}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-neutral-500">Last 7 days</span>
          <span className="font-bold text-neutral-900">{last7d}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-neutral-500">Unique players</span>
          <span className="font-bold text-neutral-900">{uniquePlayers}</span>
        </div>
      </div>
    </div>
  );
}
