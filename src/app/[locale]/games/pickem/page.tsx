import { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { cachedQuery } from "@/lib/cache";
import { getAvailableMatches } from "@/lib/queries/predictions";
import { getPickemCommunityPercentages, getUserPickems, getPickemLeaderboard } from "@/lib/queries/pickem";

// getCurrentUser() (cookies) makes this page dynamic — cache the public
// queries so anonymous hits never touch the DB.
const cachedAvailableMatches = cachedQuery(getAvailableMatches, ["pickem-matches"], 3600);
const cachedPickemLeaderboard = cachedQuery(getPickemLeaderboard, ["pickem-leaderboard"], 3600);
const cachedCommunityPercentages = cachedQuery(getPickemCommunityPercentages, ["pickem-community"], 3600);
import { PickemForm } from "./pickem-form";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const metadata: Metadata = {
  title: "Pick'em — Games",
  description: "Pick Home, Draw, or Away for upcoming matches. See community vote percentages and compete on the leaderboard.",
  alternates: {
    canonical: `${BASE_URL}/games/pickem`,
  },
};

export default async function PickemPage() {
  const [availableMatches, leaderboard, user] = await Promise.all([
    cachedAvailableMatches(30),
    cachedPickemLeaderboard(20),
    getCurrentUser(),
  ]);

  const matchIds = availableMatches.map((m) => m.id);
  const communityPercentages = await cachedCommunityPercentages(matchIds);

  let userPickems: Awaited<ReturnType<typeof getUserPickems>> = [];
  if (user) {
    userPickems = await getUserPickems(user.id, 50);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink mb-2">Pick'em</h1>
        <p className="text-muted">
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
