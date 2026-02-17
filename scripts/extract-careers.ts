/**
 * Career History Extraction Script
 *
 * Parses player Wikipedia pages to extract career history (teams, years, appearances, goals).
 * Populates the player_team_history table with historical data.
 *
 * Usage: npx tsx scripts/extract-careers.ts [--dry-run] [--player="Player Name"]
 *
 * Rate limiting: 1 request/second to be nice to Wikipedia
 */

import * as cheerio from "cheerio";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";
import { eq, and, isNull } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { CareerParser, type CareerEntry } from "./career/career-parser";
import { findBestMatch, type TEAM_ALIASES } from "./career/team-matcher";
import { toIsoDate } from "./career/date-parser";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

// Parse command line args
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const playerFilter = args.find((a) => a.startsWith("--player="))?.slice(9);

// Rate limiting - 1 request/second
const RATE_LIMIT_MS = 1000;
let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<string> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest)
    );
  }
  lastRequestTime = Date.now();

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "SportsDB/1.0 (Educational Project; https://github.com/sportsdb)",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }

  return response.text();
}

/**
 * Search Wikipedia for a player and return their career data
 */
async function getPlayerCareer(
  playerName: string
): Promise<CareerEntry[]> {
  try {
    // Search for the player's Wikipedia page
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      playerName + " footballer"
    )}&srlimit=1&format=json`;

    const searchResponse = await fetch(searchUrl, {
      headers: {
        "User-Agent": "SportsDB/1.0 (Educational Project)",
      },
    });
    const searchData = await searchResponse.json();
    const searchResults = searchData.query?.search;

    if (!searchResults || searchResults.length === 0) {
      return [];
    }

    const pageTitle = searchResults[0].title;
    const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(
      pageTitle.replace(/ /g, "_")
    )}`;

    const html = await rateLimitedFetch(wikiUrl);
    const $ = cheerio.load(html);

    // Use the modular parser
    const parser = new CareerParser();
    return parser.parse($);
  } catch (error) {
    console.log(`      Could not fetch career for ${playerName}`);
    return [];
  }
}

/**
 * Find team in database using multi-strategy matching
 */
async function findTeamInDb(
  teamName: string,
  teams: { id: string; name: string }[]
): Promise<{ teamId: string; confidence: number } | null> {
  const match = findBestMatch(teamName, teams);

  if (match && match.confidence >= 0.75) {
    return { teamId: match.teamId, confidence: match.confidence };
  }

  return null;
}

async function main() {
  console.log("\n Career History Extraction");
  console.log("=".repeat(50));
  if (isDryRun) {
    console.log("DRY RUN MODE - No changes will be saved\n");
  }
  console.log("Extracting career histories from Wikipedia...");
  console.log("Rate limit: 1 request/second\n");

  // Get all teams for matching
  const allTeams = await db.select({
    id: schema.teams.id,
    name: schema.teams.name,
  }).from(schema.teams);
  console.log(`Loaded ${allTeams.length} teams for matching\n`);

  // Get players to process
  let playersQuery = db.select().from(schema.players);
  const players = await playersQuery;

  const filteredPlayers = playerFilter
    ? players.filter((p) =>
        p.name.toLowerCase().includes(playerFilter.toLowerCase())
      )
    : players;

  console.log(`Found ${filteredPlayers.length} players to process\n`);

  let totalCareersFound = 0;
  let totalEntriesAdded = 0;
  let totalTeamsNotFound = 0;
  let totalSkipped = 0;

  for (const player of filteredPlayers) {
    process.stdout.write(`  ${player.name}: `);

    // Get career history from Wikipedia
    const career = await getPlayerCareer(player.name);

    if (career.length === 0) {
      console.log("No career data found");
      continue;
    }

    console.log(`${career.length} entries found`);
    totalCareersFound++;

    // Process each career entry
    for (const entry of career) {
      // Skip youth career entries for now
      if (entry.careerType === "youth") {
        continue;
      }

      // Find the team in our database
      const teamMatch = await findTeamInDb(entry.teamName, allTeams);

      if (!teamMatch) {
        console.log(`      Team not found: ${entry.teamName}`);
        totalTeamsNotFound++;
        continue;
      }

      const team = allTeams.find((t) => t.id === teamMatch.teamId);
      const confidenceStr =
        teamMatch.confidence < 1
          ? ` (${Math.round(teamMatch.confidence * 100)}%)`
          : "";

      // Calculate dates
      const validFrom = toIsoDate(
        { year: entry.startYear, month: entry.startMonth },
        false
      );
      const validTo = entry.endYear
        ? toIsoDate({ year: entry.endYear, month: entry.endMonth }, true)
        : null;

      // Check if this entry already exists
      const existingEntries = await db
        .select()
        .from(schema.playerTeamHistory)
        .where(
          and(
            eq(schema.playerTeamHistory.playerId, player.id),
            eq(schema.playerTeamHistory.teamId, teamMatch.teamId)
          )
        );

      // Check for duplicate by similar date range
      const isDuplicate = existingEntries.some((existing) => {
        const existingStart = existing.validFrom;
        const existingEnd = existing.validTo;
        // Consider duplicate if start dates are within same year
        return (
          existingStart.slice(0, 4) === validFrom.slice(0, 4)
        );
      });

      if (isDuplicate) {
        console.log(
          `      Exists: ${team?.name}${confidenceStr} (${entry.startYear})`
        );
        totalSkipped++;
        continue;
      }

      if (isDryRun) {
        console.log(
          `      [DRY] Would add: ${team?.name}${confidenceStr} (${entry.startYear}-${entry.endYear || "present"})`
        );
        totalEntriesAdded++;
      } else {
        // Insert the career entry
        await db.insert(schema.playerTeamHistory).values({
          playerId: player.id,
          teamId: teamMatch.teamId,
          validFrom,
          validTo,
          transferType: entry.isLoan ? "loan" : "permanent",
        });

        console.log(
          `      Added: ${team?.name}${confidenceStr} (${entry.startYear}-${entry.endYear || "present"})`
        );
        totalEntriesAdded++;
      }
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(" Summary:");
  console.log(`   Players with career data: ${totalCareersFound}`);
  console.log(`   Career entries ${isDryRun ? "would be " : ""}added: ${totalEntriesAdded}`);
  console.log(`   Entries skipped (duplicates): ${totalSkipped}`);
  console.log(`   Teams not found: ${totalTeamsNotFound}`);

  if (isDryRun) {
    console.log("\n Re-run without --dry-run to apply changes.");
  }
}

main().catch((err) => {
  console.error(" Career extraction failed:", err);
  process.exit(1);
});
