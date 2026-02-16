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
import { eq, inArray, desc, and, or } from "drizzle-orm";

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
 * Get a match with full details: teams, venue, competition, and season.
 */
export async function getMatchWithDetails(matchId: string) {
  const result = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!result[0]) return null;

  const match = result[0];

  // Fetch related data in parallel
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
