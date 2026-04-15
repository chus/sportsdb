import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { submitUrlsToGoogle, submitUrlsToIndexNow } from "@/lib/seo/indexnow";

export const maxDuration = 60;

/**
 * Submits important pages to Google Indexing API + IndexNow.
 * Runs daily, rotates through page types to stay under Google's 200/day quota.
 *
 * Strategy: each day submits a different category of pages, cycling through:
 *   Day 0: Competition pages + recent articles
 *   Day 1: Top team pages (tier 1-2)
 *   Day 2: Top player pages (indexable)
 *   Day 3: Recent match pages
 *   Day 4: Top scorer / assist leaderboard pages
 *   Day 5-6: More articles (older, may need re-crawl)
 */
export async function GET(request: NextRequest) {
  const DATABASE_URL = process.env.DATABASE_URL;
  const CRON_SECRET = process.env.CRON_SECRET;

  if (!DATABASE_URL) {
    return NextResponse.json({ error: "Missing DATABASE_URL" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const sql = neon(DATABASE_URL);

  const dayOfWeek = new Date().getDay(); // 0-6
  let paths: string[] = [];
  let category = "";

  try {
    switch (dayOfWeek) {
      case 0: {
        // Competition pages + recent articles
        category = "competitions + recent articles";
        const competitions = await sql`
          SELECT slug FROM competitions ORDER BY name LIMIT 50
        `;
        const recentArticles = await sql`
          SELECT slug FROM articles
          WHERE status = 'published' AND published_at >= NOW() - INTERVAL '3 days'
          ORDER BY published_at DESC LIMIT 100
        `;
        paths = [
          ...competitions.map((c) => `/competitions/${c.slug}`),
          ...recentArticles.map((a) => `/news/${a.slug}`),
        ];
        break;
      }
      case 1: {
        // Top teams
        category = "top teams";
        const teams = await sql`
          SELECT slug FROM teams WHERE tier <= 2 ORDER BY tier, name LIMIT 150
        `;
        paths = teams.map((t) => `/teams/${t.slug}`);
        break;
      }
      case 2: {
        // Indexable players
        category = "top players";
        const players = await sql`
          SELECT slug FROM players
          WHERE is_indexable = true
          ORDER BY popularity_score DESC NULLS LAST
          LIMIT 150
        `;
        paths = players.map((p) => `/players/${p.slug}`);
        break;
      }
      case 3: {
        // Recent match pages
        category = "recent matches";
        const matches = await sql`
          SELECT slug FROM matches
          WHERE status = 'finished' AND slug IS NOT NULL
            AND scheduled_at >= NOW() - INTERVAL '7 days'
          ORDER BY scheduled_at DESC LIMIT 150
        `;
        paths = matches.map((m) => `/matches/${m.slug}`);
        break;
      }
      case 4: {
        // Leaderboard pages
        category = "leaderboards";
        const competitions = await sql`
          SELECT slug FROM competitions ORDER BY name LIMIT 30
        `;
        paths = competitions.flatMap((c) => [
          `/top-scorers/${c.slug}`,
          `/top-assists/${c.slug}`,
        ]);
        break;
      }
      default: {
        // Days 5-6: older articles that may need re-crawl
        category = "older articles";
        const offset = (dayOfWeek - 5) * 150;
        const articles = await sql`
          SELECT slug FROM articles
          WHERE status = 'published'
          ORDER BY published_at DESC
          OFFSET ${offset} LIMIT 150
        `;
        paths = articles.map((a) => `/news/${a.slug}`);
        break;
      }
    }

    // Cap at 200 (Google's daily quota)
    paths = paths.slice(0, 200);

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        category,
        dayOfWeek,
        urlCount: paths.length,
        sampleUrls: paths.slice(0, 10),
      });
    }

    const [googleResult] = await Promise.all([
      submitUrlsToGoogle(paths),
      submitUrlsToIndexNow(paths),
    ]);

    return NextResponse.json({
      success: true,
      category,
      dayOfWeek,
      urlCount: paths.length,
      googleSubmitted: googleResult.submitted,
      googleErrors: googleResult.errors.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Submit indexing cron error:", error);
    return NextResponse.json(
      { error: "Failed to submit URLs", details: String(error) },
      { status: 500 }
    );
  }
}
