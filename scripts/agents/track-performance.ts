/**
 * Marketing AI Agent — Layer 4: Track Performance
 *
 * Reads article and content metrics from the DB and generates
 * a weekly summary report saved to data/agent-reports/.
 *
 * Usage:
 *   npx tsx scripts/agents/track-performance.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

interface WeeklyReport {
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  articles: {
    totalPublished: number;
    publishedThisWeek: number;
    byType: Record<string, number>;
  };
  social: {
    totalPosts: number;
    postsThisWeek: number;
    byPlatform: Record<string, number>;
  };
  contentGaps: {
    totalTeamsWithoutArticles: number;
    totalPlayersWithoutSpotlight: number;
  };
  agentActivity: {
    totalLogsThisWeek: number;
    byLayer: Record<string, number>;
  };
}

async function getArticleStats() {
  const [total] = await sql`
    SELECT COUNT(*)::int AS count FROM articles WHERE status = 'published'
  `;
  const [thisWeek] = await sql`
    SELECT COUNT(*)::int AS count FROM articles
    WHERE status = 'published'
      AND published_at >= NOW() - INTERVAL '7 days'
  `;
  const byType = await sql`
    SELECT type, COUNT(*)::int AS count FROM articles
    WHERE status = 'published'
      AND published_at >= NOW() - INTERVAL '7 days'
    GROUP BY type ORDER BY count DESC
  `;

  return {
    totalPublished: total.count,
    publishedThisWeek: thisWeek.count,
    byType: Object.fromEntries(byType.map((r) => [r.type, r.count])),
  };
}

async function getSocialStats() {
  const [total] = await sql`
    SELECT COUNT(*)::int AS count FROM social_posts
  `;
  const [thisWeek] = await sql`
    SELECT COUNT(*)::int AS count FROM social_posts
    WHERE created_at >= NOW() - INTERVAL '7 days'
  `;
  const byPlatform = await sql`
    SELECT platform, COUNT(*)::int AS count FROM social_posts
    WHERE created_at >= NOW() - INTERVAL '7 days'
    GROUP BY platform ORDER BY count DESC
  `;

  return {
    totalPosts: total.count,
    postsThisWeek: thisWeek.count,
    byPlatform: Object.fromEntries(byPlatform.map((r) => [r.platform, r.count])),
  };
}

async function getContentGapCounts() {
  const [teams] = await sql`
    SELECT COUNT(*)::int AS count FROM teams t
    WHERE t.tier <= 2
      AND NOT EXISTS (
        SELECT 1 FROM article_teams at2 WHERE at2.team_id = t.id
      )
  `;
  const [players] = await sql`
    SELECT COUNT(*)::int AS count FROM players p
    WHERE p.status = 'active' AND p.popularity_score > 0
      AND NOT EXISTS (
        SELECT 1 FROM articles a
        WHERE a.primary_player_id = p.id AND a.type = 'player_spotlight'
      )
  `;

  return {
    totalTeamsWithoutArticles: teams.count,
    totalPlayersWithoutSpotlight: players.count,
  };
}

async function getAgentActivity() {
  const [total] = await sql`
    SELECT COUNT(*)::int AS count FROM agent_logs
    WHERE created_at >= NOW() - INTERVAL '7 days'
  `;
  const byLayer = await sql`
    SELECT agent_layer, COUNT(*)::int AS count FROM agent_logs
    WHERE created_at >= NOW() - INTERVAL '7 days'
    GROUP BY agent_layer ORDER BY count DESC
  `;

  return {
    totalLogsThisWeek: total.count,
    byLayer: Object.fromEntries(byLayer.map((r) => [r.agent_layer, r.count])),
  };
}

async function logAction(action: string, output: string) {
  await sql`
    INSERT INTO agent_logs (agent_layer, action, output)
    VALUES ('track', ${action}, ${output})
  `;
}

async function main() {
  console.log("Agent Layer 4: Track Performance");
  console.log("=================================\n");

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const articles = await getArticleStats();
  console.log(`Articles: ${articles.publishedThisWeek} this week, ${articles.totalPublished} total`);

  const social = await getSocialStats();
  console.log(`Social posts: ${social.postsThisWeek} this week, ${social.totalPosts} total`);

  const gaps = await getContentGapCounts();
  console.log(`Content gaps: ${gaps.totalTeamsWithoutArticles} teams, ${gaps.totalPlayersWithoutSpotlight} players`);

  const agentActivity = await getAgentActivity();
  console.log(`Agent logs this week: ${agentActivity.totalLogsThisWeek}`);

  const report: WeeklyReport = {
    generatedAt: now.toISOString(),
    periodStart: weekAgo.toISOString().split("T")[0],
    periodEnd: now.toISOString().split("T")[0],
    articles,
    social,
    contentGaps: gaps,
    agentActivity,
  };

  const dateStr = now.toISOString().split("T")[0];
  const outDir = join(process.cwd(), "data", "agent-reports");
  mkdirSync(outDir, { recursive: true });

  const outPath = join(outDir, `week-${dateStr}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to ${outPath}`);

  await logAction("weekly_report", JSON.stringify(report.articles));
  console.log("Done!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
