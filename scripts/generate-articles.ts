/**
 * Generate news articles for matches, rounds, and player spotlights
 *
 * Usage:
 *   OPENAI_API_KEY=xxx npx tsx scripts/generate-articles.ts
 *   OPENAI_API_KEY=xxx npx tsx scripts/generate-articles.ts --type=match_report --limit=10
 *   OPENAI_API_KEY=xxx npx tsx scripts/generate-articles.ts --type=round_recap --competition=premier-league
 *   OPENAI_API_KEY=xxx npx tsx scripts/generate-articles.ts --dry-run
 */

import { neon } from "@neondatabase/serverless";
import OpenAI from "openai";
import {
  buildMatchReportPrompt,
  buildRoundRecapPrompt,
  buildPlayerSpotlightPrompt,
  buildMatchPreviewPrompt,
  buildSeasonRecapPrompt,
  type MatchReportContext,
  type RoundRecapContext,
  type PlayerSpotlightContext,
  type MatchPreviewContext,
  type SeasonRecapContext,
} from "./content/article-prompts";

const DATABASE_URL = process.env.DATABASE_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY environment variable is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Parse CLI args
const args = process.argv.slice(2);
const typeArg = args.find((a) => a.startsWith("--type="));
const articleType = typeArg?.split("=")[1];
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 10;
const competitionSlug = args.find((a) => a.startsWith("--competition="))?.split("=")[1];
const dryRun = args.includes("--dry-run");

interface ArticleResult {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
}

interface MatchWithoutArticleRow {
  id: string;
  matchday: number | null;
  scheduled_at: string;
  home_score: number;
  away_score: number;
  home_team: string;
  home_team_slug: string;
  away_team: string;
  away_team_slug: string;
  competition: string;
  competition_slug: string;
  competition_season_id: string;
  season: string;
  venue: string | null;
  existing_summary: string | null;
}

interface MatchEventRow {
  minute: number;
  type: string;
  player_name: string;
  team_name: string;
}

interface CompletedMatchdayRow {
  competition_season_id: string;
  competition: string;
  competition_slug: string;
  season: string;
  matchday: number;
}

interface MatchdayMatchRow {
  id: string;
  home_team: string;
  home_team_slug: string;
  away_team: string;
  away_team_slug: string;
  home_score: number;
  away_score: number;
}

interface MatchdayGoalScorerRow {
  match_id: string;
  player_name: string;
}

interface TopPerformerRow {
  player_id: string;
  player_name: string;
  player_slug: string;
  position: string | null;
  nationality: string | null;
  team_id: string;
  team_name: string;
  team_slug: string;
  competition: string | null;
  recent_goals: number;
  recent_assists: number;
  matches: number;
}

interface RecentPlayerMatchRow {
  opponent: string;
  result: string;
  goals: number;
  assists: number;
  rating: string | null;
}

interface UpcomingMatchRow {
  id: string;
  matchday: number | null;
  scheduled_at: string;
  home_team: string;
  home_team_slug: string;
  away_team: string;
  away_team_slug: string;
  competition: string;
  competition_slug: string;
  season: string;
  venue: string | null;
  competition_season_id: string;
}

interface TeamFormRow {
  result: string;
}

interface CompletedSeasonRow {
  competition_season_id: string;
  competition: string;
  competition_slug: string;
  season: string;
  winner_team_id: string | null;
  winner_name: string | null;
  winner_slug: string | null;
  match_count: number | string | null;
  total_goals: number | string | null;
}

interface PlayerSeasonStatsRow {
  appearances: number;
  goals: number;
  assists: number;
  competition: string;
}

async function generateArticle(prompt: string): Promise<ArticleResult | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 6000,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("  Failed to parse JSON from response");
      return null;
    }

    return JSON.parse(jsonMatch[0]) as ArticleResult;
  } catch (error) {
    console.error("  OpenAI API error:", error);
    return null;
  }
}

