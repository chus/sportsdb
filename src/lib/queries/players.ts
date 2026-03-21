import { db } from "@/lib/db";
import { players, playerTeamHistory, playerSeasonStats, teams, competitionSeasons, competitions, seasons, matches, matchLineups } from "@/lib/db/schema";
import { eq, and, isNull, desc, or, sql } from "drizzle-orm";

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

/**
 * Get player's ranking in their current-season competition(s) for goals and assists.
 */
export async function getPlayerRankings(playerId: string) {
  // Get player's current season stats with competition info
  const currentStats = await db
    .select({
      competitionSeasonId: playerSeasonStats.competitionSeasonId,
      goals: playerSeasonStats.goals,
      assists: playerSeasonStats.assists,
      competitionName: competitions.name,
      competitionSlug: competitions.slug,
    })
    .from(playerSeasonStats)
    .innerJoin(competitionSeasons, eq(competitionSeasons.id, playerSeasonStats.competitionSeasonId))
    .innerJoin(competitions, eq(competitions.id, competitionSeasons.competitionId))
    .innerJoin(seasons, eq(seasons.id, competitionSeasons.seasonId))
    .where(and(eq(playerSeasonStats.playerId, playerId), eq(seasons.isCurrent, true)));

  if (currentStats.length === 0) return [];

  const rankings = [];

  for (const stat of currentStats) {
    // Count players with more goals in same competition season
    const [goalsRank] = await db
      .select({ count: sql<number>`count(*) + 1` })
      .from(playerSeasonStats)
      .where(
        and(
          eq(playerSeasonStats.competitionSeasonId, stat.competitionSeasonId),
          sql`${playerSeasonStats.goals} > ${stat.goals}`
        )
      );

    // Count players with more assists in same competition season
    const [assistsRank] = await db
      .select({ count: sql<number>`count(*) + 1` })
      .from(playerSeasonStats)
      .where(
        and(
          eq(playerSeasonStats.competitionSeasonId, stat.competitionSeasonId),
          sql`${playerSeasonStats.assists} > ${stat.assists}`
        )
      );

    rankings.push({
      competitionName: stat.competitionName,
      competitionSlug: stat.competitionSlug,
      goals: stat.goals,
      assists: stat.assists,
      goalsRank: goalsRank?.count ?? 0,
      assistsRank: assistsRank?.count ?? 0,
    });
  }

  return rankings;
}

/**
 * Get recent match appearances for a player from match_lineups.
 */
export async function getPlayerRecentMatches(playerId: string, limit = 5) {
  return db
    .select({
      match: {
        id: matches.id,
        scheduledAt: matches.scheduledAt,
        status: matches.status,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
      },
      homeTeam: {
        name: sql<string>`ht.name`,
        slug: sql<string>`ht.slug`,
        logoUrl: sql<string>`ht.logo_url`,
      },
      awayTeam: {
        name: sql<string>`at.name`,
        slug: sql<string>`at.slug`,
        logoUrl: sql<string>`at.logo_url`,
      },
      lineup: {
        isStarter: matchLineups.isStarter,
        minutesPlayed: matchLineups.minutesPlayed,
      },
      competition: {
        name: competitions.name,
        slug: competitions.slug,
      },
    })
    .from(matchLineups)
    .innerJoin(matches, eq(matches.id, matchLineups.matchId))
    .innerJoin(sql`teams ht`, sql`ht.id = ${matches.homeTeamId}`)
    .innerJoin(sql`teams at`, sql`at.id = ${matches.awayTeamId}`)
    .innerJoin(competitionSeasons, eq(competitionSeasons.id, matches.competitionSeasonId))
    .innerJoin(competitions, eq(competitions.id, competitionSeasons.competitionId))
    .where(eq(matchLineups.playerId, playerId))
    .orderBy(desc(matches.scheduledAt))
    .limit(limit);
}
