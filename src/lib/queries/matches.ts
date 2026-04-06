import { db } from "@/lib/db";
import {
  matches,
  matchEvents,
  matchLineups,
  teams,
  players,
  venues,
  competitions,
  competitionSeasons,
  seasons,
} from "@/lib/db/schema";
import { eq, inArray, desc, and, or, asc, gt, sql } from "drizzle-orm";

/**
 * Get a match by ID with teams.
 */
export async function getMatch(matchId: string) {
  const result = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!result[0]) return null;

  const match = result[0];
  const [homeTeam] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, match.homeTeamId));
  const [awayTeam] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, match.awayTeamId));

  return { ...match, homeTeam, awayTeam };
}

/**
 * Internal helper: hydrate a match row with related teams, venue, competition, season.
 */
async function hydrateMatch(match: typeof matches.$inferSelect) {
  const [homeTeamResult, awayTeamResult, venueResult, compSeasonResult] =
    await Promise.all([
      db.select().from(teams).where(eq(teams.id, match.homeTeamId)),
      db.select().from(teams).where(eq(teams.id, match.awayTeamId)),
      match.venueId
        ? db.select().from(venues).where(eq(venues.id, match.venueId))
        : Promise.resolve([]),
      db
        .select({
          competition: competitions,
          season: seasons,
        })
        .from(competitionSeasons)
        .innerJoin(
          competitions,
          eq(competitions.id, competitionSeasons.competitionId)
        )
        .innerJoin(seasons, eq(seasons.id, competitionSeasons.seasonId))
        .where(eq(competitionSeasons.id, match.competitionSeasonId)),
    ]);

  return {
    ...match,
    homeTeam: homeTeamResult[0] || null,
    awayTeam: awayTeamResult[0] || null,
    venue: venueResult[0] || null,
    competition: compSeasonResult[0]?.competition || null,
    season: compSeasonResult[0]?.season || null,
  };
}

/**
 * Get a match with full details: teams, venue, competition, and season.
 *
 * Used by the redirect path (middleware-triggered API and legacy callers).
 */
export async function getMatchWithDetails(matchId: string) {
  const result = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!result[0]) return null;
  return hydrateMatch(result[0]);
}

/**
 * Get a match with full details by slug. Used by the public match page.
 */
export async function getMatchWithDetailsBySlug(slug: string) {
  const result = await db
    .select()
    .from(matches)
    .where(eq(matches.slug, slug))
    .limit(1);

  if (!result[0]) return null;
  return hydrateMatch(result[0]);
}

/**
 * Get events for a match with player details.
 */
export async function getMatchEventsWithPlayers(matchId: string) {
  const events = await db
    .select()
    .from(matchEvents)
    .where(eq(matchEvents.matchId, matchId))
    .orderBy(matchEvents.minute);

  // Get all unique player IDs from events
  const playerIds = new Set<string>();
  events.forEach((e) => {
    if (e.playerId) playerIds.add(e.playerId);
    if (e.secondaryPlayerId) playerIds.add(e.secondaryPlayerId);
  });

  // Fetch players
  const playerList =
    playerIds.size > 0
      ? await db
          .select()
          .from(players)
          .where(inArray(players.id, Array.from(playerIds)))
      : [];

  const playerMap = new Map(playerList.map((p) => [p.id, p]));

  // Attach player details to events
  return events.map((e) => ({
    ...e,
    player: e.playerId ? playerMap.get(e.playerId) || null : null,
    secondaryPlayer: e.secondaryPlayerId
      ? playerMap.get(e.secondaryPlayerId) || null
      : null,
  }));
}

/**
 * Get lineups for a match grouped by team.
 */
