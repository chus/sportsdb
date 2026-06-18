import { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getDailyQuestions, getUserDailyProgress, getChallengeLeaderboard, getCurrentStreak } from "@/lib/queries/challenge";
import { ChallengeGame } from "./challenge-game";
import { Flame } from "lucide-react";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const metadata: Metadata = {
  title: "Daily Challenge — Games",
  description: "Test your football knowledge with 5 new trivia questions every day. Categories include history, stats, transfers, and more.",
  alternates: {
    canonical: `${BASE_URL}/games/challenge`,
  },
};

export default async function ChallengePage() {
  const [questions, leaderboard, user] = await Promise.all([
    getDailyQuestions(),
    getChallengeLeaderboard(20),
    getCurrentUser(),
  ]);

  let progress = null;
  let streak = 0;
  if (user) {
    [progress, streak] = await Promise.all([
      getUserDailyProgress(user.id),
      getCurrentStreak(user.id),
    ]);
  }

  // Strip correctIndex for client — answers validated server-side
  const safeQuestions = questions.map(({ correctIndex, ...q }) => q);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-ink">Daily Challenge</h1>
          {streak > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 px-3 py-1 text-sm font-semibold">
              <Flame className="h-4 w-4" />
              {streak}-day streak
            </span>
          )}
        </div>
        <p className="text-muted">
          5 new football trivia questions every day. Earn points based on difficulty: 1 for easy, 2 for medium, 3 for hard.
          {streak > 0 && " Come back tomorrow to keep your streak alive."}
        </p>
      </div>

      <ChallengeGame
        questions={safeQuestions}
        progress={progress}
        leaderboard={leaderboard}
        isLoggedIn={!!user}
      />
    </div>
  );
}
