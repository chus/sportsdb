/**
 * Backfill slugs for all rows in the matches table.
 *
 * Slug format: ${homeTeamSlug}-vs-${awayTeamSlug}-${YYYY-MM-DD}
 * Collision handling: append -md{matchday}, then -{6charUuid}.
 *
 * Idempotent: only updates rows where slug IS NULL by default.
 *   - Pass --force to recompute every match (use with care).
 *
 * Usage:
 *   npx tsx scripts/backfill-match-slugs.ts
 *   npx tsx scripts/backfill-match-slugs.ts --force
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import {
  buildMatchSlugWithFallback,
  pickAvailableMatchSlug,
} from "../src/lib/utils/match-slug";

config({ path: ".env.local" });

const db = drizzle(neon(process.env.DATABASE_URL!));

const FORCE = process.argv.includes("--force");

interface Row {
  id: string;
  scheduled_at: string;
  matchday: number | null;
  current_slug: string | null;
  home_slug: string;
  away_slug: string;
}

async function main() {
  console.log(`Mode: ${FORCE ? "force (recompute all)" : "fill nulls only"}`);

  const result = await db.execute(sql`
    SELECT
      m.id,
      m.scheduled_at,
      m.matchday,
      m.slug AS current_slug,
      ht.slug AS home_slug,
      at.slug AS away_slug
    FROM matches m
    JOIN teams ht ON ht.id = m.home_team_id
    JOIN teams at ON at.id = m.away_team_id
    ORDER BY m.scheduled_at ASC
  `);

  const rows = (result.rows ?? result) as unknown as Row[];
  console.log(`Loaded ${rows.length} matches.`);

  // Pre-seed used slugs from rows we won't touch (existing values when not forcing)
  const usedSlugs = new Set<string>();
  if (!FORCE) {
    for (const r of rows) {
      if (r.current_slug) usedSlugs.add(r.current_slug);
    }
  }

  let updated = 0;
  let promotedToMatchday = 0;
  let promotedToUuid = 0;
  let skipped = 0;

  for (const r of rows) {
    if (!FORCE && r.current_slug) {
      skipped++;
      continue;
    }
    if (!r.home_slug || !r.away_slug) {
      console.warn(`Skipping match ${r.id}: missing team slug`);
      skipped++;
      continue;
    }

    const variants = buildMatchSlugWithFallback(
      r.home_slug,
      r.away_slug,
      r.scheduled_at,
      r.matchday,
      r.id
    );
    const chosen = pickAvailableMatchSlug(variants, usedSlugs);

    if (chosen === variants.withMatchday) promotedToMatchday++;
    else if (chosen === variants.withUuid) promotedToUuid++;

    await db.execute(sql`UPDATE matches SET slug = ${chosen} WHERE id = ${r.id}`);
    updated++;

    if (updated % 100 === 0) {
      console.log(`  ... ${updated} updated`);
    }
  }

  console.log("\n✅ Backfill complete");
  console.log(`  Updated:                ${updated}`);
  console.log(`  Skipped (already set):  ${skipped}`);
  console.log(`  Promoted to -md{n}:     ${promotedToMatchday}`);
  console.log(`  Promoted to -{uuid6}:   ${promotedToUuid}`);

  // Verify zero nulls
  const nullCheck = await db.execute(
    sql`SELECT count(*)::int AS n FROM matches WHERE slug IS NULL`
  );
  const nulls = ((nullCheck.rows ?? nullCheck) as Array<{ n: number }>)[0]?.n ?? 0;
  console.log(`  Remaining NULLs:        ${nulls}`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
