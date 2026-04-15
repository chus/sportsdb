import { NextRequest, NextResponse } from "next/server";
import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import OpenAI from "openai";
import { submitUrlsToIndexNow, pingGoogleSitemap, submitUrlsToGoogle } from "@/lib/seo/indexnow";

export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
  const DATABASE_URL = process.env.DATABASE_URL;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const CRON_SECRET = process.env.CRON_SECRET;

  if (!DATABASE_URL || !OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Missing required environment variables" },
      { status: 500 }
    );
  }

  const sql = neon(DATABASE_URL);
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = {
      matchReports: 0,
      roundRecaps: 0,
      playerSpotlights: 0,
      matchPreviews: 0,
      errors: [] as string[],
    };
    const generatedSlugs: string[] = [];

    // Hoist the players list once instead of reloading it inside every
    // linkArticleToPlayers call (was 50+ duplicate full table scans per run).
    const playersForLinking = await sql`
      SELECT id, name, known_as FROM players
      WHERE position != 'Unknown' AND length(name) > 3
    `;

    // === 1. MATCH REPORTS (25 per run) ===
    const matchesToProcess = await sql`
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
      LIMIT 25
    `;

    const runMatchReports = async () => {
      await pMap(matchesToProcess, 5, async (match) => {
        try {
          const events = await sql`
            SELECT me.minute, me.type, p.name as player_name, t.name as team_name
            FROM match_events me
            INNER JOIN players p ON me.player_id = p.id
            INNER JOIN teams t ON me.team_id = t.id
            WHERE me.match_id = ${match.id}
            ORDER BY me.minute
          `;

          const prompt = buildMatchReportPrompt(match, events);
          const article = await generateArticle(openai, prompt);

          if (article) {
            await insertArticle(sql, article, "match_report", match.id, match.home_team_slug, match.away_team_slug, playersForLinking);
            results.matchReports++;
            generatedSlugs.push(article.slug);
          }
        } catch (error) {
          results.errors.push(`Match report ${match.id}: ${error}`);
}
      });
    };

    // === 2. ROUND RECAPS (10 per run) ===
    const completedMatchdays = await sql`
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
        AND ms.finished_matches >= 3
        AND a.id IS NULL
      ORDER BY ms.competition, ms.matchday DESC
      LIMIT 10
    `;

    const runRoundRecaps = async () => {
      await pMap(completedMatchdays, 5, async (md) => {
        try {
          const mdMatches = await sql`
            SELECT
              ht.name as home_team,
              ht.slug as home_team_slug,
              at2.name as away_team,
              at2.slug as away_team_slug,
              m.home_score,
              m.away_score
            FROM matches m
            INNER JOIN teams ht ON m.home_team_id = ht.id
            INNER JOIN teams at2 ON m.away_team_id = at2.id
            WHERE m.competition_season_id = ${md.competition_season_id}
              AND m.matchday = ${md.matchday}
            ORDER BY m.scheduled_at
          `;

          const prompt = buildRoundRecapPrompt(md, mdMatches);
          const article = await generateArticle(openai, prompt);

          if (article) {
            await insertRoundRecap(sql, article, md.competition_season_id, md.matchday, mdMatches, playersForLinking);
            results.roundRecaps++;
            generatedSlugs.push(article.slug);
          }
        } catch (error) {
          results.errors.push(`Round recap ${md.competition} MD${md.matchday}: ${error}`);
        }
      });
    };

    // === 3. PLAYER SPOTLIGHTS (8 per run) ===
    // Picks top scorers from player_season_stats for the current season.
    // match_events is not reliably populated, so we rank by season goals+assists.
    const topPerformers = await sql`
      WITH season_stars AS (
        SELECT
          p.id as player_id,
          p.name as player_name,
          p.slug as player_slug,
          p.position,
          p.nationality,
          t.name as team_name,
          t.slug as team_slug,
          pss.goals::int as recent_goals,
          pss.assists::int as recent_assists,
          pss.appearances::int as matches,
          (pss.goals * 2 + pss.assists)::int as impact_score
        FROM player_season_stats pss
        INNER JOIN players p ON pss.player_id = p.id
        INNER JOIN teams t ON pss.team_id = t.id
        INNER JOIN competition_seasons cs ON pss.competition_season_id = cs.id
        INNER JOIN seasons s ON cs.season_id = s.id
        WHERE s.is_current = true
          AND pss.goals >= 3
      )
      SELECT ss.*
      FROM season_stars ss
      LEFT JOIN articles a ON a.primary_player_id = ss.player_id
        AND a.type = 'player_spotlight'
        AND a.published_at >= CURRENT_DATE - INTERVAL '30 days'
      WHERE a.id IS NULL
      ORDER BY ss.impact_score DESC, ss.recent_goals DESC
      LIMIT 8
    `;

    const runPlayerSpotlights = async () => {
      await pMap(topPerformers, 5, async (player) => {
        try {
          const prompt = buildPlayerSpotlightPrompt(player);
          const article = await generateArticle(openai, prompt);

          if (article) {
            await insertPlayerSpotlight(sql, article, player.player_id, player.team_slug, playersForLinking);
            results.playerSpotlights++;
            generatedSlugs.push(article.slug);
          }
        } catch (error) {
          results.errors.push(`Player spotlight ${player.player_name}: ${error}`);
        }
      });
    };

    // === 4. MATCH PREVIEWS (10 per run) ===
    const upcomingMatches = await sql`
      SELECT
        m.id,
        m.matchday,
        m.scheduled_at,
        ht.name as home_team,
        ht.slug as home_team_slug,
        at2.name as away_team,
        at2.slug as away_team_slug,
        c.name as competition,
        c.slug as competition_slug,
        s.label as season,
        v.name as venue,
        cs.id as competition_season_id
      FROM matches m
      INNER JOIN teams ht ON m.home_team_id = ht.id
      INNER JOIN teams at2 ON m.away_team_id = at2.id
      INNER JOIN competition_seasons cs ON m.competition_season_id = cs.id
      INNER JOIN competitions c ON cs.competition_id = c.id
      INNER JOIN seasons s ON cs.season_id = s.id
      LEFT JOIN venues v ON m.venue_id = v.id
      LEFT JOIN articles a ON m.id = a.match_id AND a.type = 'match_preview'
      WHERE m.status = 'scheduled'
        AND m.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
        AND a.id IS NULL
      ORDER BY m.scheduled_at ASC
      LIMIT 15
    `;

    const runMatchPreviews = async () => {
      await pMap(upcomingMatches, 5, async (match) => {
        try {
          const prompt = buildMatchPreviewPrompt(match);
          const article = await generateArticle(openai, prompt);

          if (article) {
            await insertArticle(sql, article, "match_preview", match.id, match.home_team_slug, match.away_team_slug, playersForLinking);
            results.matchPreviews++;
            generatedSlugs.push(article.slug);
          }
        } catch (error) {
          results.errors.push(`Match preview ${match.id}: ${error}`);
        }
      });
    };

    // Run all four article-generation stages in parallel.
    // Each stage limits its own concurrency via pMap so OpenAI/DB stay healthy.
    await Promise.all([
      runMatchReports(),
      runRoundRecaps(),
      runPlayerSpotlights(),
      runMatchPreviews(),
    ]);

    // Ping search engines about new content (non-blocking, non-critical)
    if (generatedSlugs.length > 0) {
      const urls = generatedSlugs.map((s) => `/news/${s}`);
      await Promise.all([
        submitUrlsToIndexNow(urls),
        submitUrlsToGoogle(urls),
        pingGoogleSitemap(),
      ]).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      ...results,
      indexNowPinged: generatedSlugs.length,
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

function countWords(content: string | null | undefined): number {
  if (!content) return 0;
  return content.split(/\s+/).filter(Boolean).length;
}

/**
 * Concurrency-limited Promise.map. Processes items in parallel up to
 * `concurrency` at a time. Errors thrown by `fn` are swallowed (the callers
 * already wrap with try/catch and push to results.errors), so this never
 * rejects.
 */
async function pMap<T>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<unknown>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        await fn(items[i]);
      } catch {
        // Caller is responsible for error tracking.
      }
    }
  });
  await Promise.all(workers);
}

