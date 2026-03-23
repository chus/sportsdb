import { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getAvailableMatches } from "@/lib/queries/predictions";
import { getPickemCommunityPercentages, getUserPickems, getPickemLeaderboard } from "@/lib/queries/pickem";
import { PickemForm } from "./pickem-form";

export const metadata: Metadata = {
  title: "Pick'em — Games | SportsDB",
  description: "Pick Home, Draw, or Away for upcoming matches. See community vote percentages and compete on the leaderboard.",
};

export default async function PickemPage() {
  const [availableMatches, leaderboard, user] = await Promise.all([
    getAvailableMatches(30),
    getPickemLeaderboard(20),
    getCurrentUser(),
  ]);

  const matchIds = availableMatches.map((m) => m.id);
  const communityPercentages = await getPickemCommunityPercentages(matchIds);

  let userPickems: Awaited<ReturnType<typeof getUserPickems>> = [];
  if (user) {
    userPickems = await getUserPickems(user.id, 50);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">Pick'em</h1>
        <p className="text-neutral-600">
          Pick the winner of each match. See how the community voted and earn 1 point for each correct pick.
        </p>
      </div>

      <PickemForm
        matches={availableMatches}
        communityPercentages={communityPercentages}
        userPickems={userPickems}
        leaderboard={leaderboard}
        isLoggedIn={!!user}
      />
    </div>
  );
}
