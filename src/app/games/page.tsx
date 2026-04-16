import { Metadata } from "next";
import Link from "next/link";
import { Target, Vote, Brain, Trophy, Zap, ArrowRight } from "lucide-react";
import { getCombinedLeaderboard } from "@/lib/queries/games-common";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Games — Predict, Pick & Challenge",
  description:
    "Test your football knowledge with score predictions, Pick'em, and daily trivia challenges. Compete on leaderboards and earn bragging rights.",
};

const GAMES = [
  {
    title: "Score Predictions",
    description:
      "Predict the exact score for upcoming matches. Earn 3 points for an exact match and 1 for a correct result.",
    href: "/games/prode",
    icon: Target,
    color: "from-blue-600 to-blue-700",
    bgLight: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  {
    title: "Pick'em",
    description:
      "Pick Home, Draw, or Away for each match. See how the community voted and compare your instincts.",
    href: "/games/pickem",
    icon: Vote,
    color: "from-indigo-600 to-indigo-700",
    bgLight: "bg-indigo-50",
    borderColor: "border-indigo-200",
  },
  {
    title: "Daily Challenge",
    description:
      "5 new football trivia questions every day. Categories include history, stats, transfers, and more.",
    href: "/games/challenge",
    icon: Brain,
    color: "from-purple-600 to-purple-700",
    bgLight: "bg-purple-50",
    borderColor: "border-purple-200",
  },
];

export default async function GamesPage() {
  const [leaderboard, user] = await Promise.all([
    getCombinedLeaderboard(10),
    getCurrentUser(),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-4">
          Football Games
        </h1>
        <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
          Predict scores, pick winners, and test your football knowledge.
          Compete with the community and climb the leaderboard.
        </p>
      </div>

      {/* Pro banner for free users */}
      {user && (
        <div className="mb-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold mb-1">Unlock All Games</h2>
            <p className="text-blue-100">
              Pro members get unlimited predictions, Pick'em picks, and daily
              challenges.
            </p>
          </div>
          <Link
            href="/pricing"
            className="flex-shrink-0 flex items-center gap-2 px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:shadow-lg transition-all"
          >
            <Zap className="w-5 h-5" />
            Go Pro
          </Link>
        </div>
      )}

      {/* Game cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {GAMES.map((game) => {
          const Icon = game.icon;
          return (
            <Link
              key={game.href}
              href={game.href}
              className={`group rounded-xl border ${game.borderColor} ${game.bgLight} p-6 hover:shadow-xl transition-all`}
            >
              <div
                className={`w-14 h-14 bg-gradient-to-br ${game.color} rounded-xl flex items-center justify-center mb-4`}
              >
                <Icon className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-xl font-bold text-neutral-900 mb-2">
                {game.title}
              </h2>
              <p className="text-neutral-600 text-sm mb-4">
                {game.description}
              </p>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 group-hover:gap-2 transition-all">
                Play now <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          );
        })}
      </div>

      {/* Combined leaderboard */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Trophy className="w-6 h-6 text-yellow-500" />
          <h2 className="text-2xl font-bold text-neutral-900">
            Global Leaderboard
          </h2>
        </div>

        {leaderboard.length === 0 ? (
          <p className="text-neutral-500 text-center py-8">
            No scores yet. Be the first to play!
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500">
                  <th className="text-left py-3 px-2 font-medium">#</th>
                  <th className="text-left py-3 px-2 font-medium">Player</th>
                  <th className="text-right py-3 px-2 font-medium">Prode</th>
                  <th className="text-right py-3 px-2 font-medium">Pick'em</th>
                  <th className="text-right py-3 px-2 font-medium">
                    Challenge
                  </th>
                  <th className="text-right py-3 px-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => (
                  <tr
                    key={entry.userId}
                    className="border-b border-neutral-100 hover:bg-neutral-50"
                  >
                    <td className="py-3 px-2 font-semibold text-neutral-400">
                      {entry.rank}
                    </td>
                    <td className="py-3 px-2 font-medium text-neutral-900">
                      {entry.userName}
                    </td>
                    <td className="py-3 px-2 text-right text-neutral-600">
                      {entry.prodePoints}
                    </td>
                    <td className="py-3 px-2 text-right text-neutral-600">
                      {entry.pickemPoints}
                    </td>
                    <td className="py-3 px-2 text-right text-neutral-600">
                      {entry.challengePoints}
                    </td>
                    <td className="py-3 px-2 text-right font-bold text-neutral-900">
                      {entry.totalPoints}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
