import { db } from "@/lib/db";
import {
  players,
  teams,
  matches,
  playerTeamHistory,
  competitionSeasons,
  teamSeasons,
  competitions,
  seasons,
} from "@/lib/db/schema";
import { eq, and, ne, or, isNull, sql, desc } from "drizzle-orm";

interface RelatedPlayer {
  id: string;
  name: string;
  slug: string;
  position: string;
  imageUrl: string | null;
  nationality: string | null;
}

interface RelatedTeam {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  country: string | null;
}

interface RelatedMatch {
  id: string;
  homeTeam: { name: string; slug: string; logoUrl: string | null };
  awayTeam: { name: string; slug: string; logoUrl: string | null };
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  scheduledAt: Date;
}

/**
 * Get related players for a given player.
 * Returns teammates (current or recent) and players in the same position/nationality.
 */
export async function getRelatedPlayers(
  playerId: string,
  limit = 6
): Promise<RelatedPlayer[]> {
  // Get current player info
  const player = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  if (player.length === 0) return [];

  const currentPlayer = player[0];

  // Get current team
  const currentTeamHistory = await db
    .select({ teamId: playerTeamHistory.teamId })
    .from(playerTeamHistory)
    .where(
      and(
        eq(playerTeamHistory.playerId, playerId),
        isNull(playerTeamHistory.validTo)
      )
    )
    .limit(1);

  const currentTeamId = currentTeamHistory[0]?.teamId;

  // Get teammates from current team
  let teammates: RelatedPlayer[] = [];
  if (currentTeamId) {
    const teammateResults = await db
      .select({
        id: players.id,
        name: players.name,
        slug: players.slug,
        position: players.position,
        imageUrl: players.imageUrl,
        nationality: players.nationality,
      })
      .from(players)
      .innerJoin(playerTeamHistory, eq(players.id, playerTeamHistory.playerId))
      .where(
        and(
          eq(playerTeamHistory.teamId, currentTeamId),
          isNull(playerTeamHistory.validTo),
          ne(players.id, playerId)
        )
      )
      .limit(limit);

    teammates = teammateResults;
  }

  // If we don't have enough teammates, add players with same position
  if (teammates.length < limit) {
    const remaining = limit - teammates.length;
    const teammateIds = teammates.map((t) => t.id);

    const samePosition = await db
      .select({
        id: players.id,
        name: players.name,
        slug: players.slug,
        position: players.position,
        imageUrl: players.imageUrl,
        nationality: players.nationality,
      })
      .from(players)
      .where(
        and(
          eq(players.position, currentPlayer.position),
          ne(players.id, playerId),
          sql`${players.id} NOT IN (${sql.raw(
            teammateIds.length > 0
              ? teammateIds.map((id) => `'${id}'`).join(",")
              : "''"
          )})`
        )
      )
      .limit(remaining);

    teammates = [...teammates, ...samePosition];
  }

  return teammates;
}

/**
 * Get related teams for a given team.
 * Returns teams in the same competition.
 */
export async function getRelatedTeams(
  teamId: string,
  limit = 6
): Promise<RelatedTeam[]> {
  // Find competitions this team is in
  const teamCompetitions = await db
    .select({ competitionSeasonId: teamSeasons.competitionSeasonId })
    .from(teamSeasons)
    .where(eq(teamSeasons.teamId, teamId));

  if (teamCompetitions.length === 0) {
    // Fallback: just get teams from the same country
    const team = await db
      .select({ country: teams.country })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (team.length === 0) return [];

    const sameCountry = await db
      .select({
        id: teams.id,
        name: teams.name,
        slug: teams.slug,
        logoUrl: teams.logoUrl,
        country: teams.country,
      })
      .from(teams)
      .where(and(eq(teams.country, team[0].country), ne(teams.id, teamId)))
      .limit(limit);

    return sameCountry;
  }

  const competitionSeasonIds = teamCompetitions.map((tc) => tc.competitionSeasonId);

  // Get teams in the same competitions
  const relatedTeams = await db
    .selectDistinct({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      logoUrl: teams.logoUrl,
      country: teams.country,
    })
    .from(teams)
    .innerJoin(teamSeasons, eq(teams.id, teamSeasons.teamId))
    .where(
      and(
        sql`${teamSeasons.competitionSeasonId} IN (${sql.raw(
          competitionSeasonIds.map((id) => `'${id}'`).join(",")
        )})`,
        ne(teams.id, teamId)
      )
    )
    .limit(limit);

  return relatedTeams;
}

/**
 * Get related matches for a given match.
 * Returns other matches from the same matchday or competition.
 */
