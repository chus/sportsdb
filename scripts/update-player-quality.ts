/**
 * Batch update is_indexable column for all players.
 *
 * Computes quality scores in bulk and updates the cached `is_indexable` flag.
 * Run after data enrichment or on a schedule.
 *
 * Usage:
 *   npx tsx scripts/update-player-quality.ts
 *   npx tsx scripts/update-player-quality.ts --dry-run
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const DRY_RUN = process.argv.includes("--dry-run");

interface PlayerRow {
  id: string;
  position: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  height_cm: number | null;
  preferred_foot: string | null;
  image_url: string | null;
  career_count: number;
  current_team: number;
  stats_count: number;
  lineup_count: number;
  article_count: number;
  is_indexable: boolean;
}

function scorePlayer(p: PlayerRow): number {
  let score = 0;
  if (p.position && p.position !== "Unknown") score += 10;
  if (p.nationality) score += 10;
  if (p.date_of_birth) score += 5;
  if (p.height_cm) score += 3;
  if (p.preferred_foot) score += 2;
  if (p.image_url) score += 5;
  if (Number(p.career_count) >= 1) score += 10;
  if (Number(p.career_count) >= 2) score += 5;
  if (Number(p.current_team) > 0) score += 10;
  if (Number(p.stats_count) > 0) score += 20;
  if (Number(p.lineup_count) > 0) score += 10;
  if (Number(p.article_count) > 0) score += 10;
  return score;
}

async function main() {
  console.log("=== Update Player Quality Scores ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  // Bulk query all players with aggregated signals
  console.log("Fetching all players with quality signals...");
  const players = await sql`
    SELECT
      p.id,
      p.position,
      p.nationality,
      p.date_of_birth,
      p.height_cm,
      p.preferred_foot,
      p.image_url,
      p.is_indexable,
      COALESCE(career.cnt, 0) as career_count,
      COALESCE(current.cnt, 0) as current_team,
      COALESCE(stats.cnt, 0) as stats_count,
      COALESCE(lineups.cnt, 0) as lineup_count,
      COALESCE(articles.cnt, 0) as article_count
    FROM players p
    LEFT JOIN LATERAL (
      SELECT count(*) as cnt FROM player_team_history WHERE player_id = p.id
    ) career ON true
    LEFT JOIN LATERAL (
      SELECT count(*) as cnt FROM player_team_history WHERE player_id = p.id AND valid_to IS NULL
    ) current ON true
    LEFT JOIN LATERAL (
      SELECT count(*) as cnt FROM player_season_stats WHERE player_id = p.id
    ) stats ON true
    LEFT JOIN LATERAL (
      SELECT count(*) as cnt FROM match_lineups WHERE player_id = p.id
    ) lineups ON true
    LEFT JOIN LATERAL (
      SELECT count(*) as cnt FROM article_players WHERE player_id = p.id
    ) articles ON true
  ` as PlayerRow[];

  console.log(`  Found ${players.length} players\n`);

  // Score each player
  let tierA = 0, tierB = 0, tierC = 0, tierD = 0;
  let would404 = 0;
  let toSetTrue: string[] = [];
  let toSetFalse: string[] = [];

  for (const p of players) {
    const score = scorePlayer(p);
    const isIndexable = score >= 40;

    if (score >= 60) tierA++;
    else if (score >= 40) tierB++;
    else if (score >= 20) tierC++;
    else tierD++;

    if (score < 15) would404++;

    // Only update if changed
    if (isIndexable && !p.is_indexable) {
      toSetTrue.push(p.id);
    } else if (!isIndexable && p.is_indexable) {
      toSetFalse.push(p.id);
    }
  }

  console.log("=== Quality Distribution ===");
  console.log(`  Tier A (60+, indexed):  ${tierA}`);
  console.log(`  Tier B (40-59, indexed): ${tierB}`);
  console.log(`  Tier C (20-39, noindex): ${tierC}`);
  console.log(`  Tier D (0-19, noindex):  ${tierD}`);
  console.log(`  Would 404 (<15):         ${would404}`);
  console.log(`  Total indexable (A+B):   ${tierA + tierB}`);
  console.log(`\n  Need is_indexable → true:  ${toSetTrue.length}`);
  console.log(`  Need is_indexable → false: ${toSetFalse.length}`);

  if (!DRY_RUN) {
    // Batch update in chunks of 500
    const CHUNK = 500;

    if (toSetTrue.length > 0) {
      console.log(`\nSetting is_indexable = true for ${toSetTrue.length} players...`);
      for (let i = 0; i < toSetTrue.length; i += CHUNK) {
        const chunk = toSetTrue.slice(i, i + CHUNK);
        await sql`UPDATE players SET is_indexable = true, updated_at = NOW() WHERE id = ANY(${chunk}::uuid[])`;
        console.log(`  Updated ${Math.min(i + CHUNK, toSetTrue.length)}/${toSetTrue.length}`);
      }
    }

    if (toSetFalse.length > 0) {
      console.log(`\nSetting is_indexable = false for ${toSetFalse.length} players...`);
      for (let i = 0; i < toSetFalse.length; i += CHUNK) {
        const chunk = toSetFalse.slice(i, i + CHUNK);
        await sql`UPDATE players SET is_indexable = false, updated_at = NOW() WHERE id = ANY(${chunk}::uuid[])`;
        console.log(`  Updated ${Math.min(i + CHUNK, toSetFalse.length)}/${toSetFalse.length}`);
      }
    }
  }

  console.log("\n=== Done ===");
}

main().catch(console.error);