export async function getMatchLineupsGrouped(matchId: string) {
  const lineups = await db
    .select({
      lineup: matchLineups,
      player: players,
    })
    .from(matchLineups)
    .innerJoin(players, eq(players.id, matchLineups.playerId))
    .where(eq(matchLineups.matchId, matchId));

  // Group by team
  const byTeam = new Map<
    string,
    {
      starters: typeof lineups;
      substitutes: typeof lineups;
    }
  >();

  lineups.forEach((l) => {
    const teamId = l.lineup.teamId;
    if (!byTeam.has(teamId)) {
      byTeam.set(teamId, { starters: [], substitutes: [] });
    }
    const group = byTeam.get(teamId)!;
    if (l.lineup.isStarter) {
      group.starters.push(l);
    } else {
      group.substitutes.push(l);
    }
  });

  return byTeam;
}

/**
 * Get events for a match.
 */
export async function getMatchEvents(matchId: string) {
  return db
    .select()
    .from(matchEvents)
    .where(eq(matchEvents.matchId, matchId))
    .orderBy(matchEvents.minute);
}

/**
 * Get lineups for a match.
 */
export async function getMatchLineups(matchId: string) {
  return db
    .select({
      lineup: matchLineups,
      player: players,
    })
    .from(matchLineups)
    .innerJoin(players, eq(players.id, matchLineups.playerId))
    .where(eq(matchLineups.matchId, matchId));
}

/**
 * Get live matches.
 */
export async function getLiveMatches() {
  return db
    .select()
    .from(matches)
    .where(inArray(matches.status, ["live", "half_time"]))
    .orderBy(matches.scheduledAt);
}

/**
 * Get recent finished matches.
 */
export async function getRecentMatches(limit = 10) {
  return db
    .select()
    .from(matches)
    .where(eq(matches.status, "finished"))
    .orderBy(desc(matches.scheduledAt))
    .limit(limit);
}

/**
 * Get upcoming scheduled matches with team details.
 */
export async function getUpcomingMatches(limit = 10) {
  const now = new Date();

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
        eq(matches.status, "scheduled"),
        // scheduledAt > now
      )
    )
    .orderBy(matches.scheduledAt)
    .limit(limit * 2); // Fetch more to filter

  // Get away teams
  const awayTeamIds = result.map((r) => r.match.awayTeamId);
  const awayTeamsResult =
    awayTeamIds.length > 0
      ? await db.select().from(teams).where(inArray(teams.id, awayTeamIds))
      : [];

  const awayTeamMap = new Map(awayTeamsResult.map((t) => [t.id, t]));

  // Combine and filter future matches
  return result
    .filter((r) => new Date(r.match.scheduledAt) > now)
    .slice(0, limit)
    .map((r) => ({
      ...r.match,
      homeTeam: r.homeTeam,
      awayTeam: awayTeamMap.get(r.match.awayTeamId) || null,
      competition: r.competition,
    }));
}

/**
 * Get fixtures for a competition season.
 */
export async function getCompetitionFixtures(
  competitionSeasonId: string,
  options?: { matchday?: number; limit?: number }
) {
  const { matchday, limit = 50 } = options || {};

  let query = db
    .select({
      match: matches,
      homeTeam: teams,
    })
    .from(matches)
    .innerJoin(teams, eq(teams.id, matches.homeTeamId))
    .where(
      matchday
        ? and(
            eq(matches.competitionSeasonId, competitionSeasonId),
            eq(matches.matchday, matchday)
          )
        : eq(matches.competitionSeasonId, competitionSeasonId)
    )
    .orderBy(matches.scheduledAt)
    .limit(limit);

  const result = await query;

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
  }));
}

/**
 * Get matchdays for a competition season.
 */
export async function getCompetitionMatchdays(competitionSeasonId: string) {
  const result = await db
    .select({ matchday: matches.matchday })
    .from(matches)
    .where(eq(matches.competitionSeasonId, competitionSeasonId))
    .groupBy(matches.matchday)
    .orderBy(matches.matchday);

  return result
    .filter((r) => r.matchday !== null)
    .map((r) => r.matchday as number);
}

/**
 * Get recent and upcoming matches for a team.
 */
