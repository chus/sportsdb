import Link from "next/link";
import { format } from "date-fns";
import { Trophy, Minus } from "lucide-react";
import { getHeadToHead } from "@/lib/queries/related";

interface HeadToHeadProps {
  team1Id: string;
  team2Id: string;
  team1Name: string;
  team2Name: string;
  team1Logo?: string | null;
  team2Logo?: string | null;
}

export async function HeadToHead({
  team1Id,
  team2Id,
  team1Name,
  team2Name,
  team1Logo,
  team2Logo,
}: HeadToHeadProps) {
  const stats = await getHeadToHead(team1Id, team2Id, 5);

  if (stats.totalMatches === 0) {
    return null;
  }

  const team1WinPct = stats.totalMatches > 0
    ? Math.round((stats.team1Wins / stats.totalMatches) * 100)
    : 0;
  const team2WinPct = stats.totalMatches > 0
    ? Math.round((stats.team2Wins / stats.totalMatches) * 100)
    : 0;
  const drawPct = 100 - team1WinPct - team2WinPct;

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-100">
        <h3 className="font-semibold text-neutral-900">Head to Head</h3>
        <p className="text-xs text-neutral-500">Last {stats.totalMatches} meetings</p>
      </div>

      {/* Stats Summary */}
      <div className="p-4">
        {/* Win Distribution Bar */}
        <div className="mb-4">
          <div className="flex h-3 rounded-full overflow-hidden">
            <div
              className="bg-blue-500"
              style={{ width: `${team1WinPct}%` }}
              title={`${team1Name} wins: ${stats.team1Wins}`}
            />
            <div
              className="bg-neutral-300"
              style={{ width: `${drawPct}%` }}
              title={`Draws: ${stats.draws}`}
            />
            <div
              className="bg-red-500"
              style={{ width: `${team2WinPct}%` }}
              title={`${team2Name} wins: ${stats.team2Wins}`}
            />
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-blue-600 font-medium">{stats.team1Wins} wins</span>
            <span className="text-neutral-500">{stats.draws} draws</span>
            <span className="text-red-600 font-medium">{stats.team2Wins} wins</span>
          </div>
        </div>

        {/* Goals */}
        <div className="flex items-center justify-center gap-8 py-3 border-y border-neutral-100">
          <div className="text-center">
            {team1Logo ? (
              <img src={team1Logo} alt={team1Name} className="w-8 h-8 mx-auto mb-1 object-contain" />
            ) : (
              <div className="w-8 h-8 bg-neutral-100 rounded mx-auto mb-1" />
            )}
            <div className="text-2xl font-bold text-neutral-900">{stats.team1Goals}</div>
            <div className="text-xs text-neutral-500">Goals</div>
          </div>
          <Minus className="w-4 h-4 text-neutral-300" />
          <div className="text-center">
            {team2Logo ? (
              <img src={team2Logo} alt={team2Name} className="w-8 h-8 mx-auto mb-1 object-contain" />
            ) : (
              <div className="w-8 h-8 bg-neutral-100 rounded mx-auto mb-1" />
            )}
            <div className="text-2xl font-bold text-neutral-900">{stats.team2Goals}</div>
            <div className="text-xs text-neutral-500">Goals</div>
          </div>
        </div>

        {/* Recent Matches */}
        {stats.recentMatches.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
              Recent Matches
            </h4>
            <div className="space-y-2">
              {stats.recentMatches.map((match) => {
                const isTeam1Home = match.homeTeamId === team1Id;
                const team1Score = isTeam1Home ? match.homeScore : match.awayScore;
                const team2Score = isTeam1Home ? match.awayScore : match.homeScore;
                const team1Won = team1Score > team2Score;
                const team2Won = team2Score > team1Score;

                return (
                  <Link
                    key={match.id}
                    href={`/matches/${match.id}`}
                    className="flex items-center justify-between p-2 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors text-sm"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <span className={team1Won ? "font-medium" : "text-neutral-600"}>
                        {team1Name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 px-3">
                      <span className={`font-mono font-medium ${team1Won ? "text-green-600" : ""}`}>
                        {team1Score}
                      </span>
                      <span className="text-neutral-400">-</span>
                      <span className={`font-mono font-medium ${team2Won ? "text-green-600" : ""}`}>
                        {team2Score}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <span className={team2Won ? "font-medium" : "text-neutral-600"}>
                        {team2Name}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
