/**
 * Career History Extraction Script
 *
 * Parses player Wikipedia pages to extract career history (teams, years, appearances, goals).
 * Populates the player_team_history table with historical data.
 *
 * Usage: npx tsx scripts/extract-careers.ts
 *
 * Rate limiting: 1 request/second to be nice to Wikipedia
 */

import * as cheerio from "cheerio";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";
import { eq, sql as drizzleSql, and, isNull } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

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

interface CareerEntry {
  teamName: string;
  startYear: number;
  endYear: number | null; // null = current team
  appearances: number | null;
  goals: number | null;
  isLoan: boolean;
}

/**
 * Parse Wikipedia page for career history
 */
async function getPlayerCareer(
  playerName: string
): Promise<CareerEntry[]> {
  const career: CareerEntry[] = [];

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
      return career;
    }

    const pageTitle = searchResults[0].title;
    const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(
      pageTitle.replace(/ /g, "_")
    )}`;

    const html = await rateLimitedFetch(wikiUrl);
    const $ = cheerio.load(html);

    // Find career statistics tables
    // Wikipedia footballer pages typically have an infobox with career info
    // and/or a dedicated "Club career" section with a table

    // Strategy 1: Parse infobox career table
    $(".infobox").each((_, infobox) => {
      const $infobox = $(infobox);

      // Look for "Senior career" or "Youth career" headers
      $infobox.find("tr").each((_, row) => {
        const $row = $(row);
        const headerText = $row.find("th").text().toLowerCase();

        // Check if this is a career section header
        if (
          headerText.includes("senior career") ||
          headerText.includes("career")
        ) {
          return; // Skip header row
        }

        // Parse career rows
        const cells = $row.find("td");
        if (cells.length >= 2) {
          const yearsText = $(cells[0]).text().trim();
          const teamCell = $(cells[1]);
          const teamName =
            teamCell.find("a").first().text() || teamCell.text().trim();
          const statsText = cells.length > 2 ? $(cells[2]).text().trim() : "";

          // Parse years (e.g., "2019–2022", "2023–")
          const yearsMatch = yearsText.match(/(\d{4})[–-](\d{4})?/);
          if (yearsMatch && teamName && !teamName.includes("Total")) {
            const startYear = parseInt(yearsMatch[1]);
            const endYear = yearsMatch[2] ? parseInt(yearsMatch[2]) : null;

            // Parse appearances and goals from stats (e.g., "45 (12)")
            const statsMatch = statsText.match(/(\d+)\s*\((\d+)\)/);
            const appearances = statsMatch ? parseInt(statsMatch[1]) : null;
            const goals = statsMatch ? parseInt(statsMatch[2]) : null;

            // Check if it's a loan
            const isLoan =
              teamCell.text().toLowerCase().includes("loan") ||
              yearsText.toLowerCase().includes("loan");

            // Filter out national teams and invalid entries
            if (
              !teamName.toLowerCase().includes("national") &&
              !teamName.toLowerCase().includes("u-") &&
              !teamName.toLowerCase().includes("under-") &&
              teamName.length > 1
            ) {
              career.push({
                teamName: teamName.replace(/\(loan\)/i, "").trim(),
                startYear,
                endYear,
                appearances,
                goals,
                isLoan,
              });
            }
          }
        }
      });
    });

    // Strategy 2: Parse "Club career" section table if infobox didn't work
    if (career.length === 0) {
      $("table.wikitable").each((_, table) => {
        const $table = $(table);
        const caption = $table.find("caption").text().toLowerCase();
        const prevHeader = $table.prev("h2, h3").text().toLowerCase();

        if (
          caption.includes("career") ||
          prevHeader.includes("career") ||
          prevHeader.includes("club")
        ) {
          $table.find("tbody tr").each((_, row) => {
            const $row = $(row);
            const cells = $row.find("td");

            if (cells.length >= 3) {
              // Typical columns: Season/Years, Club, Apps, Goals
              const yearText = $(cells[0]).text().trim();
              const teamCell = $(cells[1]);
              const teamName =
                teamCell.find("a").first().text() || teamCell.text().trim();
              const apps = parseInt($(cells[2]).text().trim()) || null;
              const goals =
                cells.length > 3
                  ? parseInt($(cells[3]).text().trim()) || null
                  : null;

              const yearsMatch = yearText.match(/(\d{4})/);
              if (yearsMatch && teamName && !teamName.includes("Total")) {
                const startYear = parseInt(yearsMatch[1]);

                career.push({
                  teamName,
                  startYear,
                  endYear: null,
                  appearances: apps,
                  goals,
                  isLoan: teamCell.text().toLowerCase().includes("loan"),
                });
              }
            }
          });
        }
      });
    }
  } catch (error) {
    console.log(`      ⚠️ Could not fetch career for ${playerName}`);
  }

  return career;
}

/**
 * Find or create a team by name
 */
async function findOrCreateTeam(
  teamName: string,
  country: string = "Unknown"
): Promise<string | null> {
  // Try to find existing team
  const normalizedName = teamName.toLowerCase().replace(/[^a-z0-9]/g, "");

  const existingTeams = await db.select().from(schema.teams);

  // Fuzzy match against existing teams
  for (const team of existingTeams) {
    const teamNormalized = team.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (
      teamNormalized.includes(normalizedName) ||
      normalizedName.includes(teamNormalized)
    ) {
      return team.id;
    }
  }

  // If not found, we could create the team - but for now, skip unknown teams
  // to avoid polluting the database with partial data
  return null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  console.log("📜 Career History Extraction");
  console.log("═".repeat(50));
  console.log("Extracting career histories from Wikipedia...");
  console.log("Rate limit: 1 request/second\n");

  // Get all players
  const players = await db.select().from(schema.players);
  console.log(`Found ${players.length} players to process\n`);

  let totalCareersFound = 0;
  let totalEntriesAdded = 0;

  for (const player of players) {
    process.stdout.write(`👤 ${player.name}: `);

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
      // Find the team in our database
      const teamId = await findOrCreateTeam(entry.teamName);

      if (!teamId) {
        console.log(`   ⚠️ Team not found: ${entry.teamName}`);
        continue;
      }

      // Check if this entry already exists
      const existingEntry = await db
        .select()
        .from(schema.playerTeamHistory)
        .where(
          and(
            eq(schema.playerTeamHistory.playerId, player.id),
            eq(schema.playerTeamHistory.teamId, teamId),
            eq(
              schema.playerTeamHistory.validFrom,
              `${entry.startYear}-07-01`
            )
          )
        )
        .limit(1);

      if (existingEntry.length > 0) {
        console.log(`   ⏭️ Already exists: ${entry.teamName} (${entry.startYear})`);
        continue;
      }

      // Insert the career entry
      await db.insert(schema.playerTeamHistory).values({
        playerId: player.id,
        teamId,
        validFrom: `${entry.startYear}-07-01`,
        validTo: entry.endYear ? `${entry.endYear}-06-30` : null,
        transferType: entry.isLoan ? "loan" : "permanent",
      });

      totalEntriesAdded++;
      console.log(
        `   ✅ Added: ${entry.teamName} (${entry.startYear}-${entry.endYear || "present"})`
      );
    }
  }

  console.log("\n" + "═".repeat(50));
  console.log("📊 Summary:");
  console.log(`   Players with career data: ${totalCareersFound}`);
  console.log(`   Career entries added: ${totalEntriesAdded}`);
}

main().catch((err) => {
  console.error("❌ Career extraction failed:", err);
  process.exit(1);
});
