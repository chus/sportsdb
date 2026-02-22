/**
 * Fetch historical transfer data for players
 *
 * This script populates player_team_history with historical transfers.
 * Uses TransferMarkt data via web scraping (respectful rate limiting).
 *
 * Usage:
 *   npx tsx scripts/fetch-transfers.ts
 *   npx tsx scripts/fetch-transfers.ts --player="lionel-messi"
 *   npx tsx scripts/fetch-transfers.ts --top=50
 *   npx tsx scripts/fetch-transfers.ts --dry-run
 */

import { neon } from "@neondatabase/serverless";
import { load } from "cheerio";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// Parse command line arguments
const args = process.argv.slice(2);
const playerSlugArg = args.find((a) => a.startsWith("--player="));
const specificPlayerSlug = playerSlugArg?.split("=")[1];
const topArg = args.find((a) => a.startsWith("--top="));
const topN = topArg ? parseInt(topArg.split("=")[1], 10) : 20;
const dryRun = args.includes("--dry-run");

// Known player mappings to Transfermarkt IDs (top players)
const PLAYER_TRANSFERMARKT_IDS: Record<string, { id: string; name: string }> = {
  "lionel-messi": { id: "28003", name: "Lionel Messi" },
  "cristiano-ronaldo": { id: "8198", name: "Cristiano Ronaldo" },
  "kylian-mbappe": { id: "342229", name: "Kylian Mbappé" },
  "erling-haaland": { id: "418560", name: "Erling Haaland" },
  "neymar": { id: "68290", name: "Neymar" },
  "kevin-de-bruyne": { id: "88755", name: "Kevin De Bruyne" },
  "mohamed-salah": { id: "148455", name: "Mohamed Salah" },
  "robert-lewandowski": { id: "38253", name: "Robert Lewandowski" },
  "karim-benzema": { id: "18922", name: "Karim Benzema" },
  "luka-modric": { id: "27706", name: "Luka Modrić" },
  "toni-kroos": { id: "31909", name: "Toni Kroos" },
  "virgil-van-dijk": { id: "139208", name: "Virgil van Dijk" },
  "sadio-mane": { id: "200512", name: "Sadio Mané" },
  "harry-kane": { id: "132098", name: "Harry Kane" },
  "marcus-rashford": { id: "258923", name: "Marcus Rashford" },
  "bukayo-saka": { id: "433177", name: "Bukayo Saka" },
  "jude-bellingham": { id: "581678", name: "Jude Bellingham" },
  "vinicius-junior": { id: "371998", name: "Vinícius Júnior" },
  "pedri": { id: "503429", name: "Pedri" },
  "gavi": { id: "664534", name: "Gavi" },
};

