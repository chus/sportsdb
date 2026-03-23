"use client";

import { useState, useEffect } from "react";
import { Target, Vote, Lock, Zap, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useSubscription } from "@/components/subscription/subscription-provider";
import { useUpgradeModal } from "@/components/subscription/upgrade-modal";
import { useAuth } from "@/components/auth/auth-provider";
import { useAuthModal } from "@/components/auth/auth-modal";
import { useAnalytics } from "@/hooks/use-analytics";

interface MatchPredictionWidgetProps {
  matchId: string;
  matchStatus: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
}

export function MatchPredictionWidget({
  matchId,
  matchStatus,
  homeTeamName,
  awayTeamName,
  homeScore,
  awayScore,
}: MatchPredictionWidgetProps) {
  const { user } = useAuth();
  const { openModal } = useAuthModal();
  const { canAccess } = useSubscription();
  const { openUpgradeModal } = useUpgradeModal();
  const { track } = useAnalytics();
  const isPro = canAccess("games");
  const isUpcoming = matchStatus === "scheduled";

  // Pick'em state
  const [pickemOutcome, setPickemOutcome] = useState<string | null>(null);
  const [pickemSubmitting, setPickemSubmitting] = useState(false);
  const [pickemSaved, setPickemSaved] = useState(false);

  // Community percentages
  const [community, setCommunity] = useState<{
    home: number;
    draw: number;
    away: number;
    total: number;
  } | null>(null);

  // Fetch community percentages
  useEffect(() => {
    fetch(`/api/pickem/community?matchIds=${matchId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.percentages?.[matchId]) {
          setCommunity(data.percentages[matchId]);
        }
      })
      .catch(() => {});
  }, [matchId]);

  // Fetch user's existing pick
  useEffect(() => {
    if (!user) return;
    fetch(`/api/pickem?limit=50`)
      .then((r) => r.json())
      .then((data) => {
        const existing = data.pickems?.find(
          (p: any) => p.matchId === matchId
        );
        if (existing) {
          setPickemOutcome(existing.outcome);
          setPickemSaved(true);
        }
      })
      .catch(() => {});
  }, [user, matchId]);

  const handlePick = async (outcome: "home" | "draw" | "away") => {
    if (!user) {
      openModal("signup");
      return;
    }
    if (!isPro) {
      track({
        eventType: "upgrade_impression",
        metadata: { feature: "games_pickem", context: "match_widget" },
      });
      openUpgradeModal("games_pickem", "match_widget");
      return;
    }

    setPickemSubmitting(true);
    try {
      const res = await fetch("/api/pickem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, outcome }),
      });
      if (res.ok) {
        setPickemOutcome(outcome);
        setPickemSaved(true);
      } else {
        const data = await res.json();
        if (data.upgradeUrl) {
          openUpgradeModal("games_pickem", "match_widget_gate");
        }
      }
    } finally {
      setPickemSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Vote className="w-5 h-5 text-indigo-600" />
        <h3 className="text-sm font-medium text-neutral-500">
          {isUpcoming ? "Predict This Match" : "Community Prediction"}
        </h3>
      </div>

      {/* Pick'em buttons — upcoming matches */}
      {isUpcoming && (
        <div className="space-y-3 mb-4">
          <p className="text-xs text-neutral-500">Who wins?</p>
          <div className="grid grid-cols-3 gap-2">
            {(["home", "draw", "away"] as const).map((outcome) => {
              const isSelected = pickemOutcome === outcome;
              const label =
                outcome === "home"
                  ? homeTeamName
                  : outcome === "draw"
                  ? "Draw"
                  : awayTeamName;

              return (
                <button
                  key={outcome}
                  onClick={() => handlePick(outcome)}
                  disabled={pickemSubmitting}
                  className={`relative py-2 px-1 rounded-lg text-xs font-semibold transition-all ${
                    isSelected
                      ? "bg-indigo-600 text-white ring-2 ring-indigo-300"
                      : !isPro && !user
                      ? "bg-neutral-100 text-neutral-400"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                  }`}
                >
                  {!isPro && !isSelected && (
                    <Lock className="w-2.5 h-2.5 inline mr-0.5 opacity-50" />
                  )}
                  <span className="truncate block">{label}</span>
                </button>
              );
            })}
          </div>
          {pickemSaved && (
            <div className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle className="w-3.5 h-3.5" />
              Pick saved
            </div>
          )}
        </div>
      )}

      {/* Finished match — show result */}
      {matchStatus === "finished" && pickemOutcome && (
        <div className="mb-4 p-3 bg-neutral-50 rounded-lg">
          <p className="text-xs text-neutral-500 mb-1">Your pick</p>
          <p className="text-sm font-semibold text-neutral-900">
            {pickemOutcome === "home"
              ? homeTeamName
              : pickemOutcome === "away"
              ? awayTeamName
              : "Draw"}
          </p>
        </div>
      )}

      {/* Community percentage bars */}
      {community && community.total > 0 && (
        <div>
          <p className="text-xs text-neutral-500 mb-2">
            Community ({community.total} votes)
          </p>
          <div className="space-y-1.5">
            {(["home", "draw", "away"] as const).map((outcome) => {
              const pct = community[outcome];
              const label =
                outcome === "home"
                  ? homeTeamName
                  : outcome === "draw"
                  ? "Draw"
                  : awayTeamName;
              const barColor =
                outcome === "home"
                  ? "bg-blue-500"
                  : outcome === "draw"
                  ? "bg-neutral-400"
                  : "bg-red-500";

              return (
                <div key={outcome} className="flex items-center gap-2">
                  <span className="text-xs text-neutral-600 w-16 truncate">
                    {label}
                  </span>
                  <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${barColor} rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-neutral-700 w-8 text-right">
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="mt-4 pt-4 border-t border-neutral-100">
        <Link
          href="/games/pickem"
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          See all Pick'em predictions →
        </Link>
      </div>
    </div>
  );
}
