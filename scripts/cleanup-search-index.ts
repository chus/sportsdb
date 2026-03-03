import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function cleanup() {
  console.log("=== Search Index Cleanup ===\n");

  // 1. Remove Unknown-position players from search index
  const removed = await sql`
    DELETE FROM search_index
    WHERE entity_type = 'player'
    AND id IN (SELECT id FROM players WHERE position = 'Unknown')
  `;
  console.log(`Removed ${removed.length} Unknown-position players from search index`);

  // 2. Verify
  const [check] = await sql`
    SELECT count(*) FROM search_index WHERE entity_type = 'player'
    AND id IN (SELECT id FROM players WHERE position = 'Unknown')
  `;
  console.log(`Remaining Unknown in search index: ${check.count}`);

  // 3. Check for players with bad names
  const badNames = await sql`
    SELECT id, name, slug FROM players WHERE name IS NULL OR name = '' OR name = 'Unknown'
  `;
  console.log(`\nPlayers with bad names: ${badNames.length}`);
  for (const p of badNames) {
    console.log(`  ${p.id}: "${p.name}" (${p.slug})`);
  }

  // 4. Check for duplicate slugs that might cause issues
  const dupes = await sql`
    SELECT slug, count(*) as cnt FROM players GROUP BY slug HAVING count(*) > 1 ORDER BY cnt DESC LIMIT 20
  `;
  if (dupes.length > 0) {
    console.log(`\nDuplicate slugs: ${dupes.length}`);
    for (const d of dupes) {
      console.log(`  ${d.slug}: ${d.cnt} duplicates`);
    }
  } else {
    console.log("\nNo duplicate slugs found");
  }

  // 5. Summary of search index
  const indexStats = await sql`
    SELECT entity_type, count(*) FROM search_index GROUP BY entity_type ORDER BY count DESC
  `;
  console.log("\nSearch index breakdown:");
  for (const row of indexStats) {
    console.log(`  ${row.entity_type}: ${row.count}`);
  }

  console.log("\n=== Done ===");
}

cleanup().catch(console.error);