function buildMatchReportPrompt(match: any, events: any[]): string {
  const scoreline = `${match.home_team} ${match.home_score}-${match.away_score} ${match.away_team}`;
  const homeTeamLink = `[${match.home_team}](/teams/${match.home_team_slug})`;
  const awayTeamLink = `[${match.away_team}](/teams/${match.away_team_slug})`;
  const competitionLink = `[${match.competition}](/competitions/${match.competition_slug})`;

  // Group events by type for analysis
  const goals = events.filter(e => e.type === 'goal' || e.type === 'penalty');
  const cards = events.filter(e => e.type === 'yellow_card' || e.type === 'red_card');
  const substitutions = events.filter(e => e.type === 'substitution');

  return `You are an experienced sports journalist writing an in-depth match report for SportsDB, a professional football database website. Write with authority, insight, and engaging storytelling.

LENGTH REQUIREMENT (CRITICAL — READ FIRST):
This article MUST be a MINIMUM of 1300 words. Target 1500-1800 words. Articles shorter than 1300 words will be rejected and regenerated.
This is an in-depth analysis piece, NOT a summary. Do NOT be concise. Expand every observation into multiple sentences. Add tactical context, historical reference, player background, and forward-looking analysis throughout.

MATCH INFORMATION:
- Competition: ${match.competition} (${match.season})
- Matchday: ${match.matchday || 'N/A'}
- Date: ${match.scheduled_at}
- Final Score: ${scoreline}
${match.venue ? `- Venue: ${match.venue}` : ""}

MATCH EVENTS TIMELINE:
${events.length > 0 ? events.map((e: any) => `${e.minute}' - ${e.type.toUpperCase()}: ${e.player_name} (${e.team_name})`).join("\n") : "No detailed events available"}

${match.existing_summary ? `ADDITIONAL CONTEXT:\n${match.existing_summary}` : ""}

LINKS TO INCLUDE (use these exact markdown formats):
- Home team: ${homeTeamLink}
- Away team: ${awayTeamLink}
- Competition: ${competitionLink}
- For players: [Player Name](/players/player-slug-lowercase-with-dashes)

REQUIRED STRUCTURE — Each section has a MINIMUM word count. Do not skip sections.

## Match Overview (MIN 200 words)
Cover ALL of:
- Tactical setup and how each side approached the match
- Pre-match form and standings position context
- Stakes for both teams
- Opening tempo and which side took the initiative
- Any narrative threads (rivalry, redemption, injuries)

## First Half Action (MIN 250 words)
Cover ALL of:
- Detailed account of how the half unfolded
- Every goal: build-up, finish, and significance (with minute references)
- Key chances created and missed (with minute references)
- Tactical patterns and momentum shifts
- Defensive moments, near-misses, refereeing calls
- The mood at half-time

## Second Half Drama (MIN 250 words)
Cover ALL of:
- How the second half opened — same patterns or shift?
- Tactical adjustments by either manager
- Substitutions: who, when, and what they changed
- All second-half goals in detail
- Late drama, near-misses, momentum swings
- The final whistle scene

## Key Performances (MIN 200 words)
Cover ALL of:
- 3-4 standout players with one paragraph each
- Specific actions that earned them praise
- Reference season stats where relevant
- A man-of-the-match selection with justification

## Tactical Analysis (MIN 200 words)
Cover ALL of:
- Where the game was won and lost on the pitch
- Key matchups (e.g., midfield battle, full-back duel)
- What worked and what didn't for each side
- Manager decisions that influenced the result

## Looking Ahead (MIN 200 words)
Cover ALL of:
- Implications for the league table
- What this changes for both teams' upcoming fixtures
- Form trajectory going forward
- Season-long narrative — what this confirms or upsets
- A forward-looking takeaway for both sides

WRITING STYLE:
- Use vivid, descriptive language ("thunderous strike" not "good shot")
- Include specific minute references for key moments
- Build narrative tension and drama
- Professional but engaging tone
- Vary sentence length
- Use active voice predominantly

SEO & LINKING:
- Link team names on first mention using provided links
- Create player links as [Full Name](/players/firstname-lastname)
- Natural keyword integration: "${match.home_team} vs ${match.away_team}", "${match.competition}"
- Include competition context throughout

READABILITY:
- Keep paragraphs to 3-4 sentences max
- Use transition words between sections (Meanwhile, However, In contrast, As a result)
- Open each section with a hook sentence
- Break up dense analysis with vivid match descriptions

OUTPUT FORMAT (return valid JSON only):
{
  "title": "Compelling headline with teams and key narrative (max 80 chars)",
  "slug": "team-vs-team-competition-result-keyword",
  "excerpt": "Engaging 1-2 sentence summary that hooks readers (max 160 chars)",
  "content": "Full markdown article — MINIMUM 1300 WORDS",
  "metaTitle": "SEO title with teams, score, competition (max 60 chars)",
  "metaDescription": "Meta description with result and key info (150-160 chars)"
}

FINAL REMINDER: The "content" field must be at least 1300 words. Each ## section must hit its minimum. If you finish early, expand the analysis sections — never cut sections short.`;
}

