import { db } from "@/lib/db";
import { matches, matchEvents, matchLineups, teams, players } from "@/lib/db/schema";
import { eq, inArray, desc } from "drizzle-orm";

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
