import { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getAvailableMatches, getUserPredictions, getGlobalLeaderboard } from "@/lib/queries/predictions";
import { ProdeForm } from "./prode-form";

export const metadata: Metadata = {
  title: "Score Predictions (Prode) — Games | SportsDB",
  description: "Predict exact scores for upcoming football matches. Earn 3 points for an exact match, 1 for the correct result.",
};

export default async function ProdePage() {
  const [availableMatches, leaderboard, user] = await Promise.all([
    getAvailableMatches(30),
    getGlobalLeaderboard(20),
    getCurrentUser(),
  ]);

  let userPredictions: Awaited<ReturnType<typeof getUserPredictions>> = [];
  if (user) {
    userPredictions = await getUserPredictions(user.id, 50);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">Score Predictions</h1>
        <p className="text-neutral-600">
          Predict exact scores for upcoming matches. Earn 3 points for an exact match, 1 for the correct result.
        </p>
      </div>

      <ProdeForm
        matches={availableMatches}
        userPredictions={userPredictions}
        leaderboard={leaderboard}
        isLoggedIn={!!user}
      />
    </div>
  );
}