async function generateArticle(openai: OpenAI, prompt: string): Promise<any | null> {
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

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("OpenAI API error:", error);
    return null;
  }
}

function buildRoundRecapPrompt(md: any, mdMatches: any[]): string {
  const competitionLink = `[${md.competition}](/competitions/${md.competition_slug})`;

  return `You are an SEO-focused sports journalist writing a matchday recap for a football database website.

LENGTH REQUIREMENT (CRITICAL — READ FIRST):
This article MUST be a MINIMUM of 1000 words. Target 1100-1400 words. Articles shorter than 1000 words will be rejected and regenerated.
This is a comprehensive matchday review, NOT a results dump. Discuss every notable match in detail. Add table context, form analysis, and individual performances throughout.

COMPETITION: ${md.competition} (${md.season})
MATCHDAY: ${md.matchday}

RESULTS:
${mdMatches.map((m: any) => `${m.home_team} ${m.home_score}-${m.away_score} ${m.away_team}`).join("\n")}

INTERNAL LINKS:
- Competition: ${competitionLink}
- Use format [Team Name](/teams/team-slug) for all team mentions

REQUIRED STRUCTURE — Each section has a MINIMUM word count. Do not skip sections.

## Top of the Table (MIN 200 words)
Cover:
- Title contenders and their results this round
- How the standings shifted at the top
- Key performances from leading clubs
- Implications for the title race

## The Headline Result (MIN 200 words)
Pick the single biggest story of the matchday and dig in:
- Pre-match expectations vs what happened
- The key moments that decided it
- Standout individuals
- What it means going forward

## Mid-Table Stories (MIN 150 words)
Cover:
- Battles for European qualification spots
- Surprise results from mid-table sides
- Form trends across the league's middle section

## Relegation Battle (MIN 150 words)
Cover:
- Results from teams in the bottom third
- Survival hopes and dwindling chances
- Standout individual performances from relegation-threatened sides

## Standout Performers (MIN 150 words)
Cover:
- 3-4 individual players who shaped the matchday
- A goal-of-the-round nominee
- Tactical or managerial highlights worth noting

## Matchday in Numbers (MIN 100 words)
Cover:
- Goals scored across the round
- Notable streaks (winning runs, clean sheets, scoring runs)
- Records or milestones reached

REQUIREMENTS:
- Headline with competition name and matchday number (max 80 chars)
- Excerpt for social/cards (1-2 sentences, max 160 chars)
- All team names as markdown links
- Keep paragraphs to 3-4 sentences max
- Use vivid verbs and active voice ("demolished", "edged past", "stunned")
- Open with the biggest storyline as a hook

Slug format: "${md.competition_slug}-matchday-${md.matchday}-recap-${md.season.replace("/", "-")}"

Return as JSON:
{
  "title": "...",
  "slug": "...",
  "excerpt": "...",
  "content": "Full markdown — MINIMUM 1000 WORDS",
  "metaTitle": "Max 60 chars",
  "metaDescription": "150-160 chars"
}

FINAL REMINDER: The "content" field must be at least 1000 words. Each ## section must hit its minimum. If you finish early, expand the storylines — never cut sections short.`;
}

