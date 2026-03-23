import Link from "next/link";
import { Vote, Lock, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { matches, teams, pickemPredictions } from "@/lib/db/schema";
import { eq, and, sql, count } from "drizzle-orm";
import { getPickemCommunityPercentages } from "@/lib/queries/pickem";

interface MatchdayCommunityPicksProps {
  competitionSeasonId: string;
}

export async function MatchdayCommunityPicks({
  competitionSeasonId,
}: MatchdayCommunityPicksProps) {
  // Get the next upcoming matchday
  const [nextMatch] = await db
    .select({ matchday: matches.matchday })
    .from(matches)
    .where(
      and(
        eq(matches.competitionSeasonId, competitionSeasonId),
        eq(matches.status, "scheduled")
      )
    )
    .orderBy(matches.scheduledAt)
    .limit(1);

  if (!nextMatch?.matchday) return null;

  // Get all matches for this matchday
  const matchdayMatches = await db
    .select({
      id: matches.id,
      scheduledAt: matches.scheduledAt,
      status: matches.status,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      homeTeam: { id: teams.id, name: teams.name, shortName: teams.shortName },
    })
    .from(matches)
    .innerJoin(teams, eq(matches.homeTeamId, teams.id))
    .where(
      and(
        eq(matches.competitionSeasonId, competitionSeasonId),
        eq(matches.matchday, nextMatch.matchday)
      )
    )
    .orderBy(matches.scheduledAt);

  if (matchdayMatches.length === 0) return null;

  // Get away teams
  const enriched = await Promise.all(
    matchdayMatches.map(async (m) => {
      const [awayTeam] = await db
        .select({ id: teams.id, name: teams.name, shortName: teams.shortName })
        .from(teams)
        .innerJoin(matches, eq(matches.awayTeamId, teams.id))
        .where(eq(matches.id, m.id))
        .limit(1);

      return { ...m, awayTeam };
    })
  );

  // Get community percentages
  const matchIds = enriched.map((m) => m.id);
  const percentages = await getPickemCommunityPercentages(matchIds);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-neutral-900">
          Matchday {nextMatch.matchday} Predictions
        </h3>
        <Link
          href="/games/pickem"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          Join Pick'em →
        </Link>
      </div>

      <div className="space-y-3">
        {enriched.map((match) => {
          const pct = percentages[match.id];
          const homeName =
            match.homeTeam.shortName || match.homeTeam.name;
          const awayName =
            match.awayTeam?.shortName || match.awayTeam?.name || "TBD";

          return (
            <div
              key={match.id}
              className="bg-neutral-50 rounded-lg p-3"
            >
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium text-neutral-900 flex-1 text-right pr-3">
                  {homeName}
                </span>
                <span className="text-xs text-neutral-400 px-1">vs</span>
                <span className="font-medium text-neutral-900 flex-1 pl-3">
                  {awayName}
                </span>
              </div>

              {pct && pct.total > 0 ? (
                <>
                  <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-500 rounded-l-full"
                      style={{ width: `${pct.home}%` }}
                    />
                    <div
                      className="bg-neutral-400"
                      style={{ width: `${pct.draw}%` }}
                    />
                    <div
                      className="bg-red-500 rounded-r-full"
                      style={{ width: `${pct.away}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-[10px] text-neutral-400">
                    <span>H {pct.home}%</span>
                    <span>D {pct.draw}%</span>
                    <span>A {pct.away}%</span>
                  </div>
                </>
              ) : (
                <div className="text-center text-xs text-neutral-400 py-1">
                  No predictions yet
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-4 text-center">
        <p className="text-sm text-neutral-700 mb-2">
          Think you know the results?
        </p>
        <Link
          href="/games/pickem"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Vote className="w-4 h-4" />
          Make Your Picks
        </Link>
      </div>
    </div>
  );
}
