/**
 * Incremental Football-Data.org Sync Script
 *
 * Upserts data from football-data.org without clearing existing data.
 * Safe to run repeatedly — uses externalId for deduplication.
 *
 * Usage:
 *   npx tsx scripts/sync-football-data.ts --all
 *   npx tsx scripts/sync-football-data.ts --competition --slug=premier-league
 *   npx tsx scripts/sync-football-data.ts --live
 *
 * Free tier: 10 requests/minute, covers major leagues + cups
 */

import { eq, sql as drizzleSql } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import {
  createDb,
  createRateLimitedFetch,
  COMPETITIONS,
  BASE_URL,
  slugify,
  mapMatchStatus,
  fdId,
  upsertSeasonFromApi,
  upsertCompetition,
  upsertCompetitionSeason,
  syncTeams,
  syncStandings,
  syncMatches,
  syncScorers,
  type CompMeta,
} from "./lib/football-data";

const apiKey = process.env.FOOTBALL_DATA_API_KEY;
if (!apiKey) {
  console.error("Missing FOOTBALL_DATA_API_KEY in .env.local");
  console.error("Get your free key at: https://www.football-data.org/");
  process.exit(1);
}

const db = createDb();
const fetchFn = createRateLimitedFetch(apiKey);

// ============================================================
// SYNC: ONE COMPETITION (full flow)
// ============================================================

async function syncCompetition(compMeta: CompMeta) {
  console.log(`\n== ${compMeta.name} (${compMeta.code}) ==`);

  // 1. Fetch competition info
  let apiComp;
  try {
    apiComp = await fetchFn(`${BASE_URL}/competitions/${compMeta.code}`);
  } catch (err) {
    console.log(`   SKIP: Could not fetch competition (${err})`);
    return;
  }

  if (!apiComp.currentSeason) {
    console.log(`   SKIP: No current season`);
    return;
  }

  // 2. Upsert season
  const season = await upsertSeasonFromApi(db, apiComp.currentSeason);

  // 3. Upsert competition
  const competition = await upsertCompetition(db, apiComp, compMeta);
  console.log(`   Competition: ${competition.name} (${competition.externalId})`);

  // 4. Upsert competition-season link
  const compSeason = await upsertCompetitionSeason(db, competition.id, season.id);

  // 5. Teams + squads
  let teamIdMap: Map<number, string>;
  try {
    teamIdMap = await syncTeams(db, fetchFn, compMeta.code, compSeason.id);
  } catch (err) {
    console.log(`   WARN: Could not fetch teams (${err})`);
    return;
  }

  // 6. Standings
  try {
    await syncStandings(db, fetchFn, compMeta.code, compSeason.id, teamIdMap);
  } catch (err) {
    console.log(`   WARN: Standings failed: ${err}`);
  }

  // 7. Matches
  try {
    await syncMatches(db, fetchFn, compMeta.code, compSeason.id, teamIdMap);
  } catch (err) {
    console.log(`   WARN: Matches failed: ${err}`);
  }

  // 8. Scorers
  try {
    await syncScorers(db, fetchFn, compMeta.code, compSeason.id, teamIdMap);
  } catch (err) {
    console.log(`   WARN: Scorers failed: ${err}`);
  }

  console.log(`   Done: ${compMeta.name}`);
}

// ============================================================
// SYNC: LIVE MATCHES (today only)
// ============================================================

async function syncLiveMatches() {
  console.log("\n== Syncing today's matches ==\n");

  const data = await fetchFn(`${BASE_URL}/matches`);

  let updated = 0;
  for (const apiMatch of data.matches || []) {
    const extId = fdId(apiMatch.id);

    const result = await db
      .update(schema.matches)
      .set({
        status: mapMatchStatus(apiMatch.status),
        homeScore: apiMatch.score?.fullTime?.home ?? null,
        awayScore: apiMatch.score?.fullTime?.away ?? null,
        minute:
          apiMatch.status === "IN_PLAY" ? apiMatch.minute ?? null : null,
        updatedAt: new Date(),
      })
      .where(eq(schema.matches.externalId, extId))
      .returning();

    if (result.length > 0) updated++;
  }

  console.log(`Updated ${updated} matches from ${data.matches?.length || 0} returned`);
}

// ============================================================
// SEARCH INDEX REFRESH (inline)
// ============================================================

async function refreshSearchIndex() {
  console.log("\n== Refreshing search index ==");

  const [players, teams, competitions, venues] = await Promise.all([
    db.select().from(schema.players),
    db.select().from(schema.teams),
    db.select().from(schema.competitions),
    db.select().from(schema.venues),
  ]);

  console.log(
    `Found: ${players.length} players, ${teams.length} teams, ${competitions.length} competitions, ${venues.length} venues`
  );

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

  console.log(`Search index: ${searchEntries.length} entries`);
}

// ============================================================
// CLI ENTRY POINT
// ============================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--live")) {
    await syncLiveMatches();
    return;
  }

  if (args.includes("--competition")) {
    const slugArg = args.find((a) => a.startsWith("--slug="));
    if (!slugArg) {
      console.error("Usage: --competition --slug=premier-league");
      process.exit(1);
    }
    const slug = slugArg.split("=")[1];
    const comp = COMPETITIONS.find((c) => slugify(c.name) === slug);
    if (!comp) {
      console.error(`Unknown slug: ${slug}`);
      console.error(
        "Available:",
        COMPETITIONS.map((c) => slugify(c.name)).join(", ")
      );
      process.exit(1);
    }

    await syncCompetition(comp);
    await refreshSearchIndex();
    return;
  }

  if (args.includes("--all")) {
    console.log("Syncing all competitions...\n");

    for (const comp of COMPETITIONS) {
      try {
        await syncCompetition(comp);
      } catch (err) {
        console.error(`FAILED: ${comp.name} — ${err}`);
      }
    }

    await refreshSearchIndex();

    console.log("\nSync complete!");
    return;
  }

  console.log("Usage:");
  console.log("  --all                        Sync all 12 competitions");
  console.log("  --competition --slug=<slug>  Sync one competition");
  console.log("  --live                       Update today's match scores");
  process.exit(1);
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
