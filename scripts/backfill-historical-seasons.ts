/**
 * Backfill Historical Seasons from football-data.org
 *
 * Fetches standings, matches, and scorers for the past 5 seasons
 * for all configured competitions. Safe to re-run — uses upserts.
 *
 * Usage:
 *   npx tsx scripts/backfill-historical-seasons.ts --all
 *   npx tsx scripts/backfill-historical-seasons.ts --competition --slug=premier-league
 *   npx tsx scripts/backfill-historical-seasons.ts --season=2023
 *   npx tsx scripts/backfill-historical-seasons.ts --dry-run
 *   npx tsx scripts/backfill-historical-seasons.ts --reset
 */

import * as fs from "fs";
import * as path from "path";
import {
  createDb,
  createRateLimitedFetch,
  COMPETITIONS,
  BASE_URL,
  slugify,
  upsertSeason,
  upsertCompetition,
  upsertCompetitionSeason,
  upsertTeam,
  upsertVenue,
  linkTeamVenue,
  linkTeamSeason,
  syncStandings,
  syncMatches,
  syncScorers,
  type CompMeta,
  type DrizzleDb,
  type FetchFn,
} from "./lib/football-data";

// ============================================================
// CONFIGURATION
// ============================================================

const BACKFILL_SEASONS = [2020, 2021, 2022, 2023, 2024];

// Tournaments only happen in specific years
const TOURNAMENT_SEASONS: Record<string, number[]> = {
  EC: [2020, 2024],
  WC: [2022],
};

function getSeasonsForCompetition(code: string): number[] {
  return TOURNAMENT_SEASONS[code] || BACKFILL_SEASONS;
}

// ============================================================
// PROGRESS TRACKING
// ============================================================

const PROGRESS_FILE = path.join(
  process.cwd(),
  "data",
  ".backfill-historical-progress.json"
);

interface Progress {
  completed: string[];
  lastRun: string;
  stats: {
    seasonsProcessed: number;
    teamsUpserted: number;
    matchesUpserted: number;
    standingsUpserted: number;
    scorersUpserted: number;
  };
}

function loadProgress(): { completed: Set<string>; stats: Progress["stats"] } {
  try {
    const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8")) as Progress;
    return {
      completed: new Set(data.completed),
      stats: data.stats,
    };
  } catch {
    return {
      completed: new Set(),
      stats: {
        seasonsProcessed: 0,
        teamsUpserted: 0,
        matchesUpserted: 0,
        standingsUpserted: 0,
        scorersUpserted: 0,
      },
    };
  }
}

function saveProgress(completed: Set<string>, stats: Progress["stats"]) {
  const dir = path.dirname(PROGRESS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const data: Progress = {
    completed: Array.from(completed),
    lastRun: new Date().toISOString(),
    stats,
  };
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2));
}

// ============================================================
// BACKFILL ONE COMPETITION-SEASON
// ============================================================

async function backfillCompetitionSeason(
  db: DrizzleDb,
  fetchFn: FetchFn,
  compMeta: CompMeta,
  seasonYear: number,
  progress: { completed: Set<string>; stats: Progress["stats"] }
) {
  const key = `${compMeta.code}:${seasonYear}`;

  if (progress.completed.has(key)) {
    console.log(`   SKIP: ${key} (already completed)`);
    return;
  }

  console.log(`\n   -- ${compMeta.name} ${seasonYear} --`);

  // Step 1: Fetch teams for this season (also gives us season metadata)
  let teamsData: any;
  try {
    teamsData = await fetchFn(
      `${BASE_URL}/competitions/${compMeta.code}/teams?season=${seasonYear}`
    );
  } catch (err: any) {
    if (err.message?.includes("403") || err.message?.includes("404")) {
      console.log(`   SKIP: Season ${seasonYear} not available (${err.message.slice(0, 60)})`);
      progress.completed.add(key);
      saveProgress(progress.completed, progress.stats);
      return;
    }
    throw err;
  }

  // Extract season info from the response
  const apiSeason = teamsData.season;
  if (!apiSeason) {
    console.log(`   SKIP: No season data in teams response`);
    progress.completed.add(key);
    saveProgress(progress.completed, progress.stats);
    return;
  }

  // Derive label
  const startYear = parseInt(apiSeason.startDate.slice(0, 4));
  const endYear = parseInt(apiSeason.endDate.slice(0, 4));
  const label =
    startYear === endYear ? `${startYear}` : `${startYear}/${String(endYear).slice(2)}`;

  // Upsert season (isCurrent: false for historical)
  const season = await upsertSeason(
    db,
    label,
    apiSeason.startDate,
    apiSeason.endDate,
    false
  );

  // Upsert competition
  const competition = await upsertCompetition(db, teamsData.competition || { id: 0, name: compMeta.name, type: "LEAGUE", emblem: null }, compMeta);

  // Upsert competition-season as completed
  const compSeason = await upsertCompetitionSeason(
    db,
    competition.id,
    season.id,
    "completed"
  );

  // Build team ID map
  const teamIdMap = new Map<number, string>();
  for (const apiTeam of teamsData.teams || []) {
    const team = await upsertTeam(db, apiTeam);
    teamIdMap.set(apiTeam.id, team.id);

    const venueId = await upsertVenue(db, apiTeam);
    if (venueId) await linkTeamVenue(db, team.id, venueId);
    await linkTeamSeason(db, team.id, compSeason.id);
  }
  progress.stats.teamsUpserted += teamIdMap.size;

  // Step 2: Standings
  try {
    await syncStandings(db, fetchFn, compMeta.code, compSeason.id, teamIdMap, seasonYear);
    progress.stats.standingsUpserted++;
  } catch (err) {
    console.log(`   WARN: Standings failed: ${err}`);
  }

  // Step 3: Matches
  try {
    await syncMatches(db, fetchFn, compMeta.code, compSeason.id, teamIdMap, seasonYear);
    progress.stats.matchesUpserted++;
  } catch (err) {
    console.log(`   WARN: Matches failed: ${err}`);
  }

  // Step 4: Scorers
  try {
    await syncScorers(db, fetchFn, compMeta.code, compSeason.id, teamIdMap, seasonYear);
    progress.stats.scorersUpserted++;
  } catch (err) {
    console.log(`   WARN: Scorers failed: ${err}`);
  }

  // Mark completed
  progress.completed.add(key);
  progress.stats.seasonsProcessed++;
  saveProgress(progress.completed, progress.stats);

  console.log(`   Done: ${compMeta.name} ${seasonYear}`);
}

