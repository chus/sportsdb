import { NextRequest, NextResponse } from "next/server";
import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import OpenAI from "openai";
import {
  buildPlayerSpotlightPrompt,
  buildRoundRecapPrompt,
} from "@/lib/content/article-prompts";

export const maxDuration = 300; // 5 minutes

interface GeneratedArticle {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
}

interface MatchReportRow {
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
  season: string;
  competition_season_id: string;
  venue: string | null;
  existing_summary: string | null;
}

interface MatchEventRow {
  minute: number;
  type: string;
  player_name: string;
  team_name: string;
}

interface MatchdayRow {
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
  top_scorers: string[] | null;
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
  rating?: number;
}

interface RecentPlayerMatchQueryRow {
  opponent: string;
  result: string;
  goals: number;
  assists: number;
  rating: string | null;
}

interface PlayerSeasonStatsRow {
  appearances: number;
  goals: number;
  assists: number;
  competition: string;
}

interface ArticleGenerationStatus {
  totals: {
    all: number;
    byType: Record<string, number>;
  };
  lastPublishedAtByType: Record<string, string | null>;
  pending: {
    matchReports: number;
    roundRecaps: number;
    playerSpotlights: number;
  };
}

interface CountRow {
  count: number;
}

interface PublishedTypeCountRow {
  type: string;
  count: number;
}

interface PublishedTypeTimestampRow {
  type: string;
  last_published_at: string | null;
}

interface GenerationConfig {
  matchReportsLimit: number;
  roundRecapsLimit: number;
  playerSpotlightsLimit: number;
  recapMinFinishedMatches: number;
  spotlightLookbackDays: number;
  spotlightMinGoals: number;
  dryRun: boolean;
}

const DEFAULT_GENERATION_CONFIG: GenerationConfig = {
  matchReportsLimit: 10,
  roundRecapsLimit: 2,
  playerSpotlightsLimit: 3,
  recapMinFinishedMatches: 3,
  spotlightLookbackDays: 14,
  spotlightMinGoals: 2,
  dryRun: false,
};

export async function GET(request: NextRequest) {
  return handleRequest(request, buildConfigFromSearchParams(request));
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Partial<GenerationConfig>;
  const config = buildConfigFromBody(body);
  return handleRequest(request, config);
}

