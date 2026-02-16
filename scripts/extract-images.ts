/**
 * Wikimedia Image Extraction Script
 *
 * Queries Wikipedia/Wikidata APIs to extract images for players, teams, and venues.
 * Uses Wikidata's P18 (image) property to get high-quality images.
 *
 * Usage: npx tsx scripts/extract-images.ts
 *
 * Rate limiting: 200 req/min (~300ms delay between requests)
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";
import { eq, isNull, or } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

// Rate limiting - 300ms between requests (200 req/min)
const RATE_LIMIT_MS = 300;
let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
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
      Accept: "application/json",
    },
  });

  return response;
}

/**
 * Get Wikidata entity ID from a Wikipedia article title
 */
async function getWikidataId(
  wikipediaTitle: string
): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
    wikipediaTitle
  )}&prop=pageprops&ppprop=wikibase_item&format=json`;

  try {
    const response = await rateLimitedFetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const pages = data.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0] as any;
    return page?.pageprops?.wikibase_item || null;
  } catch {
    return null;
  }
}

/**
 * Get image filename from Wikidata entity using P18 (image) property
 */
async function getWikidataImage(
  wikidataId: string
): Promise<string | null> {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${wikidataId}&property=P18&format=json`;

  try {
    const response = await rateLimitedFetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const claims = data.claims?.P18;
    if (!claims || claims.length === 0) return null;

    const imageValue = claims[0]?.mainsnak?.datavalue?.value;
    return imageValue || null;
  } catch {
    return null;
  }
}

/**
 * Construct Wikimedia Commons URL from filename
 */
function getWikimediaUrl(filename: string, width: number = 300): string {
  const encodedFilename = encodeURIComponent(filename.replace(/ /g, "_"));
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodedFilename}?width=${width}`;
}

/**
 * Search Wikipedia for an entity and get its image
 */
async function searchAndGetImage(
  searchQuery: string,
  entityType: "player" | "team" | "venue"
): Promise<string | null> {
  // Add football context to search
  let contextualizedQuery = searchQuery;
  if (entityType === "player") {
    contextualizedQuery = `${searchQuery} footballer`;
  } else if (entityType === "team") {
    contextualizedQuery = `${searchQuery} football club`;
  } else if (entityType === "venue") {
    contextualizedQuery = `${searchQuery} stadium`;
  }

  // Search Wikipedia
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    contextualizedQuery
  )}&srlimit=1&format=json`;

  try {
    const searchResponse = await rateLimitedFetch(searchUrl);
    if (!searchResponse.ok) return null;

    const searchData = await searchResponse.json();
    const searchResults = searchData.query?.search;
    if (!searchResults || searchResults.length === 0) return null;

    const title = searchResults[0].title;

    // Get Wikidata ID
    const wikidataId = await getWikidataId(title);
    if (!wikidataId) return null;

    // Get image from Wikidata
    const imageFilename = await getWikidataImage(wikidataId);
    if (!imageFilename) return null;

    return getWikimediaUrl(imageFilename);
  } catch {
    return null;
  }
}

async function updatePlayerImages() {
  console.log("\n👤 Extracting player images...");

  // Get players without images
  const playersWithoutImages = await db
    .select()
    .from(schema.players)
    .where(isNull(schema.players.imageUrl));

  console.log(`   Found ${playersWithoutImages.length} players without images`);

  let updated = 0;
  let failed = 0;

  for (const player of playersWithoutImages) {
    process.stdout.write(`   Processing: ${player.name}...`);

    const imageUrl = await searchAndGetImage(player.name, "player");

    if (imageUrl) {
      await db
        .update(schema.players)
        .set({ imageUrl, updatedAt: new Date() })
        .where(eq(schema.players.id, player.id));
      updated++;
      console.log(" ✅");
    } else {
      failed++;
      console.log(" ❌");
    }
  }

  console.log(`   Updated: ${updated}, Failed: ${failed}`);
  return { updated, failed };
}

async function updateTeamImages() {
  console.log("\n⚽ Extracting team logo images...");

  // Get teams without logo images
  const teamsWithoutImages = await db
    .select()
    .from(schema.teams)
    .where(isNull(schema.teams.logoUrl));

  console.log(`   Found ${teamsWithoutImages.length} teams without logos`);

  let updated = 0;
  let failed = 0;

  for (const team of teamsWithoutImages) {
    process.stdout.write(`   Processing: ${team.name}...`);

    const imageUrl = await searchAndGetImage(team.name, "team");

    if (imageUrl) {
      await db
        .update(schema.teams)
        .set({ logoUrl: imageUrl, updatedAt: new Date() })
        .where(eq(schema.teams.id, team.id));
      updated++;
      console.log(" ✅");
    } else {
      failed++;
      console.log(" ❌");
    }
  }

  console.log(`   Updated: ${updated}, Failed: ${failed}`);
  return { updated, failed };
}

async function updateVenueImages() {
  console.log("\n🏟️  Extracting venue images...");

  // Get venues without images
  const venuesWithoutImages = await db
    .select()
    .from(schema.venues)
    .where(isNull(schema.venues.imageUrl));

  console.log(`   Found ${venuesWithoutImages.length} venues without images`);

  let updated = 0;
  let failed = 0;

  for (const venue of venuesWithoutImages) {
    process.stdout.write(`   Processing: ${venue.name}...`);

    const imageUrl = await searchAndGetImage(venue.name, "venue");

    if (imageUrl) {
      await db
        .update(schema.venues)
        .set({ imageUrl, updatedAt: new Date() })
        .where(eq(schema.venues.id, venue.id));
      updated++;
      console.log(" ✅");
    } else {
      failed++;
      console.log(" ❌");
    }
  }

  console.log(`   Updated: ${updated}, Failed: ${failed}`);
  return { updated, failed };
}

async function main() {
  console.log("🖼️  Wikimedia Image Extraction");
  console.log("═".repeat(50));
  console.log("Extracting images from Wikipedia/Wikidata...");
  console.log("Rate limit: ~200 requests/minute\n");

  const playerResults = await updatePlayerImages();
  const teamResults = await updateTeamImages();
  const venueResults = await updateVenueImages();

  console.log("\n" + "═".repeat(50));
  console.log("📊 Summary:");
  console.log(
    `   Players: ${playerResults.updated} updated, ${playerResults.failed} failed`
  );
  console.log(
    `   Teams: ${teamResults.updated} updated, ${teamResults.failed} failed`
  );
  console.log(
    `   Venues: ${venueResults.updated} updated, ${venueResults.failed} failed`
  );
  console.log(
    `   Total: ${playerResults.updated + teamResults.updated + venueResults.updated} images extracted`
  );
}

main().catch((err) => {
  console.error("❌ Image extraction failed:", err);
  process.exit(1);
});
