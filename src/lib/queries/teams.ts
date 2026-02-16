import { db } from "@/lib/db";
import { teams, standings, competitionSeasons, seasons, playerTeamHistory, players } from "@/lib/db/schema";
import { eq, and, isNull, lte, or, gte, isNotNull, desc } from "drizzle-orm";

/**
 * Get a team by their URL slug.
 */
export async function getTeamBySlug(slug: string) {
  const result = await db
    .select()
    .from(teams)
    .where(eq(teams.slug, slug))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get team standings for a specific season.
 */
export async function getTeamStats(teamId: string, seasonId?: string) {
  const seasonFilter = seasonId
    ? eq(seasons.id, seasonId)
    : eq(seasons.isCurrent, true);

  return db
    .select({
      standing: standings,
      seasonLabel: seasons.label,
    })
    .from(standings)
    .innerJoin(
      competitionSeasons,
      eq(competitionSeasons.id, standings.competitionSeasonId)
    )
    .innerJoin(seasons, eq(seasons.id, competitionSeasons.seasonId))
    .where(and(eq(standings.teamId, teamId), seasonFilter));
}

/**
 * Get current squad for a team (players with no valid_to).
 * For historical view, pass season dates to filter.
 */
export async function getSquad(teamId: string, seasonId?: string) {
  if (!seasonId) {
    // Current squad
    return db
      .select({
        player: players,
        shirtNumber: playerTeamHistory.shirtNumber,
      })
      .from(playerTeamHistory)
      .innerJoin(players, eq(players.id, playerTeamHistory.playerId))
      .where(
        and(
          eq(playerTeamHistory.teamId, teamId),
          isNull(playerTeamHistory.validTo)
        )
      );
  }

  // Historical squad — get season dates and find overlapping stints
  const seasonResult = await db
    .select()
    .from(seasons)
    .where(eq(seasons.id, seasonId))
    .limit(1);

  if (!seasonResult[0]) return [];

  const season = seasonResult[0];
  return db
    .select({
      player: players,
      shirtNumber: playerTeamHistory.shirtNumber,
    })
    .from(playerTeamHistory)
    .innerJoin(players, eq(players.id, playerTeamHistory.playerId))
    .where(
      and(
        eq(playerTeamHistory.teamId, teamId),
        lte(playerTeamHistory.validFrom, season.endDate),
        or(
          isNull(playerTeamHistory.validTo),
          gte(playerTeamHistory.validTo, season.startDate)
        )
      )
    );
}

/**
 * Get former players for a team (players with valid_to IS NOT NULL).
 */
export async function getFormerPlayers(teamId: string, limit = 20) {
  return db
    .select({
      player: players,
      shirtNumber: playerTeamHistory.shirtNumber,
      validFrom: playerTeamHistory.validFrom,
      validTo: playerTeamHistory.validTo,
    })
    .from(playerTeamHistory)
    .innerJoin(players, eq(players.id, playerTeamHistory.playerId))
    .where(
      and(
        eq(playerTeamHistory.teamId, teamId),
        isNotNull(playerTeamHistory.validTo)
      )
    )
    .orderBy(desc(playerTeamHistory.validTo))
    .limit(limit);
}

/**
 * Get all seasons available for a team.
 */
export async function getTeamSeasons(teamId: string) {
  return db
    .select({
      season: seasons,
    })
    .from(playerTeamHistory)
    .innerJoin(seasons,
      and(
        lte(seasons.startDate, playerTeamHistory.validFrom),
        or(
          isNull(playerTeamHistory.validTo),
          gte(seasons.endDate, playerTeamHistory.validFrom)
        )
      )
    )
    .where(eq(playerTeamHistory.teamId, teamId))
    .groupBy(seasons.id)
    .orderBy(desc(seasons.startDate));
}
