/**
 * Backfill nationality and date_of_birth for already-matched players
 *
 * This script updates players that have transfermarkt_id but are missing
 * nationality or date_of_birth from the Transfermarkt CSV data.
 *
 * Usage:
 *   npx tsx scripts/transfermarkt/backfill-player-data.ts
 *   npx tsx scripts/transfermarkt/backfill-player-data.ts --dry-run
 */

import { readFileSync } from "fs";
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

interface TmPlayer {
  player_id: string;
  name: string;
  country_of_citizenship: string;
  date_of_birth: string;
}

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.split("\n").filter(Boolean);
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = values[i] || ""));
    return row;
  });
}

function parseDob(dob: string): string | null {
  if (!dob) return null;
  const match = dob.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

async function main() {
  console.log(
    `\nBackfill Player Data (Nationality & DOB)${dryRun ? " (DRY RUN)" : ""}\n`
  );

  // Load TM players CSV
  const playersCsv = readFileSync("data/transfermarkt/players.csv", "utf-8");
  const allTmPlayers = parseCsv(playersCsv) as unknown as TmPlayer[];
  console.log(`Loaded ${allTmPlayers.length} Transfermarkt players`);

  // Build lookup by TM player_id
  const tmPlayerById = new Map<number, TmPlayer>();
  for (const p of allTmPlayers) {
    tmPlayerById.set(parseInt(p.player_id), p);
  }

  // Get all matched players missing nationality or DOB
  const playersToUpdate = await sql`
    SELECT id, transfermarkt_id, name, nationality, date_of_birth
    FROM players
    WHERE transfermarkt_id IS NOT NULL
      AND (nationality IS NULL OR date_of_birth IS NULL)
  `;
  console.log(`Players needing update: ${playersToUpdate.length}\n`);

  let updated = 0;
  let skipped = 0;

  for (const dbPlayer of playersToUpdate) {
    const tmPlayer = tmPlayerById.get(dbPlayer.transfermarkt_id);
    if (!tmPlayer) {
      skipped++;
      continue;
    }

    const nationality = tmPlayer.country_of_citizenship || null;
    const dateOfBirth = parseDob(tmPlayer.date_of_birth);

    // Only update if we have new data
    const needsNationality = !dbPlayer.nationality && nationality;
    const needsDob = !dbPlayer.date_of_birth && dateOfBirth;

    if (!needsNationality && !needsDob) {
      skipped++;
      continue;
    }

    const updates: string[] = [];
    if (needsNationality) updates.push(`nationality=${nationality}`);
    if (needsDob) updates.push(`dob=${dateOfBirth}`);

    if (!dryRun) {
      await sql`
        UPDATE players SET
          nationality = COALESCE(nationality, ${nationality}),
          date_of_birth = COALESCE(date_of_birth, ${dateOfBirth}),
          updated_at = NOW()
        WHERE id = ${dbPlayer.id}
      `;
    }

    updated++;
    if (updated <= 20 || updated % 500 === 0) {
      console.log(`  ✓ ${dbPlayer.name}: ${updates.join(", ")}`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log("\nDone!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
