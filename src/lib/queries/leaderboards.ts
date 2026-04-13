import { db } from "@/lib/db";
import {
  playerSeasonStats,
  players,
  teams,
  competitionSeasons,
  competitions,
  seasons,
} from "@/lib/db/schema";
import { eq, desc, ne, and, isNotNull, sql } from "drizzle-orm";

// ============================================================
// SHARED TYPES
// ============================================================

export type LeaderboardEntry = {
  stat: typeof playerSeasonStats.$inferSelect;
  player: {
    id: string;
    name: string;
    slug: string;
    imageUrl: string | null;
    position: string;
    nationality: string | null;
    isIndexable: boolean | null;
  };
  team: {
    id: string;
    name: string;
    shortName: string | null;
    slug: string;
    logoUrl: string | null;
  };
  competition: {
    name: string;
    slug: string;
  };
  season: {
    label: string;
  };
};

// ============================================================
// BASE QUERY BUILDER
// ============================================================

function baseLeaderboardQuery() {
  return db
    .select({
      stat: playerSeasonStats,
      player: {
        id: players.id,
        name: players.name,
        slug: players.slug,
        imageUrl: players.imageUrl,
        position: players.position,
        nationality: players.nationality,
        isIndexable: players.isIndexable,
      },
      team: {
        id: teams.id,
        name: teams.name,
        shortName: teams.shortName,
        slug: teams.slug,
        logoUrl: teams.logoUrl,
      },
      competition: {
        name: competitions.name,
        slug: competitions.slug,
      },
      season: {
        label: seasons.label,
      },
    })
    .from(playerSeasonStats)
    .innerJoin(players, eq(playerSeasonStats.playerId, players.id))
    .innerJoin(teams, eq(playerSeasonStats.teamId, teams.id))
    .innerJoin(competitionSeasons, eq(playerSeasonStats.competitionSeasonId, competitionSeasons.id))
    .innerJoin(competitions, eq(competitionSeasons.competitionId, competitions.id))
    .innerJoin(seasons, eq(competitionSeasons.seasonId, seasons.id));
}

// ============================================================
// TOP SCORERS
// ============================================================

export async function getTopScorersGlobal(limit = 50): Promise<LeaderboardEntry[]> {
  return baseLeaderboardQuery()
    .where(and(eq(seasons.isCurrent, true), ne(players.position, "Unknown")))
    .orderBy(desc(playerSeasonStats.goals))
    .limit(limit);
}

export async function getTopScorersForCompetition(
  competitionSlug: string,
  limit = 50
): Promise<LeaderboardEntry[]> {
  return baseLeaderboardQuery()
    .where(
      and(
        eq(seasons.isCurrent, true),
        eq(competitions.slug, competitionSlug),
        ne(players.position, "Unknown")
      )
    )
    .orderBy(desc(playerSeasonStats.goals))
    .limit(limit);
}

// ============================================================
// TOP ASSISTS
// ============================================================

export async function getTopAssistsGlobal(limit = 50): Promise<LeaderboardEntry[]> {
  return baseLeaderboardQuery()
    .where(and(eq(seasons.isCurrent, true), ne(players.position, "Unknown")))
    .orderBy(desc(playerSeasonStats.assists))
    .limit(limit);
}

export async function getTopAssistsForCompetition(
  competitionSlug: string,
  limit = 50
): Promise<LeaderboardEntry[]> {
  return baseLeaderboardQuery()
    .where(
      and(
        eq(seasons.isCurrent, true),
        eq(competitions.slug, competitionSlug),
        ne(players.position, "Unknown")
      )
    )
    .orderBy(desc(playerSeasonStats.assists))
    .limit(limit);
}

// ============================================================
// COMPETITION HELPERS
// ============================================================

export async function getAllCompetitionSlugs(): Promise<{ slug: string }[]> {
  return db
    .select({ slug: competitions.slug })
    .from(competitions);
}

export async function getCompetitionBySlug(slug: string) {
  const [comp] = await db
    .select({
      id: competitions.id,
      name: competitions.name,
      slug: competitions.slug,
      country: competitions.country,
      logoUrl: competitions.logoUrl,
    })
    .from(competitions)
    .where(eq(competitions.slug, slug))
    .limit(1);
  return comp ?? null;
}

// ============================================================
// HISTORICAL SEASON LEADERBOARDS
// ============================================================

