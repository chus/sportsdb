"use client";

import { useState, useEffect } from "react";
import {
  Trophy,
  Target,
  TrendingUp,
  Clock,
  Award,
  Loader2,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";

interface Match {
  id: string;
  homeTeam: { id: string; name: string; logoUrl: string | null };
  awayTeam: { id: string; name: string; logoUrl: string | null };
  scheduledAt: string;
  competition: { name: string };
}

interface Stats {
  totalPredictions: number;
  correctResults: number;
  exactScores: number;
  totalPoints: number;
  accuracy: number;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  totalPoints: number;
  correctPredictions: number;
  totalPredictions: number;
}

interface Badge {
  type: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt: string | null;
}

export function PredictionsPageContent() {
  const [activeTab, setActiveTab] = useState<"predict" | "leaderboard" | "badges">("predict");
  const [matches, setMatches] = useState<Match[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [predictions, setPredictions] = useState<Record<string, { home: number; away: number }>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [matchesRes, statsRes, leaderboardRes, badgesRes] = await Promise.all([
        fetch("/api/predictions/matches"),
        fetch("/api/predictions/stats"),
        fetch("/api/predictions/leaderboard"),
        fetch("/api/badges"),
      ]);

      if (matchesRes.ok) {
        const data = await matchesRes.json();
        setMatches(data.matches || []);
      }
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (leaderboardRes.ok) {
        const data = await leaderboardRes.json();
        setLeaderboard(data.leaderboard || []);
      }
      if (badgesRes.ok) {
        const data = await badgesRes.json();
        setBadges(data.all || []);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const submitPrediction = async (matchId: string) => {
    const pred = predictions[matchId];
    if (!pred) return;

    setSubmitting(matchId);
    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          homeScore: pred.home,
          awayScore: pred.away,
        }),
      });

      if (res.ok) {
        // Refresh stats
        const statsRes = await fetch("/api/predictions/stats");
        if (statsRes.ok) {
          setStats(await statsRes.json());
        }
      }
    } catch (error) {
      console.error("Failed to submit prediction:", error);
    } finally {
      setSubmitting(null);
    }
  };

  const updatePrediction = (matchId: string, team: "home" | "away", value: number) => {
    setPredictions((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [team]: Math.max(0, Math.min(20, value)),
      },
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Hero */}
      <section className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="w-10 h-10" />
            <h1 className="text-4xl font-bold">Prediction Game</h1>
          </div>
          <p className="text-purple-100 text-lg max-w-2xl">
            Predict match scores, earn points, and climb the leaderboard. Perfect
            predictions earn 3 points, correct results earn 1 point.
          </p>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              <StatCard
                icon={Target}
                label="Predictions"
                value={stats.totalPredictions}
              />
              <StatCard
                icon={TrendingUp}
                label="Correct"
                value={`${stats.correctResults} (${stats.accuracy.toFixed(0)}%)`}
              />
              <StatCard
                icon={Award}
                label="Exact Scores"
                value={stats.exactScores}
              />
              <StatCard
                icon={Trophy}
                label="Total Points"
                value={stats.totalPoints}
              />
            </div>
          )}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-neutral-100 rounded-lg p-1 w-fit">
          {(["predict", "leaderboard", "badges"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize",
                activeTab === tab
                  ? "bg-white text-neutral-900 shadow"
                  : "text-neutral-600 hover:text-neutral-900"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === "predict" && (
          <div>
            <h2 className="text-xl font-bold text-neutral-900 mb-4">
              Upcoming Matches
            </h2>
            {matches.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-neutral-200">
                <Clock className="w-12 h-12 mx-auto text-neutral-300 mb-4" />
                <p className="text-neutral-600">No upcoming matches to predict</p>
              </div>
            ) : (
              <div className="space-y-4">
                {matches.map((match) => (
                  <div
                    key={match.id}
                    className="bg-white rounded-xl border border-neutral-200 p-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm text-neutral-500">
                        {match.competition.name}
                      </span>
                      <span className="text-sm text-neutral-500">
                        {new Date(match.scheduledAt).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      {/* Home Team */}
                      <div className="flex-1 flex items-center gap-3">
                        <div className="w-12 h-12 bg-neutral-100 rounded-lg overflow-hidden">
                          {match.homeTeam.logoUrl && (
                            <Image
                              src={match.homeTeam.logoUrl}
                              alt={match.homeTeam.name}
                              width={48}
                              height={48}
                              className="w-full h-full object-contain p-1"
                            />
                          )}
                        </div>
                        <span className="font-medium text-neutral-900">
                          {match.homeTeam.name}
                        </span>
                      </div>

                      {/* Score Inputs */}
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={predictions[match.id]?.home ?? ""}
                          onChange={(e) =>
                            updatePrediction(
                              match.id,
                              "home",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-14 h-12 text-center text-xl font-bold border-2 border-neutral-200 rounded-lg focus:border-blue-500 focus:outline-none"
                          placeholder="-"
                        />
                        <span className="text-neutral-400 font-medium">:</span>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={predictions[match.id]?.away ?? ""}
                          onChange={(e) =>
                            updatePrediction(
                              match.id,
                              "away",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-14 h-12 text-center text-xl font-bold border-2 border-neutral-200 rounded-lg focus:border-blue-500 focus:outline-none"
                          placeholder="-"
                        />
                      </div>

                      {/* Away Team */}
                      <div className="flex-1 flex items-center justify-end gap-3">
                        <span className="font-medium text-neutral-900">
                          {match.awayTeam.name}
                        </span>
                        <div className="w-12 h-12 bg-neutral-100 rounded-lg overflow-hidden">
                          {match.awayTeam.logoUrl && (
                            <Image
                              src={match.awayTeam.logoUrl}
                              alt={match.awayTeam.name}
                              width={48}
                              height={48}
                              className="w-full h-full object-contain p-1"
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="mt-4 flex justify-center">
                      <button
                        onClick={() => submitPrediction(match.id)}
                        disabled={
                          !predictions[match.id] ||
                          predictions[match.id].home === undefined ||
                          predictions[match.id].away === undefined ||
                          submitting === match.id
                        }
                        className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {submitting === match.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            Submit Prediction
                            <ChevronRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "leaderboard" && (
          <div>
            <h2 className="text-xl font-bold text-neutral-900 mb-4">
              Global Leaderboard
            </h2>
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">
                      Rank
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">
                      Player
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-neutral-500">
                      Points
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-neutral-500 hidden sm:table-cell">
                      Correct
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-neutral-500 hidden sm:table-cell">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {leaderboard.map((entry) => (
                    <tr key={entry.userId} className="hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "font-bold",
                            entry.rank === 1 && "text-yellow-500",
                            entry.rank === 2 && "text-neutral-400",
                            entry.rank === 3 && "text-amber-600"
                          )}
                        >
                          #{entry.rank}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-neutral-900">
                        {entry.userName}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-blue-600">
                        {entry.totalPoints}
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-600 hidden sm:table-cell">
                        {entry.correctPredictions}
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-500 hidden sm:table-cell">
                        {entry.totalPredictions}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {leaderboard.length === 0 && (
                <div className="text-center py-12 text-neutral-500">
                  No predictions yet. Be the first!
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "badges" && (
          <div>
            <h2 className="text-xl font-bold text-neutral-900 mb-4">Badges</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {badges.map((badge) => (
                <div
                  key={badge.type}
                  className={cn(
                    "bg-white rounded-xl border-2 p-6 transition-all",
                    badge.earned
                      ? "border-yellow-400 shadow-lg"
                      : "border-neutral-200 opacity-50"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "w-16 h-16 rounded-full flex items-center justify-center",
                        badge.earned
                          ? "bg-gradient-to-br from-yellow-400 to-orange-500"
                          : "bg-neutral-200"
                      )}
                    >
                      <Award
                        className={cn(
                          "w-8 h-8",
                          badge.earned ? "text-white" : "text-neutral-400"
                        )}
                      />
                    </div>
                    <div>
                      <h3 className="font-bold text-neutral-900">{badge.name}</h3>
                      <p className="text-sm text-neutral-500">
                        {badge.description}
                      </p>
                      {badge.earned && badge.earnedAt && (
                        <p className="text-xs text-green-600 mt-1">
                          Earned{" "}
                          {new Date(badge.earnedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Trophy;
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white/10 backdrop-blur rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-purple-200" />
        <span className="text-sm text-purple-200">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
