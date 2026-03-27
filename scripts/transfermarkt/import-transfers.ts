/**
 * Import transfer records from Transfermarkt for matched players
 *
 * Only imports transfers where:
 * - Player has been matched (has transfermarkt_id in our DB)
 * - At least one team (from/to) has been matched
 *
 * Usage:
 *   npx tsx scripts/transfermarkt/import-transfers.ts
 *   npx tsx scripts/transfermarkt/import-transfers.ts --dry-run
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

interface TmTransfer {
  player_id: string;
  transfer_date: string;
  transfer_season: string;
  from_club_id: string;
  to_club_id: string;
  from_club_name: string;
  to_club_name: string;
  transfer_fee: string;
  market_value_in_eur: string;
  player_name: string;
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
    `\nTransfermarkt Transfer Import${dryRun ? " (DRY RUN)" : ""}\n`
  );

  // 1. Load transfers CSV
  const transfersCsv = readFileSync(
    "data/transfermarkt/transfers.csv",
    "utf-8"
  );
  const allTransfers = parseCsv(transfersCsv) as unknown as TmTransfer[];
  console.log(`Loaded ${allTransfers.length} Transfermarkt transfers`);

  // 2. Build lookup: TM player_id → SportsDB player.id
  const matchedPlayers = await sql`
    SELECT id, transfermarkt_id FROM players WHERE transfermarkt_id IS NOT NULL
  `;
  const tmPlayerToDbId = new Map<number, string>();
  for (const p of matchedPlayers) {
    tmPlayerToDbId.set(p.transfermarkt_id, p.id);
  }
  console.log(`Matched players in DB: ${matchedPlayers.length}`);

  // 3. Build lookup: TM club_id → SportsDB team.id
  const matchedTeams = await sql`
    SELECT id, transfermarkt_id FROM teams WHERE transfermarkt_id IS NOT NULL
  `;
  const tmClubToDbId = new Map<number, string>();
  for (const t of matchedTeams) {
    tmClubToDbId.set(t.transfermarkt_id, t.id);
  }
  console.log(`Matched teams in DB: ${matchedTeams.length}`);

  // 4. Filter to transfers of matched players
  const eligible = allTransfers.filter((t) =>
    tmPlayerToDbId.has(parseInt(t.player_id))
  );
  console.log(`Transfers for matched players: ${eligible.length}\n`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE);
    const batchValues = [];

    for (const t of batch) {
      const playerId = tmPlayerToDbId.get(parseInt(t.player_id));
      if (!playerId) {
        skipped++;
        continue;
      }

      const fromTeamId =
        tmClubToDbId.get(parseInt(t.from_club_id)) || null;
      const toTeamId = tmClubToDbId.get(parseInt(t.to_club_id)) || null;

      // Must have at least a to_team resolved
      if (!toTeamId) {
        skipped++;
        continue;
      }

      const transferDate = t.transfer_date;
      if (!transferDate || !/^\d{4}-\d{2}-\d{2}$/.test(transferDate)) {
        skipped++;
        continue;
      }

      const feeRaw = parseFloat(t.transfer_fee);
      const feeEur = !isNaN(feeRaw) ? Math.round(feeRaw) : null;
      const marketValue = parseInt(t.market_value_in_eur) || null;
      const season = t.transfer_season || null;

      // Create a composite dedup key
      const tmId = `${t.player_id}-${t.from_club_id}-${t.to_club_id}-${transferDate}`;

      batchValues.push({
        playerId,
        fromTeamId,
        toTeamId,
        transferDate,
        feeEur,
        marketValue,
        season,
        tmId,
      });
    }

    if (batchValues.length > 0 && !dryRun) {
      for (const v of batchValues) {
        try {
          await sql`
            INSERT INTO transfers (player_id, from_team_id, to_team_id, transfer_date, transfer_fee_eur, market_value_at_transfer, season, transfermarkt_id)
            VALUES (${v.playerId}, ${v.fromTeamId}, ${v.toTeamId}, ${v.transferDate}, ${v.feeEur}, ${v.marketValue}, ${v.season}, ${v.tmId})
            ON CONFLICT (transfermarkt_id) DO NOTHING
          `;
          inserted++;
        } catch (e: any) {
          errors++;
          if (errors <= 5) console.log(`  Error: ${e.message?.slice(0, 80)}`);
        }
      }
    } else {
      inserted += batchValues.length;
    }

    if ((i + BATCH_SIZE) % 5000 < BATCH_SIZE) {
      console.log(
        `  Progress: ${Math.min(i + BATCH_SIZE, eligible.length)} / ${eligible.length} (inserted: ${inserted})`
      );
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log("\nDone!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
