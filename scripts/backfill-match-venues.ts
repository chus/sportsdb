/**
 * One-off backfill: populate matches.venue_id for existing fixtures.
 *
 * matches.venue_id was NULL for every row, so every venue page rendered
 * with no fixtures/events — pure thin content (noindex'd for AdSense in
 * commit 5e72901). Going forward the API-Football fixtures sync sets
 * venue_id from each fixture's `venue` object (scripts/sync-api-football.ts
 * → syncMatches), but that only touches fixtures re-fetched after the
 * change. This script links the ~3.9k matches already in the table.
 *
 * Source: each match is attributed to its HOME team's current venue
 * (team_venue_history.valid_to IS NULL) — the right venue for a league
 * home game, and the exact relationship a venue page surfaces ("fixtures
 * at this stadium"). No API calls; pure SQL.
 *
 * Some teams carry more than one current venue row (a known
 * team_venue_history quirk), so the pick is deterministic: highest
 * capacity, then oldest link, then venue id. The ongoing per-fixture sync
 * refines anything played at a neutral ground later.
 *
 * Idempotent: only fills rows where venue_id IS NULL, so re-running is a
 * no-op and it never clobbers a precise venue set by the fixtures sync.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  const [before] = await sql`
    SELECT count(*)::int AS total, count(*) FILTER (WHERE venue_id IS NOT NULL)::int AS with_venue
    FROM matches
  `;
  console.log(`Before: ${before.with_venue}/${before.total} matches have venue_id`);

  const updated = await sql`
    UPDATE matches m
    SET venue_id = (
      SELECT tvh.venue_id
      FROM team_venue_history tvh
      JOIN venues v ON v.id = tvh.venue_id
      WHERE tvh.team_id = m.home_team_id AND tvh.valid_to IS NULL
      ORDER BY v.capacity DESC NULLS LAST, tvh.created_at ASC, tvh.venue_id ASC
      LIMIT 1
    )
    WHERE m.venue_id IS NULL
      AND EXISTS (
        SELECT 1 FROM team_venue_history tvh
        WHERE tvh.team_id = m.home_team_id AND tvh.valid_to IS NULL
      )
    RETURNING m.id
  `;
  console.log(`Updated: ${updated.length} matches linked to a venue`);

  const [after] = await sql`
    SELECT count(*)::int AS total, count(*) FILTER (WHERE venue_id IS NOT NULL)::int AS with_venue
    FROM matches
  `;
  console.log(`After:  ${after.with_venue}/${after.total} matches have venue_id`);

  const [coverage] = await sql`
    SELECT
      count(DISTINCT venue_id) FILTER (WHERE venue_id IS NOT NULL)::int AS venues_any,
      count(DISTINCT venue_id) FILTER (WHERE venue_id IS NOT NULL AND status = 'finished')::int AS venues_finished
    FROM matches
  `;
  console.log(`Venues with ≥1 match: ${coverage.venues_any} (with a finished match: ${coverage.venues_finished})`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
