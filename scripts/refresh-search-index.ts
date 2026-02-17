/**
 * Refresh Search Index
 *
 * Updates the search_index table with all players, teams, competitions, and venues.
 *
 * Usage: npx tsx scripts/refresh-search-index.ts
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";
import { sql as drizzleSql } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function main() {
  console.log("Refreshing Search Index");
  console.log("=".repeat(50));

  // Get all entities
  const [players, teams, competitions, venues] = await Promise.all([
    db.select().from(schema.players),
    db.select().from(schema.teams),
    db.select().from(schema.competitions),
    db.select().from(schema.venues),
  ]);

  console.log(`Found: ${players.length} players, ${teams.length} teams, ${competitions.length} competitions, ${venues.length} venues`);

  // Clear existing index
  await db.execute(drizzleSql`TRUNCATE TABLE search_index`);
  console.log("Cleared existing search index");

  // Build search entries
  const searchEntries = [
    ...players.map((p) => ({
      id: p.id,
      entityType: "player" as const,
      slug: p.slug,
      name: p.name,
      subtitle: p.nationality,
      meta: p.position,
    })),
    ...teams.map((t) => ({
      id: t.id,
      entityType: "team" as const,
      slug: t.slug,
      name: t.name,
      subtitle: t.country,
      meta: t.city,
    })),
    ...competitions.map((c) => ({
      id: c.id,
      entityType: "competition" as const,
      slug: c.slug,
      name: c.name,
      subtitle: c.country,
      meta: c.type,
    })),
    ...venues.map((v) => ({
      id: v.id,
      entityType: "venue" as const,
      slug: v.slug,
      name: v.name,
      subtitle: v.city,
      meta: v.country,
    })),
  ];

  // Insert in batches
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < searchEntries.length; i += BATCH_SIZE) {
    const batch = searchEntries.slice(i, i + BATCH_SIZE);
    await db.insert(schema.searchIndex).values(batch);
    inserted += batch.length;
    process.stdout.write(`\rInserted ${inserted}/${searchEntries.length} entries`);
  }

  console.log("\n" + "=".repeat(50));
  console.log(`Search index refreshed with ${searchEntries.length} entries`);
}

main().catch((err) => {
  console.error("Failed to refresh search index:", err);
  process.exit(1);
});
