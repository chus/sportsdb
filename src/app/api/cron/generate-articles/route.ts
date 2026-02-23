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
      errors: [] as string[],
    };

    // Generate match reports (10 per run)
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
      LIMIT 10
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
        results.errors.push(`Match ${match.id}: ${error}`);
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

5. LENGTH: 800-1000 words minimum. This should be a comprehensive match report.

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
          content: "You are an expert sports journalist. Write engaging, detailed match reports with vivid language and professional analysis. Always return valid JSON."
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 4000,
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
  }
}
