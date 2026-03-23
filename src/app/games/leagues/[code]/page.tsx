import { notFound } from "next/navigation";
import Link from "next/link";
import { Users, Trophy, Copy, ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getLeagueByCode, getLeagueLeaderboard, getLeagueMembers } from "@/lib/queries/leagues";
import { LeagueShareCode } from "./league-share-code";

interface LeaguePageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({
  params,
}: LeaguePageProps): Promise<Metadata> {
  const { code } = await params;
  const league = await getLeagueByCode(code);

  if (!league) return { title: "League Not Found" };

  return {
    title: `${league.name} — Private League | SportsDB`,
    description: `Join ${league.name} and compete with friends. Use code ${league.code} to join.`,
    robots: { index: false, follow: false },
  };
}

export default async function LeaguePage({ params }: LeaguePageProps) {
  const { code } = await params;
  const league = await getLeagueByCode(code);

  if (!league) notFound();

  const [leaderboard, members] = await Promise.all([
    getLeagueLeaderboard(league.id),
    getLeagueMembers(league.id),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link
        href="/games/leagues"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Leagues
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 mb-1">
              {league.name}
            </h1>
            <div className="flex items-center gap-4 text-sm text-neutral-500">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                {members.length} members
              </div>
            </div>
          </div>
          <LeagueShareCode code={league.code} />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <h2 className="text-lg font-bold text-neutral-900">
                League Leaderboard
              </h2>
            </div>

            {leaderboard.length === 0 ? (
              <p className="text-neutral-500 text-center py-8">
                No scores yet. Start playing to see rankings!
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500">
                    <th className="text-left py-3 px-2 font-medium">#</th>
                    <th className="text-left py-3 px-2 font-medium">Player</th>
                    <th className="text-right py-3 px-2 font-medium">Prode</th>
                    <th className="text-right py-3 px-2 font-medium">
                      Pick&apos;em
                    </th>
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
            )}
          </div>
        </div>

        {/* Members sidebar */}
        <div>
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <h3 className="font-bold text-neutral-900 mb-4">Members</h3>
            <div className="space-y-3">
              {members.map((m) => (
                <div
                  key={m.userId}
                  className="flex items-center gap-3 text-sm"
                >
                  <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-semibold text-neutral-600">
                    {(m.userName?.[0] || "?").toUpperCase()}
                  </div>
                  <span className="font-medium text-neutral-900 truncate">
                    {m.userName || "Anonymous"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
