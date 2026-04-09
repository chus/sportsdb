/**
 * Sports Calendar Generator
 *
 * Scans the `matches` table over a rolling window (default -7d..+90d)
 * and upserts rows into `sports_events` for matchdays, derbies, finals,
 * international breaks, etc. Idempotent: safe to re-run.
 *
 * Usage:
 *   tsx scripts/generate-sports-calendar.ts              # full run
 *   tsx scripts/generate-sports-calendar.ts --dry-run    # log plan only
 */

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { DERBIES, findDerby, TOP_5_LEAGUE_SLUGS } from "../src/lib/data/derbies";

config({ path: ".env.local" });

type EventType =
  | "matchday"
  | "derby"
  | "final"
  | "tournament_start"
  | "international_break";

export type PlannedEvent = {
  date: string; // yyyy-MM-dd
  type: EventType;
  title: string;
  description: string | null;
  importance: number;
  competitionId: string | null;
  matchIds: string[];
  isFeatured: boolean;
  metadata: Record<string, unknown>;
};

export type CalendarStats = {
  scanned: number;
  planned: number;
  inserted: number;
  updated: number;
  byType: Record<EventType, number>;
};

export type CalendarOptions = {
  windowDaysBack?: number;
  windowDaysForward?: number;
  dryRun?: boolean;
};

/**
 * Deterministic importance score for a planned event.
 */
export function scoreEvent(input: {
  type: EventType;
  competitionSlug?: string;
  derbyImportance?: number;
  isTopOfTable?: boolean;
}): 1 | 2 | 3 | 4 | 5 {
  if (input.type === "final" || input.type === "tournament_start") return 5;
  if (input.type === "derby") return (input.derbyImportance ?? 4) as 4 | 5;
  if (input.type === "international_break") return 3;
  if (input.type === "matchday") {
    if (!input.competitionSlug) return 1;
    if (TOP_5_LEAGUE_SLUGS.has(input.competitionSlug) && input.isTopOfTable) return 4;
    if (TOP_5_LEAGUE_SLUGS.has(input.competitionSlug)) return 3;
    return 2;
  }
  return 1;
}

function toDateKey(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}

function isoWeekKey(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  const tmp = new Date(
    Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate())
  );
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/**
 * Core runner. Can be imported from the cron route.
 */
