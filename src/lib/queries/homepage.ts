/**
 * Homepage query composition layer.
 *
 * Central place where the programmatic homepage pulls its data from. Every
 * exported function MUST return empty arrays / null on no-data — never throw.
 * The homepage composes sections conditionally, so empty returns mean the
 * section is hidden (no empty shells).
 */

import { db } from "@/lib/db";
import {
  articles,
  competitions,
  competitionSeasons,
  players,
  playerSeasonStats,
  seasons,
  sportsEvents,
  standings,
  teams,
} from "@/lib/db/schema";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import {
  getLiveMatches,
  getMatchesForDateRange,
  getUpcomingMatches,
  type HubMatch,
} from "@/lib/queries/matches";
import {
  getPublishedArticles,
  type ArticleWithRelations,
} from "@/lib/queries/articles";
import { TOP_5_LEAGUE_SLUGS } from "@/lib/data/derbies";

// ============================================================
// Helpers
// ============================================================

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Deterministic daily rotation via djb2 hash of the yyyy-mm-dd key.
 * Keeps rotation stable for the whole calendar day so ISR caching works.
 */
export function dailyRotationIndex(date: Date, modulo: number): number {
  if (modulo <= 0) return 0;
  const iso = date.toISOString().slice(0, 10);
  let h = 5381;
  for (let i = 0; i < iso.length; i++) {
    h = (h << 5) + h + iso.charCodeAt(i);
  }
  return Math.abs(h) % modulo;
}

// ============================================================
// Hero banner — Live → Today → Upcoming cascade
// ============================================================

export type HeroMatch = {
  id: string;
  slug: string | null;
  scheduledAt: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  minute: number | null;
  homeTeam: { name: string; slug: string; logoUrl: string | null };
  awayTeam: { name: string; slug: string; logoUrl: string | null };
  competition: { name: string; slug: string; logoUrl: string | null } | null;
};

export type HeroBanner =
  | { kind: "live"; count: number }
  | { kind: "today"; matches: HeroMatch[] }
  | { kind: "results"; matches: HeroMatch[]; label: string }
  | { kind: "upcoming"; matches: HeroMatch[] };

function hubMatchToHero(m: HubMatch): HeroMatch {
  return {
    id: m.id,
    slug: m.slug,
    scheduledAt: m.scheduledAt,
    status: m.status,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    minute: m.minute,
    homeTeam: {
      name: m.homeTeamName,
      slug: m.homeTeamSlug,
      logoUrl: m.homeTeamLogoUrl,
    },
    awayTeam: {
      name: m.awayTeamName,
      slug: m.awayTeamSlug,
      logoUrl: m.awayTeamLogoUrl,
    },
    competition: {
      name: m.competitionName,
      slug: m.competitionSlug,
      logoUrl: m.competitionLogoUrl,
    },
  };
}

/**
 * Returns the most relevant hero content for the current moment:
 *   1. Live matches if any
 *   2. Today's scheduled/upcoming matches
 *   3. Today's finished results (if games already played)
 *   4. Yesterday's results (high-interest fallback)
 *   5. Next upcoming fixtures
 */
