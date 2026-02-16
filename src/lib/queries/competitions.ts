import { db } from "@/lib/db";
import {
  competitions,
  competitionSeasons,
  standings,
  seasons,
  teams,
  playerSeasonStats,
  players,
} from "@/lib/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";

/**
 * Get a competition by slug.
 */
export async function getCompetitionBySlug(slug: string) {
  const result = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, slug))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get standings for a competition-season.
 */
export async function getStandings(competitionSeasonId: string) {
  return db
    .select({
      standing: standings,
      team: teams,
    })
    .from(standings)
    .innerJoin(teams, eq(teams.id, standings.teamId))
    .where(eq(standings.competitionSeasonId, competitionSeasonId))
    .orderBy(standings.position);
}

/**
 * Get top scorers for a competition-season.
 */
export async function getTopScorers(competitionSeasonId: string, limit = 10) {
  return db
    .select({
      stat: playerSeasonStats,
      player: players,
      team: teams,
    })
    .from(playerSeasonStats)
    .innerJoin(players, eq(players.id, playerSeasonStats.playerId))
    .innerJoin(teams, eq(teams.id, playerSeasonStats.teamId))
    .where(eq(playerSeasonStats.competitionSeasonId, competitionSeasonId))
    .orderBy(desc(playerSeasonStats.goals))
    .limit(limit);
}

/**
 * Get competition-season by competition slug and season label (e.g., '2024-25').
 */
export async function getCompetitionSeason(
  competitionSlug: string,
  seasonLabel?: string
) {
  const comp = await getCompetitionBySlug(competitionSlug);
  if (!comp) return null;

  const seasonFilter = seasonLabel
    ? eq(seasons.label, seasonLabel.replace("-", "/"))
    : eq(seasons.isCurrent, true);

  const result = await db
    .select({
      competitionSeason: competitionSeasons,
      season: seasons,
    })
    .from(competitionSeasons)
    .innerJoin(seasons, eq(seasons.id, competitionSeasons.seasonId))
    .where(
      and(eq(competitionSeasons.competitionId, comp.id), seasonFilter)
    )
    .limit(1);

  return result[0] ? { ...result[0], competition: comp } : null;
}

/**
 * Get all seasons for a competition.
 */
export async function getAllSeasons(competitionId: string) {
  return db
    .select({
      competitionSeason: competitionSeasons,
      season: seasons,
    })
    .from(competitionSeasons)
    .innerJoin(seasons, eq(seasons.id, competitionSeasons.seasonId))
    .where(eq(competitionSeasons.competitionId, competitionId))
    .orderBy(desc(seasons.startDate));
}

/**
 * Get historical standings for a competition-season by slug and season label.
 */
export async function getHistoricalStandings(
  competitionSlug: string,
  seasonLabel: string
) {
  const comp = await getCompetitionBySlug(competitionSlug);
  if (!comp) return null;

  // Convert URL-friendly format (2024-25) to DB format (2024/25)
  const dbSeasonLabel = seasonLabel.replace("-", "/");

  const result = await db
    .select({
      competitionSeason: competitionSeasons,
      season: seasons,
    })
    .from(competitionSeasons)
    .innerJoin(seasons, eq(seasons.id, competitionSeasons.seasonId))
    .where(
      and(
        eq(competitionSeasons.competitionId, comp.id),
        eq(seasons.label, dbSeasonLabel)
      )
    )
    .limit(1);

  if (!result[0]) return null;

  const standingsData = await getStandings(result[0].competitionSeason.id);
  const topScorers = await getTopScorers(result[0].competitionSeason.id, 10);

  return {
    competition: comp,
    competitionSeason: result[0].competitionSeason,
    season: result[0].season,
    standings: standingsData,
    topScorers,
  };
}