function buildPlayerSpotlightPrompt(player: any): string {
  const playerLink = `[${player.player_name}](/players/${player.player_slug})`;
  const teamLink = `[${player.team_name}](/teams/${player.team_slug})`;

  return `You are an SEO-focused sports journalist writing a player spotlight for a football database website.

LENGTH REQUIREMENT (CRITICAL — READ FIRST):
This article MUST be a MINIMUM of 900 words. Target 1000-1200 words. Articles shorter than 900 words will be rejected and regenerated.
This is an in-depth player feature, NOT a quick stat recap. Cover the player's story, style, performances, and outlook in real depth.

PLAYER: ${player.player_name}
Position: ${player.position || "Forward"}
Nationality: ${player.nationality || "Unknown"}
Current Club: ${player.team_name}

ACHIEVEMENT: ${player.recent_goals} goals${player.recent_assists ? ` and ${player.recent_assists} assists` : ""} in ${player.matches} appearances this season

INTERNAL LINKS:
- Player: ${playerLink}
- Team: ${teamLink}

REQUIRED STRUCTURE — Each section has a MINIMUM word count.

## The Achievement (MIN 150 words)
Cover:
- What ${player.player_name} has accomplished and why it matters
- Context: how rare or significant this is for a ${player.position || "forward"}
- What it tells us about the player's level
- Open with a vivid scene-setting paragraph

## Recent Form (MIN 200 words)
Cover:
- Detailed breakdown of their recent run of matches
- Key goals, assists, and decisive moments
- Trends visible across the run (scoring streaks, big-game performances)
- How current form compares to earlier in the season

## Season in Context (MIN 150 words)
Cover:
- How this stretch fits into the overall campaign
- Where ${player.player_name} sits in scoring/assist charts
- Impact on ${player.team_name}'s results and standings
- Comparison with their previous seasons or career highs

## Playing Style (MIN 150 words)
Cover:
- Tactical role and on-pitch responsibilities
- Strengths that make them effective
- Signature moves, finishing technique, link-up play
- What sets them apart from peers in the same position

## Comparison (MIN 100 words)
Cover:
- How they stack up against 2-3 peers in the same position
- Stat comparisons where useful
- What they do better and what they could improve

## What's Next (MIN 150 words)
Cover:
- Upcoming fixtures and what to watch for
- Personal targets (records within reach, milestones)
- Implications for their team's season
- A forward-looking statement

REQUIREMENTS:
- Headline with player name and achievement (max 80 chars)
- Excerpt summarizing the achievement (max 160 chars)
- Link to player page and team page
- Keep paragraphs to 3-4 sentences max
- Use vivid descriptions and active voice
- Open with a vivid description of the player's standout moment
- Use stats naturally within prose, not as dry lists

Slug format: "${player.player_slug}-spotlight-${Date.now()}"

Return as JSON:
{
  "title": "Max 80 chars",
  "slug": "...",
  "excerpt": "Max 160 chars",
  "content": "Full markdown — MINIMUM 900 WORDS",
  "metaTitle": "Max 60 chars",
  "metaDescription": "150-160 chars"
}

FINAL REMINDER: The "content" field must be at least 900 words. Each ## section must hit its minimum.`;
}