export async function getHeroBanner(opts?: {
  personalizedCompetitionIds?: string[];
}): Promise<HeroBanner> {
  const live = await getLiveMatches();
  if (live.length > 0) {
    return { kind: "live", count: live.length };
  }

  const todayMatches = await getMatchesForDateRange(
    startOfToday(),
    endOfToday()
  );
  const filteredToday = opts?.personalizedCompetitionIds?.length
    ? todayMatches.filter((m) =>
        opts.personalizedCompetitionIds!.includes(m.competitionId)
      )
    : todayMatches;
  const pool = filteredToday.length ? filteredToday : todayMatches;

  // 2. Today's scheduled matches (games still to come)
  const todayScheduled = pool
    .filter((m) => m.status === "scheduled" || m.status === "live")
    .slice(0, 8);
  if (todayScheduled.length > 0) {
    return { kind: "today", matches: todayScheduled.map(hubMatchToHero) };
  }

  // 3. Today's finished results (games already played today)
  const todayFinished = pool
    .filter((m) => m.status === "finished")
    .slice(0, 8);
  if (todayFinished.length > 0) {
    return { kind: "results", matches: todayFinished.map(hubMatchToHero), label: "Today's Results" };
  }

  // 4. Yesterday's results (high-interest fallback)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStart = new Date(yesterday);
  yStart.setHours(0, 0, 0, 0);
  const yEnd = new Date(yesterday);
  yEnd.setHours(23, 59, 59, 999);
  const yesterdayMatches = await getMatchesForDateRange(yStart, yEnd);
  const yesterdayFinished = yesterdayMatches
    .filter((m) => m.status === "finished")
    .slice(0, 8);
  if (yesterdayFinished.length > 0) {
    return { kind: "results", matches: yesterdayFinished.map(hubMatchToHero), label: "Yesterday's Results" };
  }

  // 5. Next upcoming fixtures
  const upcoming = await getUpcomingMatches(6);
  if (!upcoming.length) {
    return { kind: "upcoming", matches: [] };
  }
  const mapped: HeroMatch[] = upcoming.map((m) => ({
    id: m.id,
    slug: m.slug,
    scheduledAt: new Date(m.scheduledAt).toISOString(),
    status: m.status,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    minute: m.minute,
    homeTeam: {
      name: m.homeTeam?.name ?? "",
      slug: m.homeTeam?.slug ?? "",
      logoUrl: m.homeTeam?.logoUrl ?? null,
    },
    awayTeam: {
      name: m.awayTeam?.name ?? "",
      slug: m.awayTeam?.slug ?? "",
      logoUrl: m.awayTeam?.logoUrl ?? null,
    },
    competition: m.competition
      ? {
          name: m.competition.name,
          slug: m.competition.slug,
          logoUrl: m.competition.logoUrl,
        }
      : null,
  }));
  return { kind: "upcoming", matches: mapped };
}

// ============================================================
// Match of the Day — best finished match in last 24h
// ============================================================

export type MatchOfTheDay = {
  id: string;
  slug: string | null;
  scheduledAt: string;
  homeScore: number;
  awayScore: number;
  homeTeam: { name: string; slug: string; logoUrl: string | null; tier: number | null };
  awayTeam: { name: string; slug: string; logoUrl: string | null; tier: number | null };
  competition: { name: string; slug: string; logoUrl: string | null };
  linkedArticle: {
    slug: string;
    title: string;
    excerpt: string;
  } | null;
  score: number;
};

/**
 * Picks the standout finished match from roughly the last 24 hours. Scoring
 * combines league tier, club tier and tightness of the contest.
 */
