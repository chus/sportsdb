/**
 * Fix Unknown player positions by fetching squad data from football-data.org
 *
 * Usage:
 *   FOOTBALL_DATA_API_KEY=xxx DATABASE_URL=xxx npx tsx scripts/fix-positions.ts
 */

import { neon } from "@neondatabase/serverless";
import { createRateLimitedFetch, mapPosition } from "./lib/football-data";

const DATABASE_URL = process.env.DATABASE_URL;
const API_KEY = process.env.FOOTBALL_DATA_API_KEY;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
if (!API_KEY) {
  console.error("FOOTBALL_DATA_API_KEY is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const apiFetch = createRateLimitedFetch(API_KEY);

async function main() {
  // 1. Find teams with Unknown-position players
  const teams = await sql`
    SELECT DISTINCT t.external_id, t.name
    FROM players p
    INNER JOIN player_team_history pth ON pth.player_id = p.id AND pth.valid_to IS NULL
    INNER JOIN teams t ON pth.team_id = t.id
    WHERE p.position = 'Unknown'
      AND t.external_id LIKE 'fd-%'
    ORDER BY t.name
  `;

  console.log(`Found ${teams.length} teams with Unknown-position players\n`);

  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const team of teams) {
    const fdId = team.external_id.replace("fd-", "");
    console.log(`Fetching squad: ${team.name} (${team.external_id})...`);

    try {
      const data = await apiFetch(
        `https://api.football-data.org/v4/teams/${fdId}`
      );

      if (!data.squad || !Array.isArray(data.squad)) {
        console.log(`  No squad data returned`);
        continue;
      }

      let updated = 0;
      for (const apiPlayer of data.squad) {
        if (!apiPlayer.position) continue;

        const mapped = mapPosition(apiPlayer.position);
        if (mapped === "Unknown") continue;

        const extId = `fd-${apiPlayer.id}`;
        const result = await sql`
          UPDATE players
          SET position = ${mapped}, updated_at = NOW()
          WHERE external_id = ${extId}
            AND position = 'Unknown'
          RETURNING id, name
        `;

        if (result.length > 0) {
          updated++;
        }
      }

      console.log(`  Updated ${updated} positions`);
      totalUpdated += updated;
    } catch (err: any) {
      console.error(`  Error: ${err.message}`);
      totalSkipped++;
    }
  }

  console.log(`\n=========================`);
  console.log(`Total positions updated: ${totalUpdated}`);
  console.log(`Teams skipped (errors): ${totalSkipped}`);
  console.log(`Done!`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