// Hardcoded transfer history for popular players (more reliable than scraping)
const TRANSFER_HISTORY: Record<string, Array<{
  team: string;
  teamSlug: string;
  from: string;
  to: string | null;
  type: string;
}>> = {
  "lionel-messi": [
    { team: "FC Barcelona", teamSlug: "fc-barcelona", from: "2004-07-01", to: "2021-08-10", type: "youth" },
    { team: "Paris Saint-Germain", teamSlug: "paris-saint-germain-fc", from: "2021-08-10", to: "2023-07-15", type: "free" },
    { team: "Inter Miami CF", teamSlug: "inter-miami-cf", from: "2023-07-15", to: null, type: "free" },
  ],
  "cristiano-ronaldo": [
    { team: "Sporting CP", teamSlug: "sporting-cp", from: "2002-07-01", to: "2003-08-12", type: "youth" },
    { team: "Manchester United", teamSlug: "manchester-united-fc", from: "2003-08-12", to: "2009-07-01", type: "permanent" },
    { team: "Real Madrid", teamSlug: "real-madrid-cf", from: "2009-07-01", to: "2018-07-10", type: "permanent" },
    { team: "Juventus", teamSlug: "juventus-fc", from: "2018-07-10", to: "2021-08-27", type: "permanent" },
    { team: "Manchester United", teamSlug: "manchester-united-fc", from: "2021-08-27", to: "2022-11-22", type: "permanent" },
    { team: "Al-Nassr FC", teamSlug: "al-nassr-fc", from: "2023-01-01", to: null, type: "free" },
  ],
  "kylian-mbappe": [
    { team: "AS Monaco", teamSlug: "as-monaco-fc", from: "2015-07-01", to: "2017-08-31", type: "youth" },
    { team: "Paris Saint-Germain", teamSlug: "paris-saint-germain-fc", from: "2017-08-31", to: "2024-07-01", type: "permanent" },
    { team: "Real Madrid", teamSlug: "real-madrid-cf", from: "2024-07-01", to: null, type: "free" },
  ],
  "erling-haaland": [
    { team: "Bryne FK", teamSlug: "bryne-fk", from: "2016-01-01", to: "2017-02-01", type: "youth" },
    { team: "Molde FK", teamSlug: "molde-fk", from: "2017-02-01", to: "2019-01-01", type: "permanent" },
    { team: "RB Salzburg", teamSlug: "rb-salzburg", from: "2019-01-01", to: "2020-01-01", type: "permanent" },
    { team: "Borussia Dortmund", teamSlug: "borussia-dortmund", from: "2020-01-01", to: "2022-07-01", type: "permanent" },
    { team: "Manchester City", teamSlug: "manchester-city-fc", from: "2022-07-01", to: null, type: "permanent" },
  ],
  "neymar": [
    { team: "Santos FC", teamSlug: "santos-fc", from: "2009-03-07", to: "2013-05-27", type: "youth" },
    { team: "FC Barcelona", teamSlug: "fc-barcelona", from: "2013-05-27", to: "2017-08-03", type: "permanent" },
    { team: "Paris Saint-Germain", teamSlug: "paris-saint-germain-fc", from: "2017-08-03", to: "2023-08-15", type: "permanent" },
    { team: "Al-Hilal", teamSlug: "al-hilal", from: "2023-08-15", to: null, type: "permanent" },
  ],
  "kevin-de-bruyne": [
    { team: "KRC Genk", teamSlug: "krc-genk", from: "2008-07-01", to: "2012-01-31", type: "youth" },
    { team: "Chelsea FC", teamSlug: "chelsea-fc", from: "2012-01-31", to: "2014-01-18", type: "permanent" },
    { team: "VfL Wolfsburg", teamSlug: "vfl-wolfsburg", from: "2014-01-18", to: "2015-08-30", type: "permanent" },
    { team: "Manchester City", teamSlug: "manchester-city-fc", from: "2015-08-30", to: null, type: "permanent" },
  ],
  "mohamed-salah": [
    { team: "El Mokawloon", teamSlug: "el-mokawloon", from: "2010-07-01", to: "2012-04-12", type: "youth" },
    { team: "FC Basel", teamSlug: "fc-basel", from: "2012-04-12", to: "2014-02-02", type: "permanent" },
    { team: "Chelsea FC", teamSlug: "chelsea-fc", from: "2014-02-02", to: "2015-02-02", type: "permanent" },
    { team: "Fiorentina", teamSlug: "acf-fiorentina", from: "2015-02-02", to: "2015-08-06", type: "loan" },
    { team: "AS Roma", teamSlug: "as-roma", from: "2015-08-06", to: "2017-06-22", type: "permanent" },
    { team: "Liverpool FC", teamSlug: "liverpool-fc", from: "2017-06-22", to: null, type: "permanent" },
  ],
  "robert-lewandowski": [
    { team: "Znicz Pruszków", teamSlug: "znicz-pruszkow", from: "2006-07-01", to: "2008-06-30", type: "youth" },
    { team: "Lech Poznań", teamSlug: "lech-poznan", from: "2008-06-30", to: "2010-06-18", type: "permanent" },
    { team: "Borussia Dortmund", teamSlug: "borussia-dortmund", from: "2010-06-18", to: "2014-07-01", type: "permanent" },
    { team: "Bayern Munich", teamSlug: "bayern-munich", from: "2014-07-01", to: "2022-07-19", type: "free" },
    { team: "FC Barcelona", teamSlug: "fc-barcelona", from: "2022-07-19", to: null, type: "permanent" },
  ],
  "harry-kane": [
    { team: "Tottenham Hotspur", teamSlug: "tottenham-hotspur-fc", from: "2009-07-01", to: "2023-08-12", type: "youth" },
    { team: "Bayern Munich", teamSlug: "bayern-munich", from: "2023-08-12", to: null, type: "permanent" },
  ],
  "jude-bellingham": [
    { team: "Birmingham City", teamSlug: "birmingham-city-fc", from: "2019-07-01", to: "2020-07-16", type: "youth" },
    { team: "Borussia Dortmund", teamSlug: "borussia-dortmund", from: "2020-07-16", to: "2023-06-14", type: "permanent" },
    { team: "Real Madrid", teamSlug: "real-madrid-cf", from: "2023-06-14", to: null, type: "permanent" },
  ],
  "vinicius-junior": [
    { team: "Flamengo", teamSlug: "flamengo", from: "2017-05-13", to: "2018-07-12", type: "youth" },
    { team: "Real Madrid", teamSlug: "real-madrid-cf", from: "2018-07-12", to: null, type: "permanent" },
  ],
};

