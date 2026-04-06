import { db } from "@/lib/db";
import {
  players,
  teams,
  competitions,
  competitionSeasons,
  seasons,
  standings,
  matches,
  playerSeasonStats,
} from "@/lib/db/schema";
import { eq, and, ne, desc, asc, isNotNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  getTopScorersGlobal,
  getTopAssistsGlobal,
  getPositionCounts,
  getDistinctNationalities,
  getDistinctTeamCountries,
} from "./leaderboards";

// ============================================================
// PLAYER BROWSE DATA
// ============================================================

export async function getPlayerBrowseData() {
  const [
    totalResult,
    competitionCountResult,
    topScorers,
    topAssists,
    positionCounts,
    nationalities,
    recentlyUpdated,
    allCompetitions,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(players)
      .where(ne(players.position, "Unknown")),
    db
      .select({ count: sql<number>`count(distinct ${competitions.id})::int` })
      .from(competitions),
    getTopScorersGlobal(10),
    getTopAssistsGlobal(10),
    getPositionCounts(),
    getDistinctNationalities(),
    db.execute<{
      id: string;
      name: string;
      slug: string;
      position: string;
      nationality: string | null;
      image_url: string | null;
      is_indexable: boolean | null;
      team_name: string | null;
      team_slug: string | null;
      team_logo_url: string | null;
    }>(sql`
      SELECT
        p.id, p.name, p.slug, p.position, p.nationality, p.image_url,
        p.is_indexable,
        t.name as team_name, t.slug as team_slug, t.logo_url as team_logo_url
      FROM players p
      LEFT JOIN player_team_history pth ON pth.player_id = p.id AND pth.valid_to IS NULL
      LEFT JOIN teams t ON t.id = pth.team_id
      WHERE p.position != 'Unknown'
        AND p.enriched_at IS NOT NULL
        AND p.image_url IS NOT NULL
      ORDER BY p.enriched_at DESC
      LIMIT 10
    `),
    db
      .select({
        id: competitions.id,
        name: competitions.name,
        slug: competitions.slug,
        logoUrl: competitions.logoUrl,
        country: competitions.country,
      })
      .from(competitions),
  ]);

  // Featured players: top scorers that have images
  const featuredPlayers = topScorers
    .filter((s) => s.player.imageUrl)
    .slice(0, 6);

  return {
    totalPlayers: totalResult[0]?.count ?? 0,
    competitionCount: competitionCountResult[0]?.count ?? 0,
    featuredPlayers,
    topScorers,
    topAssists,
    positionCounts,
    nationalities: nationalities.slice(0, 20),
    recentlyUpdated: recentlyUpdated.rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      position: r.position,
      nationality: r.nationality,
      imageUrl: r.image_url,
      isIndexable: r.is_indexable ?? false,
      team: r.team_name
        ? { name: r.team_name, slug: r.team_slug!, logoUrl: r.team_logo_url }
        : null,
    })),
    competitions: allCompetitions,
  };
}

// ============================================================
// TEAM BROWSE DATA
// ============================================================

export async function getTeamBrowseData() {
  const homeTeams = alias(teams, "homeTeam");
  const awayTeams = alias(teams, "awayTeam");

  const [
    totalResult,
    competitionCountResult,
    countryList,
    allCompetitions,
    tableLeaders,
    recentMatches,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(teams),
    db
      .select({ count: sql<number>`count(distinct ${competitions.id})::int` })
      .from(competitions),
    getDistinctTeamCountries(),
    db
      .select({
        id: competitions.id,
        name: competitions.name,
        slug: competitions.slug,
        logoUrl: competitions.logoUrl,
        country: competitions.country,
        type: competitions.type,
      })
      .from(competitions),
    // Get #1 team from each competition with current season
    db.execute<{
      team_id: string;
      team_name: string;
      team_slug: string;
      team_logo_url: string | null;
      competition_name: string;
      competition_slug: string;
      competition_logo_url: string | null;
      points: number;
      played: number;
    }>(sql`
      SELECT DISTINCT ON (c.id)
        t.id as team_id,
        t.name as team_name,
        t.slug as team_slug,
        t.logo_url as team_logo_url,
        c.name as competition_name,
        c.slug as competition_slug,
        c.logo_url as competition_logo_url,
        s.points,
        s.played
      FROM standings s
      JOIN teams t ON t.id = s.team_id
      JOIN competition_seasons cs ON cs.id = s.competition_season_id
      JOIN competitions c ON c.id = cs.competition_id
      JOIN seasons se ON se.id = cs.season_id
      WHERE se.is_current = true
        AND s.position = 1
      ORDER BY c.id, s.points DESC
    `),
    // Recent match results
    db.execute<{
      match_id: string;
      match_slug: string | null;
      scheduled_at: string;
      home_score: number | null;
      away_score: number | null;
      status: string;
      home_team_name: string;
      home_team_slug: string;
      home_team_logo_url: string | null;
      away_team_name: string;
      away_team_slug: string;
      away_team_logo_url: string | null;
    }>(sql`
      SELECT
        m.id as match_id,
        m.slug as match_slug,
        m.scheduled_at,
        m.home_score,
        m.away_score,
        m.status,
        ht.name as home_team_name, ht.slug as home_team_slug, ht.logo_url as home_team_logo_url,
        at.name as away_team_name, at.slug as away_team_slug, at.logo_url as away_team_logo_url
      FROM matches m
      JOIN teams ht ON ht.id = m.home_team_id
      JOIN teams at ON at.id = m.away_team_id
      WHERE m.status = 'finished'
      ORDER BY m.scheduled_at DESC
      LIMIT 10
    `),
  ]);

  // Count teams per competition
  const teamCountsResult = await db.execute<{
    competition_id: string;
    team_count: number;
  }>(sql`
    SELECT cs.competition_id, count(distinct ts.team_id)::int as team_count
    FROM team_seasons ts
    JOIN competition_seasons cs ON cs.id = ts.competition_season_id
    JOIN seasons s ON s.id = cs.season_id
    WHERE s.is_current = true
    GROUP BY cs.competition_id
  `);

  const teamCountMap = new Map(
    teamCountsResult.rows.map((r) => [r.competition_id, r.team_count])
  );

  return {
    totalTeams: totalResult[0]?.count ?? 0,
    competitionCount: competitionCountResult[0]?.count ?? 0,
    countryList,
    competitions: allCompetitions.map((c) => ({
      ...c,
      teamCount: teamCountMap.get(c.id) ?? 0,
    })),
    tableLeaders: tableLeaders.rows.map((r) => ({
      team: {
        id: r.team_id,
        name: r.team_name,
        slug: r.team_slug,
        logoUrl: r.team_logo_url,
      },
      competition: {
        name: r.competition_name,
        slug: r.competition_slug,
        logoUrl: r.competition_logo_url,
      },
      points: r.points,
      played: r.played,
    })),
    recentMatches: recentMatches.rows.map((r) => ({
      id: r.match_id,
      slug: r.match_slug,
      scheduledAt: r.scheduled_at,
      homeScore: r.home_score,
      awayScore: r.away_score,
      status: r.status,
      homeTeam: {
        name: r.home_team_name,
        slug: r.home_team_slug,
        logoUrl: r.home_team_logo_url,
      },
      awayTeam: {
        name: r.away_team_name,
        slug: r.away_team_slug,
        logoUrl: r.away_team_logo_url,
      },
    })),
  };
}

