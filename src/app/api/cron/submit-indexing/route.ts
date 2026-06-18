import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { submitUrlsToGoogle, submitUrlsToIndexNow } from "@/lib/seo/indexnow";
import { compareMatchup } from "@/lib/seo/compare";

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
          "/injuries",
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
        // Current-season finished matches, rotating through the whole
        // season week by week so every (now data-rich) match page gets
        // re-crawled — "last 7 days" submits nothing in the off-season.
        category = "current-season matches";
        const now = new Date();
        const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
        const weekIndex = Math.floor(dayOfYear / 7) % 12; // cycle ~12 weeks
        const offset = weekIndex * 200;
        const matches = await sql`
          SELECT m.slug FROM matches m
          JOIN competition_seasons cs ON cs.id = m.competition_season_id
          JOIN seasons s ON s.id = cs.season_id AND s.is_current = true
          WHERE m.status = 'finished' AND m.slug IS NOT NULL
          ORDER BY m.scheduled_at DESC
          OFFSET ${offset} LIMIT 200
        `;
        paths = matches.map((m) => `/matches/${m.slug}`);
        break;
      }
      case 4: {
        // Leaderboards + comparison pages. Compare pages are the format
        // that ranks page-one in GSC, so actively push them: pair the top
        // popularity-ranked players within position (matches the sitemap)
        // and submit in canonical order.
        category = "leaderboards + comparisons";
        const competitions = await sql`
          SELECT slug FROM competitions ORDER BY name LIMIT 30
        `;
        const leaderboardPaths = competitions.flatMap((c) => [
          `/top-scorers/${c.slug}`,
          `/top-assists/${c.slug}`,
        ]);
        const topPlayers = (await sql`
          SELECT slug, position FROM players
          WHERE is_indexable = true AND popularity_score > 0
          ORDER BY popularity_score DESC LIMIT 60
        `) as Array<{ slug: string; position: string | null }>;
        const byPos = new Map<string, string[]>();
        for (const p of topPlayers) {
          const k = p.position ?? "Forward";
          (byPos.get(k) ?? byPos.set(k, []).get(k)!).push(p.slug);
        }
        const comparePaths: string[] = [];
        for (const group of byPos.values()) {
          for (let i = 0; i < group.length && comparePaths.length < 150; i++) {
            for (let j = i + 1; j < group.length && comparePaths.length < 150; j++) {
              comparePaths.push(`/compare/${compareMatchup(group[i], group[j])}`);
            }
          }
        }
        paths = [...leaderboardPaths, ...comparePaths];
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

    // IndexNow has no daily limit, so submit both locales (en at root,
    // es prefixed). Google's Indexing API caps at 200/day — we cap the
    // English-locale set at 200 there and skip Spanish (most submissions
    // for non-JobPosting/BroadcastEvent content are ignored anyway).
    const enPaths = paths.slice(0, 200);
    const indexNowPaths = [
      ...paths,
      ...paths.map((p) => `/es${p === "/" ? "" : p}`),
    ];

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        category,
        dayOfWeek,
        enUrlCount: enPaths.length,
        indexNowUrlCount: indexNowPaths.length,
        sampleEnUrls: enPaths.slice(0, 5),
        sampleEsUrls: paths.slice(0, 5).map((p) => `/es${p === "/" ? "" : p}`),
      });
    }

    const [googleResult] = await Promise.all([
      submitUrlsToGoogle(enPaths),
      submitUrlsToIndexNow(indexNowPaths),
    ]);

    return NextResponse.json({
      success: true,
      category,
      dayOfWeek,
      enUrlCount: enPaths.length,
      indexNowUrlCount: indexNowPaths.length,
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
