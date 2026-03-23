import { db } from "@/lib/db";
import {
  pickemPredictions,
  matches,
  teams,
  users,
  competitionSeasons,
  competitions,
} from "@/lib/db/schema";
import { eq, and, desc, gte, lte, count, sum, sql } from "drizzle-orm";

export interface PickemPrediction {
  id: string;
  userId: string;
  matchId: string;
  outcome: "home" | "draw" | "away";
  points: number | null;
  isCorrect: boolean | null;
  submittedAt: Date | null;
  scoredAt: Date | null;
}

// Submit a Pick'em prediction (upsert)
export async function submitPickem(
  userId: string,
  matchId: string,
  outcome: "home" | "draw" | "away"
): Promise<PickemPrediction> {
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!match) throw new Error("Match not found");
  if (match.status !== "scheduled" || new Date(match.scheduledAt) <= new Date()) {
    throw new Error("Predictions are closed for this match");
  }

  const [result] = await db
    .insert(pickemPredictions)
    .values({ userId, matchId, outcome })
    .onConflictDoUpdate({
      target: [pickemPredictions.userId, pickemPredictions.matchId],
      set: { outcome, submittedAt: new Date() },
    })
    .returning();

  return {
    id: result.id,
    userId: result.userId,
    matchId: result.matchId,
    outcome: result.outcome as "home" | "draw" | "away",
    points: result.points,
    isCorrect: result.isCorrect,
    submittedAt: result.submittedAt,
    scoredAt: result.scoredAt,
  };
}

// Get user's Pick'em predictions
export async function getUserPickems(
  userId: string,
  limit = 20,
  offset = 0
) {
  const results = await db
    .select({
      pickem: pickemPredictions,
      match: matches,
      homeTeam: { id: teams.id, name: teams.name, logoUrl: teams.logoUrl },
    })
    .from(pickemPredictions)
    .innerJoin(matches, eq(pickemPredictions.matchId, matches.id))
    .innerJoin(teams, eq(matches.homeTeamId, teams.id))
    .where(eq(pickemPredictions.userId, userId))
    .orderBy(desc(matches.scheduledAt))
    .limit(limit)
    .offset(offset);

  const enriched = await Promise.all(
    results.map(async (row) => {
      const [awayTeam] = await db
        .select({ id: teams.id, name: teams.name, logoUrl: teams.logoUrl })
        .from(teams)
        .where(eq(teams.id, row.match.awayTeamId))
        .limit(1);

      return {
        ...row.pickem,
        outcome: row.pickem.outcome as "home" | "draw" | "away",
        match: {
          id: row.match.id,
          homeTeam: row.homeTeam,
          awayTeam,
          homeScore: row.match.homeScore,
          awayScore: row.match.awayScore,
          status: row.match.status,
          scheduledAt: row.match.scheduledAt,
        },
      };
    })
  );

  return enriched;
}

// Get community vote percentages for a set of matches
export async function getPickemCommunityPercentages(matchIds: string[]) {
  if (matchIds.length === 0) return {};

  const results = await db
    .select({
      matchId: pickemPredictions.matchId,
      outcome: pickemPredictions.outcome,
      cnt: count(),
    })
    .from(pickemPredictions)
    .where(sql`${pickemPredictions.matchId} = ANY(${matchIds}::uuid[])`)
    .groupBy(pickemPredictions.matchId, pickemPredictions.outcome);

  const percentages: Record<
    string,
    { home: number; draw: number; away: number; total: number }
  > = {};

  for (const row of results) {
    if (!percentages[row.matchId]) {
      percentages[row.matchId] = { home: 0, draw: 0, away: 0, total: 0 };
    }
    const c = Number(row.cnt);
    percentages[row.matchId][row.outcome as "home" | "draw" | "away"] = c;
    percentages[row.matchId].total += c;
  }

  // Convert to percentages
  for (const matchId of Object.keys(percentages)) {
    const p = percentages[matchId];
    if (p.total > 0) {
      p.home = Math.round((p.home / p.total) * 100);
      p.draw = Math.round((p.draw / p.total) * 100);
      p.away = Math.round((p.away / p.total) * 100);
    }
  }

  return percentages;
}

// Count user's Pick'em predictions for a specific matchday
export async function getUserPickemCountForMatchday(
  userId: string,
  competitionSeasonId: string,
  matchday: number
): Promise<number> {
  const [result] = await db
    .select({ cnt: count() })
    .from(pickemPredictions)
    .innerJoin(matches, eq(pickemPredictions.matchId, matches.id))
    .where(
      and(
        eq(pickemPredictions.userId, userId),
        eq(matches.competitionSeasonId, competitionSeasonId),
        eq(matches.matchday, matchday)
      )
    );

  return Number(result?.cnt ?? 0);
}

// Get Pick'em leaderboard
export async function getPickemLeaderboard(limit = 50) {
  const results = await db
    .select({
      userId: pickemPredictions.userId,
      userName: users.name,
      totalPoints: sum(pickemPredictions.points),
      correctPicks: sql<number>`COUNT(*) FILTER (WHERE ${pickemPredictions.isCorrect} = true)`,
      totalPicks: count(),
    })
    .from(pickemPredictions)
    .innerJoin(users, eq(pickemPredictions.userId, users.id))
    .groupBy(pickemPredictions.userId, users.name)
    .orderBy(desc(sum(pickemPredictions.points)))
    .limit(limit);

  return results.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    userName: r.userName ?? "Anonymous",
    totalPoints: Number(r.totalPoints ?? 0),
    correctPicks: Number(r.correctPicks ?? 0),
    totalPicks: Number(r.totalPicks ?? 0),
  }));
}

// Score Pick'em predictions after a match ends
export async function scorePickemsForMatch(matchId: string) {
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (
    !match ||
    match.status !== "finished" ||
    match.homeScore === null ||
    match.awayScore === null
  ) {
    return;
  }

  const actualResult =
    match.homeScore > match.awayScore
      ? "home"
      : match.homeScore < match.awayScore
      ? "away"
      : "draw";

  const matchPickems = await db
    .select()
    .from(pickemPredictions)
    .where(eq(pickemPredictions.matchId, matchId));

  for (const pick of matchPickems) {
    const isCorrect = pick.outcome === actualResult;
    const points = isCorrect ? 1 : 0;

    await db
      .update(pickemPredictions)
      .set({ points, isCorrect, scoredAt: new Date() })
      .where(eq(pickemPredictions.id, pick.id));
  }
}
