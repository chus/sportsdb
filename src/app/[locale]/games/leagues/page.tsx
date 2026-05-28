import { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getUserLeagues } from "@/lib/queries/leagues";
import { LeaguesContent } from "./leagues-content";

export const metadata: Metadata = {
  title: "Private Leagues — Games",
  description:
    "Create or join private prediction leagues. Compete with friends and climb your league leaderboard.",
};

export default async function LeaguesPage() {
  const user = await getCurrentUser();

  let leagues: Awaited<ReturnType<typeof getUserLeagues>> = [];
  if (user) {
    leagues = await getUserLeagues(user.id);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">
          Private Leagues
        </h1>
        <p className="text-neutral-600">
          Create a league, invite friends with a code, and compete on your own
          leaderboard.
        </p>
      </div>

      <LeaguesContent leagues={leagues} isLoggedIn={!!user} />
    </div>
  );
}
