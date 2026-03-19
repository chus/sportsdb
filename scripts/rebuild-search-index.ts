/**
 * Rebuild Search Index
 *
 * Truncates and repopulates the search_index table from all entity tables.
 * Run this whenever search results are missing or stale.
 *
 * Usage:
 *   npx tsx scripts/rebuild-search-index.ts
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL in .env.local");
  process.exit(1);
}

const client = neon(DATABASE_URL);
const db = drizzle(client, { schema });

async function main() {
  console.log("Rebuild Search Index");
  console.log("=".repeat(50));

  const [players, teams, competitions, venues] = await Promise.all([
    db.select().from(schema.players),
    db.select().from(schema.teams),
    db.select().from(schema.competitions),
    db.select().from(schema.venues),
  ]);

  console.log(
    `Found: ${players.length} players, ${teams.length} teams, ${competitions.length} competitions, ${venues.length} venues`
  );

  await db.execute(sql`TRUNCATE TABLE search_index`);
  console.log("Truncated search_index");

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

  const BATCH_SIZE = 500;
  for (let i = 0; i < searchEntries.length; i += BATCH_SIZE) {
    const batch = searchEntries.slice(i, i + BATCH_SIZE);
    await db.insert(schema.searchIndex).values(batch);
    console.log(`Inserted ${Math.min(i + BATCH_SIZE, searchEntries.length)}/${searchEntries.length}`);
  }

  console.log(`\nDone — ${searchEntries.length} entries in search_index`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