export async function getRelatedMatches(
  matchId: string,
  limit = 4
): Promise<RelatedMatch[]> {
  // Get match info
  const match = await db
    .select({
      competitionSeasonId: matches.competitionSeasonId,
      matchday: matches.matchday,
      scheduledAt: matches.scheduledAt,
    })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (match.length === 0) return [];

  const currentMatch = match[0];

  // Get matches from same matchday
  const homeTeam = db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      logoUrl: teams.logoUrl,
    })
    .from(teams)
    .as("home_team");

  const awayTeam = db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      logoUrl: teams.logoUrl,
    })
    .from(teams)
    .as("away_team");

  const relatedMatches = await db
    .select({
      id: matches.id,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      status: matches.status,
      scheduledAt: matches.scheduledAt,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
    })
    .from(matches)
    .where(
      and(
        eq(matches.competitionSeasonId, currentMatch.competitionSeasonId),
        ne(matches.id, matchId),
        currentMatch.matchday
          ? eq(matches.matchday, currentMatch.matchday)
          : sql`true`
      )
    )
    .orderBy(matches.scheduledAt)
    .limit(limit);

  // Get team details for each match
  const result: RelatedMatch[] = [];
  for (const m of relatedMatches) {
    const [home] = await db
      .select({
        name: teams.name,
        slug: teams.slug,
        logoUrl: teams.logoUrl,
      })
      .from(teams)
      .where(eq(teams.id, m.homeTeamId));

    const [away] = await db
      .select({
        name: teams.name,
        slug: teams.slug,
        logoUrl: teams.logoUrl,
      })
      .from(teams)
      .where(eq(teams.id, m.awayTeamId));

    if (home && away) {
      result.push({
        id: m.id,
        homeTeam: home,
        awayTeam: away,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        status: m.status,
        scheduledAt: m.scheduledAt,
      });
    }
  }

  return result;
}

/**
 * Get head-to-head stats between two teams.
 */
export interface HeadToHeadStats {
  totalMatches: number;
  team1Wins: number;
  team2Wins: number;
  draws: number;
  team1Goals: number;
  team2Goals: number;
  recentMatches: {
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number;
    awayScore: number;
    scheduledAt: Date;
    competitionName: string;
  }[];
}

export async function getHeadToHead(
  team1Id: string,
  team2Id: string,
  limit = 10
): Promise<HeadToHeadStats> {
  // Get all matches between these two teams
  const h2hMatches = await db
    .select({
      id: matches.id,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      scheduledAt: matches.scheduledAt,
      competitionId: competitionSeasons.competitionId,
    })
    .from(matches)
    .innerJoin(competitionSeasons, eq(matches.competitionSeasonId, competitionSeasons.id))
    .where(
      and(
        eq(matches.status, "finished"),
        or(
          and(eq(matches.homeTeamId, team1Id), eq(matches.awayTeamId, team2Id)),
          and(eq(matches.homeTeamId, team2Id), eq(matches.awayTeamId, team1Id))
        )
      )
    )
    .orderBy(desc(matches.scheduledAt))
    .limit(limit);

  // Get competition names
  const competitionIds = [...new Set(h2hMatches.map((m) => m.competitionId))];
  const competitionMap: Record<string, string> = {};

  if (competitionIds.length > 0) {
    const comps = await db
      .select({ id: competitions.id, name: competitions.name })
      .from(competitions)
      .where(sql`${competitions.id} IN (${sql.raw(competitionIds.map(id => `'${id}'`).join(','))})`);

    comps.forEach((c) => {
      competitionMap[c.id] = c.name;
    });
  }

  // Calculate stats
  let team1Wins = 0;
  let team2Wins = 0;
  let draws = 0;
  let team1Goals = 0;
  let team2Goals = 0;

  for (const match of h2hMatches) {
    const homeScore = match.homeScore ?? 0;
    const awayScore = match.awayScore ?? 0;

    // Determine goals for each team
    if (match.homeTeamId === team1Id) {
      team1Goals += homeScore;
      team2Goals += awayScore;
      if (homeScore > awayScore) team1Wins++;
      else if (awayScore > homeScore) team2Wins++;
      else draws++;
    } else {
      team1Goals += awayScore;
      team2Goals += homeScore;
      if (awayScore > homeScore) team1Wins++;
      else if (homeScore > awayScore) team2Wins++;
      else draws++;
    }
  }

  return {
    totalMatches: h2hMatches.length,
    team1Wins,
    team2Wins,
    draws,
    team1Goals,
    team2Goals,
    recentMatches: h2hMatches.map((m) => ({
      id: m.id,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeScore: m.homeScore ?? 0,
      awayScore: m.awayScore ?? 0,
      scheduledAt: m.scheduledAt,
      competitionName: competitionMap[m.competitionId] || "Unknown",
    })),
  };
}
