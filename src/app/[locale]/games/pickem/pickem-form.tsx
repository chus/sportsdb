"use client";

import { useState } from "react";
import { Trophy, Lock, Zap } from "lucide-react";
import { useSubscription } from "@/components/subscription/subscription-provider";
import { useUpgradeModal } from "@/components/subscription/upgrade-modal";
import { useAnalytics } from "@/hooks/use-analytics";

interface Match {
  id: string;
  homeTeam: { id: string; name: string; logoUrl: string | null };
  awayTeam: { id: string; name: string; logoUrl: string | null };
  scheduledAt: Date;
  competition: { name: string };
}

interface CommunityPercentages {
  [matchId: string]: { home: number; draw: number; away: number; total: number };
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  totalPoints: number;
  correctPicks: number;
  totalPicks: number;
}

interface PickemFormProps {
  matches: Match[];
  communityPercentages: CommunityPercentages;
  userPickems: any[];
  leaderboard: LeaderboardEntry[];
  isLoggedIn: boolean;
}

export function PickemForm({
  matches,
  communityPercentages,
  userPickems,
  leaderboard,
  isLoggedIn,
}: PickemFormProps) {
  const { canAccess } = useSubscription();
  const { openUpgradeModal } = useUpgradeModal();
  const { track } = useAnalytics();
  const isPro = canAccess("games");

  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const p of userPickems) {
      initial[p.matchId] = p.outcome;
    }
    return initial;
  });
  const [freePickUsed, setFreePickUsed] = useState(userPickems.length > 0);

  const handlePick = async (
    matchId: string,
    outcome: "home" | "draw" | "away"
  ) => {
    if (!isLoggedIn) return;

    // Free user: allow first pick, block subsequent
    if (!isPro && freePickUsed && !submitted[matchId]) {
      track({ eventType: "upgrade_impression", metadata: { feature: "games_pickem", context: "pickem_free_limit" } });
      openUpgradeModal("games_pickem", "pickem_free_limit");
      return;
    }

    setSubmitting(matchId);
    try {
      const res = await fetch("/api/pickem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, outcome }),
      });

      if (res.ok) {
        setSubmitted((prev) => ({ ...prev, [matchId]: outcome }));
        if (!isPro) setFreePickUsed(true);
      } else {
        const data = await res.json();
        if (data.freePickUsed || data.upgradeUrl) {
          openUpgradeModal("games_pickem", "pickem_api_gate");
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
      <div className="lg:col-span-2 space-y-8">
        {/* Free pick hint */}
        {!isPro && !freePickUsed && isLoggedIn && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
            You have <strong>1 free pick</strong> this matchday. Choose wisely!
          </div>
        )}

        {Object.entries(grouped).length === 0 && (
          <p className="text-neutral-500 text-center py-12">
            No upcoming matches available for Pick'em right now.
          </p>
        )}

        {Object.entries(grouped).map(([comp, compMatches]) => (
          <div key={comp}>
            <h2 className="text-lg font-bold text-neutral-900 mb-4">{comp}</h2>
            <div className="space-y-3">
              {compMatches.map((match) => {
                const pct = communityPercentages[match.id];
                const userPick = submitted[match.id];
                const isLocked = !isPro && freePickUsed && !userPick;

                return (
                  <div
                    key={match.id}
                    className="bg-white rounded-xl border border-neutral-200 p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-neutral-900 text-sm flex-1 text-right pr-4">
                        {match.homeTeam.name}
                      </span>
                      <span className="text-xs text-neutral-400 px-2">vs</span>
                      <span className="font-medium text-neutral-900 text-sm flex-1 pl-4">
                        {match.awayTeam.name}
                      </span>
                    </div>

                    {/* Pick buttons */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {(["home", "draw", "away"] as const).map((outcome) => {
                        const isSelected = userPick === outcome;
                        const label =
                          outcome === "home"
                            ? "Home"
                            : outcome === "draw"
                            ? "Draw"
                            : "Away";

                        return (
                          <button
                            key={outcome}
                            onClick={() => handlePick(match.id, outcome)}
                            disabled={submitting === match.id}
                            className={`relative py-2.5 rounded-lg text-sm font-semibold transition-all ${
                              isSelected
                                ? "bg-blue-600 text-white ring-2 ring-blue-300"
                                : isLocked
                                ? "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                            }`}
                          >
                            {isLocked && !isSelected && (
                              <Lock className="w-3 h-3 inline mr-1" />
                            )}
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Community percentage bars */}
                    {pct && pct.total > 0 && (
                      <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-neutral-100">
                        <div
                          className="bg-blue-500 rounded-l-full transition-all"
                          style={{ width: `${pct.home}%` }}
                          title={`Home ${pct.home}%`}
                        />
                        <div
                          className="bg-neutral-400 transition-all"
                          style={{ width: `${pct.draw}%` }}
                          title={`Draw ${pct.draw}%`}
                        />
                        <div
                          className="bg-red-500 rounded-r-full transition-all"
                          style={{ width: `${pct.away}%` }}
                          title={`Away ${pct.away}%`}
                        />
                      </div>
                    )}
                    {pct && pct.total > 0 && (
                      <div className="flex justify-between mt-1 text-[10px] text-neutral-400">
                        <span>{pct.home}%</span>
                        <span>{pct.draw}%</span>
                        <span>{pct.away}%</span>
                      </div>
                    )}

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
            <h3 className="font-bold text-neutral-900">Pick'em Leaderboard</h3>
          </div>

          {leaderboard.length === 0 ? (
            <p className="text-neutral-500 text-sm text-center py-4">
              No picks yet.
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