export async function getTeamMatches(teamId: string, limit = 10) {
  const now = new Date();

  // Get recent finished matches
  const recentResult = await db
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
        eq(matches.status, "finished"),
        or(eq(matches.homeTeamId, teamId), eq(matches.awayTeamId, teamId))
      )
    )
    .orderBy(desc(matches.scheduledAt))
    .limit(limit);

  // Get upcoming scheduled matches
  const upcomingResult = await db
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
        eq(matches.status, "scheduled"),
        or(eq(matches.homeTeamId, teamId), eq(matches.awayTeamId, teamId)),
        gt(matches.scheduledAt, now)
      )
    )
    .orderBy(asc(matches.scheduledAt))
    .limit(limit);

  // Get all away teams needed
  const allMatches = [...recentResult, ...upcomingResult];
  const awayTeamIds = allMatches.map((r) => r.match.awayTeamId);
  const awayTeamsResult =
    awayTeamIds.length > 0
      ? await db.select().from(teams).where(inArray(teams.id, awayTeamIds))
      : [];

  const awayTeamMap = new Map(awayTeamsResult.map((t) => [t.id, t]));

  const mapMatch = (r: (typeof allMatches)[0]) => ({
    ...r.match,
    homeTeam: r.homeTeam,
    awayTeam: awayTeamMap.get(r.match.awayTeamId) || null,
    competition: r.competition,
  });

  return {
    recent: recentResult.map(mapMatch),
    upcoming: upcomingResult.map(mapMatch),
  };
}

// ============================================================
// MATCHES HUB QUERIES
// ============================================================

export interface HubMatch {
  id: string;
  slug: string | null;
  scheduledAt: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  minute: number | null;
  matchday: number | null;
  homeTeamName: string;
  homeTeamSlug: string;
  homeTeamLogoUrl: string | null;
  awayTeamName: string;
  awayTeamSlug: string;
  awayTeamLogoUrl: string | null;
  competitionId: string;
  competitionName: string;
  competitionSlug: string;
  competitionLogoUrl: string | null;
}

/**
 * Get all matches in a date range with team and competition info.
 * Uses raw SQL for efficient single-query join.
 */
export async function getMatchesForDateRange(
  startDate: Date,
  endDate: Date
): Promise<HubMatch[]> {
  const result = await db.execute<{
    id: string;
    slug: string | null;
    scheduled_at: string;
    status: string;
    home_score: number | null;
    away_score: number | null;
    minute: number | null;
    matchday: number | null;
    home_team_name: string;
    home_team_slug: string;
    home_team_logo_url: string | null;
    away_team_name: string;
    away_team_slug: string;
    away_team_logo_url: string | null;
    competition_id: string;
    competition_name: string;
    competition_slug: string;
    competition_logo_url: string | null;
  }>(sql`
    SELECT
      m.id,
      m.slug,
      m.scheduled_at,
      m.status,
      m.home_score,
      m.away_score,
      m.minute,
      m.matchday,
      ht.name as home_team_name,
      ht.slug as home_team_slug,
      ht.logo_url as home_team_logo_url,
      at.name as away_team_name,
      at.slug as away_team_slug,
      at.logo_url as away_team_logo_url,
      c.id as competition_id,
      c.name as competition_name,
      c.slug as competition_slug,
      c.logo_url as competition_logo_url
    FROM matches m
    JOIN teams ht ON ht.id = m.home_team_id
    JOIN teams at ON at.id = m.away_team_id
    JOIN competition_seasons cs ON cs.id = m.competition_season_id
    JOIN competitions c ON c.id = cs.competition_id
    WHERE m.scheduled_at >= ${startDate.toISOString()}
      AND m.scheduled_at < ${endDate.toISOString()}
    ORDER BY m.scheduled_at ASC
  `);

  return result.rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    scheduledAt: r.scheduled_at,
    status: r.status,
    homeScore: r.home_score,
    awayScore: r.away_score,
    minute: r.minute,
    matchday: r.matchday,
    homeTeamName: r.home_team_name,
    homeTeamSlug: r.home_team_slug,
    homeTeamLogoUrl: r.home_team_logo_url,
    awayTeamName: r.away_team_name,
    awayTeamSlug: r.away_team_slug,
    awayTeamLogoUrl: r.away_team_logo_url,
    competitionId: r.competition_id,
    competitionName: r.competition_name,
    competitionSlug: r.competition_slug,
    competitionLogoUrl: r.competition_logo_url,
  }));
}

