import { cache } from "react";
import { db } from "@/lib/db";
import { teams, standings, competitionSeasons, competitions, seasons, playerTeamHistory, players, playerSeasonStats, transfers } from "@/lib/db/schema";
import { eq, and, isNull, lte, or, gte, isNotNull, desc, ne, sql } from "drizzle-orm";

/**
 * Get a team by their URL slug.
 *
 * Wrapped in React cache() so generateMetadata + Page share a single
 * lookup per request.
 */
export const getTeamBySlug = cache(async (slug: string) => {
  const result = await db
    .select()
    .from(teams)
    .where(eq(teams.slug, slug))
    .limit(1);

  return result[0] ?? null;
});

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
      competitionName: competitions.name,
      competitionSlug: competitions.slug,
    })
    .from(standings)
    .innerJoin(
      competitionSeasons,
      eq(competitionSeasons.id, standings.competitionSeasonId)
    )
    .innerJoin(seasons, eq(seasons.id, competitionSeasons.seasonId))
    .innerJoin(competitions, eq(competitions.id, competitionSeasons.competitionId))
    .where(and(eq(standings.teamId, teamId), seasonFilter));
}

/**
 * Get current squad for a team (players with no valid_to).
 * For historical view, pass season dates to filter.
 */
export async function getSquad(teamId: string, seasonId?: string) {
  if (!seasonId) {
    // Current squad - exclude Unknown position (bad data)
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
          isNull(playerTeamHistory.validTo),
          ne(players.position, "Unknown")
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
        ),
        ne(players.position, "Unknown")
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
        isNotNull(playerTeamHistory.validTo),
        ne(players.position, "Unknown")
      )
    )
    .orderBy(desc(playerTeamHistory.validTo))
    .limit(limit);
}

export interface TeamComparison {
  teamA: typeof teams.$inferSelect;
  teamB: typeof teams.$inferSelect;
  standingA: { standing: typeof standings.$inferSelect; competitionName: string } | null;
  standingB: { standing: typeof standings.$inferSelect; competitionName: string } | null;
  h2h: { slug: string | null; scheduledAt: Date; homeTeamId: string; awayTeamId: string; homeScore: number; awayScore: number }[];
}

/**
 * Head-to-head comparison of two teams: current standings (with form) + their
 * most recent meetings. The data behind the team-vs-team compare pages.
 */
export async function getTeamComparison(slugA: string, slugB: string): Promise<TeamComparison | null> {
  const [a, b] = await Promise.all([getTeamBySlug(slugA), getTeamBySlug(slugB)]);
  if (!a || !b || a.id === b.id) return null;

  const [sa, sb, h2hRes] = await Promise.all([
    getTeamStats(a.id),
    getTeamStats(b.id),
    db.execute(sql`
      SELECT m.slug, m.scheduled_at AS "scheduledAt", m.home_team_id AS "homeTeamId",
             m.away_team_id AS "awayTeamId", m.home_score AS "homeScore", m.away_score AS "awayScore"
      FROM matches m
      WHERE m.status = 'finished' AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
        AND ((m.home_team_id = ${a.id} AND m.away_team_id = ${b.id})
          OR (m.home_team_id = ${b.id} AND m.away_team_id = ${a.id}))
      ORDER BY m.scheduled_at DESC
      LIMIT 10
    `),
  ]);
  const pick = (rows: Awaited<ReturnType<typeof getTeamStats>>) =>
    rows[0] ? { standing: rows[0].standing, competitionName: rows[0].competitionName } : null;
  const h2h = ((h2hRes as unknown as { rows?: TeamComparison["h2h"] }).rows ?? (h2hRes as unknown as TeamComparison["h2h"]));

  return { teamA: a, teamB: b, standingA: pick(sa), standingB: pick(sb), h2h };
}

/**
 * Get the top scorer for a team in a given competition season.
 */
export async function getTeamTopScorer(teamId: string, competitionSeasonId: string) {
  const [result] = await db
    .select({
      player: players,
      goals: playerSeasonStats.goals,
      assists: playerSeasonStats.assists,
    })
    .from(playerSeasonStats)
    .innerJoin(players, eq(players.id, playerSeasonStats.playerId))
    .where(
      and(
        eq(playerSeasonStats.teamId, teamId),
        eq(playerSeasonStats.competitionSeasonId, competitionSeasonId)
      )
    )
    .orderBy(desc(playerSeasonStats.goals))
    .limit(1);

  return result ?? null;
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

/**
 * Get recent transfers for a team (incoming and outgoing).
 */
export async function getTeamTransfers(teamId: string, limit = 10) {
  return db
    .select({
      id: transfers.id,
      transferDate: transfers.transferDate,
      transferFeeEur: transfers.transferFeeEur,
      season: transfers.season,
      fromTeamId: transfers.fromTeamId,
      toTeamId: transfers.toTeamId,
      player: {
        name: players.name,
        slug: players.slug,
        position: players.position,
      },
      fromTeam: {
        name: sql<string | null>`ft.name`,
        slug: sql<string | null>`ft.slug`,
        logoUrl: sql<string | null>`ft.logo_url`,
      },
      toTeam: {
        name: sql<string>`tt.name`,
        slug: sql<string>`tt.slug`,
        logoUrl: sql<string | null>`tt.logo_url`,
      },
    })
    .from(transfers)
    .innerJoin(players, eq(players.id, transfers.playerId))
    .leftJoin(sql`teams ft`, sql`ft.id = ${transfers.fromTeamId}`)
    .innerJoin(sql`teams tt`, sql`tt.id = ${transfers.toTeamId}`)
    .where(or(eq(transfers.toTeamId, teamId), eq(transfers.fromTeamId, teamId)))
    .orderBy(desc(transfers.transferDate))
    .limit(limit);
}