export async function getMatchOfTheDay(): Promise<MatchOfTheDay | null> {
  const since = new Date();
  since.setHours(since.getHours() - 30);

  const rows = await db.execute<{
    id: string;
    slug: string | null;
    scheduled_at: string;
    home_score: number;
    away_score: number;
    home_name: string;
    home_slug: string;
    home_logo_url: string | null;
    home_tier: number | null;
    away_name: string;
    away_slug: string;
    away_logo_url: string | null;
    away_tier: number | null;
    competition_name: string;
    competition_slug: string;
    competition_logo_url: string | null;
  }>(sql`
    SELECT
      m.id,
      m.slug,
      m.scheduled_at,
      m.home_score,
      m.away_score,
      ht.name as home_name,
      ht.slug as home_slug,
      ht.logo_url as home_logo_url,
      ht.tier as home_tier,
      at.name as away_name,
      at.slug as away_slug,
      at.logo_url as away_logo_url,
      at.tier as away_tier,
      c.name as competition_name,
      c.slug as competition_slug,
      c.logo_url as competition_logo_url
    FROM matches m
    INNER JOIN teams ht ON ht.id = m.home_team_id
    INNER JOIN teams at ON at.id = m.away_team_id
    INNER JOIN competition_seasons cs ON cs.id = m.competition_season_id
    INNER JOIN competitions c ON c.id = cs.competition_id
    WHERE m.status = 'finished'
      AND m.scheduled_at >= ${since.toISOString()}
      AND m.home_score IS NOT NULL
      AND m.away_score IS NOT NULL
    ORDER BY m.scheduled_at DESC
    LIMIT 200
  `);

  if (!rows.rows.length) return null;

  const top5 = TOP_5_LEAGUE_SLUGS;
  let best: MatchOfTheDay | null = null;
  for (const r of rows.rows) {
    const homeTier = r.home_tier ?? 3;
    const awayTier = r.away_tier ?? 3;
    const isTop5 = top5.has(r.competition_slug);
    const diff = Math.abs((r.home_score ?? 0) - (r.away_score ?? 0));
    const goals = (r.home_score ?? 0) + (r.away_score ?? 0);
    // Higher is better. Tight top-5 matches with tier-1 clubs win.
    const score =
      (isTop5 ? 40 : 10) +
      (homeTier === 1 ? 20 : homeTier === 2 ? 10 : 0) +
      (awayTier === 1 ? 20 : awayTier === 2 ? 10 : 0) +
      Math.max(0, 10 - diff * 3) +
      Math.min(goals * 2, 14);

    if (!best || score > best.score) {
      best = {
        id: r.id,
        slug: r.slug,
        scheduledAt: r.scheduled_at,
        homeScore: r.home_score,
        awayScore: r.away_score,
        homeTeam: {
          name: r.home_name,
          slug: r.home_slug,
          logoUrl: r.home_logo_url,
          tier: r.home_tier,
        },
        awayTeam: {
          name: r.away_name,
          slug: r.away_slug,
          logoUrl: r.away_logo_url,
          tier: r.away_tier,
        },
        competition: {
          name: r.competition_name,
          slug: r.competition_slug,
          logoUrl: r.competition_logo_url,
        },
        linkedArticle: null,
        score,
      };
    }
  }

  if (!best) return null;

  // Attach linked article if an event preview/recap exists for this match id
  const linkedArticleRow = await db
    .select({
      slug: articles.slug,
      title: articles.title,
      excerpt: articles.excerpt,
    })
    .from(articles)
    .where(
      and(
        eq(articles.status, "published"),
        eq(articles.matchId, best.id)
      )
    )
    .orderBy(desc(articles.publishedAt))
    .limit(1);

  if (linkedArticleRow[0]) {
    best.linkedArticle = linkedArticleRow[0];
  }

  return best;
}

// ============================================================
// Standout performers (last N hours)
// ============================================================

export type StandoutPerformer = {
  playerId: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  goals: number;
  assists: number;
  teamName: string;
  teamSlug: string;
  matchId: string;
  matchSlug: string | null;
  impact: number;
};

/**
 * Top performers from recently finished matches.
 *
 * Primary: `match_events` goals/assists (when populated).
 * Fallback: season-stats leaders on winning teams from recent matches.
 * The fallback ensures the section renders even without per-match event
 * data (which requires a paid API-Football plan to ingest).
 */
