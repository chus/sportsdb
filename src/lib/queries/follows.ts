import { db } from "@/lib/db";
import { follows, players, teams, competitions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export type EntityType = "player" | "team" | "competition";

export async function followEntity(userId: string, entityType: EntityType, entityId: string) {
  const [follow] = await db
    .insert(follows)
    .values({
      userId,
      entityType,
      entityId,
    })
    .onConflictDoNothing()
    .returning();

  return follow;
}

export async function unfollowEntity(userId: string, entityType: EntityType, entityId: string) {
  await db
    .delete(follows)
    .where(
      and(
        eq(follows.userId, userId),
        eq(follows.entityType, entityType),
        eq(follows.entityId, entityId)
      )
    );
}

export async function isFollowing(userId: string, entityType: EntityType, entityId: string) {
  const [follow] = await db
    .select()
    .from(follows)
    .where(
      and(
        eq(follows.userId, userId),
        eq(follows.entityType, entityType),
        eq(follows.entityId, entityId)
      )
    )
    .limit(1);

  return !!follow;
}

export async function getUserFollows(userId: string) {
  return db
    .select()
    .from(follows)
    .where(eq(follows.userId, userId))
    .orderBy(follows.createdAt);
}

export async function getFollowedPlayers(userId: string) {
  return db
    .select({
      follow: follows,
      player: players,
    })
    .from(follows)
    .innerJoin(players, eq(players.id, follows.entityId))
    .where(and(eq(follows.userId, userId), eq(follows.entityType, "player")));
}

export async function getFollowedTeams(userId: string) {
  return db
    .select({
      follow: follows,
      team: teams,
    })
    .from(follows)
    .innerJoin(teams, eq(teams.id, follows.entityId))
    .where(and(eq(follows.userId, userId), eq(follows.entityType, "team")));
}

export async function getFollowedCompetitions(userId: string) {
  return db
    .select({
      follow: follows,
      competition: competitions,
    })
    .from(follows)
    .innerJoin(competitions, eq(competitions.id, follows.entityId))
    .where(and(eq(follows.userId, userId), eq(follows.entityType, "competition")));
}

export async function getFollowerCount(entityType: EntityType, entityId: string) {
  const result = await db
    .select()
    .from(follows)
    .where(
      and(
        eq(follows.entityType, entityType),
        eq(follows.entityId, entityId)
      )
    );

  return result.length;
}
