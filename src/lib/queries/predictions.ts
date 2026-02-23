import { db } from "@/lib/db";
import {
  predictions,
  badges,
  matches,
  teams,
  users,
  competitionSeasons,
  competitions,
} from "@/lib/db/schema";
import { eq, and, desc, gte, lte, count, sum, sql } from "drizzle-orm";

export interface Prediction {
  id: string;
  userId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  points: number | null;
  isExactScore: boolean | null;
  isCorrectResult: boolean | null;
  submittedAt: Date | null;
  scoredAt: Date | null;
}

export interface PredictionWithMatch extends Prediction {
  match: {
    id: string;
    homeTeam: { id: string; name: string; logoUrl: string | null };
    awayTeam: { id: string; name: string; logoUrl: string | null };
    homeScore: number | null;
    awayScore: number | null;
    status: string;
    scheduledAt: Date;
    competition: { name: string };
  };
}

// Get user's predictions with match details
export async function getUserPredictions(
  userId: string,
  limit = 20,
  offset = 0
): Promise<PredictionWithMatch[]> {
  const results = await db
    .select({
      prediction: predictions,
      match: matches,
      homeTeam: {
        id: teams.id,
        name: teams.name,
        logoUrl: teams.logoUrl,
      },
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .innerJoin(teams, eq(matches.homeTeamId, teams.id))
    .where(eq(predictions.userId, userId))
    .orderBy(desc(matches.scheduledAt))
    .limit(limit)
    .offset(offset);

  // Get away teams and competition names
  const enriched = await Promise.all(
    results.map(async (row) => {
      const [awayTeam] = await db
        .select({
          id: teams.id,
          name: teams.name,
          logoUrl: teams.logoUrl,
        })
        .from(teams)
        .where(eq(teams.id, row.match.awayTeamId))
        .limit(1);

      const [compSeason] = await db
        .select({ name: competitions.name })
        .from(competitionSeasons)
        .innerJoin(competitions, eq(competitionSeasons.competitionId, competitions.id))
        .where(eq(competitionSeasons.id, row.match.competitionSeasonId))
        .limit(1);

      return {
        id: row.prediction.id,
        userId: row.prediction.userId,
        matchId: row.prediction.matchId,
        homeScore: row.prediction.homeScore,
        awayScore: row.prediction.awayScore,
        points: row.prediction.points,
        isExactScore: row.prediction.isExactScore,
        isCorrectResult: row.prediction.isCorrectResult,
        submittedAt: row.prediction.submittedAt,
        scoredAt: row.prediction.scoredAt,
        match: {
          id: row.match.id,
          homeTeam: row.homeTeam,
          awayTeam,
          homeScore: row.match.homeScore,
          awayScore: row.match.awayScore,
          status: row.match.status,
          scheduledAt: row.match.scheduledAt,
          competition: { name: compSeason?.name ?? "Unknown" },
        },
      } satisfies PredictionWithMatch;
    })
  );

  return enriched;
}

// Get upcoming matches available for predictions
export async function getAvailableMatches(limit = 20) {
  const now = new Date();
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const results = await db
    .select({
      match: matches,
      homeTeam: {
        id: teams.id,
        name: teams.name,
        logoUrl: teams.logoUrl,
      },
    })
    .from(matches)
    .innerJoin(teams, eq(matches.homeTeamId, teams.id))
    .where(
      and(
        eq(matches.status, "scheduled"),
        gte(matches.scheduledAt, now),
        lte(matches.scheduledAt, oneWeekFromNow)
      )
    )
    .orderBy(matches.scheduledAt)
    .limit(limit);

  // Get away teams and competition names
  const enriched = await Promise.all(
    results.map(async (row) => {
      const [awayTeam] = await db
        .select({
          id: teams.id,
          name: teams.name,
          logoUrl: teams.logoUrl,
        })
        .from(teams)
        .where(eq(teams.id, row.match.awayTeamId))
        .limit(1);

      const [compSeason] = await db
        .select({ name: competitions.name })
        .from(competitionSeasons)
        .innerJoin(competitions, eq(competitionSeasons.competitionId, competitions.id))
        .where(eq(competitionSeasons.id, row.match.competitionSeasonId))
        .limit(1);

      return {
        id: row.match.id,
        homeTeam: row.homeTeam,
        awayTeam,
        scheduledAt: row.match.scheduledAt,
        competition: { name: compSeason?.name ?? "Unknown" },
      };
    })
  );

  return enriched;
}

// Submit a prediction
export async function submitPrediction(
  userId: string,
  matchId: string,
  homeScore: number,
  awayScore: number
): Promise<Prediction> {
  // Check if match is still open for predictions
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!match) {
    throw new Error("Match not found");
  }

  if (match.status !== "scheduled" || new Date(match.scheduledAt) <= new Date()) {
    throw new Error("Predictions are closed for this match");
  }

  const [dbPrediction] = await db
    .insert(predictions)
    .values({
      userId,
      matchId,
      homeScore,
      awayScore,
    })
    .onConflictDoUpdate({
      target: [predictions.userId, predictions.matchId],
      set: {
        homeScore,
        awayScore,
        submittedAt: new Date(),
      },
    })
    .returning();

  // Check for first prediction badge
  await checkAndAwardBadge(userId, "first_blood");

  // Check for early bird badge (24+ hours before kickoff)
  const hoursUntilMatch =
    (new Date(match.scheduledAt).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntilMatch >= 24) {
    await checkAndAwardBadge(userId, "early_bird");
  }

  return {
    id: dbPrediction.id,
    userId: dbPrediction.userId,
    matchId: dbPrediction.matchId,
    homeScore: dbPrediction.homeScore,
    awayScore: dbPrediction.awayScore,
    points: dbPrediction.points,
    isExactScore: dbPrediction.isExactScore,
    isCorrectResult: dbPrediction.isCorrectResult,
    submittedAt: dbPrediction.submittedAt,
    scoredAt: dbPrediction.scoredAt,
  };
}

// Get user's prediction stats
export async function getUserPredictionStats(userId: string) {
  const [stats] = await db
    .select({
      totalPredictions: count(),
      correctResults: sql<number>`COUNT(*) FILTER (WHERE ${predictions.isCorrectResult} = true)`,
      exactScores: sql<number>`COUNT(*) FILTER (WHERE ${predictions.isExactScore} = true)`,
      totalPoints: sum(predictions.points),
    })
    .from(predictions)
    .where(eq(predictions.userId, userId));

  return {
    totalPredictions: Number(stats?.totalPredictions ?? 0),
    correctResults: Number(stats?.correctResults ?? 0),
    exactScores: Number(stats?.exactScores ?? 0),
    totalPoints: Number(stats?.totalPoints ?? 0),
    accuracy:
      stats?.totalPredictions && Number(stats.totalPredictions) > 0
        ? (Number(stats.correctResults) / Number(stats.totalPredictions)) * 100
        : 0,
  };
}

// Get global leaderboard
export async function getGlobalLeaderboard(limit = 50) {
  const results = await db
    .select({
      userId: predictions.userId,
      userName: users.name,
      totalPoints: sum(predictions.points),
      correctPredictions: sql<number>`COUNT(*) FILTER (WHERE ${predictions.isCorrectResult} = true)`,
      totalPredictions: count(),
    })
    .from(predictions)
    .innerJoin(users, eq(predictions.userId, users.id))
    .groupBy(predictions.userId, users.name)
    .orderBy(desc(sum(predictions.points)))
    .limit(limit);

  return results.map((r, index) => ({
    rank: index + 1,
    userId: r.userId,
    userName: r.userName ?? "Anonymous",
    totalPoints: Number(r.totalPoints ?? 0),
    correctPredictions: Number(r.correctPredictions ?? 0),
    totalPredictions: Number(r.totalPredictions ?? 0),
  }));
}

// Badge helpers
export async function getUserBadges(userId: string) {
  return db.select().from(badges).where(eq(badges.userId, userId));
}

async function checkAndAwardBadge(
  userId: string,
  badgeType: string
): Promise<boolean> {
  // Check if already has badge
  const [existing] = await db
    .select()
    .from(badges)
    .where(and(eq(badges.userId, userId), eq(badges.badgeType, badgeType)))
    .limit(1);

  if (existing) return false;

  // Award badge
  await db.insert(badges).values({ userId, badgeType }).onConflictDoNothing();
  return true;
}

// Score predictions after a match ends
export async function scorePredictionsForMatch(matchId: string) {
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!match || match.status !== "finished" || match.homeScore === null || match.awayScore === null) {
    return;
  }

  const matchPredictions = await db
    .select()
    .from(predictions)
    .where(eq(predictions.matchId, matchId));

  for (const pred of matchPredictions) {
    const isExactScore =
      pred.homeScore === match.homeScore && pred.awayScore === match.awayScore;

    const predResult =
      pred.homeScore > pred.awayScore
        ? "home"
        : pred.homeScore < pred.awayScore
        ? "away"
        : "draw";

    const actualResult =
      match.homeScore > match.awayScore
        ? "home"
        : match.homeScore < match.awayScore
        ? "away"
        : "draw";

    const isCorrectResult = predResult === actualResult;

    // Points: 3 for exact, 1 for correct result
    const points = isExactScore ? 3 : isCorrectResult ? 1 : 0;

    await db
      .update(predictions)
      .set({
        points,
        isExactScore,
        isCorrectResult,
        scoredAt: new Date(),
      })
      .where(eq(predictions.id, pred.id));

    // Check for master predictor badge (100 correct)
    if (isCorrectResult) {
      const stats = await getUserPredictionStats(pred.userId);
      if (stats.correctResults >= 100) {
        await checkAndAwardBadge(pred.userId, "master_predictor");
      }
    }
  }
}
