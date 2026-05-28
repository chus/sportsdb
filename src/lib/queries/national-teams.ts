import { db } from "@/lib/db";
import {
  teams,
  nationalTeamTournaments,
  tournaments,
  players,
} from "@/lib/db/schema";
import { eq, and, or, desc, asc, sql } from "drizzle-orm";

/**
 * Tournament history for a national team, grouped by tournament and ordered
 * chronologically. Includes all stored top-4 finishes plus any other recorded
 * appearances.
 */
export async function getTournamentHistory(teamId: string) {
  return db
    .select({
      tournamentKey: tournaments.key,
      tournamentName: tournaments.name,
      tournamentShortName: tournaments.shortName,
      region: tournaments.region,
      governingBody: tournaments.governingBody,
      year: nationalTeamTournaments.year,
      hostCountry: nationalTeamTournaments.hostCountry,
      stageReached: nationalTeamTournaments.stageReached,
      finishingPosition: nationalTeamTournaments.finishingPosition,
    })
    .from(nationalTeamTournaments)
    .innerJoin(
      tournaments,
      eq(tournaments.id, nationalTeamTournaments.tournamentId)
    )
    .where(eq(nationalTeamTournaments.teamId, teamId))
    .orderBy(asc(tournaments.name), desc(nationalTeamTournaments.year));
}

/**
 * Aggregated trophy counts per tournament for a national team — used for
 * the headline "3× World Cup, 16× Copa América" trophy strip.
 */
export interface TournamentTrophies {
  tournamentKey: string;
  tournamentName: string;
  tournamentShortName: string;
  champions: number;
  runnersUp: number;
  thirdPlace: number;
  fourthPlace: number;
}

export async function getTrophySummary(teamId: string): Promise<TournamentTrophies[]> {
  const rows = await db
    .select({
      tournamentKey: tournaments.key,
      tournamentName: tournaments.name,
      tournamentShortName: tournaments.shortName,
      foundedYear: tournaments.foundedYear,
      position: nationalTeamTournaments.finishingPosition,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(nationalTeamTournaments)
    .innerJoin(
      tournaments,
      eq(tournaments.id, nationalTeamTournaments.tournamentId)
    )
    .where(eq(nationalTeamTournaments.teamId, teamId))
    .groupBy(
      tournaments.key,
      tournaments.name,
      tournaments.shortName,
      tournaments.foundedYear,
      nationalTeamTournaments.finishingPosition
    );

  // Pivot rows into a per-tournament trophy summary.
  const byKey = new Map<string, TournamentTrophies>();
  for (const row of rows) {
    let entry = byKey.get(row.tournamentKey);
    if (!entry) {
      entry = {
        tournamentKey: row.tournamentKey,
        tournamentName: row.tournamentName,
        tournamentShortName: row.tournamentShortName ?? row.tournamentName,
        champions: 0,
        runnersUp: 0,
        thirdPlace: 0,
        fourthPlace: 0,
      };
      byKey.set(row.tournamentKey, entry);
    }
    if (row.position === 1) entry.champions = Number(row.count);
    else if (row.position === 2) entry.runnersUp = Number(row.count);
    else if (row.position === 3) entry.thirdPlace = Number(row.count);
    else if (row.position === 4) entry.fourthPlace = Number(row.count);
  }

  // Sort by FIFA hierarchy: World Cup first, then by champions count desc,
  // then alphabetically.
  return [...byKey.values()].sort((a, b) => {
    if (a.tournamentKey === "fifa-world-cup") return -1;
    if (b.tournamentKey === "fifa-world-cup") return 1;
    if (a.champions !== b.champions) return b.champions - a.champions;
    return a.tournamentName.localeCompare(b.tournamentName);
  });
}

/**
 * Top players whose nationality matches a country, ranked by popularity score.
 * Used as the "Squad" approximation on national-team pages since we don't
 * ingest official call-up lists.
 *
 * Filters out retired players unless `includeRetired` is true.
 */
export async function getTopPlayersByNationality(
  country: string,
  limit = 30,
  includeRetired = false
) {
  const statusFilter = includeRetired
    ? sql`true`
    : eq(players.status, "active");

  return db
    .select({
      id: players.id,
      name: players.name,
      knownAs: players.knownAs,
      slug: players.slug,
      position: players.position,
      dateOfBirth: players.dateOfBirth,
      nationality: players.nationality,
      secondNationality: players.secondNationality,
      imageUrl: players.imageUrl,
      popularityScore: players.popularityScore,
      marketValueEur: players.marketValueEur,
      isIndexable: players.isIndexable,
    })
    .from(players)
    .where(
      and(
        or(
          eq(players.nationality, country),
          eq(players.secondNationality, country)
        ),
        statusFilter
      )
    )
    .orderBy(
      desc(players.popularityScore),
      sql`${players.marketValueEur} desc nulls last`
    )
    .limit(limit);
}

/**
 * Lookup national teams by country names — used by the page template to
 * render flags/links for "Recent World Cup champions" type widgets.
 */
export async function getNationalTeamsByCountry(countries: string[]) {
  if (countries.length === 0) return [];
  return db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      country: teams.country,
      shortName: teams.shortName,
      logoUrl: teams.logoUrl,
    })
    .from(teams)
    .where(
      and(
        eq(teams.teamType, "national"),
        sql`${teams.country} = ANY(${countries})`
      )
    );
}
