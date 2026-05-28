"use client";

import { useState } from "react";
import { Target, Trophy, Lock, Zap } from "lucide-react";
import { useSubscription } from "@/components/subscription/subscription-provider";
import { useUpgradeModal } from "@/components/subscription/upgrade-modal";
import { useAnalytics } from "@/hooks/use-analytics";
import Link from "next/link";

interface Match {
  id: string;
  homeTeam: { id: string; name: string; logoUrl: string | null };
  awayTeam: { id: string; name: string; logoUrl: string | null };
  scheduledAt: Date;
  competition: { name: string };
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  totalPoints: number;
  correctPredictions: number;
  totalPredictions: number;
}

interface ProdeFormProps {
  matches: Match[];
  userPredictions: any[];
  leaderboard: LeaderboardEntry[];
  isLoggedIn: boolean;
}

export function ProdeForm({
  matches,
  userPredictions,
  leaderboard,
  isLoggedIn,
}: ProdeFormProps) {
  const { canAccess, tier } = useSubscription();
  const { openUpgradeModal } = useUpgradeModal();
  const { track } = useAnalytics();
  const isPro = canAccess("games");

  const [scores, setScores] = useState<
    Record<string, { home: string; away: string }>
  >({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Set<string>>(
    new Set(userPredictions.map((p) => p.matchId))
  );

  const handleScoreChange = (
    matchId: string,
    side: "home" | "away",
    value: string
  ) => {
    setScores((prev) => ({
      ...prev,
      [matchId]: { ...prev[matchId], [side]: value },
    }));
  };

  const handleSubmit = async (matchId: string) => {
    if (!isPro) {
      track({ eventType: "upgrade_impression", metadata: { feature: "games_prode", context: "prode_submit" } });
      openUpgradeModal("games_prode", "prode_submit");
      return;
    }

    const score = scores[matchId];
    if (!score?.home || !score?.away) return;

    setSubmitting(matchId);
    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          homeScore: parseInt(score.home),
          awayScore: parseInt(score.away),
        }),
      });

      if (res.ok) {
        setSubmitted((prev) => new Set([...prev, matchId]));
      } else {
        const data = await res.json();
        if (data.upgradeUrl) {
          openUpgradeModal("games_prode", "prode_api_gate");
        }
      }
    } finally {
      setSubmitting(null);
    }
  };

  // Group matches by competition
  const grouped = matches.reduce<Record<string, Match[]>>((acc, m) => {
    const key = m.competition.name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Match list */}
      <div className="lg:col-span-2 space-y-8">
        {Object.entries(grouped).length === 0 && (
          <p className="text-neutral-500 text-center py-12">
            No upcoming matches available for predictions right now.
          </p>
        )}
        {Object.entries(grouped).map(([comp, compMatches]) => (
          <div key={comp}>
            <h2 className="text-lg font-bold text-neutral-900 mb-4">{comp}</h2>
            <div className="space-y-3">
              {compMatches.map((match) => {
                const isSubmitted = submitted.has(match.id);
                const existingPred = userPredictions.find(
                  (p) => p.matchId === match.id
                );

                return (
                  <div
                    key={match.id}
                    className="relative bg-white rounded-xl border border-neutral-200 p-4"
                  >
                    {/* Frosted overlay for free users */}
                    {!isPro && !isSubmitted && (
                      <div
                        className="absolute inset-0 bg-white/60 backdrop-blur-[2px] rounded-xl z-10 flex items-center justify-center cursor-pointer"
                        onClick={() => {
                          track({ eventType: "upgrade_impression", metadata: { feature: "games_prode", context: "prode_overlay" } });
                          openUpgradeModal("games_prode", "prode_overlay");
                        }}
                      >
                        <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-full">
                          <Lock className="w-4 h-4" />
                          Go Pro to Predict
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 text-right">
                        <span className="font-medium text-neutral-900 text-sm">
                          {match.homeTeam.name}
                        </span>
                      </div>

                      {isSubmitted && existingPred ? (
                        <div className="flex items-center gap-1 text-sm font-bold text-green-600 bg-green-50 px-3 py-1 rounded-lg">
                          {existingPred.homeScore} - {existingPred.awayScore}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="20"
                            placeholder="-"
                            value={scores[match.id]?.home ?? ""}
                            onChange={(e) =>
                              handleScoreChange(match.id, "home", e.target.value)
                            }
                            className="w-12 h-10 text-center border border-neutral-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <span className="text-neutral-400 font-bold">-</span>
                          <input
                            type="number"
                            min="0"
                            max="20"
                            placeholder="-"
                            value={scores[match.id]?.away ?? ""}
                            onChange={(e) =>
                              handleScoreChange(match.id, "away", e.target.value)
                            }
                            className="w-12 h-10 text-center border border-neutral-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <button
                            onClick={() => handleSubmit(match.id)}
                            disabled={
                              submitting === match.id ||
                              !scores[match.id]?.home ||
                              !scores[match.id]?.away
                            }
                            className="ml-2 px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            {submitting === match.id ? "..." : "Save"}
                          </button>
                        </div>
                      )}

                      <div className="flex-1">
                        <span className="font-medium text-neutral-900 text-sm">
                          {match.awayTeam.name}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-neutral-400 text-center">
                      {new Date(match.scheduledAt).toLocaleDateString("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sidebar: Leaderboard */}
      <div>
        <div className="bg-white rounded-xl border border-neutral-200 p-5 sticky top-24">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <h3 className="font-bold text-neutral-900">Prode Leaderboard</h3>
          </div>

          {leaderboard.length === 0 ? (
            <p className="text-neutral-500 text-sm text-center py-4">
              No predictions yet.
            </p>
          ) : (
            <div className="space-y-2">
              {leaderboard.slice(0, 10).map((entry) => (
                <div
                  key={entry.userId}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-neutral-400 font-mono text-xs">
                      {entry.rank}
                    </span>
                    <span className="font-medium text-neutral-900 truncate max-w-[140px]">
                      {entry.userName}
                    </span>
                  </div>
                  <span className="font-bold text-neutral-900">
                    {entry.totalPoints} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
