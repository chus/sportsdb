import { db } from "@/lib/db";
import { players, playerTeamHistory, playerSeasonStats, teams, competitionSeasons, competitions, seasons } from "@/lib/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";

/**
 * Get a player by their URL slug.
 * Returns full player data with current team.
 */
export async function getPlayerBySlug(slug: string) {
  const result = await db
    .select()
    .from(players)
    .where(eq(players.slug, slug))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get the current team for a player (valid_to IS NULL).
 */
export async function getPlayerCurrentTeam(playerId: string) {
  const result = await db
    .select({ team: teams, shirtNumber: playerTeamHistory.shirtNumber })
    .from(playerTeamHistory)
    .innerJoin(teams, eq(teams.id, playerTeamHistory.teamId))
    .where(
      and(
        eq(playerTeamHistory.playerId, playerId),
        isNull(playerTeamHistory.validTo)
      )
    )
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get player career timeline (all clubs, ordered by date).
 */
export async function getPlayerCareer(playerId: string) {
  return db
    .select({
      id: playerTeamHistory.id,
      team: teams,
      shirtNumber: playerTeamHistory.shirtNumber,
      validFrom: playerTeamHistory.validFrom,
      validTo: playerTeamHistory.validTo,
      transferType: playerTeamHistory.transferType,
    })
    .from(playerTeamHistory)
    .innerJoin(teams, eq(teams.id, playerTeamHistory.teamId))
    .where(eq(playerTeamHistory.playerId, playerId))
    .orderBy(playerTeamHistory.validFrom);
}

/**
 * Get player stats for a specific season (or current season if no seasonId).
 */
export async function getPlayerStats(playerId: string, seasonId?: string) {
  const seasonFilter = seasonId
    ? eq(seasons.id, seasonId)
    : eq(seasons.isCurrent, true);

  return db
    .select({
      stat: playerSeasonStats,
      seasonLabel: seasons.label,
    })
    .from(playerSeasonStats)
    .innerJoin(
      competitionSeasons,
      eq(competitionSeasons.id, playerSeasonStats.competitionSeasonId)
    )
    .innerJoin(seasons, eq(seasons.id, competitionSeasons.seasonId))
    .where(
      and(eq(playerSeasonStats.playerId, playerId), seasonFilter)
    );
}

/**
 * Get all player stats across all seasons (for stats history table).
 */
export async function getPlayerStatsHistory(playerId: string) {
  return db
    .select({
      stat: playerSeasonStats,
      team: teams,
      season: seasons,
      competition: competitions,
    })
    .from(playerSeasonStats)
    .innerJoin(teams, eq(teams.id, playerSeasonStats.teamId))
    .innerJoin(
      competitionSeasons,
      eq(competitionSeasons.id, playerSeasonStats.competitionSeasonId)
    )
    .innerJoin(seasons, eq(seasons.id, competitionSeasons.seasonId))
    .innerJoin(competitions, eq(competitions.id, competitionSeasons.competitionId))
    .where(eq(playerSeasonStats.playerId, playerId))
    .orderBy(desc(seasons.startDate));
}