export async function getStandoutPerformers(
  hours = 30,
  limit = 3
): Promise<StandoutPerformer[]> {
  const since = new Date();
  since.setHours(since.getHours() - hours);

  // Primary path: match_events (minute-level goal/assist data)
  const eventRows = await db.execute<{
    player_id: string;
    player_name: string;
    player_slug: string;
    player_image_url: string | null;
    team_name: string;
    team_slug: string;
    match_id: string;
    match_slug: string | null;
    goals: number;
    assists: number;
  }>(sql`
    SELECT
      p.id as player_id,
      p.name as player_name,
      p.slug as player_slug,
      p.image_url as player_image_url,
      t.name as team_name,
      t.slug as team_slug,
      m.id as match_id,
      m.slug as match_slug,
      COUNT(*) FILTER (WHERE me.type = 'goal') AS goals,
      (
        SELECT COUNT(*) FROM match_events me2
        WHERE me2.match_id = m.id
          AND me2.type = 'goal'
          AND me2.secondary_player_id = p.id
      ) AS assists
    FROM match_events me
    INNER JOIN players p ON p.id = me.player_id
    INNER JOIN teams t ON t.id = me.team_id
    INNER JOIN matches m ON m.id = me.match_id
    WHERE me.type = 'goal'
      AND m.scheduled_at >= ${since.toISOString()}
      AND m.status = 'finished'
    GROUP BY p.id, p.name, p.slug, p.image_url, t.name, t.slug, m.id, m.slug
    ORDER BY goals DESC
    LIMIT 50
  `);

  if (eventRows.rows.length > 0) {
    const performers: StandoutPerformer[] = eventRows.rows.map((r) => {
      const goals = Number(r.goals) || 0;
      const assists = Number(r.assists) || 0;
      return {
        playerId: r.player_id,
        name: r.player_name,
        slug: r.player_slug,
        imageUrl: r.player_image_url,
        goals,
        assists,
        teamName: r.team_name,
        teamSlug: r.team_slug,
        matchId: r.match_id,
        matchSlug: r.match_slug,
        impact: goals * 3 + assists * 2,
      };
    });
    performers.sort(
      (a, b) => b.impact - a.impact || b.goals - a.goals || b.assists - a.assists
    );
    return performers.slice(0, limit);
  }

  // Fallback: top season-stats players on teams that won recent matches.
  // Picks the highest-scoring forward/midfielder from each winning team.
  const fallbackRows = await db.execute<{
    player_id: string;
    player_name: string;
    player_slug: string;
    player_image_url: string | null;
    team_name: string;
    team_slug: string;
    match_id: string;
    match_slug: string | null;
    season_goals: number;
    season_assists: number;
  }>(sql`
    WITH recent_wins AS (
      SELECT DISTINCT ON (
        CASE WHEN m.home_score > m.away_score THEN m.home_team_id
             WHEN m.away_score > m.home_score THEN m.away_team_id
        END
      )
        m.id AS match_id,
        m.slug AS match_slug,
        CASE WHEN m.home_score > m.away_score THEN m.home_team_id
             WHEN m.away_score > m.home_score THEN m.away_team_id
        END AS winning_team_id
      FROM matches m
      WHERE m.status = 'finished'
        AND m.scheduled_at >= ${since.toISOString()}
        AND m.home_score IS NOT NULL
        AND m.away_score IS NOT NULL
        AND m.home_score != m.away_score
      ORDER BY
        CASE WHEN m.home_score > m.away_score THEN m.home_team_id
             WHEN m.away_score > m.home_score THEN m.away_team_id
        END,
        ABS(m.home_score - m.away_score) DESC
    )
    SELECT
      p.id AS player_id,
      p.name AS player_name,
      p.slug AS player_slug,
      p.image_url AS player_image_url,
      t.name AS team_name,
      t.slug AS team_slug,
      rw.match_id,
      rw.match_slug,
      COALESCE(pss.goals, 0) AS season_goals,
      COALESCE(pss.assists, 0) AS season_assists
    FROM recent_wins rw
    INNER JOIN teams t ON t.id = rw.winning_team_id
    INNER JOIN player_team_history pth ON pth.team_id = rw.winning_team_id AND pth.valid_to IS NULL
    INNER JOIN players p ON p.id = pth.player_id
    INNER JOIN player_season_stats pss ON pss.player_id = p.id
    INNER JOIN competition_seasons cs ON cs.id = pss.competition_season_id
    INNER JOIN seasons s ON s.id = cs.season_id AND s.is_current = true
    WHERE pss.goals > 0
      AND p.position IN ('Forward', 'Midfielder')
    ORDER BY (pss.goals * 2 + pss.assists) DESC
    LIMIT ${limit * 3}
  `);

  // Dedupe by team (1 player per winning team) then pick top N
  const seen = new Set<string>();
  const performers: StandoutPerformer[] = [];
  for (const r of fallbackRows.rows) {
    if (seen.has(r.team_slug)) continue;
    seen.add(r.team_slug);
    const goals = Number(r.season_goals) || 0;
    const assists = Number(r.season_assists) || 0;
    performers.push({
      playerId: r.player_id,
      name: r.player_name,
      slug: r.player_slug,
      imageUrl: r.player_image_url,
      goals,
      assists,
      teamName: r.team_name,
      teamSlug: r.team_slug,
      matchId: r.match_id,
      matchSlug: r.match_slug,
      impact: goals * 2 + assists,
    });
    if (performers.length >= limit) break;
  }
  return performers;
}

