/**
 * Sync player career history from transfers and season stats
 *
 * Creates player_team_history entries based on:
 * 1. Transfers data (explicit team changes)
 * 2. Season stats (teams played for each season)
 *
 * Usage:
 *   npx tsx scripts/transfermarkt/sync-career-history.ts
 *   npx tsx scripts/transfermarkt/sync-career-history.ts --dry-run
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const dryRun = process.argv.includes("--dry-run");

interface TeamSpell {
  playerId: string;
  teamId: string;
  teamName: string;
  validFrom: Date;
  validTo: Date | null;
}

async function main() {
  console.log(`\nSync Career History from Stats${dryRun ? " (DRY RUN)" : ""}\n`);

  // Get all player season stats with dates
  console.log("Loading player season stats...");
  const stats = await sql`
    SELECT DISTINCT
      pss.player_id,
      pss.team_id,
      t.name as team_name,
      s.start_date,
      s.end_date
    FROM player_season_stats pss
    JOIN teams t ON t.id = pss.team_id
    JOIN competition_seasons cs ON cs.id = pss.competition_season_id
    JOIN seasons s ON s.id = cs.season_id
    ORDER BY pss.player_id, s.start_date
  `;
  console.log(`  Found ${stats.length} player-team-season combinations\n`);

  // Group by player and build career spells
  const playerSpells = new Map<string, TeamSpell[]>();

  for (const stat of stats) {
    const playerId = stat.player_id;
    if (!playerSpells.has(playerId)) {
      playerSpells.set(playerId, []);
    }

    const spells = playerSpells.get(playerId)!;
    const lastSpell = spells[spells.length - 1];

    // If same team as last spell, extend it
    if (lastSpell && lastSpell.teamId === stat.team_id) {
      lastSpell.validTo = new Date(stat.end_date);
    } else {
      // Close previous spell if exists
      if (lastSpell && !lastSpell.validTo) {
        lastSpell.validTo = new Date(stat.start_date);
      }
      // Start new spell
      spells.push({
        playerId,
        teamId: stat.team_id,
        teamName: stat.team_name,
        validFrom: new Date(stat.start_date),
        validTo: new Date(stat.end_date),
      });
    }
  }

  console.log(`  Built career spells for ${playerSpells.size} players\n`);

  // Get existing career history to avoid duplicates
  console.log("Loading existing career history...");
  const existing = await sql`
    SELECT player_id, team_id, valid_from FROM player_team_history
  `;
  const existingSet = new Set(
    existing.map((e) => `${e.player_id}-${e.team_id}-${new Date(e.valid_from).getFullYear()}`)
  );
  console.log(`  Found ${existing.length} existing entries\n`);

  // Insert new career entries
  console.log("Inserting career history...");
  let inserted = 0;
  let skipped = 0;

  for (const [playerId, spells] of playerSpells) {
    for (let i = 0; i < spells.length; i++) {
      const spell = spells[i];
      const key = `${spell.playerId}-${spell.teamId}-${spell.validFrom.getFullYear()}`;

      if (existingSet.has(key)) {
        continue;
      }

      // Check if this is the last spell (current team)
      const isLast = i === spells.length - 1;
      const validTo = isLast ? null : spell.validTo;

      if (!dryRun) {
        // Check if entry already exists
        const exists = await sql`
          SELECT 1 FROM player_team_history
          WHERE player_id = ${spell.playerId}
            AND team_id = ${spell.teamId}
            AND valid_from = ${spell.validFrom.toISOString().split("T")[0]}
          LIMIT 1
        `;
        if (exists.length === 0) {
          await sql`
            INSERT INTO player_team_history (player_id, team_id, valid_from, valid_to)
            VALUES (${spell.playerId}, ${spell.teamId}, ${spell.validFrom.toISOString().split("T")[0]}, ${validTo ? validTo.toISOString().split("T")[0] : null})
          `;
          inserted++;
        } else {
          skipped++;
        }
      } else {
        inserted++;
      }
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped (already exists): ${skipped}`);

  if (!dryRun) {
    const [count] = await sql`SELECT count(*) FROM player_team_history`;
    console.log(`\nTotal player_team_history entries: ${count.count}`);
  }

  // Show sample of Nacho's career
  console.log("\n=== Nacho Fernández Career ===");
  const nacho = await sql`
    SELECT t.name, pth.valid_from, pth.valid_to
    FROM player_team_history pth
    JOIN players p ON p.id = pth.player_id
    JOIN teams t ON t.id = pth.team_id
    WHERE p.slug = 'nacho-fernandez'
    ORDER BY pth.valid_from ASC
  `;
  nacho.forEach((c) =>
    console.log(`  ${c.name}: ${c.valid_from} - ${c.valid_to || "present"}`)
  );

  console.log("\nDone!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
