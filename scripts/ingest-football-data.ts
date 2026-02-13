/**
 * Football-Data.org Ingestion Script
 *
 * Fetches real football data and populates the SportsDB database.
 *
 * Usage:
 *   1. Get free API key from https://www.football-data.org/
 *   2. Add to .env.local: FOOTBALL_DATA_API_KEY=your_key
 *   3. Run: npx tsx scripts/ingest-football-data.ts
 *
 * Free tier: 10 requests/minute, covers major European leagues
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

config({ path: ".env.local" });

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const BASE_URL = "https://api.football-data.org/v4";

if (!API_KEY) {
  console.error("❌ Missing FOOTBALL_DATA_API_KEY in .env.local");
  console.error("   Get your free key at: https://www.football-data.org/");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

// Rate limiting: 10 req/min for free tier
const RATE_LIMIT_MS = 6500; // ~9 requests per minute to be safe
let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<any> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    const waitTime = RATE_LIMIT_MS - timeSinceLastRequest;
    console.log(`   ⏳ Rate limiting: waiting ${Math.round(waitTime / 1000)}s...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();

  const response = await fetch(url, {
    headers: {
      "X-Auth-Token": API_KEY!,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error ${response.status}: ${error}`);
  }

  return response.json();
}

// Football-Data.org competition codes for free tier
const COMPETITIONS = [
  { code: "PL", name: "Premier League", country: "England" },
  { code: "PD", name: "La Liga", country: "Spain" },
  { code: "BL1", name: "Bundesliga", country: "Germany" },
  { code: "SA", name: "Serie A", country: "Italy" },
  { code: "FL1", name: "Ligue 1", country: "France" },
  { code: "CL", name: "Champions League", country: "Europe" },
  { code: "ELC", name: "Championship", country: "England" },
  { code: "DED", name: "Eredivisie", country: "Netherlands" },
  { code: "PPL", name: "Primeira Liga", country: "Portugal" },
  { code: "EC", name: "European Championship", country: "Europe" },
  { code: "WC", name: "World Cup", country: "World" },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function mapPosition(position: string | null): string {
  if (!position) return "Unknown";
  const posMap: Record<string, string> = {
    "Goalkeeper": "Goalkeeper",
    "Defence": "Defender",
    "Left-Back": "Defender",
    "Right-Back": "Defender",
    "Centre-Back": "Defender",
    "Defensive Midfield": "Midfielder",
    "Midfield": "Midfielder",
    "Central Midfield": "Midfielder",
    "Attacking Midfield": "Midfielder",
    "Left Midfield": "Midfielder",
    "Right Midfield": "Midfielder",
    "Left Winger": "Forward",
    "Right Winger": "Forward",
    "Offence": "Forward",
    "Centre-Forward": "Forward",
  };
  return posMap[position] || position;
}

async function clearDatabase() {
  console.log("🗑️  Clearing existing data...");

  // Delete in order to respect foreign keys
  await db.delete(schema.searchIndex);
  await db.delete(schema.playerSeasonStats);
  await db.delete(schema.matchEvents);
  await db.delete(schema.matchLineups);
  await db.delete(schema.matches);
  await db.delete(schema.standings);
  await db.delete(schema.teamSeasons);
  await db.delete(schema.competitionSeasons);
  await db.delete(schema.playerTeamHistory);
  await db.delete(schema.teamVenueHistory);
  await db.delete(schema.players);
  await db.delete(schema.venues);
  await db.delete(schema.teams);
  await db.delete(schema.competitions);
  await db.delete(schema.seasons);

  console.log("✅ Database cleared\n");
}

async function ingestSeasons() {
  console.log("📅 Creating seasons...");

  const seasons = [
    { label: "2023/24", startDate: "2023-08-01", endDate: "2024-06-30", isCurrent: false },
    { label: "2024/25", startDate: "2024-08-01", endDate: "2025-06-30", isCurrent: false },
    { label: "2025/26", startDate: "2025-08-01", endDate: "2026-06-30", isCurrent: true },
  ];

  const inserted = await db.insert(schema.seasons).values(seasons).returning();
  console.log(`✅ Created ${inserted.length} seasons\n`);

  return inserted;
}

async function ingestCompetitions() {
  console.log("🏆 Fetching competitions...");

  const competitionsData = await rateLimitedFetch(`${BASE_URL}/competitions`);
  const insertedCompetitions: (typeof schema.competitions.$inferSelect)[] = [];

  for (const comp of COMPETITIONS) {
    const apiComp = competitionsData.competitions?.find((c: any) => c.code === comp.code);

    if (apiComp) {
      const [inserted] = await db.insert(schema.competitions).values({
        name: apiComp.name,
        slug: slugify(apiComp.name),
        country: comp.country,
        type: apiComp.type === "CUP" ? "cup" : apiComp.type === "LEAGUE" ? "league" : "international",
        foundedYear: apiComp.currentSeason?.startDate ? parseInt(apiComp.currentSeason.startDate.slice(0, 4)) - 100 : null,
        logoUrl: apiComp.emblem,
        description: `${apiComp.name} - ${comp.country}`,
      }).returning();

      insertedCompetitions.push(inserted);
      console.log(`   ✅ ${inserted.name}`);
    }
  }

  console.log(`✅ Created ${insertedCompetitions.length} competitions\n`);
  return insertedCompetitions;
}

async function ingestTeamsAndPlayers(
  competitions: (typeof schema.competitions.$inferSelect)[],
  seasons: (typeof schema.seasons.$inferSelect)[]
) {
  console.log("⚽ Fetching teams and players...\n");

  const currentSeason = seasons.find(s => s.isCurrent) || seasons[seasons.length - 1];
  const teamMap = new Map<number, typeof schema.teams.$inferSelect>();
  const playerMap = new Map<number, typeof schema.players.$inferSelect>();
  const venueMap = new Map<string, typeof schema.venues.$inferSelect>();

  for (const competition of competitions) {
    const compCode = COMPETITIONS.find(c =>
      slugify(c.name) === competition.slug || c.name === competition.name
    )?.code;

    if (!compCode) continue;

    console.log(`📋 ${competition.name}...`);

    // Create competition-season link
    const [compSeason] = await db.insert(schema.competitionSeasons).values({
      competitionId: competition.id,
      seasonId: currentSeason.id,
      status: "in_progress",
    }).returning();

    // Fetch teams
    let teamsData;
    try {
      teamsData = await rateLimitedFetch(`${BASE_URL}/competitions/${compCode}/teams`);
    } catch (error) {
      console.log(`   ⚠️  Could not fetch teams for ${competition.name}`);
      continue;
    }

    for (const apiTeam of teamsData.teams || []) {
      // Skip if already processed
      if (teamMap.has(apiTeam.id)) {
        // Just link to this competition
        await db.insert(schema.teamSeasons).values({
          teamId: teamMap.get(apiTeam.id)!.id,
          competitionSeasonId: compSeason.id,
        }).onConflictDoNothing();
        continue;
      }

      // Insert venue if exists
      let venueId: string | null = null;
      if (apiTeam.venue) {
        const venueSlug = slugify(apiTeam.venue);
        if (!venueMap.has(venueSlug)) {
          const [venue] = await db.insert(schema.venues).values({
            name: apiTeam.venue,
            slug: venueSlug,
            city: apiTeam.address?.split(",")[0] || null,
            country: apiTeam.area?.name || null,
            capacity: null,
          }).onConflictDoNothing().returning();

          if (venue) {
            venueMap.set(venueSlug, venue);
            venueId = venue.id;
          }
        } else {
          venueId = venueMap.get(venueSlug)!.id;
        }
      }

      // Insert team
      const teamSlug = slugify(apiTeam.name);
      const [team] = await db.insert(schema.teams).values({
        name: apiTeam.name,
        shortName: apiTeam.shortName || apiTeam.tla,
        slug: teamSlug,
        country: apiTeam.area?.name || "Unknown",
        city: apiTeam.address?.split(",")[0] || null,
        foundedYear: apiTeam.founded,
        logoUrl: apiTeam.crest,
        primaryColor: apiTeam.clubColors?.split("/")[0]?.trim() || null,
        secondaryColor: apiTeam.clubColors?.split("/")[1]?.trim() || null,
      }).onConflictDoNothing().returning();

      if (!team) continue;

      teamMap.set(apiTeam.id, team);
      console.log(`   🏟️  ${team.name}`);

      // Link team to venue
      if (venueId) {
        await db.insert(schema.teamVenueHistory).values({
          teamId: team.id,
          venueId: venueId,
          validFrom: "2020-01-01",
        }).onConflictDoNothing();
      }

      // Link team to competition-season
      await db.insert(schema.teamSeasons).values({
        teamId: team.id,
        competitionSeasonId: compSeason.id,
      }).onConflictDoNothing();

      // Fetch squad (players)
      let squadData;
      try {
        squadData = await rateLimitedFetch(`${BASE_URL}/teams/${apiTeam.id}`);
      } catch {
        continue;
      }

      for (const apiPlayer of squadData.squad || []) {
        if (playerMap.has(apiPlayer.id)) continue;

        const playerSlug = slugify(apiPlayer.name);

        const [player] = await db.insert(schema.players).values({
          name: apiPlayer.name,
          knownAs: apiPlayer.name.split(" ").pop() || null,
          slug: playerSlug,
          dateOfBirth: apiPlayer.dateOfBirth,
          nationality: apiPlayer.nationality,
          position: mapPosition(apiPlayer.position),
          status: "active",
        }).onConflictDoNothing().returning();

        if (!player) continue;

        playerMap.set(apiPlayer.id, player);

        // Player-team history
        await db.insert(schema.playerTeamHistory).values({
          playerId: player.id,
          teamId: team.id,
          shirtNumber: null,
          validFrom: apiPlayer.dateOfBirth ? "2020-01-01" : "2023-01-01",
          transferType: "permanent",
        }).onConflictDoNothing();
      }
    }

    // Fetch standings
    try {
      const standingsData = await rateLimitedFetch(`${BASE_URL}/competitions/${compCode}/standings`);
      const tableStandings = standingsData.standings?.find((s: any) => s.type === "TOTAL")?.table || [];

      for (const row of tableStandings) {
        const team = teamMap.get(row.team.id);
        if (!team) continue;

        await db.insert(schema.standings).values({
          competitionSeasonId: compSeason.id,
          teamId: team.id,
          position: row.position,
          played: row.playedGames,
          won: row.won,
          drawn: row.draw,
          lost: row.lost,
          goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst,
          goalDifference: row.goalDifference,
          points: row.points,
          form: row.form || null,
        }).onConflictDoNothing();
      }
      console.log(`   📊 Standings loaded`);
    } catch {
      // Standings not available for this competition
    }

    // Fetch recent matches
    try {
      const matchesData = await rateLimitedFetch(
        `${BASE_URL}/competitions/${compCode}/matches?status=FINISHED&limit=20`
      );

      for (const apiMatch of matchesData.matches || []) {
        const homeTeam = teamMap.get(apiMatch.homeTeam.id);
        const awayTeam = teamMap.get(apiMatch.awayTeam.id);
        if (!homeTeam || !awayTeam) continue;

        await db.insert(schema.matches).values({
          competitionSeasonId: compSeason.id,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          matchday: apiMatch.matchday,
          scheduledAt: apiMatch.utcDate,
          status: "finished",
          homeScore: apiMatch.score?.fullTime?.home,
          awayScore: apiMatch.score?.fullTime?.away,
          referee: apiMatch.referees?.[0]?.name || null,
        }).onConflictDoNothing();
      }
      console.log(`   ⚽ Recent matches loaded`);
    } catch {
      // Matches not available
    }

    console.log("");
  }

  return { teamMap, playerMap, venueMap };
}

async function buildSearchIndex(
  competitions: (typeof schema.competitions.$inferSelect)[],
  teamMap: Map<number, typeof schema.teams.$inferSelect>,
  playerMap: Map<number, typeof schema.players.$inferSelect>,
  venueMap: Map<string, typeof schema.venues.$inferSelect>
) {
  console.log("🔍 Building search index...");

  const searchEntries: (typeof schema.searchIndex.$inferInsert)[] = [];

  // Add competitions
  for (const comp of competitions) {
    searchEntries.push({
      id: comp.id,
      entityType: "competition",
      slug: comp.slug,
      name: comp.name,
      subtitle: comp.country,
      meta: comp.type,
    });
  }

  // Add teams
  for (const team of teamMap.values()) {
    searchEntries.push({
      id: team.id,
      entityType: "team",
      slug: team.slug,
      name: team.name,
      subtitle: team.country,
      meta: team.city,
    });
  }

  // Add players
  for (const player of playerMap.values()) {
    searchEntries.push({
      id: player.id,
      entityType: "player",
      slug: player.slug,
      name: player.name,
      subtitle: player.nationality,
      meta: player.position,
    });
  }

  // Add venues
  for (const venue of venueMap.values()) {
    searchEntries.push({
      id: venue.id,
      entityType: "venue",
      slug: venue.slug,
      name: venue.name,
      subtitle: venue.city,
      meta: venue.country,
    });
  }

  // Insert in batches
  const batchSize = 100;
  for (let i = 0; i < searchEntries.length; i += batchSize) {
    const batch = searchEntries.slice(i, i + batchSize);
    await db.insert(schema.searchIndex).values(batch).onConflictDoNothing();
  }

  console.log(`✅ Indexed ${searchEntries.length} entities\n`);
}

async function main() {
  console.log("🚀 Football-Data.org Ingestion Script\n");
  console.log("⚠️  This will replace all existing data!\n");

  try {
    await clearDatabase();
    const seasons = await ingestSeasons();
    const competitions = await ingestCompetitions();
    const { teamMap, playerMap, venueMap } = await ingestTeamsAndPlayers(competitions, seasons);
    await buildSearchIndex(competitions, teamMap, playerMap, venueMap);

    console.log("🎉 Ingestion complete!");
    console.log(`   📊 ${competitions.length} competitions`);
    console.log(`   🏟️  ${teamMap.size} teams`);
    console.log(`   👤 ${playerMap.size} players`);
    console.log(`   🏠 ${venueMap.size} venues`);
  } catch (error) {
    console.error("❌ Ingestion failed:", error);
    process.exit(1);
  }
}

main();