// ============================================================
// Week preview — next N days grouped by date
// ============================================================

export type WeekPreviewDay = {
  date: string; // yyyy-mm-dd
  matches: HeroMatch[];
  events: Array<{
    id: string;
    type: string;
    title: string;
    importance: number;
    isFeatured: boolean;
  }>;
};

export async function getWeekPreview(days = 7): Promise<WeekPreviewDay[]> {
  const start = startOfToday();
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  end.setHours(23, 59, 59, 999);

  const [matchesRows, eventsRows] = await Promise.all([
    getMatchesForDateRange(start, end),
    db
      .select({
        id: sportsEvents.id,
        date: sportsEvents.date,
        type: sportsEvents.type,
        title: sportsEvents.title,
        importance: sportsEvents.importance,
        isFeatured: sportsEvents.isFeatured,
      })
      .from(sportsEvents)
      .where(
        and(
          gte(sportsEvents.date, start.toISOString().slice(0, 10)),
          lte(sportsEvents.date, end.toISOString().slice(0, 10))
        )
      )
      .orderBy(desc(sportsEvents.importance)),
  ]);

  const byDate = new Map<string, WeekPreviewDay>();
  for (const m of matchesRows) {
    const key = new Date(m.scheduledAt).toISOString().slice(0, 10);
    if (!byDate.has(key)) {
      byDate.set(key, { date: key, matches: [], events: [] });
    }
    byDate.get(key)!.matches.push(hubMatchToHero(m));
  }
  for (const e of eventsRows) {
    const key =
      typeof e.date === "string" ? e.date : new Date(e.date).toISOString().slice(0, 10);
    if (!byDate.has(key)) {
      byDate.set(key, { date: key, matches: [], events: [] });
    }
    byDate.get(key)!.events.push({
      id: e.id,
      type: e.type,
      title: e.title,
      importance: e.importance,
      isFeatured: e.isFeatured,
    });
  }

  return Array.from(byDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((d) => d.matches.length > 0 || d.events.length > 0);
}

// ============================================================
// Competition spotlight — daily rotating card
// ============================================================

export type CompetitionSpotlight = {
  competition: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    country: string | null;
  };
  season: { label: string } | null;
  leader: {
    name: string;
    slug: string;
    logoUrl: string | null;
    points: number;
    played: number;
    position: number;
  } | null;
  topScorer: {
    name: string;
    slug: string;
    goals: number;
    teamName: string;
    teamSlug: string;
  } | null;
  nextFixture: HeroMatch | null;
  recentForm: Array<{
    id: string;
    slug: string | null;
    homeTeam: string;
    awayTeam: string;
    homeScore: number | null;
    awayScore: number | null;
  }>;
};

/**
 * Rotates daily across the top football competitions and returns a rich
 * snapshot for the chosen one.
 */