async function getMatchesWithoutArticles(
  limitNum: number
): Promise<MatchWithoutArticleRow[]> {
  return (await sql`
    SELECT
      m.id,
      m.matchday,
      m.scheduled_at,
      m.home_score,
      m.away_score,
      ht.name as home_team,
      ht.slug as home_team_slug,
      at.name as away_team,
      at.slug as away_team_slug,
      c.name as competition,
      c.slug as competition_slug,
      cs.id as competition_season_id,
      s.label as season,
      v.name as venue,
      ms.summary as existing_summary
    FROM matches m
    INNER JOIN teams ht ON m.home_team_id = ht.id
    INNER JOIN teams at ON m.away_team_id = at.id
    INNER JOIN competition_seasons cs ON m.competition_season_id = cs.id
    INNER JOIN competitions c ON cs.competition_id = c.id
    INNER JOIN seasons s ON cs.season_id = s.id
    LEFT JOIN venues v ON m.venue_id = v.id
    LEFT JOIN match_summaries ms ON m.id = ms.match_id
    LEFT JOIN articles a ON m.id = a.match_id AND a.type = 'match_report'
    WHERE m.status = 'finished'
      AND m.home_score IS NOT NULL
      AND a.id IS NULL
    ORDER BY m.scheduled_at DESC
    LIMIT ${limitNum}
  `) as MatchWithoutArticleRow[];
}

async function getMatchEvents(matchId: string): Promise<MatchEventRow[]> {
  return (await sql`
    SELECT
      me.minute,
      me.type,
      p.name as player_name,
      t.name as team_name
    FROM match_events me
    INNER JOIN players p ON me.player_id = p.id
    INNER JOIN teams t ON me.team_id = t.id
    WHERE me.match_id = ${matchId}
    ORDER BY me.minute
  `) as MatchEventRow[];
}

async function insertArticle(
  article: ArticleResult,
  type: string,
  matchId?: string,
  competitionSeasonId?: string,
  primaryPlayerId?: string,
  primaryTeamId?: string,
  matchday?: number
): Promise<boolean> {
  try {
    // Check if slug already exists
    const existing = await sql`SELECT id FROM articles WHERE slug = ${article.slug}`;
    if (existing.length > 0) {
      // Append timestamp to make unique
      article.slug = `${article.slug}-${Date.now()}`;
    }

    await sql`
      INSERT INTO articles (
        slug, type, title, excerpt, content, meta_title, meta_description,
        match_id, competition_season_id, primary_player_id, primary_team_id,
        matchday, status, published_at, model_version
      ) VALUES (
        ${article.slug}, ${type}, ${article.title}, ${article.excerpt}, ${article.content},
        ${article.metaTitle}, ${article.metaDescription},
        ${matchId ?? null}, ${competitionSeasonId ?? null},
        ${primaryPlayerId ?? null}, ${primaryTeamId ?? null},
        ${matchday ?? null}, 'published', NOW(), 'gpt-4o-mini'
      )
    `;
    return true;
  } catch (error) {
    console.error("  Database error:", error);
    return false;
  }
}

async function linkArticleToTeams(
  articleSlug: string,
  teamSlugs: string[]
): Promise<void> {
  const [article] = await sql`SELECT id FROM articles WHERE slug = ${articleSlug}`;
  if (!article) return;

  for (const slug of teamSlugs) {
    const [team] = await sql`SELECT id FROM teams WHERE slug = ${slug}`;
    if (team) {
      await sql`
        INSERT INTO article_teams (article_id, team_id, role)
        VALUES (${article.id}, ${team.id}, 'featured')
        ON CONFLICT DO NOTHING
      `;
    }
  }
}