function buildMatchPreviewPrompt(match: any): string {
  const homeTeamLink = `[${match.home_team}](/teams/${match.home_team_slug})`;
  const awayTeamLink = `[${match.away_team}](/teams/${match.away_team_slug})`;
  const competitionLink = `[${match.competition}](/competitions/${match.competition_slug})`;

  return `You are an SEO-focused sports journalist writing a professional match preview for a football database website. Write in a factual, authoritative tone like BBC Sport — no tabloid hype.

LENGTH REQUIREMENT (CRITICAL — READ FIRST):
This article MUST be a MINIMUM of 800 words. Target 900-1100 words. Articles shorter than 800 words will be rejected and regenerated.
This is a thorough preview, NOT a paragraph summary. Discuss form, players, tactics, and historical context in depth.

MATCH DETAILS:
- Competition: ${match.competition} (${match.season})
- Date: ${match.scheduled_at}
- Teams: ${match.home_team} vs ${match.away_team}
${match.venue ? `- Venue: ${match.venue}` : ""}
${match.matchday ? `- Matchday: ${match.matchday}` : ""}

INTERNAL LINKS:
- Home team: ${homeTeamLink}
- Away team: ${awayTeamLink}
- Competition: ${competitionLink}

REQUIRED STRUCTURE — Each section has a MINIMUM word count. Do not skip sections.

## Why This Match Matters (MIN 150 words)
Cover:
- The stakes for both sides
- Table implications and points at stake
- Any rivalry, history, or narrative context
- What pundits and fans are watching for

## Form Guide (MIN 150 words)
Cover:
- Recent results for both teams with brief commentary
- Patterns: scoring trends, defensive solidity, home/away splits
- Injury or suspension news where relevant

## Key Players to Watch (MIN 150 words)
Cover:
- 2-3 players per side likely to decide the match
- Their season form and current state
- Tactical role and the matchups they'll face

## Head-to-Head History (MIN 100 words)
Cover:
- Past meetings between these teams
- Patterns from previous fixtures
- Memorable moments from recent encounters

## Tactical Battle (MIN 150 words)
Cover:
- Expected formations from both managers
- Key matchups (e.g., wing-back vs winger)
- How each side will look to win the game
- Where the match could be decided on the pitch

## Prediction (MIN 100 words)
Cover:
- An informed take on the likely outcome
- Reasoning grounded in form and tactical analysis
- A specific scoreline prediction

REQUIREMENTS:
- Factual headline (max 80 chars) — include team names and competition. No hype words ("epic", "showdown", "clash", "battle"). No exclamation marks.
- All team/player names as markdown links
- Keep paragraphs to 3-4 sentences max
- Use active voice and present tense for immediacy
- Build anticipation: start with context, end with prediction

Slug format: "${match.home_team_slug}-vs-${match.away_team_slug}-preview-${match.competition_slug}"

Return as JSON:
{
  "title": "Max 80 chars",
  "slug": "...",
  "excerpt": "Max 160 chars",
  "content": "Full markdown — MINIMUM 800 WORDS",
  "metaTitle": "Max 60 chars",
  "metaDescription": "150-160 chars"
}

FINAL REMINDER: The "content" field must be at least 800 words. Each ## section must hit its minimum.`;
}