export async function getCompetitionSpotlight(
  date: Date = new Date()
): Promise<CompetitionSpotlight | null> {
  // Prefer the top-5 European leagues. Any competition with the right slug is fine.
  const candidates = await db
    .select()
    .from(competitions)
    .where(inArray(competitions.slug, Array.from(TOP_5_LEAGUE_SLUGS)));

  if (!candidates.length) return null;

  const idx = dailyRotationIndex(date, candidates.length);
  const comp = candidates[idx];

  // Find the current-season competition_season (by seasons.isCurrent).
  const csRow = await db
    .select({
      competitionSeason: competitionSeasons,
      season: seasons,
    })
    .from(competitionSeasons)
    .innerJoin(seasons, eq(seasons.id, competitionSeasons.seasonId))
    .where(
      and(
        eq(competitionSeasons.competitionId, comp.id),
        eq(seasons.isCurrent, true)
      )
    )
    .orderBy(desc(seasons.startDate))
    .limit(1);

  const competitionSeason = csRow[0]?.competitionSeason ?? null;
  const season = csRow[0]?.season ?? null;

  let leader: CompetitionSpotlight["leader"] = null;
  let topScorer: CompetitionSpotlight["topScorer"] = null;
  let nextFixture: HeroMatch | null = null;
  let recentForm: CompetitionSpotlight["recentForm"] = [];

  if (competitionSeason) {
    const leaderRow = await db
      .select({
        standing: standings,
        team: teams,
      })
      .from(standings)
      .innerJoin(teams, eq(teams.id, standings.teamId))
      .where(eq(standings.competitionSeasonId, competitionSeason.id))
      .orderBy(standings.position)
      .limit(1);

    if (leaderRow[0]) {
      leader = {
        name: leaderRow[0].team.name,
        slug: leaderRow[0].team.slug,
        logoUrl: leaderRow[0].team.logoUrl,
        points: leaderRow[0].standing.points,
        played: leaderRow[0].standing.played,
        position: leaderRow[0].standing.position,
      };
    }

    const topScorerRow = await db
      .select({
        stat: playerSeasonStats,
        player: players,
        team: teams,
      })
      .from(playerSeasonStats)
      .innerJoin(players, eq(players.id, playerSeasonStats.playerId))
      .innerJoin(teams, eq(teams.id, playerSeasonStats.teamId))
      .where(eq(playerSeasonStats.competitionSeasonId, competitionSeason.id))
      .orderBy(desc(playerSeasonStats.goals))
      .limit(1);

    if (topScorerRow[0] && (topScorerRow[0].stat.goals ?? 0) > 0) {
      topScorer = {
        name: topScorerRow[0].player.name,
        slug: topScorerRow[0].player.slug,
        goals: topScorerRow[0].stat.goals,
        teamName: topScorerRow[0].team.name,
        teamSlug: topScorerRow[0].team.slug,
      };
    }

    const fixtureRow = await db.execute<{
      id: string;
      slug: string | null;
      scheduled_at: string;
      status: string;
      home_score: number | null;
      away_score: number | null;
      minute: number | null;
      matchday: number | null;
      home_name: string;
      home_slug: string;
      home_logo_url: string | null;
      away_name: string;
      away_slug: string;
      away_logo_url: string | null;
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
        ht.name as home_name,
        ht.slug as home_slug,
        ht.logo_url as home_logo_url,
        at.name as away_name,
        at.slug as away_slug,
        at.logo_url as away_logo_url
      FROM matches m
      INNER JOIN teams ht ON ht.id = m.home_team_id
      INNER JOIN teams at ON at.id = m.away_team_id
      WHERE m.competition_season_id = ${competitionSeason.id}
        AND m.status = 'scheduled'
        AND m.scheduled_at >= NOW()
      ORDER BY m.scheduled_at ASC
      LIMIT 1
    `);

    if (fixtureRow.rows[0]) {
      const r = fixtureRow.rows[0];
      nextFixture = {
        id: r.id,
        slug: r.slug,
        scheduledAt: r.scheduled_at,
        status: r.status,
        homeScore: r.home_score,
        awayScore: r.away_score,
        minute: r.minute,
        homeTeam: {
          name: r.home_name,
          slug: r.home_slug,
          logoUrl: r.home_logo_url,
        },
        awayTeam: {
          name: r.away_name,
          slug: r.away_slug,
          logoUrl: r.away_logo_url,
        },
        competition: {
          name: comp.name,
          slug: comp.slug,
          logoUrl: comp.logoUrl,
        },
      };
    }

    const formRows = await db.execute<{
      id: string;
      slug: string | null;
      home_name: string;
      away_name: string;
      home_score: number | null;
      away_score: number | null;
    }>(sql`
      SELECT
        m.id,
        m.slug,
        ht.name as home_name,
        at.name as away_name,
        m.home_score,
        m.away_score
      FROM matches m
      INNER JOIN teams ht ON ht.id = m.home_team_id
      INNER JOIN teams at ON at.id = m.away_team_id
      WHERE m.competition_season_id = ${competitionSeason.id}
        AND m.status = 'finished'
      ORDER BY m.scheduled_at DESC
      LIMIT 5
    `);

    recentForm = formRows.rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      homeTeam: r.home_name,
      awayTeam: r.away_name,
      homeScore: r.home_score,
      awayScore: r.away_score,
    }));
  }

  return {
    competition: {
      id: comp.id,
      name: comp.name,
      slug: comp.slug,
      logoUrl: comp.logoUrl,
      country: comp.country,
    },
    season: season ? { label: season.label } : null,
    leader,
    topScorer,
    nextFixture,
    recentForm,
  };
}

// ============================================================
// Timely articles — event-linked first, padded with recent
// ============================================================

/**
 * Surfaces event-linked articles first (matches today's sports_events),
 * then pads with the newest published articles.
 */
export async function getTimelyArticles(
  limit = 6
): Promise<ArticleWithRelations[]> {
  const todayKey = new Date().toISOString().slice(0, 10);

  const todaysEventIds = await db
    .select({ id: sportsEvents.id })
    .from(sportsEvents)
    .where(eq(sportsEvents.date, todayKey));

  let timely: ArticleWithRelations[] = [];
  if (todaysEventIds.length) {
    const eventIds = todaysEventIds.map((r) => r.id);
    const rows = await db
      .select({
        article: articles,
        competition: {
          name: competitions.name,
          slug: competitions.slug,
        },
        season: {
          label: seasons.label,
        },
        primaryPlayer: {
          name: players.name,
          slug: players.slug,
        },
        primaryTeam: {
          name: teams.name,
          slug: teams.slug,
          logoUrl: teams.logoUrl,
        },
      })
      .from(articles)
      .leftJoin(
        competitionSeasons,
        eq(articles.competitionSeasonId, competitionSeasons.id)
      )
      .leftJoin(
        competitions,
        eq(competitionSeasons.competitionId, competitions.id)
      )
      .leftJoin(seasons, eq(competitionSeasons.seasonId, seasons.id))
      .leftJoin(players, eq(articles.primaryPlayerId, players.id))
      .leftJoin(teams, eq(articles.primaryTeamId, teams.id))
      .where(
        and(
          eq(articles.status, "published"),
          inArray(articles.sportsEventId, eventIds)
        )
      )
      .orderBy(desc(articles.publishedAt))
      .limit(limit);
    timely = rows;
  }

  if (timely.length >= limit) return timely;

  const padding = await getPublishedArticles(limit * 2);
  const seen = new Set(timely.map((t) => t.article.id));
  for (const a of padding) {
    if (timely.length >= limit) break;
    if (seen.has(a.article.id)) continue;
    timely.push(a);
    seen.add(a.article.id);
  }
  return timely;
}

// ============================================================
// Today's sports events
// ============================================================

export type TodaysEvent = typeof sportsEvents.$inferSelect;

export async function getTodaysEvents(): Promise<TodaysEvent[]> {
  const todayKey = new Date().toISOString().slice(0, 10);
  return db
    .select()
    .from(sportsEvents)
    .where(eq(sportsEvents.date, todayKey))
    .orderBy(desc(sportsEvents.importance));
}

// ============================================================
// Homepage aggregate counts (fast)
// ============================================================

export type HomepageStats = {
  players: number;
  teams: number;
  competitions: number;
  matches: number;
};

export async function getHomepageStats(): Promise<HomepageStats> {
  const [row] = await db.execute<{
    players: number;
    teams: number;
    competitions: number;
    matches: number;
  }>(sql`
    SELECT
      (SELECT COUNT(*) FROM players)::int as players,
      (SELECT COUNT(*) FROM teams)::int as teams,
      (SELECT COUNT(*) FROM competitions)::int as competitions,
      (SELECT COUNT(*) FROM matches)::int as matches
  `).then((r) => r.rows);

  return {
    players: row?.players ?? 0,
    teams: row?.teams ?? 0,
    competitions: row?.competitions ?? 0,
    matches: row?.matches ?? 0,
  };
}

// ============================================================
// Top competitions for the quick-link row
// ============================================================

export async function getTopCompetitionsForHome(limit = 12) {
  return db
    .select()
    .from(competitions)
    .orderBy(competitions.name)
    .limit(limit);
}