// ============================================================
// COMPETITION BROWSE DATA
// ============================================================

export async function getCompetitionBrowseData() {
  const [allCompetitions, tableLeaders, teamCounts, matchdayInfo] =
    await Promise.all([
      db
        .select({
          id: competitions.id,
          name: competitions.name,
          slug: competitions.slug,
          logoUrl: competitions.logoUrl,
          country: competitions.country,
          type: competitions.type,
        })
        .from(competitions),
      // Current leaders
      db.execute<{
        competition_id: string;
        team_name: string;
        team_slug: string;
        team_logo_url: string | null;
        points: number;
      }>(sql`
        SELECT DISTINCT ON (cs.competition_id)
          cs.competition_id,
          t.name as team_name,
          t.slug as team_slug,
          t.logo_url as team_logo_url,
          s.points
        FROM standings s
        JOIN teams t ON t.id = s.team_id
        JOIN competition_seasons cs ON cs.id = s.competition_season_id
        JOIN seasons se ON se.id = cs.season_id
        WHERE se.is_current = true
          AND s.position = 1
        ORDER BY cs.competition_id, s.points DESC
      `),
      // Team counts
      db.execute<{
        competition_id: string;
        team_count: number;
      }>(sql`
        SELECT cs.competition_id, count(distinct ts.team_id)::int as team_count
        FROM team_seasons ts
        JOIN competition_seasons cs ON cs.id = ts.competition_season_id
        JOIN seasons s ON s.id = cs.season_id
        WHERE s.is_current = true
        GROUP BY cs.competition_id
      `),
      // Current matchday
      db.execute<{
        competition_id: string;
        current_matchday: number;
      }>(sql`
        SELECT DISTINCT ON (cs.competition_id)
          cs.competition_id,
          m.matchday as current_matchday
        FROM matches m
        JOIN competition_seasons cs ON cs.id = m.competition_season_id
        JOIN seasons se ON se.id = cs.season_id
        WHERE se.is_current = true
          AND m.status = 'finished'
          AND m.matchday IS NOT NULL
        ORDER BY cs.competition_id, m.matchday DESC
      `),
    ]);

  const leaderMap = new Map(
    tableLeaders.rows.map((r) => [
      r.competition_id,
      {
        teamName: r.team_name,
        teamSlug: r.team_slug,
        teamLogoUrl: r.team_logo_url,
        points: r.points,
      },
    ])
  );

  const teamCountMap = new Map(
    teamCounts.rows.map((r) => [r.competition_id, r.team_count])
  );

  const matchdayMap = new Map(
    matchdayInfo.rows.map((r) => [r.competition_id, r.current_matchday])
  );

  const REGION_MAP: Record<string, string> = {
    England: "Europe",
    Spain: "Europe",
    Germany: "Europe",
    Italy: "Europe",
    France: "Europe",
    Netherlands: "Europe",
    Portugal: "Europe",
    Europe: "Europe",
    Brazil: "South America",
    World: "International",
  };

  return {
    totalCount: allCompetitions.length,
    competitions: allCompetitions.map((c) => ({
      ...c,
      leader: leaderMap.get(c.id) ?? null,
      teamCount: teamCountMap.get(c.id) ?? 0,
      currentMatchday: matchdayMap.get(c.id) ?? null,
      region: REGION_MAP[c.country ?? ""] ?? "Other",
    })),
  };
}
