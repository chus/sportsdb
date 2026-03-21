/**
 * Marketing AI Agent — Layer 1: Analyze Content Gaps
 *
 * Finds entities (teams, players, competitions) with thin or missing content.
 * Writes results to data/content-gaps.json for downstream generation.
 *
 * Usage:
 *   npx tsx scripts/agents/analyze-gaps.ts
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

interface ContentGap {
  entityType: "team" | "player" | "competition";
  entityId: string;
  entityName: string;
  entitySlug: string;
  reason: string;
  articleCount: number;
}

interface GapReport {
  generatedAt: string;
  gaps: ContentGap[];
  summary: {
    teamsWithNoArticles: number;
    playersWithNoSpotlight: number;
    competitionsWithFewArticles: number;
    totalGaps: number;
  };
}

async function findTeamsWithNoArticles(): Promise<ContentGap[]> {
  const rows = await sql`
    SELECT t.id, t.name, t.slug
    FROM teams t
    WHERE t.tier <= 2
      AND NOT EXISTS (
        SELECT 1 FROM article_teams at2
        WHERE at2.team_id = t.id
      )
    ORDER BY t.tier ASC, t.name ASC
    LIMIT 20
  `;
  return rows.map((r) => ({
    entityType: "team",
    entityId: r.id,
    entityName: r.name,
    entitySlug: r.slug,
    reason: "No articles mentioning this team",
    articleCount: 0,
  }));
}

async function findPlayersWithNoSpotlight(): Promise<ContentGap[]> {
  const rows = await sql`
    SELECT p.id, p.name, p.slug, p.popularity_score
    FROM players p
    WHERE p.status = 'active'
      AND p.popularity_score > 0
      AND NOT EXISTS (
        SELECT 1 FROM articles a
        WHERE a.primary_player_id = p.id
          AND a.type = 'player_spotlight'
      )
    ORDER BY p.popularity_score DESC
    LIMIT 20
  `;
  return rows.map((r) => ({
    entityType: "player",
    entityId: r.id,
    entityName: r.name,
    entitySlug: r.slug,
    reason: "No player_spotlight article",
    articleCount: 0,
  }));
}

async function findCompetitionsWithFewArticles(): Promise<ContentGap[]> {
  const rows = await sql`
    SELECT c.id, c.name, c.slug, COUNT(a.id)::int AS article_count
    FROM competitions c
    LEFT JOIN competition_seasons cs ON cs.competition_id = c.id
    LEFT JOIN articles a ON a.competition_season_id = cs.id
    GROUP BY c.id, c.name, c.slug
    HAVING COUNT(a.id) < 5
    ORDER BY COUNT(a.id) ASC, c.name ASC
    LIMIT 10
  `;
  return rows.map((r) => ({
    entityType: "competition",
    entityId: r.id,
    entityName: r.name,
    entitySlug: r.slug,
    reason: `Only ${r.article_count} articles for this competition`,
    articleCount: r.article_count,
  }));
}

async function logAction(action: string, output: string) {
  await sql`
    INSERT INTO agent_logs (agent_layer, action, output)
    VALUES ('analyze', ${action}, ${output})
  `;
}

async function main() {
  console.log("Agent Layer 1: Analyze Content Gaps");
  console.log("====================================\n");

  const teamsGaps = await findTeamsWithNoArticles();
  console.log(`Found ${teamsGaps.length} teams with no articles`);

  const playerGaps = await findPlayersWithNoSpotlight();
  console.log(`Found ${playerGaps.length} players with no spotlight`);

  const compGaps = await findCompetitionsWithFewArticles();
  console.log(`Found ${compGaps.length} competitions with few articles`);

  const allGaps = [...teamsGaps, ...playerGaps, ...compGaps];

  const report: GapReport = {
    generatedAt: new Date().toISOString(),
    gaps: allGaps,
    summary: {
      teamsWithNoArticles: teamsGaps.length,
      playersWithNoSpotlight: playerGaps.length,
      competitionsWithFewArticles: compGaps.length,
      totalGaps: allGaps.length,
    },
  };

  const outDir = join(process.cwd(), "data");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "content-gaps.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${allGaps.length} gaps to ${outPath}`);

  await logAction("analyze_gaps", JSON.stringify(report.summary));
  console.log("Done!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
