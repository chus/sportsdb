/**
 * Update team logos from football-data.org API
 * Fetches team crests for teams in major leagues
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const BASE_URL = "https://api.football-data.org/v4";

if (!API_KEY) {
  console.error("❌ Missing FOOTBALL_DATA_API_KEY");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL!);

const RATE_LIMIT_MS = 6500;
let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<any> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    const waitTime = RATE_LIMIT_MS - timeSinceLastRequest;
    console.log(`   ⏳ Rate limiting: waiting ${Math.round(waitTime / 1000)}s...`);
    await new Promise((r) => setTimeout(r, waitTime));
  }
  lastRequestTime = Date.now();
  const res = await fetch(url, { headers: { "X-Auth-Token": API_KEY! } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

const COMP_CODES = ["PL", "PD", "BL1", "SA", "FL1", "CL", "ELC", "DED", "PPL"];

async function main() {
  console.log("🖼️  Updating team logos from football-data.org\n");

  // Get teams without logos
  const teamsWithoutLogos = await sql`
    SELECT id, name, slug FROM teams WHERE logo_url IS NULL
  `;
  console.log(`Teams without logos: ${teamsWithoutLogos.length}\n`);

  // Build lookup by normalized name
  const teamsByName = new Map<string, { id: string; name: string }>();
  for (const t of teamsWithoutLogos) {
    teamsByName.set(normalize(t.name), { id: t.id, name: t.name });
  }

  let updated = 0;

  for (const compCode of COMP_CODES) {
    console.log(`📋 Fetching ${compCode}...`);
    try {
      const data = await rateLimitedFetch(`${BASE_URL}/competitions/${compCode}/teams`);
      const teams = data.teams || [];

      for (const apiTeam of teams) {
        if (!apiTeam.crest) continue;

        const normalized = normalize(apiTeam.name);
        const dbTeam = teamsByName.get(normalized);

        if (dbTeam) {
          await sql`
            UPDATE teams SET logo_url = ${apiTeam.crest}
            WHERE id = ${dbTeam.id} AND logo_url IS NULL
          `;
          console.log(`  ✓ ${dbTeam.name}`);
          teamsByName.delete(normalized);
          updated++;
        }
      }
    } catch (error: any) {
      console.log(`  ⚠️ Error: ${error.message}`);
    }
  }

  console.log(`\n🎉 Updated ${updated} team logos`);
}

main().catch(console.error);