export async function runCalendarGenerator(
  opts: CalendarOptions = {}
): Promise<CalendarStats> {
  const {
    windowDaysBack = 7,
    windowDaysForward = 90,
    dryRun = false,
  } = opts;

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const sql = neon(DATABASE_URL);

  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - windowDaysBack);
  rangeStart.setUTCHours(0, 0, 0, 0);
  const rangeEnd = new Date(now);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + windowDaysForward);
  rangeEnd.setUTCHours(23, 59, 59, 999);

  // Pull all matches in the window with team + competition + stage info.
  // NOTE: matches has no explicit `stage` column — we look for "final" in the
  // match slug or the competition name as a heuristic for cup finals.
  const rows = (await sql`
    SELECT
      m.id,
      m.slug,
      m.scheduled_at,
      m.home_score,
      m.away_score,
      m.status,
      m.matchday,
      ht.slug as home_slug,
      ht.name as home_name,
      ht.tier as home_tier,
      at.slug as away_slug,
      at.name as away_name,
      at.tier as away_tier,
      c.id as competition_id,
      c.slug as competition_slug,
      c.name as competition_name,
      c.type as competition_type
    FROM matches m
    INNER JOIN teams ht ON ht.id = m.home_team_id
    INNER JOIN teams at ON at.id = m.away_team_id
    INNER JOIN competition_seasons cs ON cs.id = m.competition_season_id
    INNER JOIN competitions c ON c.id = cs.competition_id
    WHERE m.scheduled_at >= ${rangeStart.toISOString()}
      AND m.scheduled_at <= ${rangeEnd.toISOString()}
    ORDER BY m.scheduled_at ASC
  `) as Array<{
    id: string;
    slug: string | null;
    scheduled_at: string;
    home_score: number | null;
    away_score: number | null;
    status: string;
    matchday: number | null;
    home_slug: string;
    home_name: string;
    home_tier: number | null;
    away_slug: string;
    away_name: string;
    away_tier: number | null;
    competition_id: string;
    competition_slug: string;
    competition_name: string;
    competition_type: string;
  }>;

  const planned: PlannedEvent[] = [];
  const stats: CalendarStats = {
    scanned: rows.length,
    planned: 0,
    inserted: 0,
    updated: 0,
    byType: {
      matchday: 0,
      derby: 0,
      final: 0,
      tournament_start: 0,
      international_break: 0,
    },
  };

  // Grouping bucket for matchday detection: key = date|competitionId
  const groupMap = new Map<
    string,
    {
      date: string;
      competitionId: string;
      competitionSlug: string;
      competitionName: string;
      matches: typeof rows;
    }
  >();

  for (const row of rows) {
    const dateKey = toDateKey(row.scheduled_at);

    // --- 1. Derby detection ---
    const derby = findDerby(row.home_slug, row.away_slug);
    if (derby) {
      planned.push({
        date: dateKey,
        type: "derby",
        title: derby.name,
        description: `${row.home_name} vs ${row.away_name} — ${derby.name}`,
        importance: scoreEvent({
          type: "derby",
          derbyImportance: derby.importance,
          competitionSlug: row.competition_slug,
        }),
        competitionId: row.competition_id,
        matchIds: [row.id],
        isFeatured: derby.importance >= 5,
        metadata: {
          homeSlug: row.home_slug,
          awaySlug: row.away_slug,
          derbyName: derby.name,
        },
      });
    }

    // --- 2. Final / tournament detection (slug/name heuristic) ---
    const slugLower = (row.slug || "").toLowerCase();
    const compNameLower = row.competition_name.toLowerCase();
    const isFinal =
      slugLower.includes("-final") ||
      slugLower.includes("final-") ||
      compNameLower.includes(" final");
    const isSemiFinal =
      slugLower.includes("semi-final") ||
      slugLower.includes("semifinal");
    if (isFinal || isSemiFinal) {
      planned.push({
        date: dateKey,
        type: "final",
        title: `${row.competition_name}${isSemiFinal ? " Semi-Final" : " Final"}: ${row.home_name} vs ${row.away_name}`,
        description: `${isSemiFinal ? "Semi-final" : "Final"} of ${row.competition_name}`,
        importance: scoreEvent({ type: "final" }),
        competitionId: row.competition_id,
        matchIds: [row.id],
        isFeatured: true,
        metadata: {
          stage: isSemiFinal ? "semi_final" : "final",
          homeSlug: row.home_slug,
          awaySlug: row.away_slug,
        },
      });
    }

    // Accumulate for matchday grouping
    const groupKey = `${dateKey}|${row.competition_id}`;
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        date: dateKey,
        competitionId: row.competition_id,
        competitionSlug: row.competition_slug,
        competitionName: row.competition_name,
        matches: [],
      });
    }
    groupMap.get(groupKey)!.matches.push(row);
  }

  // --- 3. Matchday detection ---
  for (const group of groupMap.values()) {
    if (!TOP_5_LEAGUE_SLUGS.has(group.competitionSlug)) continue;
    if (group.matches.length < 5) continue;

    // Top-of-table signal: both teams tier 1 in any match of the group
    const isTopOfTable = group.matches.some(
      (m) => (m.home_tier ?? 3) === 1 && (m.away_tier ?? 3) === 1
    );
    const containsDerby = group.matches.some((m) =>
      findDerby(m.home_slug, m.away_slug)
    );

    const matchdayNumber =
      group.matches.find((m) => m.matchday != null)?.matchday ?? null;
    const importance = scoreEvent({
      type: "matchday",
      competitionSlug: group.competitionSlug,
      isTopOfTable: isTopOfTable || containsDerby,
    });

    planned.push({
      date: group.date,
      type: "matchday",
      title: matchdayNumber
        ? `${group.competitionName} — Matchday ${matchdayNumber}`
        : `${group.competitionName} — Matchday`,
      description: `${group.matches.length} ${group.competitionName} fixtures on ${group.date}`,
      importance,
      competitionId: group.competitionId,
      matchIds: group.matches.map((m) => m.id),
      isFeatured: importance >= 4,
      metadata: {
        competitionSlug: group.competitionSlug,
        matchdayNumber,
        isTopOfTable,
        containsDerby,
        matchCount: group.matches.length,
      },
    });
  }

  // --- 4. International break detection (week-level) ---
  // If any ISO week in the window has zero top-5 matches, flag it as an
  // international break event centered on Wednesday of that week.
  const weeksInWindow = new Map<string, Date>();
  const cursor = new Date(rangeStart);
  while (cursor <= rangeEnd) {
    const key = isoWeekKey(cursor);
    if (!weeksInWindow.has(key)) {
      // Wednesday of that week = center of break window
      const mid = new Date(cursor);
      const dow = mid.getUTCDay() || 7;
      mid.setUTCDate(mid.getUTCDate() + (3 - dow));
      weeksInWindow.set(key, mid);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const weeksWithTop5 = new Set<string>();
  for (const row of rows) {
    if (!TOP_5_LEAGUE_SLUGS.has(row.competition_slug)) continue;
    weeksWithTop5.add(isoWeekKey(row.scheduled_at));
  }

  for (const [weekKey, midDate] of weeksInWindow.entries()) {
    if (weeksWithTop5.has(weekKey)) continue;
    // Skip weeks entirely before `now` (past breaks aren't interesting).
    if (midDate.getTime() < now.getTime() - 2 * 24 * 3600 * 1000) continue;
    planned.push({
      date: toDateKey(midDate),
      type: "international_break",
      title: `International Break (${weekKey})`,
      description: `No top-5 league fixtures in ISO week ${weekKey}`,
      importance: scoreEvent({ type: "international_break" }),
      competitionId: null,
      matchIds: [],
      isFeatured: false,
      metadata: { isoWeek: weekKey },
    });
  }

  stats.planned = planned.length;
  for (const p of planned) stats.byType[p.type]++;

  if (dryRun) {
    console.log(`[dry-run] Scanned ${stats.scanned} matches`);
    console.log(`[dry-run] Planned ${stats.planned} events`);
    console.log(`[dry-run] By type:`, stats.byType);
    for (const p of planned.slice(0, 20)) {
      console.log(
        `  ${p.date} ${p.type.padEnd(22)} imp=${p.importance} ${p.title}`
      );
    }
    if (planned.length > 20) {
      console.log(`  ... ${planned.length - 20} more`);
    }
    return stats;
  }

  // --- Upsert phase ---
  // Unique index on (date, type, competition_id).
  for (const p of planned) {
    try {
      const result = (await sql`
        INSERT INTO sports_events (
          date, type, title, description, importance,
          competition_id, match_ids, is_featured, metadata
        )
        VALUES (
          ${p.date}, ${p.type}, ${p.title}, ${p.description}, ${p.importance},
          ${p.competitionId}, ${JSON.stringify(p.matchIds)}::jsonb,
          ${p.isFeatured}, ${JSON.stringify(p.metadata)}::jsonb
        )
        ON CONFLICT (date, type, competition_id)
        DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          importance = EXCLUDED.importance,
          match_ids = EXCLUDED.match_ids,
          is_featured = EXCLUDED.is_featured,
          metadata = EXCLUDED.metadata,
          updated_at = now()
        RETURNING xmax = 0 as inserted
      `) as Array<{ inserted: boolean }>;
      if (result[0]?.inserted) {
        stats.inserted++;
      } else {
        stats.updated++;
      }
    } catch (err) {
      console.error(`Failed to upsert event ${p.date} ${p.type}:`, err);
    }
  }

  return stats;
}

// ---------- CLI entry ----------
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const stats = await runCalendarGenerator({ dryRun });
  console.log("Calendar generator complete:", stats);
}

// Only run when executed directly (e.g. `tsx scripts/generate-sports-calendar.ts`).
// When imported by the cron route, `process.argv[1]` will not point at this file.
const invokedDirectly =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  (process.argv[1]?.endsWith("generate-sports-calendar.ts") ||
    process.argv[1]?.endsWith("generate-sports-calendar.js"));

if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