export async function getTopScorersForCompetitionSeason(
  competitionSlug: string,
  seasonLabel: string,
  limit = 50
): Promise<LeaderboardEntry[]> {
  return baseLeaderboardQuery()
    .where(
      and(
        eq(competitions.slug, competitionSlug),
        eq(seasons.label, seasonLabel),
        ne(players.position, "Unknown")
      )
    )
    .orderBy(desc(playerSeasonStats.goals))
    .limit(limit);
}

export async function getTopAssistsForCompetitionSeason(
  competitionSlug: string,
  seasonLabel: string,
  limit = 50
): Promise<LeaderboardEntry[]> {
  return baseLeaderboardQuery()
    .where(
      and(
        eq(competitions.slug, competitionSlug),
        eq(seasons.label, seasonLabel),
        ne(players.position, "Unknown")
      )
    )
    .orderBy(desc(playerSeasonStats.assists))
    .limit(limit);
}

export async function getCompetitionSeasonLabels(
  competitionSlug: string
): Promise<string[]> {
  const results = await db
    .selectDistinct({ label: seasons.label })
    .from(playerSeasonStats)
    .innerJoin(competitionSeasons, eq(playerSeasonStats.competitionSeasonId, competitionSeasons.id))
    .innerJoin(competitions, eq(competitionSeasons.competitionId, competitions.id))
    .innerJoin(seasons, eq(competitionSeasons.seasonId, seasons.id))
    .where(eq(competitions.slug, competitionSlug))
    .orderBy(desc(seasons.label));
  return results.map((r) => r.label);
}

/**
 * Returns the current season URL label (e.g. "2025-26") for a given competition.
 * Used by leaderboard [season] pages to decide canonical URL (point to /[slug]
 * when the param matches the current season, to avoid duplicate content).
 */
export async function getCurrentSeasonUrlLabel(
  competitionSlug: string
): Promise<string | null> {
  const result = await db
    .select({ label: seasons.label })
    .from(seasons)
    .innerJoin(competitionSeasons, eq(competitionSeasons.seasonId, seasons.id))
    .innerJoin(competitions, eq(competitionSeasons.competitionId, competitions.id))
    .where(and(eq(competitions.slug, competitionSlug), eq(seasons.isCurrent, true)))
    .limit(1);
  return result[0]?.label.replace("/", "-") ?? null;
}

/**
 * Returns the label of the current season (e.g. "2025/26").
 * Used by pages that need a dynamic season string in metadata.
 * Falls back to a date-based calculation if no DB row is found.
 */
export async function getCurrentSeasonLabel(): Promise<string> {
  const result = await db
    .select({ label: seasons.label })
    .from(seasons)
    .where(eq(seasons.isCurrent, true))
    .limit(1);
  if (result[0]?.label) return result[0].label;
  // Fallback: European football season runs Aug–Jun
  const now = new Date();
  const y = now.getFullYear();
  const startYear = now.getMonth() >= 7 ? y : y - 1;
  return `${startYear}/${String(startYear + 1).slice(2)}`;
}

// ============================================================
// PLAYERS BY POSITION
// ============================================================

export async function getPositionCounts(): Promise<{ position: string; count: number }[]> {
  return db
    .select({
      position: players.position,
      count: sql<number>`count(*)::int`.as("count"),
    })
    .from(players)
    .where(ne(players.position, "Unknown"))
    .groupBy(players.position)
    .orderBy(desc(sql`count(*)`));
}

export async function getPlayersByPosition(position: string, limit = 100) {
  const result = await db.execute<{
    id: string;
    name: string;
    slug: string;
    position: string;
    nationality: string | null;
    image_url: string | null;
    popularity_score: number | null;
    is_indexable: boolean;
    team_name: string | null;
    team_slug: string | null;
    team_logo_url: string | null;
  }>(sql`
    SELECT
      p.id, p.name, p.slug, p.position, p.nationality, p.image_url, p.popularity_score,
      p.is_indexable,
      t.name as team_name, t.slug as team_slug, t.logo_url as team_logo_url
    FROM players p
    LEFT JOIN player_team_history pth ON pth.player_id = p.id AND pth.valid_to IS NULL
    LEFT JOIN teams t ON t.id = pth.team_id
    WHERE p.position = ${position}
    ORDER BY coalesce(p.popularity_score, 0) DESC
    LIMIT ${limit}
  `);

  return result.rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    position: r.position,
    nationality: r.nationality,
    imageUrl: r.image_url,
    popularityScore: r.popularity_score,
    isIndexable: r.is_indexable,
    team: r.team_name
      ? { name: r.team_name, slug: r.team_slug!, logoUrl: r.team_logo_url }
      : null,
  }));
}

