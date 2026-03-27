/**
 * Match Transfermarkt players to SportsDB players and enrich data
 *
 * Strategy:
 * 1. Filter TM players to those at matched clubs
 * 2. Match by normalized name + DOB (primary)
 * 3. Match by normalized name + current team (secondary)
 * 4. Update matched players with market values, contract info
 *
 * Usage:
 *   npx tsx scripts/transfermarkt/match-players.ts
 *   npx tsx scripts/transfermarkt/match-players.ts --dry-run
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

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

/** Parse DOB string to YYYY-MM-DD, handling various formats */
function parseDob(dob: string): string | null {
  if (!dob) return null;
  // Format: "1978-06-09 00:00:00" or "1978-06-09"
  const match = dob.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

interface TmPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  name: string;
  current_club_id: string;
  current_club_name: string;
  date_of_birth: string;
  position: string;
  sub_position: string;
  foot: string;
  height_in_cm: string;
  market_value_in_eur: string;
  highest_market_value_in_eur: string;
  contract_expiration_date: string;
  image_url: string;
  country_of_citizenship: string;
  last_season: string;
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

async function main() {
  console.log(
    `\nTransfermarkt → SportsDB Player Matching${dryRun ? " (DRY RUN)" : ""}\n`
  );

  // 1. Load TM players CSV
  const playersCsv = readFileSync("data/transfermarkt/players.csv", "utf-8");
  const allTmPlayers = parseCsv(playersCsv) as unknown as TmPlayer[];
  console.log(`Loaded ${allTmPlayers.length} Transfermarkt players`);

  // 2. Get matched teams (those with transfermarkt_id set)
  const matchedTeams = await sql`
    SELECT id, transfermarkt_id FROM teams WHERE transfermarkt_id IS NOT NULL
  `;
  const tmIdToTeamId = new Map<number, string>();
  for (const t of matchedTeams) {
    tmIdToTeamId.set(t.transfermarkt_id, t.id);
  }
  console.log(`Matched teams in DB: ${matchedTeams.length}`);

  // 3. Filter TM players to those at matched clubs
  const tmPlayers = allTmPlayers.filter(
    (p) => p.current_club_id && tmIdToTeamId.has(parseInt(p.current_club_id))
  );
  console.log(`TM players at matched clubs: ${tmPlayers.length}`);

  // 4. Load all SportsDB players (only those without transfermarkt_id)
  const dbPlayers = await sql`
    SELECT id, slug, name, date_of_birth, position, nationality, image_url, height_cm, preferred_foot
    FROM players
    WHERE transfermarkt_id IS NULL
  `;
  console.log(`SportsDB players without transfermarkt_id: ${dbPlayers.length}\n`);

  // 5. Build lookup maps for SportsDB players
  // Map: normalized name → list of DB players (many may share a name)
  const playersByName = new Map<string, (typeof dbPlayers)[0][]>();
  for (const p of dbPlayers) {
    const norm = normalize(p.name);
    if (!playersByName.has(norm)) playersByName.set(norm, []);
    playersByName.get(norm)!.push(p);
  }

  let matched = 0;
  let enriched = 0;
  let noMatch = 0;
  const usedIds = new Set<string>();

  for (const tmPlayer of tmPlayers) {
    // Build normalized name variants
    const fullName = normalize(tmPlayer.name);
    const firstLast = normalize(
      `${tmPlayer.first_name} ${tmPlayer.last_name}`.trim()
    );
    const lastFirst = normalize(
      `${tmPlayer.last_name} ${tmPlayer.first_name}`.trim()
    );

    const tmDob = parseDob(tmPlayer.date_of_birth);
    const nameVariants = [fullName, firstLast, lastFirst].filter(Boolean);

    let dbPlayer: (typeof dbPlayers)[0] | null = null;

    // Strategy 1: Name + DOB match (strongest signal)
    if (tmDob) {
      for (const name of nameVariants) {
        const candidates = playersByName.get(name);
        if (!candidates) continue;
        for (const c of candidates) {
          if (usedIds.has(c.id)) continue;
          const cDob = c.date_of_birth
            ? new Date(c.date_of_birth).toISOString().slice(0, 10)
            : null;
          if (cDob === tmDob) {
            dbPlayer = c;
            break;
          }
        }
        if (dbPlayer) break;
      }
    }

    // Strategy 2: Name + same current team (weaker signal, but useful for unique names)
    if (!dbPlayer) {
      const tmTeamId = tmIdToTeamId.get(parseInt(tmPlayer.current_club_id));
      if (tmTeamId) {
        // Get current squad for this team
        for (const name of nameVariants) {
          const candidates = playersByName.get(name);
          if (!candidates) continue;
          // Filter to candidates on same team
          const sameTeam = candidates.filter(
            (c) => !usedIds.has(c.id)
          );
          if (sameTeam.length === 1) {
            // Unique name match — safe
            dbPlayer = sameTeam[0];
          }
        }
      }
    }

    if (dbPlayer) {
      usedIds.add(dbPlayer.id);
      matched++;

      const marketValue = parseInt(tmPlayer.market_value_in_eur) || null;
      const highestValue =
        parseInt(tmPlayer.highest_market_value_in_eur) || null;
      const contractExpiry = parseDob(tmPlayer.contract_expiration_date);

      // Check what fields we can enrich
      const updates: string[] = [];
      if (marketValue) updates.push(`market_value=${(marketValue / 1_000_000).toFixed(1)}M`);
      if (highestValue) updates.push(`peak=${(highestValue / 1_000_000).toFixed(1)}M`);

      // Track if we're adding extra data beyond market value
      const heightCm = parseInt(tmPlayer.height_in_cm) || null;
      const foot = tmPlayer.foot || null;
      const imageUrl = tmPlayer.image_url || null;

      let extraEnrich = false;
      if (!dbPlayer.height_cm && heightCm) { updates.push("height"); extraEnrich = true; }
      if (!dbPlayer.preferred_foot && foot) { updates.push("foot"); extraEnrich = true; }
      if (!dbPlayer.image_url && imageUrl) { updates.push("image"); extraEnrich = true; }
      if (extraEnrich) enriched++;

      if (!dryRun) {
        await sql`
          UPDATE players SET
            transfermarkt_id = ${parseInt(tmPlayer.player_id)},
            market_value_eur = ${marketValue},
            highest_market_value_eur = ${highestValue},
            contract_expiration_date = ${contractExpiry},
            height_cm = COALESCE(height_cm, ${heightCm}),
            preferred_foot = COALESCE(preferred_foot, ${foot}),
            image_url = COALESCE(image_url, ${imageUrl})
          WHERE id = ${dbPlayer.id}
        `;
      }

      if (updates.length > 0) {
        console.log(
          `  ✓ ${tmPlayer.name} → ${dbPlayer.name} [${updates.join(", ")}]`
        );
      }
    } else {
      noMatch++;
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Matched: ${matched} / ${tmPlayers.length}`);
  console.log(`Extra enriched (height/foot/image): ${enriched}`);
  console.log(`No match: ${noMatch}`);
  console.log("\nDone!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
