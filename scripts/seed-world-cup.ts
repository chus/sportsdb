/**
 * Seed World Cup 2026 Data
 *
 * Seeds the FIFA World Cup 2026 competition, teams, groups, and venues.
 * This is additive — it won't clear existing data.
 *
 * Usage: npx tsx scripts/seed-world-cup.ts
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";
import { eq, and } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// All 48 teams for the 2026 World Cup
const WORLD_CUP_TEAMS = [
  // Group A
  { name: "United States", shortName: "USA", country: "United States", group: "A" },
  { name: "Morocco", shortName: "MAR", country: "Morocco", group: "A" },
  { name: "Scotland", shortName: "SCO", country: "Scotland", group: "A" },
  { name: "Argentina", shortName: "ARG", country: "Argentina", group: "A" },
  // Group B
  { name: "France", shortName: "FRA", country: "France", group: "B" },
  { name: "Denmark", shortName: "DEN", country: "Denmark", group: "B" },
  { name: "Australia", shortName: "AUS", country: "Australia", group: "B" },
  { name: "Indonesia", shortName: "IDN", country: "Indonesia", group: "B" },
  // Group C
  { name: "Mexico", shortName: "MEX", country: "Mexico", group: "C" },
  { name: "Ecuador", shortName: "ECU", country: "Ecuador", group: "C" },
  { name: "Senegal", shortName: "SEN", country: "Senegal", group: "C" },
  { name: "Wales", shortName: "WAL", country: "Wales", group: "C" },
  // Group D
  { name: "Brazil", shortName: "BRA", country: "Brazil", group: "D" },
  { name: "Colombia", shortName: "COL", country: "Colombia", group: "D" },
  { name: "Cameroon", shortName: "CMR", country: "Cameroon", group: "D" },
  { name: "Bahrain", shortName: "BHR", country: "Bahrain", group: "D" },
  // Group E
  { name: "England", shortName: "ENG", country: "England", group: "E" },
  { name: "Serbia", shortName: "SRB", country: "Serbia", group: "E" },
  { name: "Canada", shortName: "CAN", country: "Canada", group: "E" },
  { name: "Bolivia", shortName: "BOL", country: "Bolivia", group: "E" },
  // Group F
  { name: "Germany", shortName: "GER", country: "Germany", group: "F" },
  { name: "Uruguay", shortName: "URU", country: "Uruguay", group: "F" },
  { name: "Japan", shortName: "JPN", country: "Japan", group: "F" },
  { name: "Honduras", shortName: "HON", country: "Honduras", group: "F" },
  // Group G
  { name: "Spain", shortName: "ESP", country: "Spain", group: "G" },
  { name: "Paraguay", shortName: "PAR", country: "Paraguay", group: "G" },
  { name: "Iran", shortName: "IRN", country: "Iran", group: "G" },
  { name: "South Korea", shortName: "KOR", country: "South Korea", group: "G" },
  // Group H
  { name: "Portugal", shortName: "POR", country: "Portugal", group: "H" },
  { name: "Ivory Coast", shortName: "CIV", country: "Ivory Coast", group: "H" },
  { name: "Saudi Arabia", shortName: "KSA", country: "Saudi Arabia", group: "H" },
  { name: "Panama", shortName: "PAN", country: "Panama", group: "H" },
  // Group I
  { name: "Netherlands", shortName: "NED", country: "Netherlands", group: "I" },
  { name: "Belgium", shortName: "BEL", country: "Belgium", group: "I" },
  { name: "Nigeria", shortName: "NGA", country: "Nigeria", group: "I" },
  { name: "Costa Rica", shortName: "CRC", country: "Costa Rica", group: "I" },
  // Group J
  { name: "Italy", shortName: "ITA", country: "Italy", group: "J" },
  { name: "Egypt", shortName: "EGY", country: "Egypt", group: "J" },
  { name: "Peru", shortName: "PER", country: "Peru", group: "J" },
  { name: "Qatar", shortName: "QAT", country: "Qatar", group: "J" },
  // Group K
  { name: "Croatia", shortName: "CRO", country: "Croatia", group: "K" },
  { name: "Ghana", shortName: "GHA", country: "Ghana", group: "K" },
  { name: "Chile", shortName: "CHI", country: "Chile", group: "K" },
  { name: "Jamaica", shortName: "JAM", country: "Jamaica", group: "K" },
  // Group L
  { name: "Switzerland", shortName: "SUI", country: "Switzerland", group: "L" },
  { name: "Algeria", shortName: "ALG", country: "Algeria", group: "L" },
  { name: "Venezuela", shortName: "VEN", country: "Venezuela", group: "L" },
  { name: "New Zealand", shortName: "NZL", country: "New Zealand", group: "L" },
];

// Host venues
const VENUES = [
  // USA (11 venues)
  { name: "MetLife Stadium", city: "East Rutherford", country: "United States", capacity: 82500, lat: "40.813528", lng: "-74.074361" },
  { name: "AT&T Stadium", city: "Arlington", country: "United States", capacity: 80000, lat: "32.747778", lng: "-97.092778" },
  { name: "SoFi Stadium", city: "Inglewood", country: "United States", capacity: 70240, lat: "33.953333", lng: "-118.339167" },
  { name: "NRG Stadium", city: "Houston", country: "United States", capacity: 72220, lat: "29.684722", lng: "-95.410833" },
  { name: "Hard Rock Stadium", city: "Miami Gardens", country: "United States", capacity: 64767, lat: "25.958056", lng: "-80.238889" },
  { name: "Mercedes-Benz Stadium", city: "Atlanta", country: "United States", capacity: 71000, lat: "33.755556", lng: "-84.400833" },
  { name: "Lincoln Financial Field", city: "Philadelphia", country: "United States", capacity: 69176, lat: "39.900556", lng: "-75.1675" },
  { name: "Lumen Field", city: "Seattle", country: "United States", capacity: 68740, lat: "47.595278", lng: "-122.331667" },
  { name: "Levi's Stadium", city: "Santa Clara", country: "United States", capacity: 68500, lat: "37.403333", lng: "-121.97" },
  { name: "Gillette Stadium", city: "Foxborough", country: "United States", capacity: 65878, lat: "42.090944", lng: "-71.264344" },
  { name: "Arrowhead Stadium", city: "Kansas City", country: "United States", capacity: 76416, lat: "39.048889", lng: "-94.484444" },
  // Mexico (3 venues)
  { name: "Estadio Azteca", city: "Mexico City", country: "Mexico", capacity: 87523, lat: "19.302778", lng: "-99.150556" },
  { name: "Estadio BBVA", city: "Monterrey", country: "Mexico", capacity: 53460, lat: "25.670278", lng: "-100.243889" },
  { name: "Estadio Akron", city: "Guadalajara", country: "Mexico", capacity: 49850, lat: "20.680278", lng: "-103.462222" },
  // Canada (2 venues)
  { name: "BMO Field", city: "Toronto", country: "Canada", capacity: 30991, lat: "43.633056", lng: "-79.418611" },
  { name: "BC Place", city: "Vancouver", country: "Canada", capacity: 54500, lat: "49.276667", lng: "-123.111944" },
];

async function seed() {
  console.log("Starting World Cup 2026 seed...\n");

  // 1. Ensure the 2025/26 season exists
  const [season] = await db
    .select()
    .from(schema.seasons)
    .where(eq(schema.seasons.isCurrent, true))
    .limit(1);

  if (!season) {
    console.error("No current season found. Run the main ingestion script first.");
    process.exit(1);
  }
  console.log(`Using season: ${season.label} (${season.id})\n`);

  // 2. Create the World Cup competition
  console.log("Creating FIFA World Cup 2026 competition...");
  const [wcCompetition] = await db
    .insert(schema.competitions)
    .values({
      name: "FIFA World Cup 2026",
      slug: "fifa-world-cup-2026",
      country: "World",
      type: "international",
      foundedYear: 1930,
      description:
        "The 23rd FIFA World Cup, jointly hosted by the United States, Mexico, and Canada. The first World Cup with 48 teams.",
    })
    .onConflictDoNothing()
    .returning();

  let competitionId: string;
  if (wcCompetition) {
    competitionId = wcCompetition.id;
    console.log(`  Created competition: ${wcCompetition.id}\n`);
  } else {
    const [existing] = await db
      .select()
      .from(schema.competitions)
      .where(eq(schema.competitions.slug, "fifa-world-cup-2026"))
      .limit(1);
    competitionId = existing.id;
    console.log(`  Competition already exists: ${competitionId}\n`);
  }

  // 3. Create competition_season
  console.log("Creating competition season...");
  const [compSeason] = await db
    .insert(schema.competitionSeasons)
    .values({
      competitionId,
      seasonId: season.id,
      status: "scheduled",
    })
    .onConflictDoNothing()
    .returning();

  let compSeasonId: string;
  if (compSeason) {
    compSeasonId = compSeason.id;
    console.log(`  Created competition season: ${compSeasonId}\n`);
  } else {
    const [existing] = await db
      .select()
      .from(schema.competitionSeasons)
      .where(
        and(
          eq(schema.competitionSeasons.competitionId, competitionId),
          eq(schema.competitionSeasons.seasonId, season.id)
        )
      )
      .limit(1);
    compSeasonId = existing.id;
    console.log(`  Competition season already exists: ${compSeasonId}\n`);
  }

  // 4. Insert national teams
  console.log("Inserting national teams...");
  const teamMap: Record<string, string> = {};
  for (const t of WORLD_CUP_TEAMS) {
    const teamSlug = slugify(`${t.country}-national-team`);
    const [inserted] = await db
      .insert(schema.teams)
      .values({
        name: `${t.country}`,
        shortName: t.shortName,
        slug: teamSlug,
        country: t.country,
        tier: 1,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted) {
      teamMap[t.shortName] = inserted.id;
    } else {
      const [existing] = await db
        .select()
        .from(schema.teams)
        .where(eq(schema.teams.slug, teamSlug))
        .limit(1);
      if (existing) teamMap[t.shortName] = existing.id;
    }
  }
  console.log(`  Processed ${Object.keys(teamMap).length} teams\n`);

  // 5. Create standings (group stage tables)
  console.log("Creating group stage standings...");
  let standingsCount = 0;
  const groups = [...new Set(WORLD_CUP_TEAMS.map((t) => t.group))];

  for (const group of groups) {
    const groupTeams = WORLD_CUP_TEAMS.filter((t) => t.group === group);
    for (let i = 0; i < groupTeams.length; i++) {
      const teamId = teamMap[groupTeams[i].shortName];
      if (!teamId) continue;

      await db
        .insert(schema.standings)
        .values({
          competitionSeasonId: compSeasonId,
          teamId,
          position: i + 1,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          points: 0,
          form: group, // Store group letter in form field for grouping
        })
        .onConflictDoNothing();
      standingsCount++;
    }
  }
  console.log(`  Created ${standingsCount} standing entries across ${groups.length} groups\n`);

  // 6. Create team_seasons
  console.log("Creating team season entries...");
  for (const teamId of Object.values(teamMap)) {
    await db
      .insert(schema.teamSeasons)
      .values({
        teamId,
        competitionSeasonId: compSeasonId,
      })
      .onConflictDoNothing();
  }
  console.log(`  Created team season entries\n`);

  // 7. Insert venues
  console.log("Inserting host venues...");
  let venueCount = 0;
  for (const v of VENUES) {
    const venueSlug = slugify(v.name);
    const [inserted] = await db
      .insert(schema.venues)
      .values({
        name: v.name,
        slug: venueSlug,
        city: v.city,
        country: v.country,
        capacity: v.capacity,
        latitude: v.lat,
        longitude: v.lng,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted) venueCount++;
  }
  console.log(`  Created ${venueCount} new venues\n`);

  // 8. Add to search index
  console.log("Updating search index...");
  await db
    .insert(schema.searchIndex)
    .values({
      id: competitionId,
      entityType: "competition",
      slug: "fifa-world-cup-2026",
      name: "FIFA World Cup 2026",
      subtitle: "United States, Mexico, Canada",
      meta: "world cup 2026 fifa football soccer international tournament",
    })
    .onConflictDoNothing();

  for (const t of WORLD_CUP_TEAMS) {
    const teamId = teamMap[t.shortName];
    if (!teamId) continue;
    await db
      .insert(schema.searchIndex)
      .values({
        id: teamId,
        entityType: "team",
        slug: slugify(`${t.country}-national-team`),
        name: t.country,
        subtitle: `National Team · Group ${t.group}`,
        meta: `${t.country} ${t.shortName} world cup 2026 national team football`,
      })
      .onConflictDoNothing();
  }
  console.log("  Search index updated\n");

  console.log("World Cup 2026 seed complete!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
