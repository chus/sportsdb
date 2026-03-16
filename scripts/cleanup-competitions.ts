/**
 * Competition Cleanup Script
 *
 * Merges duplicate competitions, deletes empty season links,
 * removes competitions with no data, and refreshes search index.
 *
 * Usage: npx tsx scripts/cleanup-competitions.ts
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";
import { eq, sql as drizzleSql, and, notExists, isNull } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

// ============================================================
// STEP 1: Merge duplicate competitions
// ============================================================

// Pairs: [keepSlug, deleteExternalId]
// We keep the Wikipedia entry (has the canonical slug) and absorb the API entry's data
const MERGE_PAIRS = [
  { keepSlug: "la-liga", deleteExternalId: "fd-2014" },
  { keepSlug: "brasileirao-serie-a", deleteExternalId: "fd-2013" },
];

async function mergeCompetitions() {
  console.log("\n== Step 1: Merge duplicate competitions ==\n");

  for (const { keepSlug, deleteExternalId } of MERGE_PAIRS) {
    // Find the entry to keep (Wikipedia slug)
    const [keep] = await db
      .select()
      .from(schema.competitions)
      .where(eq(schema.competitions.slug, keepSlug))
      .limit(1);

    // Find the entry to delete (API externalId)
    const [remove] = await db
      .select()
      .from(schema.competitions)
      .where(eq(schema.competitions.externalId, deleteExternalId))
      .limit(1);

    if (!keep || !remove) {
      console.log(`  SKIP: ${keepSlug} or ${deleteExternalId} not found`);
      continue;
    }

    if (keep.id === remove.id) {
      console.log(`  SKIP: ${keepSlug} — already the same record`);
      continue;
    }

    console.log(`  Merging: "${remove.name}" (${remove.slug}) → "${keep.name}" (${keep.slug})`);

    // Re-parent competition_seasons from the API entry to the Wikipedia entry
    const compSeasons = await db
      .select()
      .from(schema.competitionSeasons)
      .where(eq(schema.competitionSeasons.competitionId, remove.id));

    for (const cs of compSeasons) {
      // Check if the keep entry already has this season
      const [existing] = await db
        .select()
        .from(schema.competitionSeasons)
        .where(
          and(
            eq(schema.competitionSeasons.competitionId, keep.id),
            eq(schema.competitionSeasons.seasonId, cs.seasonId)
          )
        )
        .limit(1);

      if (existing) {
        // Both have this season — merge data from remove's season into keep's season
        // Re-point all child tables from cs.id → existing.id
        await db.update(schema.standings)
          .set({ competitionSeasonId: existing.id })
          .where(eq(schema.standings.competitionSeasonId, cs.id));
        await db.update(schema.matches)
          .set({ competitionSeasonId: existing.id })
          .where(eq(schema.matches.competitionSeasonId, cs.id));
        await db.update(schema.playerSeasonStats)
          .set({ competitionSeasonId: existing.id })
          .where(eq(schema.playerSeasonStats.competitionSeasonId, cs.id));
        await db.update(schema.teamSeasons)
          .set({ competitionSeasonId: existing.id })
          .where(eq(schema.teamSeasons.competitionSeasonId, cs.id));

        // Delete the now-empty competition_season from the API entry
        // First delete any remaining team_seasons that might conflict
        await db.delete(schema.teamSeasons)
          .where(eq(schema.teamSeasons.competitionSeasonId, cs.id));
        await db.delete(schema.competitionSeasons)
          .where(eq(schema.competitionSeasons.id, cs.id));

        console.log(`    Merged season ${cs.seasonId} into existing`);
      } else {
        // Keep entry doesn't have this season — just re-parent
        await db.update(schema.competitionSeasons)
          .set({ competitionId: keep.id })
          .where(eq(schema.competitionSeasons.id, cs.id));

        console.log(`    Re-parented season ${cs.seasonId}`);
      }
    }

    // Re-parent user league preferences
    await db.update(schema.userLeaguePreferences)
      .set({ competitionId: keep.id })
      .where(eq(schema.userLeaguePreferences.competitionId, remove.id));

    // Save values we need from the API entry before deleting it
    const savedExternalId = remove.externalId;
    const savedLogoUrl = remove.logoUrl;
    const savedDescription = remove.description;

    // Clear externalId on the API entry first (to avoid unique constraint conflict)
    await db.update(schema.competitions)
      .set({ externalId: null })
      .where(eq(schema.competitions.id, remove.id));

    // Delete the now-orphaned API entry
    await db.delete(schema.competitions)
      .where(eq(schema.competitions.id, remove.id));

    // Copy externalId, logoUrl, description to the kept entry
    await db.update(schema.competitions)
      .set({
        externalId: savedExternalId,
        logoUrl: savedLogoUrl || keep.logoUrl,
        description: savedDescription || keep.description,
        updatedAt: new Date(),
      })
      .where(eq(schema.competitions.id, keep.id));

    console.log(`    Deleted: "${remove.name}" (${remove.slug})`);
    console.log(`    Kept: "${keep.name}" (${keepSlug}) with externalId=${deleteExternalId}`);
  }
}

// ============================================================
// STEP 2: Delete empty competition-season links
// ============================================================

async function deleteEmptyCompetitionSeasons() {
  console.log("\n== Step 2: Delete empty competition-season links ==\n");

  const allCompSeasons = await db.execute(drizzleSql`
    SELECT cs.id, c.name, c.slug, s.label,
      (SELECT count(*) FROM standings WHERE competition_season_id = cs.id) as standings_count,
      (SELECT count(*) FROM matches WHERE competition_season_id = cs.id) as match_count,
      (SELECT count(*) FROM team_seasons WHERE competition_season_id = cs.id) as team_count,
      (SELECT count(*) FROM player_season_stats WHERE competition_season_id = cs.id) as scorer_count
    FROM competition_seasons cs
    JOIN competitions c ON c.id = cs.competition_id
    JOIN seasons s ON s.id = cs.season_id
    ORDER BY c.name, s.label
  `);

  let deleted = 0;
  for (const row of allCompSeasons.rows) {
    // Only standings + matches + scorers count as real data
    // team_seasons alone (just roster links) are not sufficient
    const realData = Number(row.standings_count) + Number(row.match_count) + Number(row.scorer_count);

    if (realData === 0) {
      // Delete dependent team_seasons first
      await db.delete(schema.teamSeasons)
        .where(eq(schema.teamSeasons.competitionSeasonId, row.id as string));
      // Delete the empty competition-season
      await db.delete(schema.competitionSeasons)
        .where(eq(schema.competitionSeasons.id, row.id as string));
      console.log(`  Deleted: ${row.name} / ${row.label} (teams=${row.team_count}, no real data)`);
      deleted++;
    }
  }

  // Also clean up team_seasons that reference empty comp-seasons (belt and suspenders)
  // Already handled by FK cascade in most cases, but just in case:
  if (deleted > 0) {
    console.log(`  Removed ${deleted} empty competition-season links`);
  } else {
    console.log("  None found");
  }
}

// ============================================================
// STEP 3: Delete empty competitions
// ============================================================

async function deleteEmptyCompetitions() {
  console.log("\n== Step 3: Delete empty competitions ==\n");

  // Find competitions with no competition_seasons and no externalId
  const emptyComps = await db.execute(drizzleSql`
    SELECT c.id, c.name, c.slug, c.external_id
    FROM competitions c
    WHERE NOT EXISTS (
      SELECT 1 FROM competition_seasons cs WHERE cs.competition_id = c.id
    )
    ORDER BY c.name
  `);

  let deleted = 0;
  for (const row of emptyComps.rows) {
    // Check if there are articles referencing competition_seasons for this competition
    // (already no comp_seasons, so no articles either)

    // Check user_league_preferences
    await db.delete(schema.userLeaguePreferences)
      .where(eq(schema.userLeaguePreferences.competitionId, row.id as string));

    // Check follows
    await db.delete(schema.follows)
      .where(
        and(
          eq(schema.follows.entityType, "competition"),
          eq(schema.follows.entityId, row.id as string)
        )
      );

    await db.delete(schema.competitions)
      .where(eq(schema.competitions.id, row.id as string));
    console.log(`  Deleted: ${row.name} (${row.slug}) [ext: ${row.external_id || "none"}]`);
    deleted++;
  }

  if (deleted > 0) {
    console.log(`  Removed ${deleted} empty competitions`);
  } else {
    console.log("  None found");
  }
}

// ============================================================
// STEP 4: Refresh search index
// ============================================================

async function refreshSearchIndex() {
  console.log("\n== Step 4: Refresh search index ==\n");

  const [players, teams, competitions, venues] = await Promise.all([
    db.select().from(schema.players),
    db.select().from(schema.teams),
    db.select().from(schema.competitions),
    db.select().from(schema.venues),
  ]);

  await db.execute(drizzleSql`TRUNCATE TABLE search_index`);

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
  }

  console.log(`  ${competitions.length} competitions, ${teams.length} teams, ${players.length} players, ${venues.length} venues`);
  console.log(`  Search index: ${searchEntries.length} entries`);
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("Competition Cleanup Script");
  console.log("=".repeat(50));

  await mergeCompetitions();
  await deleteEmptyCompetitionSeasons();
  await deleteEmptyCompetitions();
  await refreshSearchIndex();

  console.log("\n" + "=".repeat(50));
  console.log("Cleanup complete!");
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