async function insertArticle(
  sql: NeonQueryFunction<false, false>,
  article: any,
  type: string,
  matchId: string,
  homeTeamSlug: string,
  awayTeamSlug: string,
  playersForLinking: readonly any[]
): Promise<void> {
  // Check if slug exists
  const existing = await sql`SELECT id FROM articles WHERE slug = ${article.slug}`;
  if (existing.length > 0) {
    article.slug = `${article.slug}-${Date.now()}`;
  }

  await sql`
    INSERT INTO articles (
      slug, type, title, excerpt, content, meta_title, meta_description,
      match_id, status, published_at, model_version, word_count
    ) VALUES (
      ${article.slug}, ${type}, ${article.title}, ${article.excerpt}, ${article.content},
      ${article.metaTitle}, ${article.metaDescription},
      ${matchId}, 'published', NOW(), 'gpt-4o-mini', ${countWords(article.content)}
    )
  `;

  // Link teams
  const [insertedArticle] = await sql`SELECT id FROM articles WHERE slug = ${article.slug}`;
  if (insertedArticle) {
    for (const slug of [homeTeamSlug, awayTeamSlug]) {
      const [team] = await sql`SELECT id FROM teams WHERE slug = ${slug}`;
      if (team) {
        await sql`
          INSERT INTO article_teams (article_id, team_id, role)
          VALUES (${insertedArticle.id}, ${team.id}, 'featured')
          ON CONFLICT DO NOTHING
        `;
      }
    }
    await linkArticleToPlayers(sql, insertedArticle.id, [article.title, article.excerpt, article.content].join(" "), playersForLinking);
  }
}

