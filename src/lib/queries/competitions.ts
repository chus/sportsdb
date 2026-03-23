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
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { matches } from "@/lib/db/schema";

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
 * If no season label provided, tries current season first, then falls back to most recent.
 */
export async function getCompetitionSeason(
  competitionSlug: string,
  seasonLabel?: string
) {
  const comp = await getCompetitionBySlug(competitionSlug);
  if (!comp) return null;

  // If specific season requested, get that one
  if (seasonLabel) {
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
          eq(seasons.label, seasonLabel.replace("-", "/"))
        )
      )
      .limit(1);

    return result[0] ? { ...result[0], competition: comp } : null;
  }

  // Otherwise, try current season first — prefer one that has actual data (standings/matches)
  const currentResults = await db
    .select({
      competitionSeason: competitionSeasons,
      season: seasons,
      matchCount: sql<number>`(
        SELECT count(*) FROM matches m
        WHERE m.competition_season_id = ${competitionSeasons.id}
      )`,
    })
    .from(competitionSeasons)
    .innerJoin(seasons, eq(seasons.id, competitionSeasons.seasonId))
    .where(
      and(eq(competitionSeasons.competitionId, comp.id), eq(seasons.isCurrent, true))
    )
    .orderBy(desc(seasons.startDate));

  // Pick the current season with the most data; fall back to any current season
  const withData = currentResults.find((r) => r.matchCount > 0);
  const currentPick = withData || currentResults[0];

  if (currentPick) {
    return { competitionSeason: currentPick.competitionSeason, season: currentPick.season, competition: comp };
  }

  // Fallback: get most recent season by start date
  const fallbackResult = await db
    .select({
      competitionSeason: competitionSeasons,
      season: seasons,
    })
    .from(competitionSeasons)
    .innerJoin(seasons, eq(seasons.id, competitionSeasons.seasonId))
    .where(eq(competitionSeasons.competitionId, comp.id))
    .orderBy(desc(seasons.startDate))
    .limit(1);

  return fallbackResult[0] ? { ...fallbackResult[0], competition: comp } : null;
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

/**
 * Get recent results and upcoming fixtures for a competition season.
 */
export async function getCompetitionRecentAndUpcoming(
  competitionSeasonId: string,
  recentLimit = 6,
  upcomingLimit = 3
) {
  const homeTeams = alias(teams, "homeTeam");
  const awayTeams = alias(teams, "awayTeam");

  const [recentResults, upcomingMatches] = await Promise.all([
    db
      .select({
        id: matches.id,
        scheduledAt: matches.scheduledAt,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
        status: matches.status,
        matchday: matches.matchday,
        homeTeam: {
          name: homeTeams.name,
          shortName: homeTeams.shortName,
          slug: homeTeams.slug,
          logoUrl: homeTeams.logoUrl,
        },
        awayTeam: {
          name: awayTeams.name,
          shortName: awayTeams.shortName,
          slug: awayTeams.slug,
          logoUrl: awayTeams.logoUrl,
        },
      })
      .from(matches)
      .innerJoin(homeTeams, eq(homeTeams.id, matches.homeTeamId))
      .innerJoin(awayTeams, eq(awayTeams.id, matches.awayTeamId))
      .where(
        and(
          eq(matches.competitionSeasonId, competitionSeasonId),
          eq(matches.status, "finished")
        )
      )
      .orderBy(desc(matches.scheduledAt))
      .limit(recentLimit),
    db
      .select({
        id: matches.id,
        scheduledAt: matches.scheduledAt,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
        status: matches.status,
        matchday: matches.matchday,
        homeTeam: {
          name: homeTeams.name,
          shortName: homeTeams.shortName,
          slug: homeTeams.slug,
          logoUrl: homeTeams.logoUrl,
        },
        awayTeam: {
          name: awayTeams.name,
          shortName: awayTeams.shortName,
          slug: awayTeams.slug,
          logoUrl: awayTeams.logoUrl,
        },
      })
      .from(matches)
      .innerJoin(homeTeams, eq(homeTeams.id, matches.homeTeamId))
      .innerJoin(awayTeams, eq(awayTeams.id, matches.awayTeamId))
      .where(
        and(
          eq(matches.competitionSeasonId, competitionSeasonId),
          eq(matches.status, "scheduled")
        )
      )
      .orderBy(asc(matches.scheduledAt))
      .limit(upcomingLimit),
  ]);

  return { recent: recentResults, upcoming: upcomingMatches };
}
