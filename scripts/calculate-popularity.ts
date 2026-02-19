/**
 * Calculate player popularity scores based on multiple factors:
 * - Team tier (playing for top club)
 * - Career appearances
 * - Goals and assists
 * - Position (attackers get attention bonus)
 * - Wikipedia page views (if available)
 *
 * Usage:
 *   npx tsx scripts/calculate-popularity.ts
 *   npx tsx scripts/calculate-popularity.ts --dry-run
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// Top tier clubs (tier 1) - most popular clubs globally
const TIER_1_CLUBS = [
  "real-madrid", "barcelona", "manchester-united", "manchester-city",
  "liverpool", "chelsea", "arsenal", "bayern-munich", "paris-saint-germain",
  "juventus", "ac-milan", "inter-milan", "atletico-madrid", "borussia-dortmund",
  "tottenham-hotspur", "manchester-city-fc", "fc-barcelona", "real-madrid-cf",
  "fc-bayern-munchen", "fc-bayern-münchen"
];

// Mid tier clubs (tier 2)
const TIER_2_CLUBS = [
  "napoli", "roma", "lazio", "sevilla", "villarreal", "real-betis",
  "athletic-bilbao", "rb-leipzig", "bayer-leverkusen", "monaco",
  "olympique-marseille", "lyon", "newcastle-united", "west-ham",
  "aston-villa", "everton", "leicester-city", "ajax", "psv-eindhoven",
  "benfica", "porto", "sporting-cp", "galatasaray", "fenerbahce"
];

async function setTeamTiers(dryRun: boolean) {
  console.log("\n=== Setting Team Tiers ===");

  // Set tier 1
  for (const slug of TIER_1_CLUBS) {
    if (dryRun) {
      console.log(`[DRY-RUN] Would set ${slug} to tier 1`);
    } else {
      await sql`UPDATE teams SET tier = 1 WHERE slug ILIKE ${slug} OR slug ILIKE ${slug + '-fc'} OR slug ILIKE ${'fc-' + slug}`;
    }
  }

  // Set tier 2
  for (const slug of TIER_2_CLUBS) {
    if (dryRun) {
      console.log(`[DRY-RUN] Would set ${slug} to tier 2`);
    } else {
      await sql`UPDATE teams SET tier = 2 WHERE slug ILIKE ${slug} OR slug ILIKE ${slug + '-fc'} OR slug ILIKE ${'fc-' + slug}`;
    }
  }

  // Check results
  const tierCounts = await sql`
    SELECT tier, COUNT(*) as count FROM teams GROUP BY tier ORDER BY tier
  `;
  console.log("Team tier distribution:", tierCounts);
}

async function calculatePlayerScores(dryRun: boolean) {
  console.log("\n=== Calculating Player Popularity Scores ===");

  // Get all players with their stats and current team
  const players = await sql`
    SELECT
      p.id,
      p.name,
      p.slug,
      p.position,
      p.image_url,
      COALESCE(SUM(pss.appearances), 0) as total_appearances,
      COALESCE(SUM(pss.goals), 0) as total_goals,
      COALESCE(SUM(pss.assists), 0) as total_assists,
      t.tier as team_tier,
      t.name as team_name
    FROM players p
    LEFT JOIN player_season_stats pss ON pss.player_id = p.id
    LEFT JOIN player_team_history pth ON pth.player_id = p.id AND pth.valid_to IS NULL
    LEFT JOIN teams t ON t.id = pth.team_id
    GROUP BY p.id, p.name, p.slug, p.position, p.image_url, t.tier, t.name
  `;

  console.log(`Processing ${players.length} players...`);

  let updated = 0;
  for (const player of players) {
    let score = 0;

    // Base score from appearances (1 point per 10 appearances, max 100)
    const appearances = Number(player.total_appearances) || 0;
    score += Math.min(Math.floor(appearances / 10), 100);

    // Goals bonus (2 points per goal, max 200)
    const goals = Number(player.total_goals) || 0;
    score += Math.min(goals * 2, 200);

    // Assists bonus (1 point per assist, max 100)
    const assists = Number(player.total_assists) || 0;
    score += Math.min(assists, 100);

    // Team tier bonus
    const tier = Number(player.team_tier) || 3;
    if (tier === 1) score += 150; // Top club bonus
    else if (tier === 2) score += 75; // Mid tier bonus

    // Position bonus (attackers get more attention)
    const position = (player.position || "").toLowerCase();
    if (position.includes("forward") || position.includes("striker") || position.includes("winger")) {
      score += 50;
    } else if (position.includes("midfield") || position.includes("attacking")) {
      score += 25;
    }

    // Has image bonus (indicates notable player with Wikipedia presence)
    if (player.image_url) {
      score += 30;
    }

    if (dryRun) {
      if (score > 200) {
        console.log(`[DRY-RUN] ${player.name} (${player.team_name || 'No team'}): ${score} points`);
      }
    } else {
      await sql`UPDATE players SET popularity_score = ${score} WHERE id = ${player.id}`;
      updated++;
    }
  }

  if (!dryRun) {
    console.log(`Updated ${updated} players`);

    // Show top players
    const topPlayers = await sql`
      SELECT name, popularity_score, position FROM players
      ORDER BY popularity_score DESC
      LIMIT 20
    `;
    console.log("\nTop 20 Players by Popularity:");
    topPlayers.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.name} - ${p.popularity_score} points (${p.position})`);
    });
  }
}

async function updateSearchIndex(dryRun: boolean) {
  if (dryRun) {
    console.log("\n[DRY-RUN] Would update search index with popularity scores");
    return;
  }

  console.log("\n=== Updating Search Index ===");

  // Add popularity to search index meta
  await sql`
    UPDATE search_index si
    SET meta = CONCAT(
      COALESCE(si.meta, ''),
      ' | Score: ',
      (SELECT popularity_score FROM players p WHERE p.id = si.id)
    )
    WHERE si.entity_type = 'player'
  `;

  console.log("Search index updated with popularity scores");
}

// Parse args
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

console.log("=== Player Popularity Calculator ===");
console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);

async function main() {
  await setTeamTiers(dryRun);
  await calculatePlayerScores(dryRun);
  // Skip search index update for now - can be done separately
  console.log("\nDone!");
}

main().then(() => process.exit(0)).catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
