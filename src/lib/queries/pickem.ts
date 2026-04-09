import { db } from "@/lib/db";
import {
  pickemPredictions,
  matches,
  teams,
  users,
  competitionSeasons,
  competitions,
} from "@/lib/db/schema";
import { eq, and, desc, gte, lte, count, sum, sql, isNotNull, inArray } from "drizzle-orm";
import { checkAndAwardBadge, checkTripleThreat } from "./badges";

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
    .where(inArray(pickemPredictions.matchId, matchIds))
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

    if (isCorrect) {
      // Check pickem_streak_5: 5 consecutive correct picks
      const recentPicks = await db
        .select({ isCorrect: pickemPredictions.isCorrect })
        .from(pickemPredictions)
        .where(
          and(
            eq(pickemPredictions.userId, pick.userId),
            isNotNull(pickemPredictions.scoredAt)
          )
        )
        .orderBy(desc(pickemPredictions.scoredAt))
        .limit(5);

      if (
        recentPicks.length === 5 &&
        recentPicks.every((p) => p.isCorrect === true)
      ) {
        await checkAndAwardBadge(pick.userId, "pickem_streak_5");
      }
    }
  }

  // Check pickem_perfect_matchday: all picks correct for this matchday
  const [matchInfo] = await db
    .select({
      competitionSeasonId: matches.competitionSeasonId,
      matchday: matches.matchday,
    })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (matchInfo?.matchday) {
    // Get all matches in this matchday
    const matchdayMatches = await db
      .select({ id: matches.id })
      .from(matches)
      .where(
        and(
          eq(matches.competitionSeasonId, matchInfo.competitionSeasonId),
          eq(matches.matchday, matchInfo.matchday),
          eq(matches.status, "finished")
        )
      );

    const matchdayMatchIds = matchdayMatches.map((m) => m.id);

    // For each user who picked in this matchday, check if all are correct
    const userResults = await db
      .select({
        userId: pickemPredictions.userId,
        total: count(),
        correct: sql<number>`COUNT(*) FILTER (WHERE ${pickemPredictions.isCorrect} = true)`,
      })
      .from(pickemPredictions)
      .where(inArray(pickemPredictions.matchId, matchdayMatchIds))
      .groupBy(pickemPredictions.userId);

    for (const ur of userResults) {
      if (
        Number(ur.total) === matchdayMatchIds.length &&
        Number(ur.correct) === matchdayMatchIds.length &&
        matchdayMatchIds.length > 0
      ) {
        await checkAndAwardBadge(ur.userId, "pickem_perfect_matchday");
      }
    }
  }

  // Check triple_threat for all users who had picks in this match
  const uniqueUsers = [...new Set(matchPickems.map((p) => p.userId))];
  for (const uid of uniqueUsers) {
    await checkTripleThreat(uid);
  }
}
