import { NextRequest, NextResponse } from "next/server";
import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import OpenAI from "openai";

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

    // === 1. MATCH REPORTS (5 per run) ===
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
      LIMIT 5
    `;

    for (const match of matchesToProcess) {
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
          await insertArticle(sql, article, "match_report", match.id, match.home_team_slug, match.away_team_slug);
          results.matchReports++;
        }

        await new Promise((r) => setTimeout(r, 500));
      } catch (error) {
        results.errors.push(`Match report ${match.id}: ${error}`);
      }
    }

    // === 2. ROUND RECAPS (3 per run) ===
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
      LIMIT 3
    `;

    for (const md of completedMatchdays) {
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
          await insertRoundRecap(sql, article, md.competition_season_id, md.matchday, mdMatches);
          results.roundRecaps++;
        }

        await new Promise((r) => setTimeout(r, 500));
      } catch (error) {
        results.errors.push(`Round recap ${md.competition} MD${md.matchday}: ${error}`);
      }
    }

    // === 3. PLAYER SPOTLIGHTS (2 per run) ===
    const topPerformers = await sql`
      WITH recent_stars AS (
        SELECT
          p.id as player_id,
          p.name as player_name,
          p.slug as player_slug,
          p.position,
          p.nationality,
          t.name as team_name,
          t.slug as team_slug,
          COUNT(*)::int as recent_goals,
          COUNT(DISTINCT m.id)::int as matches
        FROM match_events me
        INNER JOIN matches m ON me.match_id = m.id
        INNER JOIN players p ON me.player_id = p.id
        INNER JOIN teams t ON me.team_id = t.id
        WHERE me.type IN ('goal', 'penalty')
          AND m.scheduled_at >= CURRENT_DATE - INTERVAL '14 days'
        GROUP BY p.id, p.name, p.slug, p.position, p.nationality, t.name, t.slug
        HAVING COUNT(*) >= 2
      )
      SELECT rs.*
      FROM recent_stars rs
      LEFT JOIN articles a ON a.primary_player_id = rs.player_id
        AND a.type = 'player_spotlight'
        AND a.published_at >= CURRENT_DATE - INTERVAL '14 days'
      WHERE a.id IS NULL
      ORDER BY rs.recent_goals DESC
      LIMIT 2
    `;

    for (const player of topPerformers) {
      try {
        const prompt = buildPlayerSpotlightPrompt(player);
        const article = await generateArticle(openai, prompt);

        if (article) {
          await insertPlayerSpotlight(sql, article, player.player_id, player.team_slug);
          results.playerSpotlights++;
        }

        await new Promise((r) => setTimeout(r, 500));
      } catch (error) {
        results.errors.push(`Player spotlight ${player.player_name}: ${error}`);
      }
    }

    // === 4. MATCH PREVIEWS (3 per run) ===
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
        AND m.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '3 days'
        AND a.id IS NULL
      ORDER BY m.scheduled_at ASC
      LIMIT 3
    `;

    for (const match of upcomingMatches) {
      try {
        const prompt = buildMatchPreviewPrompt(match);
        const article = await generateArticle(openai, prompt);

        if (article) {
          await insertArticle(sql, article, "match_preview", match.id, match.home_team_slug, match.away_team_slug);
          results.matchPreviews++;
        }

        await new Promise((r) => setTimeout(r, 500));
      } catch (error) {
        results.errors.push(`Match preview ${match.id}: ${error}`);
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
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

COMPETITION: ${md.competition} (${md.season})
MATCHDAY: ${md.matchday}

RESULTS:
${mdMatches.map((m: any) => `${m.home_team} ${m.home_score}-${m.away_score} ${m.away_team}`).join("\n")}

INTERNAL LINKS:
- Competition: ${competitionLink}
- Use format [Team Name](/teams/team-slug) for all team mentions

REQUIREMENTS:
1. Headline with competition name and matchday number (max 80 chars)
2. Excerpt for social/cards (1-2 sentences)
3. 900-1400 words organized by storyline, not match-by-match
4. Use ## H2 headings for narrative themes (Title Race, Relegation Battle, Upsets, etc.)
5. All team names as markdown links
6. Keep paragraphs to 3-4 sentences max
7. Use vivid verbs and active voice

Slug format: "${md.competition_slug}-matchday-${md.matchday}-recap-${md.season.replace("/", "-")}"

Return as JSON:
{
  "title": "...",
  "slug": "...",
  "excerpt": "...",
  "content": "...",
  "metaTitle": "...",
  "metaDescription": "..."
}`;
}