// ============================================================
// PLAYERS BY NATIONALITY
// ============================================================

export async function getDistinctNationalities(): Promise<{ nationality: string; count: number }[]> {
  const results = await db
    .select({
      nationality: players.nationality,
      count: sql<number>`count(*)::int`.as("count"),
    })
    .from(players)
    .where(and(ne(players.position, "Unknown"), isNotNull(players.nationality)))
    .groupBy(players.nationality)
    .orderBy(desc(sql`count(*)`));

  return results.filter((r) => r.nationality !== null) as { nationality: string; count: number }[];
}

export async function getPlayersByNationality(nationality: string, limit = 100) {
  // Get players with their current team
  const result = await db.execute<{
    id: string;
    name: string;
    slug: string;
    position: string;
    nationality: string;
    image_url: string | null;
    popularity_score: number | null;
    is_indexable: boolean | null;
    team_name: string | null;
    team_slug: string | null;
    team_logo_url: string | null;
  }>(sql`
    SELECT
      p.id, p.name, p.slug, p.position, p.nationality, p.image_url, p.popularity_score,
      p.is_indexable,
      t.name as team_name, t.slug as team_slug, t.logo_url as team_logo_url
    FROM players p
    LEFT JOIN player_team_history pth ON pth.player_id = p.id AND pth.valid_to IS NULL
    LEFT JOIN teams t ON t.id = pth.team_id
    WHERE p.nationality = ${nationality}
      AND p.position != 'Unknown'
    ORDER BY coalesce(p.popularity_score, 0) DESC
    LIMIT ${limit}
  `);

  return result.rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    position: r.position,
    nationality: r.nationality,
    imageUrl: r.image_url,
    popularityScore: r.popularity_score,
    isIndexable: r.is_indexable ?? false,
    team: r.team_name
      ? { name: r.team_name, slug: r.team_slug!, logoUrl: r.team_logo_url }
      : null,
  }));
}

// ============================================================
// TEAMS BY COUNTRY
// ============================================================

export async function getDistinctTeamCountries(): Promise<{ country: string; count: number }[]> {
  return db
    .select({
      country: teams.country,
      count: sql<number>`count(*)::int`.as("count"),
    })
    .from(teams)
    .groupBy(teams.country)
    .orderBy(desc(sql`count(*)`));
}

export async function getTeamsByCountry(country: string, limit = 100) {
  return db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      city: teams.city,
      country: teams.country,
      foundedYear: teams.foundedYear,
      logoUrl: teams.logoUrl,
      tier: teams.tier,
    })
    .from(teams)
    .where(eq(teams.country, country))
    .orderBy(teams.tier, teams.name)
    .limit(limit);
}

// ============================================================
// HEAD-TO-HEAD COMPARISON
// ============================================================

export async function getTopPlayerPairs(limit = 15): Promise<{ slug: string; name: string }[]> {
  // Rank by real current-season production (goals + assists) instead of the
  // popularity_score column, which is uniformly zero. Restricts matchups to
  // players who actually have stats, so /compare/[a]-vs-[b] pages never land
  // on empty-body "soft 404" candidates.
  const rows = await db
    .select({
      slug: players.slug,
      name: players.name,
      score: sql<number>`
        SUM(COALESCE(${playerSeasonStats.goals}, 0) + COALESCE(${playerSeasonStats.assists}, 0))::int
      `,
    })
    .from(players)
    .innerJoin(playerSeasonStats, eq(playerSeasonStats.playerId, players.id))
    .innerJoin(competitionSeasons, eq(competitionSeasons.id, playerSeasonStats.competitionSeasonId))
    .innerJoin(seasons, eq(seasons.id, competitionSeasons.seasonId))
    .where(
      and(
        ne(players.position, "Unknown"),
        eq(seasons.isCurrent, true),
        eq(players.isIndexable, true),
      ),
    )
    .groupBy(players.id, players.slug, players.name)
    .orderBy(desc(sql`SUM(COALESCE(${playerSeasonStats.goals}, 0) + COALESCE(${playerSeasonStats.assists}, 0))`))
    .limit(limit);

  return rows.map((r) => ({ slug: r.slug, name: r.name }));
}

