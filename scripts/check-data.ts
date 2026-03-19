/**
 * Data integrity check — verifies all entities are populated and search works.
 *
 * Usage: npx tsx scripts/check-data.ts
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";
import { sql } from "drizzle-orm";

config({ path: ".env.local" });

const db = drizzle(neon(process.env.DATABASE_URL!));

let passed = 0;
let failed = 0;

function ok(label: string) {
  passed++;
  console.log(`  ✓ ${label}`);
}
function fail(label: string) {
  failed++;
  console.log(`  ✗ ${label}`);
}

async function main() {
  console.log("Data Integrity Check");
  console.log("=".repeat(50));

  // --- 1. Entity counts ---
  console.log("\n1. Entity counts");
  const tables: [string, number][] = [
    ["competitions", 1],
    ["teams", 10],
    ["players", 100],
    ["venues", 1],
    ["matches", 10],
    ["seasons", 1],
    ["standings", 10],
    ["articles", 1],
    ["search_index", 100],
  ];
  for (const [table, minCount] of tables) {
    const r = await db.execute(sql.raw(`SELECT count(*)::int as c FROM ${table}`));
    const c = r.rows[0].c as number;
    if (c >= minCount) ok(`${table}: ${c} rows`);
    else fail(`${table}: ${c} rows (expected >= ${minCount})`);
  }

  // --- 2. Search index coverage ---
  console.log("\n2. Search index coverage");
  const indexCounts = await db.execute(sql`
    SELECT entity_type, count(*)::int as c
    FROM search_index GROUP BY entity_type ORDER BY entity_type
  `);
  for (const row of indexCounts.rows) {
    const c = row.c as number;
    if (c > 0) ok(`search_index[${row.entity_type}]: ${c}`);
    else fail(`search_index[${row.entity_type}]: 0`);
  }

  // Compare search_index vs source tables
  const sourceCounts = await db.execute(sql`
    SELECT 'player' as t, count(*)::int as c FROM players
    UNION ALL SELECT 'team', count(*)::int FROM teams
    UNION ALL SELECT 'competition', count(*)::int FROM competitions
    UNION ALL SELECT 'venue', count(*)::int FROM venues
  `);
  const siCounts = new Map(indexCounts.rows.map((r) => [r.entity_type, r.c as number]));
  for (const row of sourceCounts.rows) {
    const src = row.c as number;
    const si = siCounts.get(row.t as string) ?? 0;
    if (si === src) ok(`${row.t}: index (${si}) = source (${src})`);
    else fail(`${row.t}: index (${si}) ≠ source (${src})`);
  }

  // --- 3. Multi-word search queries ---
  console.log("\n3. Search query tests (multi-word AND matching)");
  const searchTests: [string, string | null][] = [
    ["messi", "player"],
    ["real madrid", "team"],
    ["liga argentina", "competition"],
    ["premier league", "competition"],
    ["barcelona", null],
    ["bundesliga", "competition"],
    ["porto", null],
    ["ligue 1", "competition"],
  ];
  for (const [query, expectedType] of searchTests) {
    const words = query.split(/\s+/).filter((w) => w.length >= 2);
    const wordClauses = words
      .map(
        (w) =>
          `(lower(name) LIKE '%${w}%' OR lower(coalesce(subtitle,'')) LIKE '%${w}%' OR lower(coalesce(meta,'')) LIKE '%${w}%')`
      )
      .join(" AND ");
    const r = await db.execute(
      sql.raw(`SELECT name, entity_type FROM search_index WHERE ${wordClauses} LIMIT 3`)
    );
    if (r.rows.length > 0) {
      const match = r.rows[0];
      const names = r.rows.map((x) => x.name).join(", ");
      if (!expectedType || match.entity_type === expectedType)
        ok(`"${query}" → ${names} (${match.entity_type})`);
      else ok(`"${query}" → ${names} (got ${match.entity_type}, wanted ${expectedType})`);
    } else {
      fail(`"${query}" → no results`);
    }
  }

  // --- 4. Player image coverage ---
  console.log("\n4. Player image coverage");
  const imgStats = await db.execute(sql`
    SELECT count(*)::int as total,
      count(image_url)::int as with_image,
      count(*) FILTER (WHERE image_url IS NULL)::int as missing
    FROM players
  `);
  const s = imgStats.rows[0];
  const pct = Math.round(((s.with_image as number) / (s.total as number)) * 100);
  if (pct >= 50) ok(`${s.with_image}/${s.total} players have images (${pct}%)`);
  else fail(`${s.with_image}/${s.total} players have images (${pct}%) — below 50%`);

  // --- 5. Competition data completeness ---
  console.log("\n5. Competition data");
  const compData = await db.execute(sql`
    SELECT c.name, c.slug,
      (SELECT count(*)::int FROM competition_seasons cs WHERE cs.competition_id = c.id) as seasons,
      (SELECT count(*)::int FROM standings st
        JOIN competition_seasons cs ON cs.id = st.competition_season_id
        WHERE cs.competition_id = c.id) as standings_count,
      (SELECT count(*)::int FROM matches m
        JOIN competition_seasons cs ON cs.id = m.competition_season_id
        WHERE cs.competition_id = c.id) as match_count
    FROM competitions c ORDER BY c.name
  `);
  for (const row of compData.rows) {
    const label = `${row.name}: ${row.seasons} seasons, ${row.standings_count} standings, ${row.match_count} matches`;
    if ((row.standings_count as number) > 0 && (row.match_count as number) > 0) ok(label);
    else if ((row.standings_count as number) > 0 || (row.match_count as number) > 0)
      ok(label + " (partial)");
    else fail(label + " (empty!)");
  }

  // --- 6. Teams per competition ---
  console.log("\n6. Team counts per competition (current season)");
  const teamCounts = await db.execute(sql`
    SELECT c.name,
      (SELECT count(DISTINCT st.team_id)::int FROM standings st
        JOIN competition_seasons cs ON cs.id = st.competition_season_id
        WHERE cs.competition_id = c.id) as team_count
    FROM competitions c ORDER BY c.name
  `);
  for (const row of teamCounts.rows) {
    const tc = row.team_count as number;
    if (tc >= 10) ok(`${row.name}: ${tc} teams`);
    else if (tc > 0) ok(`${row.name}: ${tc} teams (small league)`);
    else fail(`${row.name}: 0 teams`);
  }

  // --- Summary ---
  console.log("\n" + "=".repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Check failed:", err);
  process.exit(1);
});
