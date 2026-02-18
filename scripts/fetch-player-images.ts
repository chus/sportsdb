/**
 * Fetch player images from Wikipedia/Wikidata
 *
 * Uses Wikipedia API to search for player pages and extract main images.
 * Rate limited to 1 request per second to be respectful.
 *
 * Usage:
 *   npx tsx scripts/fetch-player-images.ts
 *   npx tsx scripts/fetch-player-images.ts --dry-run
 *   npx tsx scripts/fetch-player-images.ts --limit=100
 *   npx tsx scripts/fetch-player-images.ts --player="Lionel Messi"
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

interface WikipediaSearchResult {
  query?: {
    search?: Array<{
      title: string;
      pageid: number;
    }>;
  };
}

interface WikipediaPageResult {
  query?: {
    pages?: Record<
      string,
      {
        pageid: number;
        title: string;
        original?: { source: string };
        thumbnail?: { source: string };
      }
    >;
  };
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchWikipedia(playerName: string): Promise<number | null> {
  const searchQuery = `${playerName} footballer`;
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    searchQuery
  )}&format=json&srlimit=5`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "SportsDB/1.0 (https://sportsdb.com; contact@sportsdb.com)",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data: WikipediaSearchResult = await response.json();
    const results = data.query?.search || [];

    // Find the best match - prioritize exact name matches
    const normalizedName = playerName.toLowerCase();
    for (const result of results) {
      const resultName = result.title.toLowerCase();
      if (
        resultName.includes(normalizedName) ||
        normalizedName.includes(resultName.replace(/ \(.*\)$/, ""))
      ) {
        return result.pageid;
      }
    }

    // Return first result if no exact match
    return results[0]?.pageid || null;
  } catch (error) {
    console.error(`  Error searching Wikipedia for ${playerName}:`, error);
    return null;
  }
}

async function getPageImage(pageId: number): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageId}&prop=pageimages&piprop=original|thumbnail&pithumbsize=400&format=json`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "SportsDB/1.0 (https://sportsdb.com; contact@sportsdb.com)",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data: WikipediaPageResult = await response.json();
    const page = data.query?.pages?.[pageId.toString()];

    // Prefer original image, fall back to thumbnail
    return page?.original?.source || page?.thumbnail?.source || null;
  } catch (error) {
    console.error(`  Error getting page image:`, error);
    return null;
  }
}

async function fetchPlayerImage(playerName: string): Promise<string | null> {
  // Search for the player's Wikipedia page
  const pageId = await searchWikipedia(playerName);
  if (!pageId) {
    return null;
  }

  // Get the main image from the page
  await delay(500); // Rate limiting
  return getPageImage(pageId);
}

async function processPlayers(dryRun: boolean, limit: number, specificPlayer?: string) {
  let players;

  if (specificPlayer) {
    players = await sql`
      SELECT id, name, slug FROM players
      WHERE name ILIKE ${`%${specificPlayer}%`}
      LIMIT 10
    `;
  } else {
    // Get players without images
    players = await sql`
      SELECT id, name, slug FROM players
      WHERE image_url IS NULL
      ORDER BY name
      LIMIT ${limit}
    `;
  }

  console.log(`Found ${players.length} players to process`);

  let processed = 0;
  let updated = 0;
  let failed = 0;

  for (const player of players) {
    processed++;
    console.log(`[${processed}/${players.length}] ${player.name}...`);

    const imageUrl = await fetchPlayerImage(player.name);

    if (imageUrl) {
      console.log(`  ✓ Found image`);

      if (!dryRun) {
        await sql`
          UPDATE players SET image_url = ${imageUrl}
          WHERE id = ${player.id}
        `;
      } else {
        console.log(`  [DRY-RUN] Would update with: ${imageUrl.substring(0, 60)}...`);
      }
      updated++;
    } else {
      console.log(`  ✗ No image found`);
      failed++;
    }

    // Rate limiting: 1 request per second
    await delay(1000);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Processed: ${processed}`);
  console.log(`${dryRun ? "Would update" : "Updated"}: ${updated}`);
  console.log(`No image found: ${failed}`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 100;
const playerArg = args.find((a) => a.startsWith("--player="));
const specificPlayer = playerArg?.split("=")[1];

console.log("=== Player Image Fetcher ===");
console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
console.log(`Limit: ${specificPlayer ? "N/A (specific player)" : limit}`);
if (specificPlayer) {
  console.log(`Player: ${specificPlayer}`);
}
console.log("");

processPlayers(dryRun, limit, specificPlayer)
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