function buildPlayerSpotlightPrompt(player: any): string {
  const playerLink = `[${player.player_name}](/players/${player.player_slug})`;
  const teamLink = `[${player.team_name}](/teams/${player.team_slug})`;

  return `You are an SEO-focused sports journalist writing a player spotlight for a football database website.

PLAYER: ${player.player_name}
Position: ${player.position || "Forward"}
Nationality: ${player.nationality || "Unknown"}
Current Club: ${player.team_name}

ACHIEVEMENT: ${player.recent_goals} goals in ${player.matches} recent matches

INTERNAL LINKS:
- Player: ${playerLink}
- Team: ${teamLink}

REQUIREMENTS:
1. Headline with player name and achievement (max 80 chars)
2. 800-1200 words with clear ## H2 structure
3. Sections: The Achievement, Recent Form, Season in Context, Playing Style, What's Next
4. Link to player page and team page
5. Keep paragraphs to 3-4 sentences max
6. Use vivid descriptions and active voice

Slug format: "${player.player_slug}-spotlight-${Date.now()}"

Return as JSON:
{
  "title": "...",
  "slug": "...",
  "excerpt": "...",
  "content": "...",
  "metaTitle": "...",
  "metaDescription": "..."
}`;
}

function buildMatchPreviewPrompt(match: any): string {
  const homeTeamLink = `[${match.home_team}](/teams/${match.home_team_slug})`;
  const awayTeamLink = `[${match.away_team}](/teams/${match.away_team_slug})`;
  const competitionLink = `[${match.competition}](/competitions/${match.competition_slug})`;

  return `You are an SEO-focused sports journalist writing a match preview for a football database website.

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

REQUIREMENTS:
1. Exciting headline that builds anticipation (max 80 chars)
2. 700-1000 words with ## H2 headings
3. Sections: Why This Match Matters, Form Guide, Key Players to Watch, Tactical Battle, Prediction
4. All team/player names as markdown links
5. Keep paragraphs to 3-4 sentences max
6. End with a bold prediction

Slug format: "${match.home_team_slug}-vs-${match.away_team_slug}-preview-${match.competition_slug}"

Return as JSON:
{
  "title": "...",
  "slug": "...",
  "excerpt": "...",
  "content": "...",
  "metaTitle": "...",
  "metaDescription": "..."
}`;
}

async function insertArticle(
  sql: NeonQueryFunction<false, false>,
  article: any,
  type: string,
  matchId: string,
  homeTeamSlug: string,
  awayTeamSlug: string
): Promise<void> {
  // Check if slug exists
  const existing = await sql`SELECT id FROM articles WHERE slug = ${article.slug}`;
  if (existing.length > 0) {
    article.slug = `${article.slug}-${Date.now()}`;
  }

  await sql`
    INSERT INTO articles (
      slug, type, title, excerpt, content, meta_title, meta_description,
      match_id, status, published_at, model_version
    ) VALUES (
      ${article.slug}, ${type}, ${article.title}, ${article.excerpt}, ${article.content},
      ${article.metaTitle}, ${article.metaDescription},
      ${matchId}, 'published', NOW(), 'gpt-4o-mini'
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
    await linkArticleToPlayers(sql, insertedArticle.id, [article.title, article.excerpt, article.content].join(" "));
  }
}

async function insertRoundRecap(
  sql: NeonQueryFunction<false, false>,
  article: any,
  competitionSeasonId: string,
  matchday: number,
  mdMatches: any[]
): Promise<void> {
  const existing = await sql`SELECT id FROM articles WHERE slug = ${article.slug}`;
  if (existing.length > 0) {
    article.slug = `${article.slug}-${Date.now()}`;
  }

  await sql`
    INSERT INTO articles (
      slug, type, title, excerpt, content, meta_title, meta_description,
      competition_season_id, matchday, status, published_at, model_version
    ) VALUES (
      ${article.slug}, 'round_recap', ${article.title}, ${article.excerpt}, ${article.content},
      ${article.metaTitle}, ${article.metaDescription},
      ${competitionSeasonId}, ${matchday}, 'published', NOW(), 'gpt-4o-mini'
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
    await linkArticleToPlayers(sql, insertedArticle.id, [article.title, article.excerpt, article.content].join(" "));
  }
}

async function insertPlayerSpotlight(
  sql: NeonQueryFunction<false, false>,
  article: any,
  playerId: string,
  teamSlug: string
): Promise<void> {
  const existing = await sql`SELECT id FROM articles WHERE slug = ${article.slug}`;
  if (existing.length > 0) {
    article.slug = `${article.slug}-${Date.now()}`;
  }

  await sql`
    INSERT INTO articles (
      slug, type, title, excerpt, content, meta_title, meta_description,
      primary_player_id, status, published_at, model_version
    ) VALUES (
      ${article.slug}, 'player_spotlight', ${article.title}, ${article.excerpt}, ${article.content},
      ${article.metaTitle}, ${article.metaDescription},
      ${playerId}, 'published', NOW(), 'gpt-4o-mini'
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
    await linkArticleToPlayers(sql, insertedArticle.id, [article.title, article.excerpt, article.content].join(" "), playerId);
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function linkArticleToPlayers(
  sql: NeonQueryFunction<false, false>,
  articleId: string,
  text: string,
  primaryPlayerId?: string | null
): Promise<void> {
  const players = await sql`
    SELECT id, name, known_as FROM players
    WHERE position != 'Unknown' AND length(name) > 3
  `;

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
