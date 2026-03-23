import { db } from "@/lib/db";
import {
  badges,
  predictions,
  pickemPredictions,
  challengeAnswers,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function checkAndAwardBadge(
  userId: string,
  badgeType: string
): Promise<boolean> {
  const [existing] = await db
    .select()
    .from(badges)
    .where(and(eq(badges.userId, userId), eq(badges.badgeType, badgeType)))
    .limit(1);

  if (existing) return false;

  await db.insert(badges).values({ userId, badgeType }).onConflictDoNothing();
  return true;
}

export async function getUserBadges(userId: string) {
  return db.select().from(badges).where(eq(badges.userId, userId));
}

// triple_threat: user has scored points in all 3 games
export async function checkTripleThreat(userId: string) {
  const result = await db.execute(sql`
    SELECT
      EXISTS(SELECT 1 FROM ${predictions} WHERE user_id = ${userId} AND points > 0) as has_prode,
      EXISTS(SELECT 1 FROM ${pickemPredictions} WHERE user_id = ${userId} AND points > 0) as has_pickem,
      EXISTS(SELECT 1 FROM ${challengeAnswers} WHERE user_id = ${userId} AND points > 0) as has_challenge
  `);

  const row = result.rows[0] as any;
  if (row?.has_prode && row?.has_pickem && row?.has_challenge) {
    await checkAndAwardBadge(userId, "triple_threat");
  }
}
