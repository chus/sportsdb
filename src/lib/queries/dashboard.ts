import { db } from "@/lib/db";
import {
  userLeaguePreferences,
  competitions,
  competitionSeasons,
  seasons,
  matches,
  standings,
  teams,
  articles,
} from "@/lib/db/schema";
import { eq, and, desc, asc, gt, lt, inArray } from "drizzle-orm";

/**
 * Get all dashboard data for an authenticated user in one call.
 */
export async function getDashboardData(userId: string) {
  const [followedLeagues, latestArticles] = await Promise.all([
    getFollowedLeagues(userId),
    getLatestArticles(),
  ]);

  // Only fetch fixtures and standings if the user follows leagues
  const competitionIds = followedLeagues.map((l) => l.competition.id);

  const [upcomingFixtures, leagueStandings] = await Promise.all([
    competitionIds.length > 0
      ? getUpcomingFixturesForLeagues(competitionIds)
      : Promise.resolve([]),
    competitionIds.length > 0
      ? getStandingsForLeagues(competitionIds)
      : Promise.resolve([]),
  ]);

  return {
    followedLeagues,
    upcomingFixtures,
    leagueStandings,
    latestArticles,
  };
}

/**
 * Get user's followed leagues with competition details.
 */
async function getFollowedLeagues(userId: string) {
  return db
    .select({
      preference: userLeaguePreferences,
      competition: competitions,
    })
    .from(userLeaguePreferences)
    .innerJoin(
      competitions,
      eq(competitions.id, userLeaguePreferences.competitionId)
    )
    .where(eq(userLeaguePreferences.userId, userId))
    .orderBy(asc(userLeaguePreferences.displayOrder));
}

/**
 * Get upcoming fixtures (next 7 days) for a set of competitions.
 */
async function getUpcomingFixturesForLeagues(competitionIds: string[]) {
  const now = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  // Get current competition-season IDs for the followed competitions
  const compSeasons = await db
    .select({
      id: competitionSeasons.id,
      competitionId: competitionSeasons.competitionId,
    })
    .from(competitionSeasons)
    .innerJoin(seasons, eq(seasons.id, competitionSeasons.seasonId))
    .where(
      and(
        inArray(competitionSeasons.competitionId, competitionIds),
        eq(seasons.isCurrent, true)
      )
    );

  if (compSeasons.length === 0) return [];

  const compSeasonIds = compSeasons.map((cs) => cs.id);

  const result = await db
    .select({
      match: matches,
      homeTeam: teams,
      competition: competitions,
    })
    .from(matches)
    .innerJoin(teams, eq(teams.id, matches.homeTeamId))
    .innerJoin(
      competitionSeasons,
      eq(competitionSeasons.id, matches.competitionSeasonId)
    )
    .innerJoin(
      competitions,
      eq(competitions.id, competitionSeasons.competitionId)
    )
    .where(
      and(
        inArray(matches.competitionSeasonId, compSeasonIds),
        eq(matches.status, "scheduled"),
        gt(matches.scheduledAt, now),
        lt(matches.scheduledAt, nextWeek)
      )
    )
    .orderBy(asc(matches.scheduledAt))
    .limit(20);

  // Get away teams
  const awayTeamIds = result.map((r) => r.match.awayTeamId);
  const awayTeamsResult =
    awayTeamIds.length > 0
      ? await db.select().from(teams).where(inArray(teams.id, awayTeamIds))
      : [];

  const awayTeamMap = new Map(awayTeamsResult.map((t) => [t.id, t]));

  return result.map((r) => ({
    ...r.match,
    homeTeam: r.homeTeam,
    awayTeam: awayTeamMap.get(r.match.awayTeamId) || null,
    competition: r.competition,
  }));
}

/**
 * Get current standings for followed leagues (top 5 per league).
 */
async function getStandingsForLeagues(competitionIds: string[]) {
  // Get current competition-season IDs
  const compSeasons = await db
    .select({
      id: competitionSeasons.id,
      competitionId: competitionSeasons.competitionId,
      competition: competitions,
    })
    .from(competitionSeasons)
    .innerJoin(seasons, eq(seasons.id, competitionSeasons.seasonId))
    .innerJoin(
      competitions,
      eq(competitions.id, competitionSeasons.competitionId)
    )
    .where(
      and(
        inArray(competitionSeasons.competitionId, competitionIds),
        eq(seasons.isCurrent, true)
      )
    );

  if (compSeasons.length === 0) return [];

  // Get standings for each competition-season (top 5)
  const allStandings = await Promise.all(
    compSeasons.map(async (cs) => {
      const rows = await db
        .select({
          standing: standings,
          team: teams,
        })
        .from(standings)
        .innerJoin(teams, eq(teams.id, standings.teamId))
        .where(eq(standings.competitionSeasonId, cs.id))
        .orderBy(asc(standings.position))
        .limit(5);

      return {
        competition: cs.competition,
        competitionSeasonId: cs.id,
        standings: rows,
      };
    })
  );

  return allStandings;
}

/**
 * Get latest published articles.
 */
async function getLatestArticles(limit = 5) {
  return db
    .select({
      id: articles.id,
      slug: articles.slug,
      title: articles.title,
      excerpt: articles.excerpt,
      type: articles.type,
      imageUrl: articles.imageUrl,
      publishedAt: articles.publishedAt,
    })
    .from(articles)
    .where(eq(articles.status, "published"))
    .orderBy(desc(articles.publishedAt))
    .limit(limit);
}
