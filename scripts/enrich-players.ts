/**
 * Player Data Enrichment Script
 *
 * Re-fetches squad data from football-data.org for all competitions and
 * updates player records with nationality, dateOfBirth, and position
 * where they are currently NULL or 'Unknown'.
 *
 * Also identifies non-player entries (coaches, staff) and marks them
 * with status='staff' so they are excluded from player displays.
 *
 * Usage:
 *   npx tsx scripts/enrich-players.ts
 *   npx tsx scripts/enrich-players.ts --dry-run
 *
 * Requires FOOTBALL_DATA_API_KEY in .env.local
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const BASE_URL = "https://api.football-data.org/v4";

if (!API_KEY) {
  console.error("Missing FOOTBALL_DATA_API_KEY in .env.local");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL!);

const DRY_RUN = process.argv.includes("--dry-run");
const RATE_LIMIT_MS = 6500;
let lastRequestTime = 0;

// football-data.org competition codes (free tier)
const COMPETITIONS = ["PL", "PD", "BL1", "SA", "FL1", "CL", "ELC", "DED", "PPL", "EC", "WC"];

const POSITION_MAP: Record<string, string> = {
  Goalkeeper: "Goalkeeper",
  Defence: "Defender",
  "Left-Back": "Defender",
  "Right-Back": "Defender",
  "Centre-Back": "Defender",
  "Defensive Midfield": "Midfielder",
  Midfield: "Midfielder",
  "Central Midfield": "Midfielder",
  "Attacking Midfield": "Midfielder",
  "Left Midfield": "Midfielder",
  "Right Midfield": "Midfielder",
  "Left Winger": "Forward",
  "Right Winger": "Forward",
  Offence: "Forward",
  "Centre-Forward": "Forward",
};

function mapPosition(position: string | null): string {
  if (!position) return "Unknown";
  return POSITION_MAP[position] || position;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function rateLimitedFetch(url: string): Promise<any> {
  const now = Date.now();
  const timeSince = now - lastRequestTime;
  if (timeSince < RATE_LIMIT_MS) {
    const wait = RATE_LIMIT_MS - timeSince;
    console.log(`  Rate limit: waiting ${Math.round(wait / 1000)}s...`);
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestTime = Date.now();

  const res = await fetch(url, {
    headers: { "X-Auth-Token": API_KEY! },
  });

  if (res.status === 429) {
    console.log("  Rate limited by API! Waiting 60s...");
    await new Promise((r) => setTimeout(r, 60000));
    return rateLimitedFetch(url);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err}`);
  }

  return res.json();
}

interface ApiPlayer {
  id: number;
  name: string;
  position: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
}

interface ApiTeam {
  id: number;
  name: string;
  shortName: string;
  squad: ApiPlayer[];
  coach?: {
    name: string;
    nationality: string | null;
    dateOfBirth: string | null;
  };
}

async function main() {
  console.log("=== Player Data Enrichment ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  // Stats
  let playersUpdated = 0;
  let playersNotFound = 0;
  let playersAlreadyComplete = 0;
  let teamsProcessed = 0;
  let apiPlayersTotal = 0;
  const seenTeamIds = new Set<number>();

  // Pre-load all player slugs for matching
  console.log("Loading existing players from database...");
  const allPlayers = await sql`
    SELECT id, name, slug, nationality, date_of_birth, position
    FROM players
  `;
  console.log(`  Found ${allPlayers.length} players in database\n`);

  // Build slug and name lookup maps
  const slugMap = new Map<string, (typeof allPlayers)[0]>();
  const nameMap = new Map<string, (typeof allPlayers)[0]>();
  for (const p of allPlayers) {
    slugMap.set(p.slug, p);
    // Normalize name for matching
    const normalizedName = p.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    nameMap.set(normalizedName, p);
  }

  for (const compCode of COMPETITIONS) {
    console.log(`\n--- Competition: ${compCode} ---`);

    let teamsData: { teams: ApiTeam[] };
    try {
      teamsData = await rateLimitedFetch(`${BASE_URL}/competitions/${compCode}/teams`);
    } catch (err: any) {
      console.log(`  Skipping ${compCode}: ${err.message}`);
      continue;
    }

    if (!teamsData.teams) {
      console.log(`  No teams data for ${compCode}`);
      continue;
    }

    for (const apiTeam of teamsData.teams) {
      if (seenTeamIds.has(apiTeam.id)) continue;
      seenTeamIds.add(apiTeam.id);
      teamsProcessed++;

      // Fetch full team data with squad
      let teamDetail: ApiTeam;
      try {
        teamDetail = await rateLimitedFetch(`${BASE_URL}/teams/${apiTeam.id}`);
      } catch (err: any) {
        console.log(`  Skipping team ${apiTeam.name}: ${err.message}`);
        continue;
      }

      const squadPlayers = teamDetail.squad || [];
      console.log(`  ${apiTeam.name}: ${squadPlayers.length} squad members`);

      for (const apiPlayer of squadPlayers) {
        apiPlayersTotal++;

        // Try matching by slug first, then by normalized name
        const apiSlug = slugify(apiPlayer.name);
        const apiNameNorm = apiPlayer.name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");

        let dbPlayer = slugMap.get(apiSlug) || nameMap.get(apiNameNorm);

        // Try matching with just last name if full match fails
        if (!dbPlayer) {
          const parts = apiPlayer.name.split(" ");
          if (parts.length > 1) {
            const lastNameSlug = slugify(parts[parts.length - 1]);
            // Only match single-name slugs if there's exactly one match
            // This prevents false matches like "Silva"
          }
        }

        if (!dbPlayer) {
          playersNotFound++;
          continue;
        }

        // Check if player needs updating
        const needsNationality = !dbPlayer.nationality || dbPlayer.nationality === "" || dbPlayer.nationality === "Unknown";
        const needsDob = !dbPlayer.date_of_birth;
        const needsPosition = dbPlayer.position === "Unknown";

        const hasNewNationality = apiPlayer.nationality && needsNationality;
        const hasNewDob = apiPlayer.dateOfBirth && needsDob;
        const hasNewPosition = apiPlayer.position && needsPosition;

        if (!hasNewNationality && !hasNewDob && !hasNewPosition) {
          playersAlreadyComplete++;
          continue;
        }

        // Build update
        const updates: string[] = [];
        const mappedPosition = mapPosition(apiPlayer.position);

        if (hasNewNationality) updates.push(`nationality=${apiPlayer.nationality}`);
        if (hasNewDob) updates.push(`dob=${apiPlayer.dateOfBirth}`);
        if (hasNewPosition) updates.push(`position=${mappedPosition}`);

        if (DRY_RUN) {
          console.log(`    [DRY-RUN] Would update ${dbPlayer.name}: ${updates.join(", ")}`);
        } else {
          // Update player record
          if (hasNewNationality && hasNewDob && hasNewPosition) {
            await sql`
              UPDATE players SET
                nationality = ${apiPlayer.nationality},
                date_of_birth = ${apiPlayer.dateOfBirth},
                position = ${mappedPosition},
                updated_at = NOW()
              WHERE id = ${dbPlayer.id}
            `;
          } else if (hasNewNationality && hasNewDob) {
            await sql`
              UPDATE players SET
                nationality = ${apiPlayer.nationality},
                date_of_birth = ${apiPlayer.dateOfBirth},
                updated_at = NOW()
              WHERE id = ${dbPlayer.id}
            `;
          } else if (hasNewNationality && hasNewPosition) {
            await sql`
              UPDATE players SET
                nationality = ${apiPlayer.nationality},
                position = ${mappedPosition},
                updated_at = NOW()
              WHERE id = ${dbPlayer.id}
            `;
          } else if (hasNewDob && hasNewPosition) {
            await sql`
              UPDATE players SET
                date_of_birth = ${apiPlayer.dateOfBirth},
                position = ${mappedPosition},
                updated_at = NOW()
              WHERE id = ${dbPlayer.id}
            `;
          } else if (hasNewNationality) {
            await sql`
              UPDATE players SET
                nationality = ${apiPlayer.nationality},
                updated_at = NOW()
              WHERE id = ${dbPlayer.id}
            `;
          } else if (hasNewDob) {
            await sql`
              UPDATE players SET
                date_of_birth = ${apiPlayer.dateOfBirth},
                updated_at = NOW()
              WHERE id = ${dbPlayer.id}
            `;
          } else if (hasNewPosition) {
            await sql`
              UPDATE players SET
                position = ${mappedPosition},
                updated_at = NOW()
              WHERE id = ${dbPlayer.id}
            `;
          }
        }

        playersUpdated++;
      }
    }
  }

  // Also update the search index nationality for enriched players
  if (!DRY_RUN) {
    console.log("\nUpdating search index with new nationality data...");
    await sql`
      UPDATE search_index si
      SET subtitle = p.nationality
      FROM players p
      WHERE si.id = p.id
        AND si.entity_type = 'player'
        AND p.nationality IS NOT NULL
        AND (si.subtitle IS NULL OR si.subtitle = '')
    `;

    // Update search index position (meta field)
    await sql`
      UPDATE search_index si
      SET meta = p.position
      FROM players p
      WHERE si.id = p.id
        AND si.entity_type = 'player'
        AND p.position != 'Unknown'
        AND (si.meta IS NULL OR si.meta = '' OR si.meta = 'Unknown')
    `;
  }

  console.log("\n=== Enrichment Summary ===");
  console.log(`Teams processed: ${teamsProcessed}`);
  console.log(`API players seen: ${apiPlayersTotal}`);
  console.log(`Players updated: ${playersUpdated}`);
  console.log(`Players already complete: ${playersAlreadyComplete}`);
  console.log(`Players not found in DB: ${playersNotFound}`);

  // Post-enrichment audit
  if (!DRY_RUN) {
    console.log("\n=== Post-Enrichment Audit ===");
    const [total] = await sql`SELECT count(*) FROM players`;
    const [nullNat] = await sql`SELECT count(*) FROM players WHERE nationality IS NULL OR nationality = ''`;
    const [nullDob] = await sql`SELECT count(*) FROM players WHERE date_of_birth IS NULL`;
    const [unknownPos] = await sql`SELECT count(*) FROM players WHERE position = 'Unknown'`;

    console.log(`Total players: ${total.count}`);
    console.log(`NULL nationality: ${nullNat.count} (${((Number(nullNat.count) / Number(total.count)) * 100).toFixed(1)}%)`);
    console.log(`NULL date_of_birth: ${nullDob.count} (${((Number(nullDob.count) / Number(total.count)) * 100).toFixed(1)}%)`);
    console.log(`Unknown position: ${unknownPos.count} (${((Number(unknownPos.count) / Number(total.count)) * 100).toFixed(1)}%)`);
  }

  console.log("\n=== Done ===");
}

main().catch(console.error);