async function handleRequest(request: NextRequest, config: GenerationConfig) {
  const DATABASE_URL = process.env.DATABASE_URL;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const CRON_SECRET = process.env.CRON_SECRET;

  if (!DATABASE_URL) {
    return NextResponse.json(
      { error: "Missing required environment variables" },
      { status: 500 }
    );
  }

  const sql = neon(DATABASE_URL);

  // Verify cron secret (fail closed: require secret unless explicitly unset in dev)
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mode = request.nextUrl.searchParams.get("mode");

  if (mode === "status") {
    const status = await getGenerationStatus(sql, config);
    return NextResponse.json({
      success: true,
      mode: "status",
      config,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  if (!config.dryRun && !OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is required unless dryRun=true" },
      { status: 500 }
    );
  }

  const openai = config.dryRun ? null : new OpenAI({ apiKey: OPENAI_API_KEY });

  try {
    const statusBefore = await getGenerationStatus(sql, config);
    const results = {
      matchReports: 0,
      roundRecaps: 0,
      playerSpotlights: 0,
      errors: [] as string[],
      dryRun: config.dryRun,
    };

    // Generate match reports.
    const matchesToProcess = (await sql`
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
        s.label as season,
        cs.id as competition_season_id,
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
      LIMIT ${config.matchReportsLimit}
    `) as MatchReportRow[];

    for (const match of matchesToProcess) {
      try {
        const events = (await sql`
          SELECT me.minute, me.type, p.name as player_name, t.name as team_name
          FROM match_events me
          INNER JOIN players p ON me.player_id = p.id
          INNER JOIN teams t ON me.team_id = t.id
          WHERE me.match_id = ${match.id}
          ORDER BY me.minute
        `) as MatchEventRow[];

        const prompt = buildMatchReportPrompt(match, events);
        const article = config.dryRun ? null : await generateArticle(openai!, prompt);

        if (config.dryRun) {
          results.matchReports++;
        } else if (article) {
          await insertArticle(sql, article, "match_report", {
            matchId: match.id,
            competitionSeasonId: match.competition_season_id,
            teamSlugs: [match.home_team_slug, match.away_team_slug],
          });
          results.matchReports++;
        }

        await new Promise((r) => setTimeout(r, 500));
      } catch (error) {
        results.errors.push(`Match ${match.id}: ${error}`);
      }
    }

    const matchdaysToProcess = await getCompletedMatchdays(
      sql,
      config.roundRecapsLimit,
      config.recapMinFinishedMatches
    );

    for (const matchday of matchdaysToProcess) {
      try {
        const matches = await getMatchdayMatches(
          sql,
          matchday.competition_season_id,
          matchday.matchday
        );

        if (matches.length === 0) {
          continue;
        }

        const prompt = buildRoundRecapPrompt({
          competition: matchday.competition,
          competitionSlug: matchday.competition_slug,
          season: matchday.season,
          matchday: matchday.matchday,
          matches: matches.map((m) => ({
            homeTeam: m.home_team,
            awayTeam: m.away_team,
            homeScore: m.home_score,
            awayScore: m.away_score,
            topScorers: m.top_scorers ?? [],
          })),
        });

        const article = config.dryRun ? null : await generateArticle(openai!, prompt);

        if (config.dryRun) {
          results.roundRecaps++;
        } else if (article) {
          await insertArticle(sql, article, "round_recap", {
            competitionSeasonId: matchday.competition_season_id,
            matchday: matchday.matchday,
            teamSlugs: Array.from(
              new Set(
                matches.flatMap((m) => [m.home_team_slug, m.away_team_slug])
              )
            ),
          });
          results.roundRecaps++;
        }

        await new Promise((r) => setTimeout(r, 500));
      } catch (error) {
        results.errors.push(
          `Round recap ${matchday.competition_season_id}/${matchday.matchday}: ${error}`
        );
      }
    }

    const performersToProcess = await getTopPerformers(
      sql,
      config.playerSpotlightsLimit,
      config.spotlightLookbackDays,
      config.spotlightMinGoals
    );

    for (const performer of performersToProcess) {
      try {
        const recentMatches = await getRecentPlayerMatches(
          sql,
          performer.player_id,
          performer.team_id,
          config.spotlightLookbackDays
        );
        const seasonStats =
          (await getPlayerSeasonStats(sql, performer.player_id, performer.team_id)) || {
            appearances: Number(performer.matches),
            goals: Number(performer.recent_goals),
            assists: Number(performer.recent_assists),
            competition: performer.competition || "League",
          };

        const prompt = buildPlayerSpotlightPrompt({
          player: {
            name: performer.player_name,
            slug: performer.player_slug,
            position: performer.position || "Forward",
            nationality: performer.nationality || "Unknown",
            currentTeam: performer.team_name,
            currentTeamSlug: performer.team_slug,
          },
          recentMatches,
          seasonStats,
          achievement: `${performer.recent_goals} goals and ${performer.recent_assists} assists in ${performer.matches} matches`,
        });

        const article = config.dryRun ? null : await generateArticle(openai!, prompt);

        if (config.dryRun) {
          results.playerSpotlights++;
        } else if (article) {
          await insertArticle(sql, article, "player_spotlight", {
            primaryPlayerId: performer.player_id,
            primaryTeamId: performer.team_id,
            teamSlugs: [performer.team_slug],
          });
          results.playerSpotlights++;
        }

        await new Promise((r) => setTimeout(r, 500));
      } catch (error) {
        results.errors.push(`Player spotlight ${performer.player_id}: ${error}`);
      }
    }

    const statusAfter = await getGenerationStatus(sql, config);

    return NextResponse.json({
      success: true,
      mode: config.dryRun ? "dry-run" : request.method.toLowerCase(),
      config,
      ...results,
      statusBefore,
      statusAfter,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Article generation cron error:", error);
    return NextResponse.json(
      { error: "Failed to generate articles", details: String(error) },
      { status: 500 }
    );
  }
}

function buildConfigFromSearchParams(request: NextRequest): GenerationConfig {
  const params = request.nextUrl.searchParams;
  return {
    matchReportsLimit: parsePositiveInt(
      params.get("matchReportsLimit"),
      DEFAULT_GENERATION_CONFIG.matchReportsLimit
    ),
    roundRecapsLimit: parsePositiveInt(
      params.get("roundRecapsLimit"),
      DEFAULT_GENERATION_CONFIG.roundRecapsLimit
    ),
    playerSpotlightsLimit: parsePositiveInt(
      params.get("playerSpotlightsLimit"),
      DEFAULT_GENERATION_CONFIG.playerSpotlightsLimit
    ),
    recapMinFinishedMatches: parsePositiveInt(
      params.get("recapMinFinishedMatches"),
      DEFAULT_GENERATION_CONFIG.recapMinFinishedMatches
    ),
    spotlightLookbackDays: parsePositiveInt(
      params.get("spotlightLookbackDays"),
      DEFAULT_GENERATION_CONFIG.spotlightLookbackDays
    ),
    spotlightMinGoals: parsePositiveInt(
      params.get("spotlightMinGoals"),
      DEFAULT_GENERATION_CONFIG.spotlightMinGoals
    ),
    dryRun: parseBoolean(
      params.get("dryRun"),
      DEFAULT_GENERATION_CONFIG.dryRun
    ),
  };
}

function buildConfigFromBody(body: Partial<GenerationConfig>): GenerationConfig {
  return {
    matchReportsLimit: sanitizePositiveInt(
      body.matchReportsLimit,
      DEFAULT_GENERATION_CONFIG.matchReportsLimit
    ),
    roundRecapsLimit: sanitizePositiveInt(
      body.roundRecapsLimit,
      DEFAULT_GENERATION_CONFIG.roundRecapsLimit
    ),
    playerSpotlightsLimit: sanitizePositiveInt(
      body.playerSpotlightsLimit,
      DEFAULT_GENERATION_CONFIG.playerSpotlightsLimit
    ),
    recapMinFinishedMatches: sanitizePositiveInt(
      body.recapMinFinishedMatches,
      DEFAULT_GENERATION_CONFIG.recapMinFinishedMatches
    ),
    spotlightLookbackDays: sanitizePositiveInt(
      body.spotlightLookbackDays,
      DEFAULT_GENERATION_CONFIG.spotlightLookbackDays
    ),
    spotlightMinGoals: sanitizePositiveInt(
      body.spotlightMinGoals,
      DEFAULT_GENERATION_CONFIG.spotlightMinGoals
    ),
    dryRun:
      typeof body.dryRun === "boolean"
        ? body.dryRun
        : DEFAULT_GENERATION_CONFIG.dryRun,
  };
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = value ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sanitizePositiveInt(
  value: number | undefined,
  fallback: number
): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

function parseBoolean(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

async function getGenerationStatus(
  sql: NeonQueryFunction<false, false>,
  config: GenerationConfig
): Promise<ArticleGenerationStatus> {
  const [publishedRowsResult, lastPublishedRowsResult, matchReportsPending, roundRecapsPending, playerSpotlightsPending] =
    await Promise.all([
      sql`
        SELECT type, COUNT(*)::int as count
        FROM articles
        WHERE status = 'published'
        GROUP BY type
      `,
      sql`
        SELECT type, MAX(published_at) as last_published_at
        FROM articles
        WHERE status = 'published'
        GROUP BY type
      `,
      getPendingMatchReportCount(sql),
      getCompletedMatchdayCount(sql, config.recapMinFinishedMatches),
      getTopPerformerCount(
        sql,
        config.spotlightLookbackDays,
        config.spotlightMinGoals
      ),
    ]);
  const publishedRows = publishedRowsResult as PublishedTypeCountRow[];
  const lastPublishedRows = lastPublishedRowsResult as PublishedTypeTimestampRow[];

  const byType = Object.fromEntries(
    publishedRows.map((row) => [row.type as string, Number(row.count)])
  );
  const lastPublishedAtByType = Object.fromEntries(
    lastPublishedRows.map((row) => [
      row.type as string,
      row.last_published_at ? String(row.last_published_at) : null,
    ])
  );

  return {
    totals: {
      all: Object.values(byType).reduce((sum, count) => sum + count, 0),
      byType,
    },
    lastPublishedAtByType,
    pending: {
      matchReports: matchReportsPending,
      roundRecaps: roundRecapsPending,
      playerSpotlights: playerSpotlightsPending,
    },
  };
}

function buildMatchReportPrompt(match: MatchReportRow, events: MatchEventRow[]): string {
  const scoreline = `${match.home_team} ${match.home_score}-${match.away_score} ${match.away_team}`;
  const homeTeamLink = `[${match.home_team}](/teams/${match.home_team_slug})`;
  const awayTeamLink = `[${match.away_team}](/teams/${match.away_team_slug})`;
  const competitionLink = `[${match.competition}](/competitions/${match.competition_slug})`;

  return `You are an experienced sports journalist writing an in-depth match report for SportsDB, a professional football database website. Write with authority, insight, and engaging storytelling.

MATCH INFORMATION:
- Competition: ${match.competition} (${match.season})
- Matchday: ${match.matchday || 'N/A'}
- Date: ${match.scheduled_at}
- Final Score: ${scoreline}
${match.venue ? `- Venue: ${match.venue}` : ""}

MATCH EVENTS TIMELINE:
${events.length > 0 ? events.map((e) => `${e.minute}' - ${e.type.toUpperCase()}: ${e.player_name} (${e.team_name})`).join("\n") : "No detailed events available"}

${match.existing_summary ? `ADDITIONAL CONTEXT:\n${match.existing_summary}` : ""}

LINKS TO INCLUDE (use these exact markdown formats):
- Home team: ${homeTeamLink}
- Away team: ${awayTeamLink}
- Competition: ${competitionLink}
- For players: [Player Name](/players/player-slug-lowercase-with-dashes)

WRITING GUIDELINES:

1. OPENING PARAGRAPH (hook the reader):
   - Start with the most dramatic or significant aspect of the match
   - Set the scene and context (rivalry, standings implications, etc.)
   - Make readers want to continue reading

2. STRUCTURE (use ## for H2 headings):
   ## Match Overview
   - Brief tactical setup and early game flow
   - How both teams approached the match

   ## First Half Action
   - Key moments, goals, chances
   - Tactical battles and momentum shifts

   ## Second Half Drama
   - How the game evolved
   - Decisive moments and turning points

   ## Key Performances
   - Highlight 2-3 standout players
   - Specific contributions that influenced the result

   ## Looking Ahead
   - What this result means for both teams
   - Upcoming fixtures or implications

3. WRITING STYLE:
   - Use vivid, descriptive language ("thunderous strike" not "good shot")
   - Include specific minute references for key moments
   - Build narrative tension and drama
   - Professional but engaging tone
   - Vary sentence length for rhythm
   - Use active voice predominantly

4. SEO & LINKING:
   - Link team names on first mention using provided links
   - Create player links as [Full Name](/players/firstname-lastname)
   - Natural keyword integration: "${match.home_team} vs ${match.away_team}", "${match.competition}"
   - Include competition context throughout

5. LENGTH: 1200-1800 words minimum. This should be a comprehensive, in-depth match report.

6. READABILITY:
   - Keep paragraphs to 3-4 sentences max for easy scanning
   - Vary sentence length: mix short punchy sentences with longer analytical ones
   - Use transition words between sections (Meanwhile, However, In contrast, As a result)
   - Open each section with a hook sentence
   - Use active voice predominantly
   - Break up dense analysis with vivid match descriptions

OUTPUT FORMAT (return valid JSON only):
{
  "title": "Compelling headline with teams and key narrative (max 80 chars)",
  "slug": "team-vs-team-competition-result-keyword",
  "excerpt": "Engaging 1-2 sentence summary that hooks readers (max 160 chars)",
  "content": "Full markdown article content with ## headings and [links](/path)",
  "metaTitle": "SEO title with teams, score, competition (max 60 chars)",
  "metaDescription": "Meta description with result and key info (150-160 chars)"
}`;
}

async function generateArticle(
  openai: OpenAI,
  prompt: string
): Promise<GeneratedArticle | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert sports journalist writing for a professional football database website. Write engaging, detailed articles with vivid language, clear structure, and excellent readability. Use short paragraphs (3-4 sentences max), varied sentence lengths, active voice, and strong transition words. Articles should be comprehensive and informative — never thin or generic. Always return valid JSON."
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 6000,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as GeneratedArticle;
  } catch (error) {
    console.error("OpenAI API error:", error);
    return null;
  }
}

async function insertArticle(
  sql: NeonQueryFunction<false, false>,
  article: GeneratedArticle,
  type: string,
  options: {
    matchId?: string;
    competitionSeasonId?: string;
    primaryPlayerId?: string;
    primaryTeamId?: string;
    matchday?: number;
    teamSlugs?: string[];
  } = {}
): Promise<void> {
  // Check if slug exists
  const existing = await sql`SELECT id FROM articles WHERE slug = ${article.slug}`;
  if (existing.length > 0) {
    article.slug = `${article.slug}-${Date.now()}`;
  }

  const [insertedArticle] = await sql`
    INSERT INTO articles (
      slug, type, title, excerpt, content, meta_title, meta_description,
      match_id, competition_season_id, primary_player_id, primary_team_id,
      matchday, status, published_at, model_version
    ) VALUES (
      ${article.slug}, ${type}, ${article.title}, ${article.excerpt}, ${article.content},
      ${article.metaTitle}, ${article.metaDescription},
      ${options.matchId ?? null}, ${options.competitionSeasonId ?? null},
      ${options.primaryPlayerId ?? null}, ${options.primaryTeamId ?? null},
      ${options.matchday ?? null}, 'published', NOW(), 'gpt-4o-mini'
    )
    RETURNING id
  `;

  // Link teams
  if (insertedArticle) {
    for (const slug of options.teamSlugs || []) {
      const [team] = await sql`SELECT id FROM teams WHERE slug = ${slug}`;
      if (team) {
        await sql`
          INSERT INTO article_teams (article_id, team_id, role)
          VALUES (${insertedArticle.id}, ${team.id}, 'featured')
          ON CONFLICT DO NOTHING
        `;
      }
    }
  }
}

async function getCompletedMatchdays(
  sql: NeonQueryFunction<false, false>,
  limit: number,
  minFinishedMatches: number
): Promise<MatchdayRow[]> {
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
      GROUP BY cs.id, c.name, c.slug, s.label, m.matchday
    )
    SELECT ms.*
    FROM matchday_status ms
    LEFT JOIN articles a ON
      a.competition_season_id = ms.competition_season_id
      AND a.matchday = ms.matchday
      AND a.type = 'round_recap'
    WHERE ms.total_matches = ms.finished_matches
      AND ms.finished_matches >= ${minFinishedMatches}
      AND a.id IS NULL
    ORDER BY ms.competition, ms.matchday DESC
    LIMIT ${limit}
  `) as MatchdayRow[];
}

async function getMatchdayMatches(
  sql: NeonQueryFunction<false, false>,
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
      m.away_score,
      COALESCE(
        ARRAY_AGG(DISTINCT p.name) FILTER (
          WHERE me.type IN ('goal', 'penalty') AND p.name IS NOT NULL
        ),
        ARRAY[]::text[]
      ) as top_scorers
    FROM matches m
    INNER JOIN teams ht ON m.home_team_id = ht.id
    INNER JOIN teams at ON m.away_team_id = at.id
    LEFT JOIN match_events me ON me.match_id = m.id
    LEFT JOIN players p ON me.player_id = p.id
    WHERE m.competition_season_id = ${competitionSeasonId}
      AND m.matchday = ${matchday}
    GROUP BY m.id, ht.name, ht.slug, at.name, at.slug, m.home_score, m.away_score, m.scheduled_at
    ORDER BY m.scheduled_at
  `) as MatchdayMatchRow[];
}

async function getTopPerformers(
  sql: NeonQueryFunction<false, false>,
  limit: number,
  lookbackDays: number,
  minGoals: number
): Promise<TopPerformerRow[]> {
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
        AND m.scheduled_at >= NOW() - (${lookbackDays} * INTERVAL '1 day')
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
      INNER JOIN competitions c ON c.id = cs.competition_id
      GROUP BY p.id, p.name, p.slug, p.position, p.nationality, t.id, t.name, t.slug
      HAVING SUM(rpm.goals) >= ${minGoals}
    )
    SELECT rs.*
    FROM recent_stars rs
    LEFT JOIN articles a ON a.primary_player_id = rs.player_id
      AND a.type = 'player_spotlight'
      AND a.generated_at >= NOW() - (${lookbackDays} * INTERVAL '1 day')
    WHERE a.id IS NULL
    ORDER BY rs.recent_goals DESC, rs.recent_assists DESC, rs.matches ASC
    LIMIT ${limit}
  `) as TopPerformerRow[];
}

async function getRecentPlayerMatches(
  sql: NeonQueryFunction<false, false>,
  playerId: string,
  teamId: string,
  lookbackDays: number
): Promise<RecentPlayerMatchRow[]> {
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
      AND m.scheduled_at >= NOW() - (${lookbackDays} * INTERVAL '1 day')
    GROUP BY m.id, m.scheduled_at, ht.name, at.name, m.home_team_id, m.away_team_id, m.home_score, m.away_score
    ORDER BY m.scheduled_at DESC
    LIMIT 5
  `) as RecentPlayerMatchQueryRow[];

  return rows.map((row) => ({
    opponent: row.opponent,
    result: row.result,
    goals: Number(row.goals),
    assists: Number(row.assists),
    rating: row.rating ? Number(row.rating) : undefined,
  }));
}

async function getPlayerSeasonStats(
  sql: NeonQueryFunction<false, false>,
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

async function getPendingMatchReportCount(
  sql: NeonQueryFunction<false, false>
): Promise<number> {
  const [row] = (await sql`
    SELECT COUNT(*)::int as count
    FROM matches m
    LEFT JOIN articles a ON m.id = a.match_id AND a.type = 'match_report'
    WHERE m.status = 'finished'
      AND m.home_score IS NOT NULL
      AND a.id IS NULL
  `) as CountRow[];

  return Number(row?.count || 0);
}

async function getCompletedMatchdayCount(
  sql: NeonQueryFunction<false, false>,
  minFinishedMatches: number
): Promise<number> {
  const [row] = (await sql`
    WITH matchday_status AS (
      SELECT
        cs.id as competition_season_id,
        m.matchday,
        COUNT(*) as total_matches,
        COUNT(*) FILTER (WHERE m.status = 'finished') as finished_matches
      FROM matches m
      INNER JOIN competition_seasons cs ON m.competition_season_id = cs.id
      WHERE m.matchday IS NOT NULL
      GROUP BY cs.id, m.matchday
    )
    SELECT COUNT(*)::int as count
    FROM matchday_status ms
    LEFT JOIN articles a ON
      a.competition_season_id = ms.competition_season_id
      AND a.matchday = ms.matchday
      AND a.type = 'round_recap'
    WHERE ms.total_matches = ms.finished_matches
      AND ms.finished_matches >= ${minFinishedMatches}
      AND a.id IS NULL
  `) as CountRow[];

  return Number(row?.count || 0);
}

async function getTopPerformerCount(
  sql: NeonQueryFunction<false, false>,
  lookbackDays: number,
  minGoals: number
): Promise<number> {
  const [row] = (await sql`
    WITH recent_player_matches AS (
      SELECT
        ml.player_id,
        m.id as match_id,
        COALESCE(
          SUM(CASE WHEN me.player_id = ml.player_id AND me.type IN ('goal', 'penalty') THEN 1 ELSE 0 END),
          0
        )::int as goals
      FROM match_lineups ml
      INNER JOIN matches m ON ml.match_id = m.id
      LEFT JOIN match_events me ON me.match_id = m.id
      WHERE COALESCE(ml.minutes_played, 0) > 0
        AND m.status = 'finished'
        AND m.scheduled_at >= NOW() - (${lookbackDays} * INTERVAL '1 day')
      GROUP BY ml.player_id, m.id
    ),
    recent_stars AS (
      SELECT
        rpm.player_id
      FROM recent_player_matches rpm
      GROUP BY rpm.player_id
      HAVING SUM(rpm.goals) >= ${minGoals}
    )
    SELECT COUNT(*)::int as count
    FROM recent_stars rs
    LEFT JOIN articles a ON a.primary_player_id = rs.player_id
      AND a.type = 'player_spotlight'
      AND a.generated_at >= NOW() - (${lookbackDays} * INTERVAL '1 day')
    WHERE a.id IS NULL
  `) as CountRow[];

  return Number(row?.count || 0);
}
