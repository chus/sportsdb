import { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getDailyQuestions, getUserDailyProgress, getChallengeLeaderboard } from "@/lib/queries/challenge";
import { ChallengeGame } from "./challenge-game";

export const metadata: Metadata = {
  title: "Daily Challenge — Games | SportsDB",
  description: "Test your football knowledge with 5 new trivia questions every day. Categories include history, stats, transfers, and more.",
};

export default async function ChallengePage() {
  const [questions, leaderboard, user] = await Promise.all([
    getDailyQuestions(),
    getChallengeLeaderboard(20),
    getCurrentUser(),
  ]);

  let progress = null;
  if (user) {
    progress = await getUserDailyProgress(user.id);
  }

  // Strip correctIndex for client — answers validated server-side
  const safeQuestions = questions.map(({ correctIndex, ...q }) => q);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">Daily Challenge</h1>
        <p className="text-neutral-600">
          5 new football trivia questions every day. Earn points based on difficulty: 1 for easy, 2 for medium, 3 for hard.
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