export async function getPlayerWithAggregatedStats(slug: string) {
  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.slug, slug))
    .limit(1);

  if (!player) return null;

  const stats = await db
    .select({
      appearances: sql<number>`sum(${playerSeasonStats.appearances})::int`,
      goals: sql<number>`sum(${playerSeasonStats.goals})::int`,
      assists: sql<number>`sum(${playerSeasonStats.assists})::int`,
      yellowCards: sql<number>`sum(${playerSeasonStats.yellowCards})::int`,
      redCards: sql<number>`sum(${playerSeasonStats.redCards})::int`,
      minutesPlayed: sql<number>`sum(${playerSeasonStats.minutesPlayed})::int`,
    })
    .from(playerSeasonStats)
    .where(eq(playerSeasonStats.playerId, player.id));

  const teamResult = await db.execute<{
    name: string;
    slug: string;
    logo_url: string | null;
  }>(sql`
    SELECT t.name, t.slug, t.logo_url
    FROM player_team_history pth
    JOIN teams t ON t.id = pth.team_id
    WHERE pth.player_id = ${player.id} AND pth.valid_to IS NULL
    LIMIT 1
  `);

  const team = teamResult.rows[0] ?? null;

  return {
    id: player.id,
    name: player.name,
    slug: player.slug,
    position: player.position,
    nationality: player.nationality,
    imageUrl: player.imageUrl,
    dateOfBirth: player.dateOfBirth,
    heightCm: player.heightCm,
    wikipediaUrl: player.wikipediaUrl,
    websiteUrl: player.websiteUrl,
    instagramHandle: player.instagramHandle,
    twitterHandle: player.twitterHandle,
    team: team ? { name: team.name, slug: team.slug, logoUrl: team.logo_url } : null,
    totalStats: {
      appearances: stats[0]?.appearances || 0,
      goals: stats[0]?.goals || 0,
      assists: stats[0]?.assists || 0,
      yellowCards: stats[0]?.yellowCards || 0,
      redCards: stats[0]?.redCards || 0,
      minutesPlayed: stats[0]?.minutesPlayed || 0,
    },
  };
}

// ============================================================
// TRANSFERS
// ============================================================

export async function getRecentTransfers(limit = 50) {
  const result = await db.execute<{
    id: string;
    player_id: string;
    player_name: string;
    player_slug: string;
    player_image_url: string | null;
    player_position: string;
    player_is_indexable: boolean;
    to_team_id: string;
    to_team_name: string;
    to_team_slug: string;
    to_team_logo_url: string | null;
    from_team_name: string | null;
    from_team_slug: string | null;
    from_team_logo_url: string | null;
    transfer_type: string | null;
    valid_from: string;
  }>(sql`
    SELECT
      pth.id,
      p.id as player_id,
      p.name as player_name,
      p.slug as player_slug,
      p.image_url as player_image_url,
      p.position as player_position,
      p.is_indexable as player_is_indexable,
      t_to.id as to_team_id,
      t_to.name as to_team_name,
      t_to.slug as to_team_slug,
      t_to.logo_url as to_team_logo_url,
      t_from.name as from_team_name,
      t_from.slug as from_team_slug,
      t_from.logo_url as from_team_logo_url,
      pth.transfer_type,
      pth.valid_from
    FROM player_team_history pth
    JOIN players p ON p.id = pth.player_id
    JOIN teams t_to ON t_to.id = pth.team_id
    LEFT JOIN LATERAL (
      SELECT t.name, t.slug, t.logo_url
      FROM player_team_history prev
      JOIN teams t ON t.id = prev.team_id
      WHERE prev.player_id = pth.player_id
        AND prev.valid_to IS NOT NULL
        AND prev.valid_to <= pth.valid_from
      ORDER BY prev.valid_to DESC
      LIMIT 1
    ) t_from ON true
    WHERE p.position != 'Unknown'
    ORDER BY pth.valid_from DESC
    LIMIT ${limit}
  `);

  return result.rows.map((r) => ({
    id: r.id,
    player: {
      id: r.player_id,
      name: r.player_name,
      slug: r.player_slug,
      imageUrl: r.player_image_url,
      position: r.player_position,
      isIndexable: r.player_is_indexable,
    },
    toTeam: {
      id: r.to_team_id,
      name: r.to_team_name,
      slug: r.to_team_slug,
      logoUrl: r.to_team_logo_url,
    },
    fromTeam: r.from_team_name
      ? { name: r.from_team_name, slug: r.from_team_slug!, logoUrl: r.from_team_logo_url }
      : null,
    transferType: r.transfer_type,
    date: r.valid_from,
  }));
}
