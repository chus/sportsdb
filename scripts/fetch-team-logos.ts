/**
 * Fetch team logos from Wikipedia/Wikidata
 *
 * Uses Wikipedia API to search for team pages and extract logos/crests.
 * Rate limited to 1 request per second to be respectful.
 *
 * Usage:
 *   npx tsx scripts/fetch-team-logos.ts
 *   npx tsx scripts/fetch-team-logos.ts --dry-run
 *   npx tsx scripts/fetch-team-logos.ts --limit=50
 *   npx tsx scripts/fetch-team-logos.ts --team="Manchester United"
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
        images?: Array<{ title: string }>;
      }
    >;
  };
}

interface WikipediaImageInfoResult {
  query?: {
    pages?: Record<
      string,
      {
        imageinfo?: Array<{
          url: string;
          descriptionurl: string;
        }>;
      }
    >;
  };
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchWikipedia(teamName: string, country: string): Promise<number | null> {
  // Try different search queries
  const queries = [
    `${teamName} F.C.`,
    `${teamName} football club`,
    `${teamName} ${country} football`,
    teamName,
  ];

  for (const searchQuery of queries) {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      searchQuery
    )}&format=json&srlimit=5`;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "SportsDB/1.0 (https://sportsdb.com; contact@sportsdb.com)",
        },
      });

      if (!response.ok) continue;

      const data: WikipediaSearchResult = await response.json();
      const results = data.query?.search || [];

      // Find the best match - look for football club pages
      for (const result of results) {
        const title = result.title.toLowerCase();
        const normalizedName = teamName.toLowerCase();

        if (
          (title.includes(normalizedName) || normalizedName.includes(title.split(" ")[0])) &&
          (title.includes("f.c.") ||
            title.includes("fc") ||
            title.includes("football") ||
            title.includes("club"))
        ) {
          return result.pageid;
        }
      }

      // Try first result if it looks like a football club
      if (results.length > 0) {
        const firstTitle = results[0].title.toLowerCase();
        if (
          firstTitle.includes("f.c.") ||
          firstTitle.includes("fc") ||
          firstTitle.includes("football")
        ) {
          return results[0].pageid;
        }
      }
    } catch (error) {
      continue;
    }

    await delay(300);
  }

  return null;
}

async function getPageImages(pageId: number): Promise<string[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageId}&prop=images&format=json`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "SportsDB/1.0 (https://sportsdb.com; contact@sportsdb.com)",
      },
    });

    if (!response.ok) return [];

    const data: WikipediaPageResult = await response.json();
    const page = data.query?.pages?.[pageId.toString()];

    return page?.images?.map((img) => img.title) || [];
  } catch (error) {
    return [];
  }
}

async function getImageUrl(imageTitle: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
    imageTitle
  )}&prop=imageinfo&iiprop=url&format=json`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "SportsDB/1.0 (https://sportsdb.com; contact@sportsdb.com)",
      },
    });

    if (!response.ok) return null;

    const data: WikipediaImageInfoResult = await response.json();
    const pages = data.query?.pages;

    if (!pages) return null;

    const page = Object.values(pages)[0];
    return page?.imageinfo?.[0]?.url || null;
  } catch (error) {
    return null;
  }
}

async function fetchTeamLogo(teamName: string, country: string): Promise<string | null> {
  // Search for the team's Wikipedia page
  const pageId = await searchWikipedia(teamName, country);
  if (!pageId) {
    return null;
  }

  await delay(300);

  // Get all images from the page
  const images = await getPageImages(pageId);

  // Look for logo/crest images
  const logoKeywords = ["logo", "crest", "badge", "emblem", "shield", "escudo"];
  const logoImages = images.filter((img) => {
    const lower = img.toLowerCase();
    return logoKeywords.some((keyword) => lower.includes(keyword));
  });

  // Try to get the logo image URL
  for (const logoImage of logoImages) {
    await delay(300);
    const url = await getImageUrl(logoImage);
    if (url && (url.endsWith(".png") || url.endsWith(".svg"))) {
      return url;
    }
  }

  // Fallback: try the main page image
  const mainImageUrl = `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageId}&prop=pageimages&piprop=original&format=json`;

  try {
    const response = await fetch(mainImageUrl, {
      headers: {
        "User-Agent": "SportsDB/1.0 (https://sportsdb.com; contact@sportsdb.com)",
      },
    });

    if (response.ok) {
      const data: WikipediaPageResult = await response.json();
      const page = data.query?.pages?.[pageId.toString()];
      const imageUrl = page?.original?.source;

      // Only use if it looks like a logo (not a stadium or photo)
      if (imageUrl && (imageUrl.includes("logo") || imageUrl.includes("crest"))) {
        return imageUrl;
      }
    }
  } catch (error) {
    // Ignore
  }

  return null;
}

async function processTeams(dryRun: boolean, limit: number, specificTeam?: string) {
  let teams;

  if (specificTeam) {
    teams = await sql`
      SELECT id, name, slug, country FROM teams
      WHERE name ILIKE ${`%${specificTeam}%`}
      LIMIT 10
    `;
  } else {
    // Get teams without logos
    teams = await sql`
      SELECT id, name, slug, country FROM teams
      WHERE logo_url IS NULL
      ORDER BY name
      LIMIT ${limit}
    `;
  }

  console.log(`Found ${teams.length} teams to process`);

  let processed = 0;
  let updated = 0;
  let failed = 0;

  for (const team of teams) {
    processed++;
    console.log(`[${processed}/${teams.length}] ${team.name} (${team.country})...`);

    const logoUrl = await fetchTeamLogo(team.name, team.country);

    if (logoUrl) {
      console.log(`  ✓ Found logo`);

      if (!dryRun) {
        await sql`
          UPDATE teams SET logo_url = ${logoUrl}
          WHERE id = ${team.id}
        `;
      } else {
        console.log(`  [DRY-RUN] Would update with: ${logoUrl.substring(0, 60)}...`);
      }
      updated++;
    } else {
      console.log(`  ✗ No logo found`);
      failed++;
    }

    // Rate limiting
    await delay(1000);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Processed: ${processed}`);
  console.log(`${dryRun ? "Would update" : "Updated"}: ${updated}`);
  console.log(`No logo found: ${failed}`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 50;
const teamArg = args.find((a) => a.startsWith("--team="));
const specificTeam = teamArg?.split("=")[1];

console.log("=== Team Logo Fetcher ===");
console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
console.log(`Limit: ${specificTeam ? "N/A (specific team)" : limit}`);
if (specificTeam) {
  console.log(`Team: ${specificTeam}`);
}
console.log("");

processTeams(dryRun, limit, specificTeam)
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
