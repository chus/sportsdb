/**
 * Wikipedia Football Data Scraper
 *
 * Scrapes football teams and players from Wikipedia.
 * Uses Wikipedia's API for cleaner data extraction.
 *
 * Usage: npx tsx scripts/ingest-wikipedia.ts
 */

import * as cheerio from "cheerio";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";
import * as schema from "../src/lib/db/schema";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

// Rate limiting - be nice to Wikipedia
const RATE_LIMIT_MS = 1000;
let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<string> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();

  const response = await fetch(url, {
    headers: {
      "User-Agent": "SportsDB/1.0 (Educational Project; https://github.com/sportsdb)",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }

  return response.text();
}

async function getWikipediaPage(title: string): Promise<cheerio.CheerioAPI> {
  const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  const html = await rateLimitedFetch(url);
  return cheerio.load(html);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// League configurations with Wikipedia page titles
const LEAGUES = [
  // European Leagues
  {
    name: "Premier League",
    country: "England",
    type: "league" as const,
    teamsPage: "2024–25_Premier_League",
    tableSelector: "table.wikitable",
  },
  {
    name: "La Liga",
    country: "Spain",
    type: "league" as const,
    teamsPage: "2024–25_La_Liga",
    tableSelector: "table.wikitable",
  },
  {
    name: "Bundesliga",
    country: "Germany",
    type: "league" as const,
    teamsPage: "2024–25_Bundesliga",
    tableSelector: "table.wikitable",
  },
  {
    name: "Serie A",
    country: "Italy",
    type: "league" as const,
    teamsPage: "2024–25_Serie_A",
    tableSelector: "table.wikitable",
  },
  {
    name: "Ligue 1",
    country: "France",
    type: "league" as const,
    teamsPage: "2024–25_Ligue_1",
    tableSelector: "table.wikitable",
  },
  {
    name: "Eredivisie",
    country: "Netherlands",
    type: "league" as const,
    teamsPage: "2024–25_Eredivisie",
    tableSelector: "table.wikitable",
  },
  {
    name: "Primeira Liga",
    country: "Portugal",
    type: "league" as const,
    teamsPage: "2024–25_Primeira_Liga",
    tableSelector: "table.wikitable",
  },
  // North American Leagues
  {
    name: "MLS",
    country: "USA",
    type: "league" as const,
    teamsPage: "2024_Major_League_Soccer_season",
    tableSelector: "table.wikitable",
  },
  {
    name: "Liga MX",
    country: "Mexico",
    type: "league" as const,
    teamsPage: "2024–25_Liga_MX_season",
    tableSelector: "table.wikitable",
  },
  // South American Leagues
  {
    name: "Liga Profesional Argentina",
    country: "Argentina",
    type: "league" as const,
    teamsPage: "2024_Argentine_Primera_División",
    tableSelector: "table.wikitable",
  },
  {
    name: "Brasileirão Série A",
    country: "Brazil",
    type: "league" as const,
    teamsPage: "2024_Campeonato_Brasileiro_Série_A",
    tableSelector: "table.wikitable",
  },
  {
    name: "Liga BetPlay",
    country: "Colombia",
    type: "league" as const,
    teamsPage: "2024_Categoría_Primera_A_season",
    tableSelector: "table.wikitable",
  },
  {
    name: "Primera División de Chile",
    country: "Chile",
    type: "league" as const,
    teamsPage: "2024_Chilean_Primera_División",
    tableSelector: "table.wikitable",
  },
  {
    name: "Primera División de Uruguay",
    country: "Uruguay",
    type: "league" as const,
    teamsPage: "2024_Uruguayan_Primera_División_season",
    tableSelector: "table.wikitable",
  },
  {
    name: "Liga 1 Perú",
    country: "Peru",
    type: "league" as const,
    teamsPage: "2024_Liga_1_(Peru)_season",
    tableSelector: "table.wikitable",
  },
  {
    name: "Liga Pro Ecuador",
    country: "Ecuador",
    type: "league" as const,
    teamsPage: "2024_Ecuadorian_Serie_A_season",
    tableSelector: "table.wikitable",
  },
  {
    name: "Primera División de Paraguay",
    country: "Paraguay",
    type: "league" as const,
    teamsPage: "2024_Paraguayan_Primera_División_season",
    tableSelector: "table.wikitable",
  },
  {
    name: "Primera División de Venezuela",
    country: "Venezuela",
    type: "league" as const,
    teamsPage: "2024_Venezuelan_Primera_División_season",
    tableSelector: "table.wikitable",
  },
  {
    name: "Primera División de Bolivia",
    country: "Bolivia",
    type: "league" as const,
    teamsPage: "2024_Bolivian_Primera_División_season",
    tableSelector: "table.wikitable",
  },
];

interface TeamInfo {
  name: string;
  wikiTitle: string;
  stadium?: string;
  city?: string;
  founded?: number;
}

interface PlayerInfo {
  name: string;
  position: string;
  nationality?: string;
  dateOfBirth?: string;
  number?: number;
}

async function extractTeamsFromLeaguePage(
  pageTitle: string
): Promise<TeamInfo[]> {
  console.log(`   📄 Fetching ${pageTitle}...`);
  const $ = await getWikipediaPage(pageTitle);
  const teams: TeamInfo[] = [];

  // Find the "Teams" or "Clubs" section and its table
  // Wikipedia league pages typically have a table with team names

  // Strategy 1: Look for standings table (most reliable)
  $("table.wikitable").each((_, table) => {
    const $table = $(table);
    const headerText = $table.find("th").first().text().toLowerCase();

    // Check if this looks like a standings or teams table
    if (
      headerText.includes("pos") ||
      headerText.includes("team") ||
      headerText.includes("club")
    ) {
      $table.find("tbody tr").each((_, row) => {
        const $row = $(row);
        // Find team link - usually in first few cells
        $row.find("td").each((_, cell) => {
          const $cell = $(cell);
          const $link = $cell.find('a[href^="/wiki/"]').first();
          const href = $link.attr("href");
          const teamName = $link.attr("title") || $link.text();

          if (
            href &&
            teamName &&
            !href.includes("File:") &&
            !href.includes("Flag") &&
            teamName.length > 2 &&
            !teamName.match(/^\d+$/)
          ) {
            // Filter out non-team links
            const isLikelyTeam =
              href.includes("F.C.") ||
              href.includes("FC") ||
              href.includes("_FC") ||
              href.includes("football") ||
              href.includes("United") ||
              href.includes("City") ||
              href.includes("Athletic") ||
              teamName.includes("FC") ||
              teamName.includes("United") ||
              teamName.includes("City");

            // Also check it's not a country or competition link
            const isNotTeam =
              href.includes("national") ||
              href.includes("Premier_League") ||
              href.includes("La_Liga") ||
              teamName.length < 3;

            if (!isNotTeam) {
              const wikiTitle = decodeURIComponent(
                href.replace("/wiki/", "")
              ).replace(/_/g, " ");
              if (!teams.find((t) => t.name === teamName)) {
                teams.push({ name: teamName, wikiTitle });
              }
              return false; // Break inner loop
            }
          }
        });
      });
    }
  });

  // Deduplicate and clean
  const uniqueTeams = teams.filter(
    (team, index, self) =>
      index === self.findIndex((t) => slugify(t.name) === slugify(team.name))
  );

  return uniqueTeams.slice(0, 25); // Limit to 25 teams per league
}

async function extractTeamDetails(
  wikiTitle: string
): Promise<{ stadium?: string; city?: string; founded?: number }> {
  try {
    const $ = await getWikipediaPage(wikiTitle);
    const details: { stadium?: string; city?: string; founded?: number } = {};

    // Parse infobox
    $(".infobox th").each((_, th) => {
      const $th = $(th);
      const label = $th.text().toLowerCase().trim();
      const $td = $th.next("td");
      const value = $td.text().trim();

      if (label.includes("ground") || label.includes("stadium")) {
        details.stadium = $td.find("a").first().text() || value.split("\n")[0];
      }
      if (label.includes("city") || label.includes("location")) {
        details.city = value.split(",")[0].split("\n")[0];
      }
      if (label === "founded") {
        const year = value.match(/\d{4}/);
        if (year) details.founded = parseInt(year[0]);
      }
    });

    return details;
  } catch {
    return {};
  }
}

async function extractSquadFromTeamPage(
  wikiTitle: string,
  teamName: string
): Promise<PlayerInfo[]> {
  const players: PlayerInfo[] = [];

  try {
    const $ = await getWikipediaPage(wikiTitle);

    // Find squad tables - they usually have headers like "No.", "Name", "Pos"
    $("table.wikitable").each((_, table) => {
      const $table = $(table);
      const headers: string[] = [];

      // Get headers
      $table.find("tr").first().find("th").each((_, th) => {
        headers.push($(th).text().toLowerCase().trim());
      });

      // Check if this is a squad table
      const hasNumber = headers.some((h) => h.includes("no") || h === "#");
      const hasName = headers.some(
        (h) => h.includes("name") || h.includes("player")
      );
      const hasPosition = headers.some(
        (h) => h.includes("pos") || h.includes("position")
      );

      if ((hasNumber || hasPosition) && (hasName || headers.length >= 3)) {
        // Parse player rows
        $table.find("tbody tr, tr").each((_, row) => {
          const $row = $(row);
          const cells = $row.find("td");
          if (cells.length < 2) return;

          // Try to extract player info
          let name = "";
          let position = "";
          let nationality = "";
          let number: number | undefined;

          cells.each((i, cell) => {
            const $cell = $(cell);
            const text = $cell.text().trim();
            const header = headers[i] || "";

            // Number column
            if (header.includes("no") || header === "#") {
              const num = parseInt(text);
              if (!isNaN(num) && num > 0 && num < 100) number = num;
            }

            // Name column - look for link
            if (header.includes("name") || header.includes("player")) {
              const $link = $cell.find("a").first();
              name = $link.text().trim() || text;
            }

            // Position column
            if (header.includes("pos")) {
              position = text
                .replace(/\[.*?\]/g, "")
                .trim()
                .split(/[,\/]/)[0];
            }

            // Nationality - look for flag
            if (header.includes("nat")) {
              const $flag = $cell.find('a[title*="national"]').first();
              nationality = $flag.attr("title")?.replace(" national.*", "") || "";
            }
          });

          // If we couldn't find name from header, try first link in row
          if (!name) {
            const $link = $row.find('a[href^="/wiki/"]').first();
            if ($link.length) {
              const href = $link.attr("href") || "";
              if (
                !href.includes("File:") &&
                !href.includes("Flag") &&
                !href.includes("national")
              ) {
                name = $link.text().trim();
              }
            }
          }

          // Normalize position
          if (position) {
            position = normalizePosition(position);
          }

          if (name && name.length > 2 && !name.match(/^\d+$/)) {
            players.push({ name, position: position || "Unknown", nationality, number });
          }
        });
      }
    });
  } catch (error) {
    console.log(`      ⚠️ Could not fetch squad for ${teamName}`);
  }

  // Deduplicate
  return players.filter(
    (p, i, arr) => i === arr.findIndex((x) => slugify(x.name) === slugify(p.name))
  );
}

function normalizePosition(pos: string): string {
  const p = pos.toLowerCase().trim();
  if (p.includes("goalkeeper") || p === "gk") return "Goalkeeper";
  if (
    p.includes("defender") ||
    p.includes("back") ||
    p === "df" ||
    p === "cb" ||
    p === "lb" ||
    p === "rb"
  )
    return "Defender";
  if (p.includes("midfielder") || p === "mf" || p === "cm" || p === "dm" || p === "am")
    return "Midfielder";
  if (
    p.includes("forward") ||
    p.includes("striker") ||
    p.includes("winger") ||
    p === "fw" ||
    p === "cf" ||
    p === "st" ||
    p === "lw" ||
    p === "rw"
  )
    return "Forward";
  return "Unknown";
}

async function clearDatabase() {
  console.log("🗑️  Clearing existing data...\n");

  // Use raw SQL TRUNCATE with CASCADE to avoid foreign key issues
  await sql`TRUNCATE TABLE search_index, player_season_stats, match_events, match_lineups, matches, standings, team_seasons, competition_seasons, player_team_history, team_venue_history, players, venues, teams, competitions, seasons CASCADE`;
}

async function main() {
  console.log("🌐 Wikipedia Football Scraper\n");
  console.log("This will scrape football data from Wikipedia.");
  console.log("Respecting rate limits (1 request/second).\n");

  await clearDatabase();

  // Create seasons
  console.log("📅 Creating seasons...");
  const [currentSeason] = await db
    .insert(schema.seasons)
    .values({
      label: "2024/25",
      startDate: "2024-08-01",
      endDate: "2025-06-30",
      isCurrent: true,
    })
    .returning();
  console.log("✅ Season created\n");

  const allTeams: (typeof schema.teams.$inferSelect)[] = [];
  const allPlayers: (typeof schema.players.$inferSelect)[] = [];
  const allVenues: (typeof schema.venues.$inferSelect)[] = [];
  const allCompetitions: (typeof schema.competitions.$inferSelect)[] = [];

  // Process each league
  for (const league of LEAGUES) {
    console.log(`\n🏆 ${league.name} (${league.country})`);
    console.log("─".repeat(40));

    try {
      // Create competition
      const [competition] = await db
        .insert(schema.competitions)
        .values({
          name: league.name,
          slug: slugify(league.name),
          country: league.country,
          type: league.type,
        })
        .returning();
      allCompetitions.push(competition);

      // Create competition-season link
      const [compSeason] = await db
        .insert(schema.competitionSeasons)
        .values({
          competitionId: competition.id,
          seasonId: currentSeason.id,
          status: "in_progress",
        })
        .returning();

      // Get teams from league page
      let teamsInfo;
      try {
        teamsInfo = await extractTeamsFromLeaguePage(league.teamsPage);
      } catch (err) {
        console.log(`   ⚠️ Could not fetch league page: ${err instanceof Error ? err.message : err}`);
        console.log(`   Skipping ${league.name}...`);
        continue;
      }
      console.log(`   Found ${teamsInfo.length} teams`);

    for (const teamInfo of teamsInfo) {
      console.log(`\n   ⚽ ${teamInfo.name}`);

      // Get team details
      const details = await extractTeamDetails(teamInfo.wikiTitle);

      // Insert team
      const [team] = await db
        .insert(schema.teams)
        .values({
          name: teamInfo.name,
          shortName: teamInfo.name.replace(/ FC$| F\.C\.$/, "").slice(0, 15),
          slug: slugify(teamInfo.name),
          country: league.country,
          city: details.city || null,
          foundedYear: details.founded || null,
        })
        .onConflictDoNothing()
        .returning();

      if (!team) {
        console.log(`      (skipped - duplicate)`);
        continue;
      }
      allTeams.push(team);

      // Insert venue if found
      if (details.stadium) {
        const [venue] = await db
          .insert(schema.venues)
          .values({
            name: details.stadium,
            slug: slugify(details.stadium),
            city: details.city || null,
            country: league.country,
          })
          .onConflictDoNothing()
          .returning();

        if (venue) {
          allVenues.push(venue);
          await db.insert(schema.teamVenueHistory).values({
            teamId: team.id,
            venueId: venue.id,
            validFrom: "2020-01-01",
          }).onConflictDoNothing();
        }
      }

      // Link team to competition
      await db.insert(schema.teamSeasons).values({
        teamId: team.id,
        competitionSeasonId: compSeason.id,
      }).onConflictDoNothing();

      // Get squad
      const playersInfo = await extractSquadFromTeamPage(teamInfo.wikiTitle, teamInfo.name);
      console.log(`      👥 ${playersInfo.length} players`);

      for (const playerInfo of playersInfo) {
        const [player] = await db
          .insert(schema.players)
          .values({
            name: playerInfo.name,
            knownAs: playerInfo.name.split(" ").pop() || null,
            slug: slugify(playerInfo.name),
            nationality: playerInfo.nationality || null,
            position: playerInfo.position,
            status: "active",
          })
          .onConflictDoNothing()
          .returning();

        if (player) {
          allPlayers.push(player);

          // Player-team link
          await db.insert(schema.playerTeamHistory).values({
            playerId: player.id,
            teamId: team.id,
            shirtNumber: playerInfo.number || null,
            validFrom: "2024-07-01",
            transferType: "permanent",
          }).onConflictDoNothing();
        }
      }
    }
    } catch (err) {
      console.log(`   ❌ Error processing ${league.name}: ${err instanceof Error ? err.message : err}`);
      console.log(`   Continuing with next league...`);
    }
  }

  // Build search index
  console.log("\n\n🔍 Building search index...");

  const searchEntries = [
    ...allCompetitions.map((c) => ({
      id: c.id,
      entityType: "competition" as const,
      slug: c.slug,
      name: c.name,
      subtitle: c.country,
      meta: c.type,
    })),
    ...allTeams.map((t) => ({
      id: t.id,
      entityType: "team" as const,
      slug: t.slug,
      name: t.name,
      subtitle: t.country,
      meta: t.city,
    })),
    ...allPlayers.map((p) => ({
      id: p.id,
      entityType: "player" as const,
      slug: p.slug,
      name: p.name,
      subtitle: p.nationality,
      meta: p.position,
    })),
    ...allVenues.map((v) => ({
      id: v.id,
      entityType: "venue" as const,
      slug: v.slug,
      name: v.name,
      subtitle: v.city,
      meta: v.country,
    })),
  ];

  // Insert in batches
  for (let i = 0; i < searchEntries.length; i += 100) {
    await db.insert(schema.searchIndex).values(searchEntries.slice(i, i + 100)).onConflictDoNothing();
  }

  console.log(`✅ Indexed ${searchEntries.length} entities`);

  console.log("\n" + "═".repeat(50));
  console.log("🎉 Wikipedia scraping complete!\n");
  console.log(`   🏆 ${allCompetitions.length} competitions`);
  console.log(`   🏟️  ${allTeams.length} teams`);
  console.log(`   👤 ${allPlayers.length} players`);
  console.log(`   🏠 ${allVenues.length} venues`);
  console.log("\nRun 'npm run dev' and search for players!");
}

main().catch((err) => {
  console.error("❌ Scraping failed:", err);
  process.exit(1);
});