async function getPlayerId(slug: string): Promise<string | null> {
  const result = await sql`SELECT id FROM players WHERE slug = ${slug}`;
  return result.length > 0 ? result[0].id : null;
}

async function getTeamId(slug: string): Promise<string | null> {
  const result = await sql`SELECT id FROM teams WHERE slug = ${slug}`;
  return result.length > 0 ? result[0].id : null;
}

async function insertTransferHistory(
  playerId: string,
  teamId: string,
  validFrom: string,
  validTo: string | null,
  transferType: string
): Promise<boolean> {
  try {
    await sql`
      INSERT INTO player_team_history (player_id, team_id, valid_from, valid_to, transfer_type)
      VALUES (${playerId}, ${teamId}, ${validFrom}, ${validTo}, ${transferType})
      ON CONFLICT DO NOTHING
    `;
    return true;
  } catch (error) {
    console.error("  Error inserting transfer:", error);
    return false;
  }
}

async function clearPlayerHistory(playerId: string): Promise<void> {
  await sql`DELETE FROM player_team_history WHERE player_id = ${playerId}`;
}

async function processPlayer(playerSlug: string): Promise<boolean> {
  console.log(`\nProcessing: ${playerSlug}`);

  const transfers = TRANSFER_HISTORY[playerSlug];
  if (!transfers) {
    console.log(`  No transfer data available for ${playerSlug}`);
    return false;
  }

  const playerId = await getPlayerId(playerSlug);
  if (!playerId) {
    console.log(`  Player not found in database: ${playerSlug}`);
    return false;
  }

  if (dryRun) {
    console.log(`  [DRY RUN] Would insert ${transfers.length} transfers`);
    transfers.forEach((t) => {
      console.log(`    ${t.from} - ${t.to || "Present"}: ${t.team} (${t.type})`);
    });
    return true;
  }

  // Clear existing history
  await clearPlayerHistory(playerId);
  console.log(`  Cleared existing history`);

  let inserted = 0;
  for (const transfer of transfers) {
    const teamId = await getTeamId(transfer.teamSlug);
    if (!teamId) {
      console.log(`  Team not found: ${transfer.team} (${transfer.teamSlug})`);
      continue;
    }

    const success = await insertTransferHistory(
      playerId,
      teamId,
      transfer.from,
      transfer.to,
      transfer.type
    );

    if (success) {
      inserted++;
      console.log(`  + ${transfer.from} - ${transfer.to || "Present"}: ${transfer.team}`);
    }
  }

  console.log(`  Inserted ${inserted}/${transfers.length} transfers`);
  return true;
}

async function getTopPlayers(limit: number): Promise<string[]> {
  const result = await sql`
    SELECT slug FROM players
    WHERE popularity_score IS NOT NULL
    ORDER BY popularity_score DESC
    LIMIT ${limit}
  `;
  return result.map((r: any) => r.slug);
}

async function main() {
  console.log("Transfer History Import Script");
  console.log("==============================");

  if (dryRun) {
    console.log("Running in DRY RUN mode - no data will be modified\n");
  }

  let playersToProcess: string[] = [];

  if (specificPlayerSlug) {
    playersToProcess = [specificPlayerSlug];
  } else {
    // Get players we have data for
    const availablePlayers = Object.keys(TRANSFER_HISTORY);
    console.log(`Available transfer data for ${availablePlayers.length} players`);
    playersToProcess = availablePlayers;
  }

  let processed = 0;
  let success = 0;

  for (const slug of playersToProcess) {
    const result = await processPlayer(slug);
    processed++;
    if (result) success++;

    // Small delay to be nice to the database
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log("\n==============================");
  console.log(`Processed: ${processed} players`);
  console.log(`Success: ${success}`);
  console.log("Done!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