async function insertRoundRecap(
  sql: NeonQueryFunction<false, false>,
  article: any,
  competitionSeasonId: string,
  matchday: number,
  mdMatches: any[],
  playersForLinking: readonly any[]
): Promise<void> {
  const existing = await sql`SELECT id FROM articles WHERE slug = ${article.slug}`;
  if (existing.length > 0) {
    article.slug = `${article.slug}-${Date.now()}`;
  }

  await sql`
    INSERT INTO articles (
      slug, type, title, excerpt, content, meta_title, meta_description,
      competition_season_id, matchday, status, published_at, model_version, word_count
    ) VALUES (
      ${article.slug}, 'round_recap', ${article.title}, ${article.excerpt}, ${article.content},
      ${article.metaTitle}, ${article.metaDescription},
      ${competitionSeasonId}, ${matchday}, 'published', NOW(), 'gpt-4o-mini', ${countWords(article.content)}
    )
  `;

  // Link all teams from this matchday
  const [insertedArticle] = await sql`SELECT id FROM articles WHERE slug = ${article.slug}`;
  if (insertedArticle) {
    const teamSlugs = [...new Set(mdMatches.flatMap((m: any) => [m.home_team_slug, m.away_team_slug]))];
    for (const slug of teamSlugs) {
      const [team] = await sql`SELECT id FROM teams WHERE slug = ${slug}`;
      if (team) {
        await sql`
          INSERT INTO article_teams (article_id, team_id, role)
          VALUES (${insertedArticle.id}, ${team.id}, 'featured')
          ON CONFLICT DO NOTHING
        `;
      }
    }
    await linkArticleToPlayers(sql, insertedArticle.id, [article.title, article.excerpt, article.content].join(" "), playersForLinking);
  }
}

async function insertPlayerSpotlight(
  sql: NeonQueryFunction<false, false>,
  article: any,
  playerId: string,
  teamSlug: string,
  playersForLinking: readonly any[]
): Promise<void> {
  const existing = await sql`SELECT id FROM articles WHERE slug = ${article.slug}`;
  if (existing.length > 0) {
    article.slug = `${article.slug}-${Date.now()}`;
  }

  await sql`
    INSERT INTO articles (
      slug, type, title, excerpt, content, meta_title, meta_description,
      primary_player_id, status, published_at, model_version, word_count
    ) VALUES (
      ${article.slug}, 'player_spotlight', ${article.title}, ${article.excerpt}, ${article.content},
      ${article.metaTitle}, ${article.metaDescription},
      ${playerId}, 'published', NOW(), 'gpt-4o-mini', ${countWords(article.content)}
    )
  `;

  // Link team
  const [team] = await sql`SELECT id FROM teams WHERE slug = ${teamSlug}`;
  const [insertedArticle] = await sql`SELECT id FROM articles WHERE slug = ${article.slug}`;
  if (insertedArticle && team) {
    await sql`
      INSERT INTO article_teams (article_id, team_id, role)
      VALUES (${insertedArticle.id}, ${team.id}, 'featured')
      ON CONFLICT DO NOTHING
    `;
  }
  if (insertedArticle) {
    await linkArticleToPlayers(sql, insertedArticle.id, [article.title, article.excerpt, article.content].join(" "), playersForLinking, playerId);
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function linkArticleToPlayers(
  sql: NeonQueryFunction<false, false>,
  articleId: string,
  text: string,
  players: readonly any[],
  primaryPlayerId?: string | null
): Promise<void> {
  const matched = new Set<string>();
  if (primaryPlayerId) matched.add(primaryPlayerId);

  for (const p of players) {
    if (p.name && p.name.includes(" ")) {
      const re = new RegExp(`\\b${escapeRegex(p.name)}\\b`, "i");
      if (re.test(text)) matched.add(p.id);
    }
    if (p.known_as && p.known_as.length >= 5 && p.known_as !== p.name) {
      const re = new RegExp(`\\b${escapeRegex(p.known_as)}\\b`, "i");
      if (re.test(text)) matched.add(p.id);
    }
  }

  for (const playerId of matched) {
    const role = playerId === primaryPlayerId ? "featured" : "mentioned";
    await sql`
      INSERT INTO article_players (article_id, player_id, role)
      VALUES (${articleId}, ${playerId}, ${role})
      ON CONFLICT DO NOTHING
    `;
  }
}
