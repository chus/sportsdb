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

  return `You are an SEO-focused sports journalist writing a match report for a football database website.

MATCH DETAILS:
- Competition: ${match.competition} (${match.season})
- Date: ${match.scheduled_at}
- Result: ${scoreline}
${match.venue ? `- Venue: ${match.venue}` : ""}
${match.matchday ? `- Matchday: ${match.matchday}` : ""}

KEY EVENTS:
${events.map((e: any) => `${e.minute}' - ${e.type}: ${e.player_name} (${e.team_name})`).join("\n")}

${match.existing_summary ? `MATCH SUMMARY (use as reference):\n${match.existing_summary}` : ""}

INTERNAL LINKS TO USE:
- Home team: ${homeTeamLink}
- Away team: ${awayTeamLink}
- Competition: ${competitionLink}

SEO REQUIREMENTS:
1. Include the team names and competition in the title for search visibility
2. Use H2/H3 subheadings to structure content (## First Half, ## Second Half, ## Key Moments)
3. Include internal markdown links to team pages
4. When mentioning goal scorers, link to their player page using format [Player Name](/players/player-slug)
5. Include keywords: "${match.home_team} vs ${match.away_team}", "${match.competition} ${match.season}"
6. Meta description should be 150-160 chars with key result info

ARTICLE REQUIREMENTS:
1. Engaging headline with team names and score (max 80 chars)
2. Brief excerpt for cards/social (1-2 sentences, 150 chars max)
3. 400-600 words, professional sports journalism style
4. Clear structure with H2 headings for sections
5. All team/player mentions should be internal links

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

async function generateArticle(openai: OpenAI, prompt: string): Promise<any | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
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
      ${matchId}, 'published', NOW(), 'gpt-3.5-turbo'
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
