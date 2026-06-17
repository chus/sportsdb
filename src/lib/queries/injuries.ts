import { cache } from "react";
import { db } from "@/lib/db";
import { injuries, players, teams, competitionSeasons, competitions, seasons } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

/**
 * Current injuries & suspensions for a team's players (current season).
 * Powers the "Injuries & Suspensions" section on the team page.
 */
export const getTeamInjuries = cache(async (teamId: string) => {
  return db
    .select({
      playerName: players.name,
      playerSlug: players.slug,
      playerImage: players.imageUrl,
      position: players.position,
      isIndexable: players.isIndexable,
      type: injuries.type,
      reason: injuries.reason,
      fixtureDate: injuries.fixtureDate,
    })
    .from(injuries)
    .innerJoin(players, eq(players.id, injuries.playerId))
    .innerJoin(competitionSeasons, eq(competitionSeasons.id, injuries.competitionSeasonId))
    .innerJoin(seasons, and(eq(seasons.id, competitionSeasons.seasonId), eq(seasons.isCurrent, true)))
    .where(eq(injuries.teamId, teamId))
    .orderBy(players.name);
});

/**
 * A single player's current injury/suspension, or null if fit.
 */
export const getPlayerInjury = cache(async (playerId: string) => {
  const rows = await db
    .select({ type: injuries.type, reason: injuries.reason, fixtureDate: injuries.fixtureDate })
    .from(injuries)
    .innerJoin(competitionSeasons, eq(competitionSeasons.id, injuries.competitionSeasonId))
    .innerJoin(seasons, and(eq(seasons.id, competitionSeasons.seasonId), eq(seasons.isCurrent, true)))
    .where(eq(injuries.playerId, playerId))
    .limit(1);
  return rows[0] ?? null;
});

/**
 * All current injuries across leagues, grouped for the /injuries hub.
 * Joined with player/team/competition for linking.
 */
export const getCurrentInjuries = cache(async () => {
  return db
    .select({
      playerName: players.name,
      playerSlug: players.slug,
      playerImage: players.imageUrl,
      position: players.position,
      isIndexable: players.isIndexable,
      teamName: teams.name,
      teamSlug: teams.slug,
      teamLogo: teams.logoUrl,
      competitionName: competitions.name,
      competitionSlug: competitions.slug,
      type: injuries.type,
      reason: injuries.reason,
      fixtureDate: injuries.fixtureDate,
    })
    .from(injuries)
    .innerJoin(players, eq(players.id, injuries.playerId))
    .innerJoin(teams, eq(teams.id, injuries.teamId))
    .innerJoin(competitionSeasons, eq(competitionSeasons.id, injuries.competitionSeasonId))
    .innerJoin(competitions, eq(competitions.id, competitionSeasons.competitionId))
    .innerJoin(seasons, and(eq(seasons.id, competitionSeasons.seasonId), eq(seasons.isCurrent, true)))
    .orderBy(competitions.name, teams.name, players.name);
});

/** Count of current injuries — for hub metadata / nav badges. */
export const getInjuryCount = cache(async () => {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(injuries)
    .innerJoin(competitionSeasons, eq(competitionSeasons.id, injuries.competitionSeasonId))
    .innerJoin(seasons, and(eq(seasons.id, competitionSeasons.seasonId), eq(seasons.isCurrent, true)));
  return row?.c ?? 0;
});
