import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { postTweet } from "@/lib/social/twitter";
import { postToReddit } from "@/lib/social/reddit";
import {
  composeTweet,
  composeRedditTitle,
  getSubreddit,
  type ArticleForSocial,
} from "@/lib/social/compose";

export const maxDuration = 120;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

const MAX_TWEETS_PER_RUN = 10;
const MAX_REDDIT_PER_RUN = 5;
const REDDIT_ARTICLE_TYPES = ["match_report", "round_recap"];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay() {
  return 30_000 + Math.random() * 90_000; // 30-120s
}

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

  const results = {
    tweetsPosted: 0,
    redditPosted: 0,
    errors: [] as string[],
    dryRun,
  };

  try {
    // Find articles published in last 24h without a social_posts row for each platform
    const articlesForTwitter = await sql`
      SELECT
        a.id, a.slug, a.type, a.title, a.excerpt, a.matchday,
        m.home_score, m.away_score,
        ht.name as home_team, awt.name as away_team,
        p.name as player_name,
        pss.goals as player_goals, pss.assists as player_assists,
        c.name as competition_name, c.slug as competition_slug
      FROM articles a
      LEFT JOIN matches m ON a.match_id = m.id
      LEFT JOIN teams ht ON m.home_team_id = ht.id
      LEFT JOIN teams awt ON m.away_team_id = awt.id
      LEFT JOIN players p ON a.primary_player_id = p.id
      LEFT JOIN competition_seasons cs ON a.competition_season_id = cs.id
      LEFT JOIN competitions c ON cs.competition_id = c.id
      LEFT JOIN player_season_stats pss ON pss.player_id = p.id
        AND pss.competition_season_id = cs.id
      LEFT JOIN social_posts sp ON sp.article_id = a.id AND sp.platform = 'twitter'
      WHERE a.status = 'published'
        AND a.published_at >= NOW() - INTERVAL '24 hours'
        AND sp.id IS NULL
      ORDER BY a.published_at DESC
      LIMIT ${MAX_TWEETS_PER_RUN}
    `;

    const articlesForReddit = await sql`
      SELECT
        a.id, a.slug, a.type, a.title, a.excerpt, a.matchday,
        m.home_score, m.away_score,
        ht.name as home_team, awt.name as away_team,
        c.name as competition_name, c.slug as competition_slug
      FROM articles a
      LEFT JOIN matches m ON a.match_id = m.id
      LEFT JOIN teams ht ON m.home_team_id = ht.id
      LEFT JOIN teams awt ON m.away_team_id = awt.id
      LEFT JOIN competition_seasons cs ON a.competition_season_id = cs.id
      LEFT JOIN competitions c ON cs.competition_id = c.id
      LEFT JOIN social_posts sp ON sp.article_id = a.id AND sp.platform = 'reddit'
      WHERE a.status = 'published'
        AND a.published_at >= NOW() - INTERVAL '24 hours'
        AND a.type = ANY(${REDDIT_ARTICLE_TYPES})
        AND sp.id IS NULL
      ORDER BY a.published_at DESC
      LIMIT ${MAX_REDDIT_PER_RUN}
    `;

    // Post tweets
    for (const row of articlesForTwitter) {
      const article: ArticleForSocial = {
        slug: row.slug,
        type: row.type,
        title: row.title,
        excerpt: row.excerpt,
        homeTeam: row.home_team,
        awayTeam: row.away_team,
        homeScore: row.home_score,
        awayScore: row.away_score,
        playerName: row.player_name,
        playerGoals: row.player_goals,
        playerAssists: row.player_assists,
        competitionName: row.competition_name,
        competitionSlug: row.competition_slug,
        matchday: row.matchday,
      };

      const tweetText = composeTweet(article);

      if (dryRun) {
        console.log(`[DRY RUN] Tweet for ${row.slug}:\n${tweetText}\n`);
        results.tweetsPosted++;
        continue;
      }

      try {
        const result = await postTweet(tweetText);

        await sql`
          INSERT INTO social_posts (platform, content, link_url, article_id, external_id, status, posted_at)
          VALUES (
            'twitter',
            ${tweetText},
            ${`${BASE_URL}/news/${row.slug}`},
            ${row.id},
            ${result?.id || null},
            ${result ? "posted" : "failed"},
            ${result ? new Date().toISOString() : null}
          )
        `;

        if (result) results.tweetsPosted++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        results.errors.push(`Tweet ${row.slug}: ${msg}`);

        await sql`
          INSERT INTO social_posts (platform, content, link_url, article_id, status, error_message)
          VALUES (
            'twitter',
            ${tweetText},
            ${`${BASE_URL}/news/${row.slug}`},
            ${row.id},
            'failed',
            ${msg}
          )
        `;
      }

      if (articlesForTwitter.indexOf(row) < articlesForTwitter.length - 1) {
        await sleep(randomDelay());
      }
    }

    // Post to Reddit
    for (const row of articlesForReddit) {
      const article: ArticleForSocial = {
        slug: row.slug,
        type: row.type,
        title: row.title,
        excerpt: row.excerpt,
        homeTeam: row.home_team,
        awayTeam: row.away_team,
        homeScore: row.home_score,
        awayScore: row.away_score,
        competitionName: row.competition_name,
        competitionSlug: row.competition_slug,
        matchday: row.matchday,
      };

      const redditTitle = composeRedditTitle(article);
      const subreddit = getSubreddit(row.competition_slug);
      const articleUrl = `${BASE_URL}/news/${row.slug}`;

      if (!subreddit) continue;

      if (dryRun) {
        console.log(`[DRY RUN] Reddit r/${subreddit}: ${redditTitle}\n  ${articleUrl}\n`);
        results.redditPosted++;
        continue;
      }

      try {
        const result = await postToReddit({
          subreddit,
          title: redditTitle,
          url: articleUrl,
        });

        await sql`
          INSERT INTO social_posts (platform, content, link_url, article_id, external_id, status, posted_at)
          VALUES (
            'reddit',
            ${redditTitle},
            ${articleUrl},
            ${row.id},
            ${result?.id || null},
            ${result ? "posted" : "failed"},
            ${result ? new Date().toISOString() : null}
          )
        `;

        if (result) results.redditPosted++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        results.errors.push(`Reddit ${row.slug}: ${msg}`);

        await sql`
          INSERT INTO social_posts (platform, content, link_url, article_id, status, error_message)
          VALUES (
            'reddit',
            ${redditTitle},
            ${articleUrl},
            ${row.id},
            'failed',
            ${msg}
          )
        `;
      }

      if (articlesForReddit.indexOf(row) < articlesForReddit.length - 1) {
        await sleep(randomDelay());
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Social distribution cron error:", error);
    return NextResponse.json(
      { error: "Failed to distribute social posts", details: String(error) },
      { status: 500 }
    );
  }
}