async function generateMatchReports(limitNum: number): Promise<number> {
  console.log(`\nGenerating match report articles (limit: ${limitNum})...`);

  const matches = await getMatchesWithoutArticles(limitNum);
  console.log(`Found ${matches.length} matches without articles`);

  let generated = 0;

  for (const match of matches) {
    console.log(`\nProcessing: ${match.home_team} ${match.home_score}-${match.away_score} ${match.away_team}`);

    const events = await getMatchEvents(match.id);

    const context: MatchReportContext = {
      match: {
        id: match.id,
        homeTeam: match.home_team,
        homeTeamSlug: match.home_team_slug,
        awayTeam: match.away_team,
        awayTeamSlug: match.away_team_slug,
        homeScore: match.home_score,
        awayScore: match.away_score,
        competition: match.competition,
        competitionSlug: match.competition_slug,
        season: match.season,
        matchday: match.matchday,
        date: match.scheduled_at,
        venue: match.venue,
      },
      events: events.map((e) => ({
        minute: e.minute,
        type: e.type,
        playerName: e.player_name,
        teamName: e.team_name,
      })),
      existingSummary: match.existing_summary,
    };

    if (dryRun) {
      console.log(`  [DRY RUN] Would generate article for match ${match.id}`);
      generated++;
      continue;
    }

    const prompt = buildMatchReportPrompt(context);
    const article = await generateArticle(prompt);

    if (article) {
      const success = await insertArticle(
        article,
        "match_report",
        match.id,
        match.competition_season_id
      );
      if (success) {
        await linkArticleToTeams(article.slug, [match.home_team_slug, match.away_team_slug]);
        console.log(`  Created: "${article.title}"`);
        generated++;
      }
    }

    // Rate limiting
    await new Promise((r) => setTimeout(r, 500));
  }

  return generated;
}

async function getCompletedMatchdays(): Promise<CompletedMatchdayRow[]> {
  // Find matchdays where all matches are finished and no article exists yet
  return (await sql`
    WITH matchday_status AS (
      SELECT
        cs.id as competition_season_id,
        c.name as competition,
        c.slug as competition_slug,
        s.label as season,
        m.matchday,
        COUNT(*) as total_matches,
        COUNT(*) FILTER (WHERE m.status = 'finished') as finished_matches
      FROM matches m
      INNER JOIN competition_seasons cs ON m.competition_season_id = cs.id
      INNER JOIN competitions c ON cs.competition_id = c.id
      INNER JOIN seasons s ON cs.season_id = s.id
      WHERE m.matchday IS NOT NULL
        AND (${competitionSlug || null} IS NULL OR c.slug = ${competitionSlug || null})
      GROUP BY cs.id, c.name, c.slug, s.label, m.matchday
    )
    SELECT ms.*
    FROM matchday_status ms
    LEFT JOIN articles a ON
      a.competition_season_id = ms.competition_season_id
      AND a.matchday = ms.matchday
      AND a.type = 'round_recap'
    WHERE ms.total_matches = ms.finished_matches
      AND ms.finished_matches >= 3
      AND a.id IS NULL
    ORDER BY ms.competition, ms.matchday DESC
    LIMIT ${limit}
  `) as CompletedMatchdayRow[];
}

async function getMatchdayMatches(
  competitionSeasonId: string,
  matchday: number
): Promise<MatchdayMatchRow[]> {
  return (await sql`
    SELECT
      m.id,
      ht.name as home_team,
      ht.slug as home_team_slug,
      at.name as away_team,
      at.slug as away_team_slug,
      m.home_score,
      m.away_score
    FROM matches m
    INNER JOIN teams ht ON m.home_team_id = ht.id
    INNER JOIN teams at ON m.away_team_id = at.id
    WHERE m.competition_season_id = ${competitionSeasonId}
      AND m.matchday = ${matchday}
    ORDER BY m.scheduled_at
  `) as MatchdayMatchRow[];
}

async function getMatchdayGoalScorers(
  competitionSeasonId: string,
  matchday: number
): Promise<Map<string, string[]>> {
  const events = (await sql`
    SELECT
      m.id as match_id,
      p.name as player_name
    FROM match_events me
    INNER JOIN matches m ON me.match_id = m.id
    INNER JOIN players p ON me.player_id = p.id
    WHERE m.competition_season_id = ${competitionSeasonId}
      AND m.matchday = ${matchday}
      AND me.type IN ('goal', 'penalty')
    ORDER BY m.id, me.minute
  `) as MatchdayGoalScorerRow[];

  const scorersByMatch = new Map<string, string[]>();
  for (const e of events) {
    const current = scorersByMatch.get(e.match_id) || [];
    current.push(e.player_name);
    scorersByMatch.set(e.match_id, current);
  }
  return scorersByMatch;
}

