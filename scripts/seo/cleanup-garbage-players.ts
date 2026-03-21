/**
 * Garbage Player Cleanup Script
 *
 * Identifies non-player entries among Unknown-position players
 * (league names, year ranges, staff roles, etc.) and deletes them
 * from all related tables.
 *
 * Usage:
 *   npx tsx scripts/seo/cleanup-garbage-players.ts --dry-run
 *   npx tsx scripts/seo/cleanup-garbage-players.ts
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const DRY_RUN = process.argv.includes("--dry-run");

const GARBAGE_PATTERNS: RegExp[] = [
  // Year ranges: "1920–28", "1949–50", "2024", "1950–1970"
  /^\d{4}[–-]\d{2,4}$/,
  /^\d{4}$/,
  // Year ranges with commas: "1920–28, 1935", "2006–2008, 2012–2015"
  /^\d{4}[–-]\d{2,4}[,\s]/,
  // Season + league combos: "1999–2000 Serie B", "2010–11 Serie A"
  /^\d{4}[–-]\d{2,4}\s+\w/,
  // Year-text combos: "2018–present", "2020–current"
  /^\d{4}[–-](present|current|today)/i,
  // Multi-digit prefix junk: "19992000–2001"
  /^\d{5,}/,
  // Season labels: "2023/24", "2024/25"
  /^\d{4}\/\d{2,4}/,
  // League/competition names
  /^(Bundesliga|La Liga|Serie [A-Z]|Ligue \d|Premier League|Eredivisie|Primeira Liga)/i,
  /^(\d+\.\s*(Bundesliga|Liga))/i,
  /^(Champions League|Europa League|Conference League)/i,
  /^(Group [A-Z])/i,
  /^(Verbandsliga|Oberliga|Regionalliga|Kreisliga)/i,
  /^(Copa (Libertadores|Sudamericana|America))/i,
  /^(UEFA|FIFA|CONMEBOL|AFC|CAF)\b/i,
  // Year prefixed competition names: "2025–26 UEFA", "2025 Copa"
  /^\d{4}[–-]?\d{0,2}\s+(UEFA|Copa|Liga|Ligue)/i,
  // Club names stored as players
  /^(FC |SC |SV |TSV |BSG |BTuFC |KRPO$|1\.\s*FC\s)/i,
  /^(FC Olympia|FC Union|Club Atlético)/i,
  // "department" in name (historical club fragments)
  /department/i,
  // Staff roles
  /^(Manager|Coach|Head Coach|Assistant|Physio|Doctor|Analyst)/i,
  // Short codes (2-5 uppercase letters only)
  /^[A-Z]{2,5}$/,
  // Date strings: "January 2024", etc.
  /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i,
  // Entries with multiple names separated by multi-space (board members)
  /\s{3,}/,
  // 3. Liga type entries
  /^\d+\.\s+(Liga|Bundesliga|Division)/i,
];

function isGarbageEntry(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;
  return GARBAGE_PATTERNS.some((p) => p.test(trimmed));
}

async function main() {
  console.log("=== Garbage Player Cleanup ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  // Fetch all Unknown-position players
  const unknownPlayers = await sql`
    SELECT id, name, slug, position
    FROM players
    WHERE position = 'Unknown' OR position IS NULL
    ORDER BY name
  `;

  console.log(`Total Unknown-position players: ${unknownPlayers.length}\n`);

  const garbage: typeof unknownPlayers = [];
  const legitimate: typeof unknownPlayers = [];

  for (const p of unknownPlayers) {
    if (isGarbageEntry(p.name)) {
      garbage.push(p);
    } else {
      legitimate.push(p);
    }
  }

  console.log(`Garbage entries identified: ${garbage.length}`);
  console.log(`Legitimate Unknown-position players: ${legitimate.length}\n`);

  // Show garbage entries
  if (garbage.length > 0) {
    console.log("Garbage entries to delete:");
    for (const g of garbage.slice(0, 50)) {
      console.log(`  "${g.name}" (${g.slug})`);
    }
    if (garbage.length > 50) {
      console.log(`  ... and ${garbage.length - 50} more`);
    }
  }

  if (DRY_RUN) {
    console.log("\n[DRY RUN] No deletions performed.");

    // Show some legitimate Unknown players for review
    console.log("\nSample legitimate Unknown-position players (for manual review):");
    for (const p of legitimate.slice(0, 20)) {
      console.log(`  "${p.name}" (${p.slug})`);
    }

    console.log("\n=== Done (dry run) ===");
    return;
  }

  // Delete garbage entries
  if (garbage.length === 0) {
    console.log("No garbage entries to delete.");
    console.log("\n=== Done ===");
    return;
  }

  const garbageIds = garbage.map((g) => g.id);

  console.log("\nDeleting garbage entries from all tables...");

  const BATCH_SIZE = 100;

  // Delete in FK-safe order with explicit queries for each table
  for (let i = 0; i < garbageIds.length; i += BATCH_SIZE) {
    const batch = garbageIds.slice(i, i + BATCH_SIZE);
    await sql`DELETE FROM search_index WHERE id = ANY(${batch}) AND entity_type = 'player'`;
  }
  console.log("  search_index: cleaned");

  for (let i = 0; i < garbageIds.length; i += BATCH_SIZE) {
    const batch = garbageIds.slice(i, i + BATCH_SIZE);
    await sql`DELETE FROM match_lineups WHERE player_id = ANY(${batch})`;
  }
  console.log("  match_lineups: cleaned");

  for (let i = 0; i < garbageIds.length; i += BATCH_SIZE) {
    const batch = garbageIds.slice(i, i + BATCH_SIZE);
    await sql`DELETE FROM article_players WHERE player_id = ANY(${batch})`;
  }
  console.log("  article_players: cleaned");

  for (let i = 0; i < garbageIds.length; i += BATCH_SIZE) {
    const batch = garbageIds.slice(i, i + BATCH_SIZE);
    await sql`DELETE FROM player_season_stats WHERE player_id = ANY(${batch})`;
  }
  console.log("  player_season_stats: cleaned");

  for (let i = 0; i < garbageIds.length; i += BATCH_SIZE) {
    const batch = garbageIds.slice(i, i + BATCH_SIZE);
    await sql`DELETE FROM match_events WHERE player_id = ANY(${batch})`;
    await sql`UPDATE match_events SET secondary_player_id = NULL WHERE secondary_player_id = ANY(${batch})`;
  }
  console.log("  match_events: cleaned");

  for (let i = 0; i < garbageIds.length; i += BATCH_SIZE) {
    const batch = garbageIds.slice(i, i + BATCH_SIZE);
    await sql`DELETE FROM player_team_history WHERE player_id = ANY(${batch})`;
  }
  console.log("  player_team_history: cleaned");

  // Finally delete the players themselves
  for (let i = 0; i < garbageIds.length; i += BATCH_SIZE) {
    const batch = garbageIds.slice(i, i + BATCH_SIZE);
    await sql`DELETE FROM players WHERE id = ANY(${batch})`;
  }
  console.log(`  players: ${garbageIds.length} deleted`);

  console.log(`\n=== Cleanup Complete: ${garbageIds.length} garbage entries removed ===`);
}

main().catch(console.error);
