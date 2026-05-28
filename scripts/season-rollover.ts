/**
 * Season rollover: create the 2025/26 season, mark it current (and
 * 2024/25 not-current), then link every competition to it via a new
 * competition_seasons row.
 *
 * Idempotent — re-running creates nothing extra.
 *
 * After this script, the ingestion crons (update-matches,
 * fetch-standings, fetch-player-stats) will write to the new
 * competition_season_ids and team / competition / player pages will
 * render 2025/26 data instead of stale 2024/25.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

// European football: 2025/26 season runs Aug 2025 → Jun 2026.
// Pick dates safely wider than any real fixture so cron season-detection
// (which buckets matches by date range) always lands in the right season.
const SEASON_LABEL = "2025/26";
const SEASON_START = "2025-07-01"; // covers pre-season friendlies too
const SEASON_END = "2026-06-30";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  // 1. Create or find the 2025/26 season row
  console.log("=== Step 1: ensure season exists ===");
  let season = (await sql`SELECT id, label FROM seasons WHERE label = ${SEASON_LABEL} LIMIT 1`)[0];
  if (season) {
    console.log(`✓ season ${season.label} already exists (${season.id})`);
  } else {
    const inserted = await sql`
      INSERT INTO seasons (label, start_date, end_date, is_current)
      VALUES (${SEASON_LABEL}, ${SEASON_START}, ${SEASON_END}, false)
      RETURNING id, label
    `;
    season = inserted[0];
    console.log(`+ season ${season.label} created (${season.id})`);
  }

  // 2. Flip the is_current flag in a single transaction-equivalent
  console.log("\n=== Step 2: flip is_current ===");
  await sql`UPDATE seasons SET is_current = false WHERE label != ${SEASON_LABEL}`;
  await sql`UPDATE seasons SET is_current = true WHERE label = ${SEASON_LABEL}`;
  const current = await sql`SELECT label FROM seasons WHERE is_current = true`;
  console.log(`current season(s) now:`, current.map((s: { label: string }) => s.label));

  // 3. Backfill competition_seasons for every competition that doesn't
  //    yet have a 2025/26 row
  console.log("\n=== Step 3: link every competition to 2025/26 ===");
  const comps = await sql`SELECT id, slug FROM competitions ORDER BY slug`;
  let created = 0;
  let existed = 0;
  for (const comp of comps as Array<{ id: string; slug: string }>) {
    const existing = await sql`
      SELECT id FROM competition_seasons
      WHERE competition_id = ${comp.id} AND season_id = ${season.id}
      LIMIT 1
    `;
    if (existing[0]) {
      existed++;
      continue;
    }
    await sql`
      INSERT INTO competition_seasons (competition_id, season_id)
      VALUES (${comp.id}, ${season.id})
    `;
    created++;
  }
  console.log(`  ${created} new competition_seasons rows`);
  console.log(`  ${existed} already existed`);

  // 4. Verify the headline competitions all have a current-season link
  console.log("\n=== Step 4: verification ===");
  const status = await sql`
    SELECT c.slug,
      EXISTS (
        SELECT 1 FROM competition_seasons cs
        JOIN seasons s ON s.id = cs.season_id
        WHERE cs.competition_id = c.id AND s.is_current = true
      ) AS has_current
    FROM competitions c
    WHERE c.slug IN (
      'premier-league','la-liga','bundesliga','serie-a','ligue-1',
      'uefa-champions-league','championship','eredivisie','primeira-liga'
    )
    ORDER BY c.slug
  `;
  console.table(status);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
