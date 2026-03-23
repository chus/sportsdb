"use client";

import { Share2, MessageCircle } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

interface SharePredictionCardProps {
  gameType: "prode" | "pickem" | "challenge";
  points: number;
  rank?: number;
  correctCount?: number;
  totalCount?: number;
}

export function SharePredictionCard({
  gameType,
  points,
  rank,
  correctCount,
  totalCount,
}: SharePredictionCardProps) {
  const { user } = useAuth();

  const refCode = (user as any)?.referralCode || "";
  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "https://datasports.co";
  const shareUrl = `${baseUrl}/games/${gameType}${refCode ? `?ref=${refCode}` : ""}`;

  const gameLabel =
    gameType === "prode"
      ? "Score Predictions"
      : gameType === "pickem"
      ? "Pick'em"
      : "Daily Challenge";

  const shareText = rank
    ? `I'm #${rank} on the ${gameLabel} leaderboard with ${points} points on DataSports! Think you can do better?`
    : `I scored ${points} points in ${gameLabel} on DataSports! Think you can do better?`;

  const handleShare = (platform: "whatsapp" | "twitter" | "telegram") => {
    let url = "";
    switch (platform) {
      case "whatsapp":
        url = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;
        break;
      case "twitter":
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case "telegram":
        url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
        break;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (points === 0) return null;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Share2 className="w-4 h-4 text-blue-600" />
        <h4 className="text-sm font-semibold text-neutral-900">
          Share Your Score
        </h4>
      </div>

      <div className="bg-white rounded-lg p-4 mb-4">
        <div className="text-center">
          <p className="text-3xl font-bold text-neutral-900">{points}</p>
          <p className="text-xs text-neutral-500">points</p>
          {rank && (
            <p className="text-sm text-blue-600 font-semibold mt-1">
              Rank #{rank}
            </p>
          )}
          {correctCount !== undefined && totalCount !== undefined && (
            <p className="text-xs text-neutral-500 mt-1">
              {correctCount}/{totalCount} correct
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => handleShare("whatsapp")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-500 text-white text-xs font-semibold rounded-lg hover:bg-green-600 transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          WhatsApp
        </button>
        <button
          onClick={() => handleShare("twitter")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-neutral-900 text-white text-xs font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
        >
          X
        </button>
        <button
          onClick={() => handleShare("telegram")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition-colors"
        >
          Telegram
        </button>
      </div>
    </div>
  );
}
