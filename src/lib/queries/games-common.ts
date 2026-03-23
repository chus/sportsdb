import { db } from "@/lib/db";
import { predictions, pickemPredictions, challengeAnswers, users } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";

// Combined leaderboard across all 3 games
export async function getCombinedLeaderboard(limit = 50) {
  const results = await db.execute(sql`
    SELECT
      u.id as user_id,
      u.name as user_name,
      COALESCE(prode.pts, 0) + COALESCE(pickem.pts, 0) + COALESCE(challenge.pts, 0) as total_points,
      COALESCE(prode.pts, 0) as prode_points,
      COALESCE(pickem.pts, 0) as pickem_points,
      COALESCE(challenge.pts, 0) as challenge_points
    FROM ${users} u
    LEFT JOIN LATERAL (
      SELECT SUM(points) as pts FROM ${predictions} WHERE user_id = u.id
    ) prode ON true
    LEFT JOIN LATERAL (
      SELECT SUM(points) as pts FROM ${pickemPredictions} WHERE user_id = u.id
    ) pickem ON true
    LEFT JOIN LATERAL (
      SELECT SUM(points) as pts FROM ${challengeAnswers} WHERE user_id = u.id
    ) challenge ON true
    WHERE COALESCE(prode.pts, 0) + COALESCE(pickem.pts, 0) + COALESCE(challenge.pts, 0) > 0
    ORDER BY total_points DESC
    LIMIT ${limit}
  `);

  return (results.rows as any[]).map((r: any, i: number) => ({
    rank: i + 1,
    userId: r.user_id,
    userName: r.user_name ?? "Anonymous",
    totalPoints: Number(r.total_points),
    prodePoints: Number(r.prode_points),
    pickemPoints: Number(r.pickem_points),
    challengePoints: Number(r.challenge_points),
  }));
}
