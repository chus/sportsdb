/**
 * One-pass external_id stamping for teams and players.
 *
 * Walks every covered league's standings (teams) and scorer charts
 * (players) from football-data.org and runs each entity through the
 * identity resolver — which looks up by external_id, falls back to name
 * matching once, and stamps the provider ID onto the matched row.
 *
 * After this pass, steady-state ingestion resolves entities by ID with
 * zero name matching. Re-run any time; it's idempotent.
 *
 * Usage: npx tsx scripts/stamp-external-ids.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { resolveTeam, resolvePlayer } from "../src/lib/ingestion/resolve";

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
if (!API_KEY) {
  console.error("FOOTBALL_DATA_API_KEY environment variable is required");
  process.exit(1);
}

const LEAGUES = ["PL", "PD", "BL1", "SA", "FL1", "DED", "PPL", "ELC", "CL"];

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const tally = { teams: { external_id: 0, name_match: 0, miss: 0 }, players: { external_id: 0, name_match: 0, miss: 0 } };

  for (const code of LEAGUES) {
    console.log(`\n--- ${code} ---`);

    // Teams via standings
    const sRes = await fetch(
      `https://api.football-data.org/v4/competitions/${code}/standings`,
      { headers: { "X-Auth-Token": API_KEY! } },
    );
    if (sRes.ok) {
      const data = await sRes.json();
      for (const entry of data.standings?.[0]?.table ?? []) {
        const hit = await resolveTeam(sql, entry.team.id, entry.team.name);
        if (!hit) {
          tally.teams.miss++;
          console.log(`  ✗ team miss: ${entry.team.name}`);
        } else {
          tally.teams[hit.via === "external_id" ? "external_id" : "name_match"]++;
        }
      }
    } else {
      console.warn(`  standings api ${sRes.status}`);
    }
    await new Promise((r) => setTimeout(r, 6500));

    // Players via scorers
    const pRes = await fetch(
      `https://api.football-data.org/v4/competitions/${code}/scorers?limit=100`,
      { headers: { "X-Auth-Token": API_KEY! } },
    );
    if (pRes.ok) {
      const data = await pRes.json();
      for (const scorer of data.scorers ?? []) {
        const hit = await resolvePlayer(sql, scorer.player.id, scorer.player.name);
        if (!hit) tally.players.miss++;
        else tally.players[hit.via === "external_id" ? "external_id" : "name_match"]++;
      }
    } else {
      console.warn(`  scorers api ${pRes.status}`);
    }
    await new Promise((r) => setTimeout(r, 6500));
  }

  console.log("\n=== Tally ===");
  console.table(tally);

  const coverage = await sql`
    SELECT
      (SELECT count(*) FROM teams WHERE external_id LIKE 'fd-team-%') AS teams_stamped,
      (SELECT count(*) FROM players WHERE external_id LIKE 'fd-player-%') AS players_stamped
  `;
  console.log("coverage:", coverage[0]);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