/**
 * Get matchday summary stats for a date (total matches, goals, red cards, biggest win).
 */
export async function getMatchDaySummary(startOfDay: Date, endOfDay: Date) {
  const result = await db.execute<{
    total_matches: number;
    finished_matches: number;
    total_goals: number;
    red_cards: number;
    biggest_diff: number | null;
    biggest_home: string | null;
    biggest_away: string | null;
    biggest_home_score: number | null;
    biggest_away_score: number | null;
    biggest_match_id: string | null;
    biggest_match_slug: string | null;
  }>(sql`
    SELECT
      count(*)::int as total_matches,
      count(*) FILTER (WHERE m.status = 'finished')::int as finished_matches,
      coalesce(sum(m.home_score + m.away_score) FILTER (WHERE m.status = 'finished'), 0)::int as total_goals,
      coalesce((
        SELECT count(*)::int FROM match_events me
        JOIN matches mx ON mx.id = me.match_id
        WHERE mx.scheduled_at >= ${startOfDay.toISOString()}
          AND mx.scheduled_at < ${endOfDay.toISOString()}
          AND me.type = 'red_card'
      ), 0)::int as red_cards,
      (
        SELECT abs(mx.home_score - mx.away_score)
        FROM matches mx
        WHERE mx.scheduled_at >= ${startOfDay.toISOString()}
          AND mx.scheduled_at < ${endOfDay.toISOString()}
          AND mx.status = 'finished'
        ORDER BY abs(mx.home_score - mx.away_score) DESC
        LIMIT 1
      ) as biggest_diff,
      (
        SELECT ht.name FROM matches mx
        JOIN teams ht ON ht.id = mx.home_team_id
        WHERE mx.scheduled_at >= ${startOfDay.toISOString()}
          AND mx.scheduled_at < ${endOfDay.toISOString()}
          AND mx.status = 'finished'
        ORDER BY abs(mx.home_score - mx.away_score) DESC
        LIMIT 1
      ) as biggest_home,
      (
        SELECT at.name FROM matches mx
        JOIN teams at ON at.id = mx.away_team_id
        WHERE mx.scheduled_at >= ${startOfDay.toISOString()}
          AND mx.scheduled_at < ${endOfDay.toISOString()}
          AND mx.status = 'finished'
        ORDER BY abs(mx.home_score - mx.away_score) DESC
        LIMIT 1
      ) as biggest_away,
      (
        SELECT mx.home_score FROM matches mx
        WHERE mx.scheduled_at >= ${startOfDay.toISOString()}
          AND mx.scheduled_at < ${endOfDay.toISOString()}
          AND mx.status = 'finished'
        ORDER BY abs(mx.home_score - mx.away_score) DESC
        LIMIT 1
      ) as biggest_home_score,
      (
        SELECT mx.away_score FROM matches mx
        WHERE mx.scheduled_at >= ${startOfDay.toISOString()}
          AND mx.scheduled_at < ${endOfDay.toISOString()}
          AND mx.status = 'finished'
        ORDER BY abs(mx.home_score - mx.away_score) DESC
        LIMIT 1
      ) as biggest_away_score,
      (
        SELECT mx.id FROM matches mx
        WHERE mx.scheduled_at >= ${startOfDay.toISOString()}
          AND mx.scheduled_at < ${endOfDay.toISOString()}
          AND mx.status = 'finished'
        ORDER BY abs(mx.home_score - mx.away_score) DESC
        LIMIT 1
      ) as biggest_match_id,
      (
        SELECT mx.slug FROM matches mx
        WHERE mx.scheduled_at >= ${startOfDay.toISOString()}
          AND mx.scheduled_at < ${endOfDay.toISOString()}
          AND mx.status = 'finished'
        ORDER BY abs(mx.home_score - mx.away_score) DESC
        LIMIT 1
      ) as biggest_match_slug
    FROM matches m
    WHERE m.scheduled_at >= ${startOfDay.toISOString()}
      AND m.scheduled_at < ${endOfDay.toISOString()}
  `);

  const r = result.rows[0];
  return {
    totalMatches: r?.total_matches ?? 0,
    finishedMatches: r?.finished_matches ?? 0,
    totalGoals: r?.total_goals ?? 0,
    redCards: r?.red_cards ?? 0,
    biggestWin: r?.biggest_diff
      ? {
          matchId: r.biggest_match_id!,
          matchSlug: r.biggest_match_slug ?? null,
          homeTeam: r.biggest_home!,
          awayTeam: r.biggest_away!,
          homeScore: r.biggest_home_score!,
          awayScore: r.biggest_away_score!,
        }
      : null,
  };
}

