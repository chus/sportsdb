/**
 * Player Data Enrichment via API-Football
 *
 * Enriches player records with nationality, date of birth, height,
 * preferred foot, and image from the API-Football /players endpoint.
 *
 * Usage:
 *   npx tsx scripts/enrich-players-apifootball.ts
 *   npx tsx scripts/enrich-players-apifootball.ts --limit 50
 *   npx tsx scripts/enrich-players-apifootball.ts --dry-run
 *
 * Requires API_FOOTBALL_KEY in .env.local
 * Free tier: 100 requests/day — default --limit is 95
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = "https://v3.football.api-sports.io";

if (!API_KEY) {
  console.error("Missing API_FOOTBALL_KEY in .env.local");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL!);

// CLI flags
const DRY_RUN = process.argv.includes("--dry-run");
const limitArg = process.argv.find((a) => a.startsWith("--limit"));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1] || process.argv[process.argv.indexOf("--limit") + 1]) || 95 : 95;

// Rate limiting
const RATE_LIMIT_MS = 6500; // API-Football: 10 req/min
let lastRequestTime = 0;
let requestCount = 0;

// Priority league slugs (in order)
const PRIORITY_LEAGUES = [
  "premier-league",
  "la-liga",
  "bundesliga",
  "serie-a",
  "ligue-1",
  "liga-profesional-argentina",
];

interface PlayerRow {
  id: string;
  name: string;
  external_id: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  height_cm: number | null;
  preferred_foot: string | null;
  image_url: string | null;
  position: string | null;
  priority: number;
}

async function apiFetch(endpoint: string): Promise<any> {
  const now = Date.now();
  const timeSince = now - lastRequestTime;
  if (timeSince < RATE_LIMIT_MS) {
    const wait = RATE_LIMIT_MS - timeSince;
    await new Promise((r) => setTimeout(r, wait));
  }

  lastRequestTime = Date.now();
  requestCount++;

  const url = `${BASE_URL}${endpoint}`;
  console.log(`  [${requestCount}/${LIMIT}] GET ${endpoint}`);

  const res = await fetch(url, {
    headers: {
      "x-rapidapi-key": API_KEY!,
      "x-rapidapi-host": "v3.football.api-sports.io",
    },
  });

  if (res.status === 429) {
    console.error("  RATE LIMITED — stopping");
    return { response: [] };
  }

  if (!res.ok) {
    const text = await res.text();
    console.error(`  API error ${res.status}: ${text}`);
    return { response: [] };
  }

  const data = await res.json();

  // Check for API-level errors
  if (data.errors && Object.keys(data.errors).length > 0) {
    console.error("  API errors:", JSON.stringify(data.errors));
    return { response: [] };
  }

  return data;
}

function parseHeight(height: string | null): number | null {
  if (!height) return null;
  const match = height.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

const POSITION_MAP: Record<string, string> = {
  Goalkeeper: "Goalkeeper",
  Defender: "Defender",
  Midfielder: "Midfielder",
  Attacker: "Forward",
};

async function main() {
  console.log("=== Player Enrichment via API-Football ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Limit: ${LIMIT} players\n`);

  // Get priority league IDs
  const priorityLeagueIds = await sql`
    SELECT id FROM competitions
    WHERE slug = ANY(${PRIORITY_LEAGUES}::text[])
  `;
  const priorityIds = priorityLeagueIds.map((r: any) => r.id);

  // Fetch players needing enrichment, ordered by priority
  console.log("Fetching players needing enrichment...");
  const players = await sql`
    SELECT
      p.id,
      p.name,
      p.external_id,
      p.nationality,
      p.date_of_birth,
      p.height_cm,
      p.preferred_foot,
      p.image_url,
      p.position,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM player_team_history pth
          JOIN competition_seasons cs ON cs.id = (
            SELECT cs2.id FROM competition_seasons cs2
            JOIN player_season_stats pss ON pss.competition_season_id = cs2.id
            WHERE pss.player_id = p.id
            LIMIT 1
          )
          WHERE pth.player_id = p.id AND pth.valid_to IS NULL
          AND cs.competition_id = ANY(${priorityIds}::uuid[])
        ) THEN 1
        ELSE 2
      END as priority
    FROM players p
    WHERE (p.nationality IS NULL OR p.date_of_birth IS NULL OR p.height_cm IS NULL)
      AND p.enriched_at IS NULL
      AND p.position != 'Unknown'
      AND p.external_id LIKE 'af-%'
    ORDER BY priority ASC, p.popularity_score DESC NULLS LAST
    LIMIT ${LIMIT}
  ` as PlayerRow[];

  console.log(`  Found ${players.length} players to enrich\n`);

  if (players.length === 0) {
    // Try without af- filter
    console.log("No af- players found. Checking all players...");
    const allPlayers = await sql`
      SELECT count(*) as cnt
      FROM players
      WHERE (nationality IS NULL OR date_of_birth IS NULL OR height_cm IS NULL)
        AND enriched_at IS NULL
        AND position != 'Unknown'
    `;
    console.log(`  ${allPlayers[0].cnt} total players need enrichment but lack af- external IDs`);
    console.log("  Run sync-api-football.ts first to assign af- IDs, then re-run this script.");
    return;
  }

  // Stats
  let enriched = 0;
  let noData = 0;
  let errors = 0;
  let skipped = 0;

  for (const player of players) {
    if (requestCount >= LIMIT) {
      console.log(`\nRequest limit (${LIMIT}) reached. Stopping.`);
      break;
    }

    // Extract API-Football numeric ID from "af-123" format
    const afId = player.external_id!.replace("af-", "");

    const data = await apiFetch(`/players?id=${afId}&season=2024`);
    const apiPlayer = data.response?.[0]?.player;

    if (!apiPlayer) {
      console.log(`  ${player.name}: no data found`);
      noData++;
      // Still mark as enriched to avoid retrying
      if (!DRY_RUN) {
        await sql`UPDATE players SET enriched_at = NOW() WHERE id = ${player.id}`;
      }
      continue;
    }

    // Extract fields
    const nationality = apiPlayer.nationality || null;
    const dateOfBirth = apiPlayer.birth?.date || null;
    const heightCm = parseHeight(apiPlayer.height);
    const preferredFoot = null; // Not in /players response directly
    const imageUrl = apiPlayer.photo || null;
    const position = data.response?.[0]?.statistics?.[0]?.games?.position;
    const mappedPosition = position ? (POSITION_MAP[position] || position) : null;

    // Check what's new
    const updates: string[] = [];
    if (nationality && !player.nationality) updates.push(`nationality=${nationality}`);
    if (dateOfBirth && !player.date_of_birth) updates.push(`dob=${dateOfBirth}`);
    if (heightCm && !player.height_cm) updates.push(`height=${heightCm}cm`);
    if (imageUrl && !player.image_url) updates.push(`image=yes`);
    if (mappedPosition && player.position === "Unknown") updates.push(`position=${mappedPosition}`);

    if (updates.length === 0) {
      console.log(`  ${player.name}: already complete`);
      skipped++;
      if (!DRY_RUN) {
        await sql`UPDATE players SET enriched_at = NOW() WHERE id = ${player.id}`;
      }
      continue;
    }

    console.log(`  ${player.name}: ${updates.join(", ")}`);

    if (!DRY_RUN) {
      await sql`
        UPDATE players SET
          nationality = COALESCE(nationality, ${nationality}),
          date_of_birth = COALESCE(date_of_birth, ${dateOfBirth}),
          height_cm = COALESCE(height_cm, ${heightCm}),
          image_url = COALESCE(image_url, ${imageUrl}),
          position = CASE WHEN position = 'Unknown' AND ${mappedPosition} IS NOT NULL THEN ${mappedPosition} ELSE position END,
          enriched_at = NOW(),
          updated_at = NOW()
        WHERE id = ${player.id}
      `;
    }

    enriched++;
  }

  console.log("\n=== Enrichment Summary ===");
  console.log(`  Requests used: ${requestCount}/${LIMIT}`);
  console.log(`  Players enriched: ${enriched}`);
  console.log(`  No API data: ${noData}`);
  console.log(`  Already complete: ${skipped}`);
  console.log(`  Errors: ${errors}`);

  if (!DRY_RUN) {
    // Show remaining work
    const remaining = await sql`
      SELECT count(*) as cnt
      FROM players
      WHERE (nationality IS NULL OR date_of_birth IS NULL OR height_cm IS NULL)
        AND enriched_at IS NULL
        AND position != 'Unknown'
    `;
    console.log(`\n  Remaining players needing enrichment: ${remaining[0].cnt}`);
    console.log("  Run this script again tomorrow to continue.");
  }

  console.log("\n=== Done ===");
}

main().catch(console.error);