// ============================================================
// DRY RUN
// ============================================================

function printDryRun(
  comps: CompMeta[],
  seasonFilter: number | null,
  completed: Set<string>
) {
  console.log("\n=== BACKFILL HISTORICAL SEASONS (DRY RUN) ===\n");
  console.log(
    "Competition".padEnd(30) +
      "Seasons".padEnd(30) +
      "Requests"
  );
  console.log("─".repeat(70));

  let totalPairs = 0;
  let totalRequests = 0;
  let skipped = 0;

  for (const comp of comps) {
    const seasons = getSeasonsForCompetition(comp.code).filter(
      (y) => !seasonFilter || y === seasonFilter
    );

    const remaining = seasons.filter((y) => !completed.has(`${comp.code}:${y}`));
    const done = seasons.length - remaining.length;
    skipped += done;

    const requests = remaining.length * 4;
    totalPairs += remaining.length;
    totalRequests += requests;

    const seasonStr = seasons.map((y) =>
      completed.has(`${comp.code}:${y}`) ? `${y}*` : `${y}`
    ).join(", ");

    console.log(
      comp.name.padEnd(30) +
        seasonStr.padEnd(30) +
        `${requests}`
    );
  }

  console.log("─".repeat(70));
  console.log(`\nTotal: ${totalPairs} remaining comp-seasons, ${totalRequests} API requests`);
  console.log(`Already completed: ${skipped} (* in list above)`);
  console.log(`Estimated time: ~${Math.ceil(totalRequests * 6.5 / 60)} minutes\n`);
}

// ============================================================
// CLI
// ============================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage:");
    console.log("  --all                         Backfill all competitions, all seasons");
    console.log("  --competition --slug=<slug>    Single competition");
    console.log("  --season=<year>                Single season across all competitions");
    console.log("  --dry-run                      Preview what would be fetched");
    console.log("  --reset                        Clear progress and start over");
    process.exit(1);
  }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    console.error("Missing FOOTBALL_DATA_API_KEY in .env.local");
    process.exit(1);
  }

  // Handle --reset
  if (args.includes("--reset")) {
    if (fs.existsSync(PROGRESS_FILE)) {
      fs.unlinkSync(PROGRESS_FILE);
      console.log("Progress reset.");
    } else {
      console.log("No progress file to reset.");
    }
    if (args.length === 1) return;
  }

  // Determine competitions
  let comps: CompMeta[] = [...COMPETITIONS];

  if (args.includes("--competition")) {
    const slugArg = args.find((a) => a.startsWith("--slug="));
    if (!slugArg) {
      console.error("Usage: --competition --slug=premier-league");
      process.exit(1);
    }
    const slug = slugArg.split("=")[1];
    const found = COMPETITIONS.find((c) => slugify(c.name) === slug);
    if (!found) {
      console.error(`Unknown slug: ${slug}`);
      console.error("Available:", COMPETITIONS.map((c) => slugify(c.name)).join(", "));
      process.exit(1);
    }
    comps = [found];
  }

  // Determine season filter
  const seasonArg = args.find((a) => a.startsWith("--season="));
  const seasonFilter = seasonArg ? parseInt(seasonArg.split("=")[1]) : null;

  // Load progress
  const progress = loadProgress();

  // Dry run
  if (args.includes("--dry-run")) {
    printDryRun(comps, seasonFilter, progress.completed);
    return;
  }

  // Full run
  const db = createDb();
  const fetchFn = createRateLimitedFetch(apiKey);

  console.log("\n=== BACKFILL HISTORICAL SEASONS ===\n");

  for (const comp of comps) {
    const seasons = getSeasonsForCompetition(comp.code).filter(
      (y) => !seasonFilter || y === seasonFilter
    );

    if (seasons.length === 0) continue;

    console.log(`\n== ${comp.name} (${comp.code}) ==`);

    for (const year of seasons) {
      try {
        await backfillCompetitionSeason(db, fetchFn, comp, year, progress);
      } catch (err) {
        console.error(`   FAILED: ${comp.name} ${year} — ${err}`);
        // Save progress and continue
        saveProgress(progress.completed, progress.stats);
      }
    }
  }

  console.log("\n=== BACKFILL COMPLETE ===");
  console.log(`Seasons processed: ${progress.stats.seasonsProcessed}`);
  console.log(`Teams upserted: ${progress.stats.teamsUpserted}`);
  console.log(`Standings sets: ${progress.stats.standingsUpserted}`);
  console.log(`Match sets: ${progress.stats.matchesUpserted}`);
  console.log(`Scorer sets: ${progress.stats.scorersUpserted}`);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