/**
 * Get competitions that have matches in a date range (for filter pills).
 */
export async function getCompetitionsWithMatches(
  startDate: Date,
  endDate: Date
) {
  const result = await db.execute<{
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    match_count: number;
  }>(sql`
    SELECT
      c.id,
      c.name,
      c.slug,
      c.logo_url,
      count(*)::int as match_count
    FROM matches m
    JOIN competition_seasons cs ON cs.id = m.competition_season_id
    JOIN competitions c ON c.id = cs.competition_id
    WHERE m.scheduled_at >= ${startDate.toISOString()}
      AND m.scheduled_at < ${endDate.toISOString()}
    GROUP BY c.id, c.name, c.slug, c.logo_url
    ORDER BY match_count DESC
  `);

  return result.rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    logoUrl: r.logo_url,
    matchCount: r.match_count,
  }));
}

/**
 * Get recent finished matches with team and competition info.
 */
export async function getRecentFinishedMatches(
  limit = 20
): Promise<HubMatch[]> {
  const result = await db.execute<{
    id: string;
    slug: string | null;
    scheduled_at: string;
    status: string;
    home_score: number | null;
    away_score: number | null;
    minute: number | null;
    matchday: number | null;
    home_team_name: string;
    home_team_slug: string;
    home_team_logo_url: string | null;
    away_team_name: string;
    away_team_slug: string;
    away_team_logo_url: string | null;
    competition_id: string;
    competition_name: string;
    competition_slug: string;
    competition_logo_url: string | null;
  }>(sql`
    SELECT
      m.id,
      m.slug,
      m.scheduled_at,
      m.status,
      m.home_score,
      m.away_score,
      m.minute,
      m.matchday,
      ht.name as home_team_name,
      ht.slug as home_team_slug,
      ht.logo_url as home_team_logo_url,
      at.name as away_team_name,
      at.slug as away_team_slug,
      at.logo_url as away_team_logo_url,
      c.id as competition_id,
      c.name as competition_name,
      c.slug as competition_slug,
      c.logo_url as competition_logo_url
    FROM matches m
    JOIN teams ht ON ht.id = m.home_team_id
    JOIN teams at ON at.id = m.away_team_id
    JOIN competition_seasons cs ON cs.id = m.competition_season_id
    JOIN competitions c ON c.id = cs.competition_id
    WHERE m.status = 'finished'
    ORDER BY m.scheduled_at DESC
    LIMIT ${limit}
  `);

  return result.rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    scheduledAt: r.scheduled_at,
    status: r.status,
    homeScore: r.home_score,
    awayScore: r.away_score,
    minute: r.minute,
    matchday: r.matchday,
    homeTeamName: r.home_team_name,
    homeTeamSlug: r.home_team_slug,
    homeTeamLogoUrl: r.home_team_logo_url,
    awayTeamName: r.away_team_name,
    awayTeamSlug: r.away_team_slug,
    awayTeamLogoUrl: r.away_team_logo_url,
    competitionId: r.competition_id,
    competitionName: r.competition_name,
    competitionSlug: r.competition_slug,
    competitionLogoUrl: r.competition_logo_url,
  }));
}
