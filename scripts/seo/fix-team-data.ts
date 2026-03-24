/**
 * Fix team data quality issues for SEO
 *
 * 1. Set city = NULL where city is numeric (data quality bug from API)
 * 2. Set short_name = NULL where length = 15 (truncated from API limit)
 *
 * Usage:
 *   DATABASE_URL=xxx npx tsx scripts/seo/fix-team-data.ts
 *   DATABASE_URL=xxx npx tsx scripts/seo/fix-team-data.ts --dry-run
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(`\nTeam Data Quality Fix${dryRun ? " (DRY RUN)" : ""}\n`);

  // 1. Find teams with numeric city values
  const numericCities = await sql`
    SELECT id, name, city FROM teams WHERE city ~ '^\d+$'
  `;
  console.log(`Teams with numeric city: ${numericCities.length}`);
  for (const t of numericCities) {
    console.log(`  - ${t.name}: city="${t.city}"`);
  }

  if (!dryRun && numericCities.length > 0) {
    await sql`UPDATE teams SET city = NULL WHERE city ~ '^\d+$'`;
    console.log(`  Fixed: set ${numericCities.length} cities to NULL`);
  }

  // 2. Find teams with truncated short_name (exactly 15 chars = API limit)
  const truncatedNames = await sql`
    SELECT id, name, short_name FROM teams WHERE length(short_name) = 15
  `;
  console.log(`\nTeams with truncated short_name (15 chars): ${truncatedNames.length}`);
  for (const t of truncatedNames) {
    console.log(`  - ${t.name}: short_name="${t.short_name}"`);
  }

  if (!dryRun && truncatedNames.length > 0) {
    await sql`UPDATE teams SET short_name = NULL WHERE length(short_name) = 15`;
    console.log(`  Fixed: set ${truncatedNames.length} short_names to NULL`);
  }

  // 3. Report teams with no country
  const noCountry = await sql`
    SELECT id, name FROM teams WHERE country IS NULL
  `;
  console.log(`\nTeams with no country: ${noCountry.length}`);
  for (const t of noCountry.slice(0, 10)) {
    console.log(`  - ${t.name}`);
  }
  if (noCountry.length > 10) console.log(`  ... and ${noCountry.length - 10} more`);

  // 4. Report teams with no logo
  const noLogo = await sql`
    SELECT id, name FROM teams WHERE logo_url IS NULL
  `;
  console.log(`\nTeams with no logo: ${noLogo.length}`);

  console.log("\nDone!");
}

main().catch(console.error);
