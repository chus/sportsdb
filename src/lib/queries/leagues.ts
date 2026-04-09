import { db } from "@/lib/db";
import {
  predictionLeagues,
  predictionLeagueMembers,
  predictions,
  pickemPredictions,
  challengeAnswers,
  users,
} from "@/lib/db/schema";
import { eq, and, desc, count, sum, sql } from "drizzle-orm";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createLeague(userId: string, name: string) {
  const code = generateCode();

  const [league] = await db
    .insert(predictionLeagues)
    .values({ name, code, createdBy: userId })
    .returning();

  // Auto-join the creator
  await db
    .insert(predictionLeagueMembers)
    .values({ leagueId: league.id, userId })
    .onConflictDoNothing();

  return league;
}

export async function joinLeague(userId: string, code: string) {
  const [league] = await db
    .select()
    .from(predictionLeagues)
    .where(eq(predictionLeagues.code, code.toUpperCase()))
    .limit(1);

  if (!league) throw new Error("League not found");

  // Check if already a member
  const [existing] = await db
    .select()
    .from(predictionLeagueMembers)
    .where(
      and(
        eq(predictionLeagueMembers.leagueId, league.id),
        eq(predictionLeagueMembers.userId, userId)
      )
    )
    .limit(1);

  if (existing) throw new Error("Already a member");

  await db
    .insert(predictionLeagueMembers)
    .values({ leagueId: league.id, userId });

  return league;
}

export async function getUserLeagues(userId: string) {
  const memberships = await db
    .select({
      league: predictionLeagues,
      memberCount: sql<number>`(
        SELECT count(*)::int FROM ${predictionLeagueMembers}
        WHERE league_id = ${predictionLeagues.id}
      )`,
    })
    .from(predictionLeagueMembers)
    .innerJoin(
      predictionLeagues,
      eq(predictionLeagueMembers.leagueId, predictionLeagues.id)
    )
    .where(eq(predictionLeagueMembers.userId, userId))
    .orderBy(desc(predictionLeagues.createdAt));

  return memberships.map((m) => ({
    id: m.league.id,
    name: m.league.name,
    code: m.league.code,
    isPrivate: m.league.isPrivate,
    createdBy: m.league.createdBy,
    memberCount: Number(m.memberCount),
    createdAt: m.league.createdAt,
  }));
}

export async function getLeagueByCode(code: string) {
  const [league] = await db
    .select()
    .from(predictionLeagues)
    .where(eq(predictionLeagues.code, code.toUpperCase()))
    .limit(1);

  return league ?? null;
}

export async function getLeagueMembers(leagueId: string) {
  return db
    .select({
      userId: predictionLeagueMembers.userId,
      userName: users.name,
      joinedAt: predictionLeagueMembers.joinedAt,
    })
    .from(predictionLeagueMembers)
    .innerJoin(users, eq(predictionLeagueMembers.userId, users.id))
    .where(eq(predictionLeagueMembers.leagueId, leagueId))
    .orderBy(predictionLeagueMembers.joinedAt);
}

export async function getLeagueLeaderboard(leagueId: string) {
  const members = await db
    .select({ userId: predictionLeagueMembers.userId })
    .from(predictionLeagueMembers)
    .where(eq(predictionLeagueMembers.leagueId, leagueId));

  const memberIds = members.map((m) => m.userId);
  if (memberIds.length === 0) return [];

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
    WHERE u.id IN (${sql.join(
      memberIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})
    ORDER BY total_points DESC
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
