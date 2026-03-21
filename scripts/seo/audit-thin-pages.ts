/**
 * Thin Pages Audit Script
 *
 * Scores every player and team page on a 0-100 quality scale,
 * assigns quality tiers (A/B/C/D), and outputs actionable results.
 *
 * Usage:
 *   npx tsx scripts/seo/audit-thin-pages.ts
 *   npx tsx scripts/seo/audit-thin-pages.ts --json   # also write JSON output
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { writeFileSync, mkdirSync, existsSync } from "fs";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const WRITE_JSON = process.argv.includes("--json");

type Tier = "A" | "B" | "C" | "D";

interface EntityScore {
  id: string;
  slug: string;
  name: string;
  score: number;
  tier: Tier;
  missing: string[];
}

function assignPlayerTier(score: number): Tier {
  if (score >= 60) return "A";
  if (score >= 40) return "B";
  if (score >= 20) return "C";
  return "D";
}

function assignTeamTier(score: number): Tier {
  if (score >= 40) return "A";
  if (score >= 25) return "B";
  if (score >= 15) return "C";
  return "D";
}

async function auditPlayers(): Promise<EntityScore[]> {
  console.log("Scoring players...");

  const rows = await sql`
    SELECT
      p.id, p.slug, p.name, p.position, p.nationality,
      p.date_of_birth, p.height_cm, p.preferred_foot, p.image_url,
      count(DISTINCT pth.id) FILTER (WHERE pth.id IS NOT NULL) AS career_count,
      count(DISTINCT pth.id) FILTER (WHERE pth.valid_to IS NULL) AS current_team_count,
      count(DISTINCT pss.id) FILTER (WHERE pss.id IS NOT NULL) AS stats_count,
      count(DISTINCT ml.id) FILTER (WHERE ml.id IS NOT NULL) AS lineup_count,
      count(DISTINCT ap.id) FILTER (WHERE ap.id IS NOT NULL) AS article_count
    FROM players p
    LEFT JOIN player_team_history pth ON pth.player_id = p.id
    LEFT JOIN player_season_stats pss ON pss.player_id = p.id
    LEFT JOIN match_lineups ml ON ml.player_id = p.id
    LEFT JOIN article_players ap ON ap.player_id = p.id
    WHERE p.position IS NOT NULL AND p.position != 'Unknown'
    GROUP BY p.id
  `;

  const results: EntityScore[] = [];

  for (const r of rows) {
    let score = 0;
    const missing: string[] = [];

    // Position (10)
    if (r.position && r.position !== "Unknown") {
      score += 10;
    } else {
      missing.push("position");
    }

    // Nationality (10)
    if (r.nationality) {
      score += 10;
    } else {
      missing.push("nationality");
    }

    // Date of birth (5)
    if (r.date_of_birth) {
      score += 5;
    } else {
      missing.push("dateOfBirth");
    }

    // Height (3)
    if (r.height_cm) {
      score += 3;
    } else {
      missing.push("heightCm");
    }

    // Preferred foot (2)
    if (r.preferred_foot) {
      score += 2;
    } else {
      missing.push("preferredFoot");
    }

    // Image (5)
    if (r.image_url) {
      score += 5;
    } else {
      missing.push("imageUrl");
    }

    // Career >= 1 (10)
    const careerCount = Number(r.career_count);
    if (careerCount >= 1) {
      score += 10;
    } else {
      missing.push("career");
    }

    // Career >= 2 (5)
    if (careerCount >= 2) {
      score += 5;
    }

    // Current team (10)
    if (Number(r.current_team_count) > 0) {
      score += 10;
    } else {
      missing.push("currentTeam");
    }

    // Season stats (20)
    if (Number(r.stats_count) > 0) {
      score += 20;
    } else {
      missing.push("stats");
    }

    // Match lineups (10)
    if (Number(r.lineup_count) > 0) {
      score += 10;
    } else {
      missing.push("lineups");
    }

    // Related articles (10)
    if (Number(r.article_count) > 0) {
      score += 10;
    } else {
      missing.push("articles");
    }

    results.push({
      id: r.id,
      slug: r.slug,
      name: r.name,
      score,
      tier: assignPlayerTier(score),
      missing,
    });
  }

  return results;
}

async function auditTeams(): Promise<EntityScore[]> {
  console.log("Scoring teams...");

  const rows = await sql`
    SELECT
      t.id, t.slug, t.name, t.country, t.city, t.founded_year, t.logo_url,
      count(DISTINCT pth.id) FILTER (
        WHERE pth.valid_to IS NULL
        AND EXISTS (SELECT 1 FROM players p WHERE p.id = pth.player_id AND p.position != 'Unknown')
      ) AS squad_size,
      count(DISTINCT s.id) FILTER (WHERE s.id IS NOT NULL) AS standings_count,
      count(DISTINCT m.id) FILTER (WHERE m.id IS NOT NULL) AS match_count
    FROM teams t
    LEFT JOIN player_team_history pth ON pth.team_id = t.id
    LEFT JOIN standings s ON s.team_id = t.id
    LEFT JOIN matches m ON (m.home_team_id = t.id OR m.away_team_id = t.id)
    GROUP BY t.id
  `;

  const results: EntityScore[] = [];

  for (const r of rows) {
    let score = 0;
    const missing: string[] = [];

    if (r.country) {
      score += 10;
    } else {
      missing.push("country");
    }

    if (r.city) {
      score += 5;
    } else {
      missing.push("city");
    }

    if (r.founded_year) {
      score += 5;
    } else {
      missing.push("foundedYear");
    }

    if (r.logo_url) {
      score += 5;
    } else {
      missing.push("logoUrl");
    }

    if (Number(r.squad_size) > 0) {
      score += 15;
    } else {
      missing.push("squad");
    }

    if (Number(r.standings_count) > 0) {
      score += 10;
    } else {
      missing.push("standings");
    }

    if (Number(r.match_count) > 0) {
      score += 10;
    } else {
      missing.push("matches");
    }

    results.push({
      id: r.id,
      slug: r.slug,
      name: r.name,
      score,
      tier: assignTeamTier(score),
      missing,
    });
  }

  return results;
}

function printTierSummary(label: string, results: EntityScore[]) {
  const tiers = { A: 0, B: 0, C: 0, D: 0 };
  for (const r of results) tiers[r.tier]++;
  const total = results.length;

  console.log(`\n--- ${label} (${total} total) ---`);
  console.log(`  Tier A (Rich):       ${tiers.A} (${((tiers.A / total) * 100).toFixed(1)}%) — indexed`);
  console.log(`  Tier B (Adequate):   ${tiers.B} (${((tiers.B / total) * 100).toFixed(1)}%) — indexed`);
  console.log(`  Tier C (Thin):       ${tiers.C} (${((tiers.C / total) * 100).toFixed(1)}%) — noindex`);
  console.log(`  Tier D (Stub):       ${tiers.D} (${((tiers.D / total) * 100).toFixed(1)}%) — noindex`);
  console.log(`  Indexed total:       ${tiers.A + tiers.B} (${(((tiers.A + tiers.B) / total) * 100).toFixed(1)}%)`);
  console.log(`  Noindex total:       ${tiers.C + tiers.D} (${(((tiers.C + tiers.D) / total) * 100).toFixed(1)}%)`);

  // Top missing signals
  const missingCounts: Record<string, number> = {};
  for (const r of results) {
    for (const m of r.missing) {
      missingCounts[m] = (missingCounts[m] || 0) + 1;
    }
  }
  const sorted = Object.entries(missingCounts).sort((a, b) => b[1] - a[1]);
  console.log(`\n  Top missing signals:`);
  for (const [signal, count] of sorted.slice(0, 8)) {
    console.log(`    ${signal}: ${count} (${((count / total) * 100).toFixed(1)}%)`);
  }

  // Sample Tier D entities
  const tierD = results.filter((r) => r.tier === "D").slice(0, 10);
  if (tierD.length > 0) {
    console.log(`\n  Sample Tier D (worst):`);
    for (const r of tierD) {
      console.log(`    ${r.name} (${r.slug}) — score ${r.score}, missing: ${r.missing.join(", ")}`);
    }
  }
}

async function main() {
  console.log("=== Thin Pages Audit ===\n");

  const [playerResults, teamResults] = await Promise.all([
    auditPlayers(),
    auditTeams(),
  ]);

  printTierSummary("PLAYERS", playerResults);
  printTierSummary("TEAMS", teamResults);

  // Also count excluded players (Unknown position)
  const [excluded] = await sql`
    SELECT count(*) AS cnt FROM players
    WHERE position IS NULL OR position = 'Unknown'
  `;
  console.log(`\n--- EXCLUDED (Unknown position, get 404) ---`);
  console.log(`  ${excluded.cnt} players`);

  // Summary
  const playerIndexed = playerResults.filter((r) => r.tier === "A" || r.tier === "B").length;
  const teamIndexed = teamResults.filter((r) => r.tier === "A" || r.tier === "B").length;
  console.log(`\n=== SUMMARY ===`);
  console.log(`Players: ${playerIndexed} indexed / ${playerResults.length - playerIndexed} noindex / ${excluded.cnt} excluded (404)`);
  console.log(`Teams: ${teamIndexed} indexed / ${teamResults.length - teamIndexed} noindex`);

  if (WRITE_JSON) {
    const outputDir = "scripts/seo/output";
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

    writeFileSync(
      `${outputDir}/audit-results.json`,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          players: {
            total: playerResults.length,
            tierA: playerResults.filter((r) => r.tier === "A").length,
            tierB: playerResults.filter((r) => r.tier === "B").length,
            tierC: playerResults.filter((r) => r.tier === "C").length,
            tierD: playerResults.filter((r) => r.tier === "D").length,
          },
          teams: {
            total: teamResults.length,
            tierA: teamResults.filter((r) => r.tier === "A").length,
            tierB: teamResults.filter((r) => r.tier === "B").length,
            tierC: teamResults.filter((r) => r.tier === "C").length,
            tierD: teamResults.filter((r) => r.tier === "D").length,
          },
          playerDetails: playerResults,
          teamDetails: teamResults,
        },
        null,
        2
      )
    );
    console.log(`\nJSON written to ${outputDir}/audit-results.json`);
  }

  console.log("\n=== Audit Complete ===");
}

main().catch(console.error);
