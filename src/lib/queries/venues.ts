import { db } from "@/lib/db";
import {
  venues,
  teams,
  teamVenueHistory,
  matches,
  competitionSeasons,
  competitions,
  seasons,
} from "@/lib/db/schema";
import { eq, and, isNull, or, desc, gte, asc } from "drizzle-orm";

/**
 * Get a venue by their URL slug.
 */
export async function getVenueBySlug(slug: string) {
  const result = await db
    .select()
    .from(venues)
    .where(eq(venues.slug, slug))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get teams that play at this venue (current and historical).
 */
export async function getVenueTeams(venueId: string) {
  const results = await db
    .select({
      team: teams,
      validFrom: teamVenueHistory.validFrom,
      validTo: teamVenueHistory.validTo,
    })
    .from(teamVenueHistory)
    .innerJoin(teams, eq(teams.id, teamVenueHistory.teamId))
    .where(eq(teamVenueHistory.venueId, venueId))
    .orderBy(desc(teamVenueHistory.validFrom));

  // Separate current vs historical
  const current = results.filter((r) => r.validTo === null);
  const historical = results.filter((r) => r.validTo !== null);

  return { current, historical };
}

/**
 * Get matches played at this venue (recent and upcoming).
 */
export async function getVenueMatches(venueId: string, limit = 10) {
  // Get recent finished matches
  const recent = await db
    .select({
      match: matches,
      homeTeam: teams,
      awayTeam: {
        id: teams.id,
        name: teams.name,
        shortName: teams.shortName,
        slug: teams.slug,
        logoUrl: teams.logoUrl,
      },
      competition: competitions,
    })
    .from(matches)
    .innerJoin(teams, eq(teams.id, matches.homeTeamId))
    .innerJoin(competitionSeasons, eq(competitionSeasons.id, matches.competitionSeasonId))
    .innerJoin(competitions, eq(competitions.id, competitionSeasons.competitionId))
    .where(and(eq(matches.venueId, venueId), eq(matches.status, "finished")))
    .orderBy(desc(matches.scheduledAt))
    .limit(limit);

  // Fetch away teams separately (Drizzle doesn't support aliased self-joins well)
  const recentWithAwayTeams = await Promise.all(
    recent.map(async (r) => {
      const [awayTeam] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, r.match.awayTeamId));
      return { ...r, awayTeam };
    })
  );

  // Get upcoming matches
  const upcoming = await db
    .select({
      match: matches,
      homeTeam: teams,
      competition: competitions,
    })
    .from(matches)
    .innerJoin(teams, eq(teams.id, matches.homeTeamId))
    .innerJoin(competitionSeasons, eq(competitionSeasons.id, matches.competitionSeasonId))
    .innerJoin(competitions, eq(competitions.id, competitionSeasons.competitionId))
    .where(and(eq(matches.venueId, venueId), eq(matches.status, "scheduled")))
    .orderBy(asc(matches.scheduledAt))
    .limit(limit);

  // Fetch away teams for upcoming matches
  const upcomingWithAwayTeams = await Promise.all(
    upcoming.map(async (r) => {
      const [awayTeam] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, r.match.awayTeamId));
      return { ...r, awayTeam };
    })
  );

  return { recent: recentWithAwayTeams, upcoming: upcomingWithAwayTeams };
}

/**
 * Get all venues.
 */
export async function getAllVenues() {
  return db.select().from(venues).orderBy(venues.name);
}
