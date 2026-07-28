import { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { cachedQuery } from "@/lib/cache";
import { getAvailableMatches, getUserPredictions, getGlobalLeaderboard } from "@/lib/queries/predictions";

// getCurrentUser() (cookies) makes this page dynamic — cache the public
// queries so anonymous hits never touch the DB.
const cachedAvailableMatches = cachedQuery(getAvailableMatches, ["prode-matches"], 3600);
const cachedGlobalLeaderboard = cachedQuery(getGlobalLeaderboard, ["prode-leaderboard"], 3600);
import { ProdeForm } from "./prode-form";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const metadata: Metadata = {
  title: "Score Predictions (Prode) — Games",
  description: "Predict exact scores for upcoming football matches. Earn 3 points for an exact match, 1 for the correct result.",
  alternates: {
    canonical: `${BASE_URL}/games/prode`,
  },
};

export default async function ProdePage() {
  const [availableMatches, leaderboard, user] = await Promise.all([
    cachedAvailableMatches(30),
    cachedGlobalLeaderboard(20),
    getCurrentUser(),
  ]);

  let userPredictions: Awaited<ReturnType<typeof getUserPredictions>> = [];
  if (user) {
    userPredictions = await getUserPredictions(user.id, 50);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink mb-2">Score Predictions</h1>
        <p className="text-muted">
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