async function generateRoundRecaps(): Promise<number> {
  console.log(`\nGenerating round recap articles...`);

  const matchdays = await getCompletedMatchdays();
  console.log(`Found ${matchdays.length} completed matchdays without articles`);

  let generated = 0;

  for (const md of matchdays) {
    console.log(`\nProcessing: ${md.competition} Matchday ${md.matchday}`);

    const matches = await getMatchdayMatches(md.competition_season_id, md.matchday);

    // Get goal scorers per match (simplified - just get all scorers for matchday)
    const scorersMap = await getMatchdayGoalScorers(md.competition_season_id, md.matchday);

    const context: RoundRecapContext = {
      competition: md.competition,
      competitionSlug: md.competition_slug,
      season: md.season,
      matchday: md.matchday,
      matches: matches.map((m) => ({
        homeTeam: m.home_team,
        awayTeam: m.away_team,
        homeScore: m.home_score,
        awayScore: m.away_score,
        topScorers: scorersMap.get(m.id) || [],
      })),
    };

    if (dryRun) {
      console.log(`  [DRY RUN] Would generate round recap`);
      generated++;
      continue;
    }

    const prompt = buildRoundRecapPrompt(context);
    const article = await generateArticle(prompt);

    if (article) {
      const success = await insertArticle(
        article,
        "round_recap",
        undefined,
        md.competition_season_id,
        undefined,
        undefined,
        md.matchday
      );
      if (success) {
        await linkArticleToTeams(
          article.slug,
          Array.from(
            new Set(matches.flatMap((m) => [m.home_team_slug, m.away_team_slug]))
          )
        );
        console.log(`  Created: "${article.title}"`);
        generated++;
      }
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  return generated;
}

async function getTopPerformers(): Promise<TopPerformerRow[]> {
  // Find players with standout attacking output over the last two weeks.
  return (await sql`
    WITH recent_player_matches AS (
      SELECT
        ml.player_id,
        ml.team_id,
        m.competition_season_id,
        m.id as match_id,
        COALESCE(
          SUM(CASE WHEN me.player_id = ml.player_id AND me.type IN ('goal', 'penalty') THEN 1 ELSE 0 END),
          0
        )::int as goals,
        COALESCE(
          SUM(CASE WHEN me.secondary_player_id = ml.player_id AND me.type IN ('goal', 'penalty') THEN 1 ELSE 0 END),
          0
        )::int as assists
      FROM match_lineups ml
      INNER JOIN matches m ON ml.match_id = m.id
      LEFT JOIN match_events me ON me.match_id = m.id
      WHERE COALESCE(ml.minutes_played, 0) > 0
        AND m.status = 'finished'
        AND m.scheduled_at >= NOW() - INTERVAL '14 days'
      GROUP BY ml.player_id, ml.team_id, m.competition_season_id, m.id
    ),
    recent_stars AS (
      SELECT
        p.id as player_id,
        p.name as player_name,
        p.slug as player_slug,
        p.position,
        p.nationality,
        t.id as team_id,
        t.name as team_name,
        t.slug as team_slug,
        MIN(c.name) as competition,
        SUM(rpm.goals)::int as recent_goals,
        SUM(rpm.assists)::int as recent_assists,
        COUNT(*)::int as matches
      FROM recent_player_matches rpm
      INNER JOIN players p ON p.id = rpm.player_id
      INNER JOIN teams t ON t.id = rpm.team_id
      INNER JOIN competition_seasons cs ON cs.id = rpm.competition_season_id
      INNER JOIN competitions c ON cs.competition_id = c.id
      GROUP BY p.id, p.name, p.slug, p.position, p.nationality, t.id, t.name, t.slug
      HAVING SUM(rpm.goals) >= 2
    )
    SELECT rs.*
    FROM recent_stars rs
    LEFT JOIN articles a ON a.primary_player_id = rs.player_id
      AND a.type = 'player_spotlight'
      AND a.generated_at >= NOW() - INTERVAL '14 days'
    WHERE a.id IS NULL
    ORDER BY rs.recent_goals DESC, rs.recent_assists DESC, rs.matches ASC
    LIMIT ${limit}
  `) as TopPerformerRow[];
}

async function getRecentPlayerMatches(
  playerId: string,
  teamId: string
): Promise<PlayerSpotlightContext["recentMatches"]> {
  const rows = (await sql`
    SELECT
      CASE WHEN m.home_team_id = ${teamId} THEN at.name ELSE ht.name END as opponent,
      CASE
        WHEN (m.home_team_id = ${teamId} AND m.home_score > m.away_score)
          OR (m.away_team_id = ${teamId} AND m.away_score > m.home_score)
        THEN 'W'
        WHEN m.home_score = m.away_score THEN 'D'
        ELSE 'L'
      END as result,
      COALESCE(
        SUM(CASE WHEN me.player_id = ${playerId} AND me.type IN ('goal', 'penalty') THEN 1 ELSE 0 END),
        0
      )::int as goals,
      COALESCE(
        SUM(CASE WHEN me.secondary_player_id = ${playerId} AND me.type IN ('goal', 'penalty') THEN 1 ELSE 0 END),
        0
      )::int as assists,
      MAX(ml.rating)::text as rating
    FROM match_lineups ml
    INNER JOIN matches m ON ml.match_id = m.id
    INNER JOIN teams ht ON m.home_team_id = ht.id
    INNER JOIN teams at ON m.away_team_id = at.id
    LEFT JOIN match_events me ON me.match_id = m.id
    WHERE ml.player_id = ${playerId}
      AND ml.team_id = ${teamId}
      AND COALESCE(ml.minutes_played, 0) > 0
      AND m.status = 'finished'
      AND m.scheduled_at >= NOW() - INTERVAL '14 days'
    GROUP BY m.id, m.scheduled_at, ht.name, at.name, m.home_team_id, m.away_team_id, m.home_score, m.away_score
    ORDER BY m.scheduled_at DESC
    LIMIT 5
  `) as RecentPlayerMatchRow[];

  return rows.map((row) => ({
    opponent: row.opponent,
    result: row.result,
    goals: Number(row.goals),
    assists: Number(row.assists),
    rating: row.rating ? Number(row.rating) : undefined,
  }));
}

async function getPlayerSeasonStats(
  playerId: string,
  teamId: string
): Promise<PlayerSeasonStatsRow | null> {
  const [row] = (await sql`
    SELECT
      pss.appearances,
      pss.goals,
      pss.assists,
      c.name as competition
    FROM player_season_stats pss
    INNER JOIN competition_seasons cs ON pss.competition_season_id = cs.id
    INNER JOIN competitions c ON cs.competition_id = c.id
    INNER JOIN seasons s ON cs.season_id = s.id
    WHERE pss.player_id = ${playerId}
      AND pss.team_id = ${teamId}
    ORDER BY s.is_current DESC, s.start_date DESC
    LIMIT 1
  `) as PlayerSeasonStatsRow[];

  if (!row) {
    return null;
  }

  return {
    appearances: Number(row.appearances),
    goals: Number(row.goals),
    assists: Number(row.assists),
    competition: row.competition,
  };
}

async function generatePlayerSpotlights(): Promise<number> {
  console.log(`\nGenerating player spotlight articles...`);

  const performers = await getTopPerformers();
  console.log(`Found ${performers.length} top performers without recent articles`);

  let generated = 0;

  for (const player of performers) {
    console.log(`\nProcessing: ${player.player_name} (${player.recent_goals} goals)`);

    const recentMatches = await getRecentPlayerMatches(
      player.player_id,
      player.team_id
    );
    const seasonStats =
      (await getPlayerSeasonStats(player.player_id, player.team_id)) || {
        appearances: player.matches,
        goals: player.recent_goals,
        assists: player.recent_assists,
        competition: player.competition || "League",
      };

    const context: PlayerSpotlightContext = {
      player: {
        name: player.player_name,
        slug: player.player_slug,
        position: player.position || "Forward",
        nationality: player.nationality || "Unknown",
        currentTeam: player.team_name,
        currentTeamSlug: player.team_slug,
      },
      recentMatches,
      seasonStats,
      achievement: `${player.recent_goals} goals and ${player.recent_assists} assists in ${player.matches} matches`,
    };

    if (dryRun) {
      console.log(`  [DRY RUN] Would generate player spotlight`);
      generated++;
      continue;
    }

    const prompt = buildPlayerSpotlightPrompt(context);
    const article = await generateArticle(prompt);

    if (article) {
      const success = await insertArticle(
        article,
        "player_spotlight",
        undefined,
        undefined,
        player.player_id,
        player.team_id
      );
      if (success) {
        await linkArticleToTeams(article.slug, [player.team_slug]);
        console.log(`  Created: "${article.title}"`);
        generated++;
      }
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  return generated;
}

async function getUpcomingMatches(
  limitNum: number,
  daysAhead = 2
): Promise<UpcomingMatchRow[]> {
  const cutoff = new Date(Date.now() + daysAhead * 86_400_000).toISOString();
  return (await sql`
    SELECT
      m.id,
      m.matchday,
      m.scheduled_at,
      ht.name as home_team,
      ht.slug as home_team_slug,
      at.name as away_team,
      at.slug as away_team_slug,
      c.name as competition,
      c.slug as competition_slug,
      s.label as season,
      v.name as venue,
      cs.id as competition_season_id
    FROM matches m
    INNER JOIN teams ht ON m.home_team_id = ht.id
    INNER JOIN teams at ON m.away_team_id = at.id
    INNER JOIN competition_seasons cs ON m.competition_season_id = cs.id
    INNER JOIN competitions c ON cs.competition_id = c.id
    INNER JOIN seasons s ON cs.season_id = s.id
    LEFT JOIN venues v ON m.venue_id = v.id
    LEFT JOIN articles a ON m.id = a.match_id AND a.type = 'match_preview'
    WHERE m.status = 'scheduled'
      AND m.scheduled_at BETWEEN NOW() AND ${cutoff}::timestamptz
      AND a.id IS NULL
    ORDER BY m.scheduled_at ASC
    LIMIT ${limitNum}
  `) as UpcomingMatchRow[];
}

async function getTeamForm(teamId: string): Promise<string> {
  const results = (await sql`
    SELECT
      CASE
        WHEN (m.home_team_id = ${teamId} AND m.home_score > m.away_score)
          OR (m.away_team_id = ${teamId} AND m.away_score > m.home_score)
        THEN 'W'
        WHEN m.home_score = m.away_score THEN 'D'
        ELSE 'L'
      END as result
    FROM matches m
    WHERE (m.home_team_id = ${teamId} OR m.away_team_id = ${teamId})
      AND m.status = 'finished'
    ORDER BY m.scheduled_at DESC
    LIMIT 5
  `) as TeamFormRow[];
  return results.map((r) => r.result).join("");
}

async function generateMatchPreviews(): Promise<number> {
  console.log(`\nGenerating match preview articles...`);

  const matches = await getUpcomingMatches(limit, 3); // 3 days ahead
  console.log(`Found ${matches.length} upcoming matches without previews`);

  let generated = 0;

  for (const match of matches) {
    console.log(`\nProcessing: ${match.home_team} vs ${match.away_team}`);

    // Get team forms
    const homeTeamId = await sql`SELECT id FROM teams WHERE slug = ${match.home_team_slug}`;
    const awayTeamId = await sql`SELECT id FROM teams WHERE slug = ${match.away_team_slug}`;

    const homeForm = homeTeamId[0] ? await getTeamForm(homeTeamId[0].id) : "";
    const awayForm = awayTeamId[0] ? await getTeamForm(awayTeamId[0].id) : "";

    const context: MatchPreviewContext = {
      match: {
        homeTeam: match.home_team,
        homeTeamSlug: match.home_team_slug,
        awayTeam: match.away_team,
        awayTeamSlug: match.away_team_slug,
        competition: match.competition,
        competitionSlug: match.competition_slug,
        season: match.season,
        matchday: match.matchday,
        date: match.scheduled_at,
        venue: match.venue,
      },
      homeTeamForm: homeForm,
      awayTeamForm: awayForm,
    };

    if (dryRun) {
      console.log(`  [DRY RUN] Would generate match preview`);
      generated++;
      continue;
    }

    const prompt = buildMatchPreviewPrompt(context);
    const article = await generateArticle(prompt);

    if (article) {
      const success = await insertArticle(
        article,
        "match_preview",
        match.id,
        match.competition_season_id
      );
      if (success) {
        await linkArticleToTeams(article.slug, [match.home_team_slug, match.away_team_slug]);
        console.log(`  Created: "${article.title}"`);
        generated++;
      }
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  return generated;
}

async function getCompletedSeasons(): Promise<CompletedSeasonRow[]> {
  return (await sql`
    SELECT
      cs.id as competition_season_id,
      c.name as competition,
      c.slug as competition_slug,
      s.label as season,
      st.team_id as winner_team_id,
      t.name as winner_name,
      t.slug as winner_slug,
      (SELECT COUNT(*) FROM matches WHERE competition_season_id = cs.id AND status = 'finished') as match_count,
      (SELECT SUM(home_score + away_score) FROM matches WHERE competition_season_id = cs.id AND status = 'finished') as total_goals
    FROM competition_seasons cs
    INNER JOIN competitions c ON cs.competition_id = c.id
    INNER JOIN seasons s ON cs.season_id = s.id
    LEFT JOIN standings st ON st.competition_season_id = cs.id AND st.position = 1
    LEFT JOIN teams t ON st.team_id = t.id
    LEFT JOIN articles a ON a.competition_season_id = cs.id AND a.type = 'season_review'
    WHERE cs.status = 'completed'
      AND a.id IS NULL
    LIMIT ${limit}
  `) as CompletedSeasonRow[];
}

async function generateSeasonRecaps(): Promise<number> {
  console.log(`\nGenerating season recap articles...`);

  const seasons = await getCompletedSeasons();
  console.log(`Found ${seasons.length} completed seasons without recaps`);

  let generated = 0;

  for (const season of seasons) {
    console.log(`\nProcessing: ${season.competition} ${season.season}`);

    const matchCount = Number(season.match_count) || 0;
    const totalGoals = Number(season.total_goals) || 0;

    const context: SeasonRecapContext = {
      competition: season.competition,
      competitionSlug: season.competition_slug,
      season: season.season,
      winner: season.winner_name,
      winnerSlug: season.winner_slug,
      keyStats: {
        totalGoals: totalGoals,
        matches: matchCount,
        avgGoalsPerMatch: matchCount > 0 ? totalGoals / matchCount : 0,
      },
    };

    if (dryRun) {
      console.log(`  [DRY RUN] Would generate season recap`);
      generated++;
      continue;
    }

    const prompt = buildSeasonRecapPrompt(context);
    const article = await generateArticle(prompt);

    if (article) {
      const success = await insertArticle(
        article,
        "season_review",
        undefined,
        season.competition_season_id
      );
      if (success) {
        console.log(`  Created: "${article.title}"`);
        generated++;
      }
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  return generated;
}

async function main() {
  console.log("Article Generation Script");
  console.log("=========================");

  if (dryRun) {
    console.log("Running in DRY RUN mode - no articles will be created\n");
  }

  let totalGenerated = 0;

  // Generate based on type or all
  if (!articleType || articleType === "match_report") {
    totalGenerated += await generateMatchReports(limit);
  }

  if (!articleType || articleType === "match_preview") {
    totalGenerated += await generateMatchPreviews();
  }

  if (!articleType || articleType === "round_recap") {
    totalGenerated += await generateRoundRecaps();
  }

  if (!articleType || articleType === "player_spotlight") {
    totalGenerated += await generatePlayerSpotlights();
  }

  if (!articleType || articleType === "season_review") {
    totalGenerated += await generateSeasonRecaps();
  }

  console.log("\n=========================");
  console.log(`Total articles generated: ${totalGenerated}`);
  console.log("Done!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
