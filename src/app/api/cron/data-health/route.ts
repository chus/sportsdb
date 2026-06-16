import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Data-health canary.
 *
 * Asserts the invariants that, when violated, mean the site is silently
 * serving empty/broken pages. This exists because the database was wiped
 * weekly for months by a rogue cron and nobody noticed until a user sent
 * a screenshot — every check here would have caught that the morning it
 * happened.
 *
 * On any failure it logs the failed checks, optionally POSTs to
 * HEALTHCHECK_WEBHOOK_URL (Slack/Discord-compatible JSON), and returns
 * HTTP 500 so the failure is visible in Vercel's cron dashboard.
 * On success returns 200 with the metrics.
 *
 * Runs daily. Cheap (a handful of COUNT queries).
 */

const TOP_LEAGUES = ["premier-league", "la-liga", "bundesliga", "serie-a", "ligue-1"];

// Single-table leagues: each position is unique, so two teams sharing a
// position means a duplicate club entity or a stale standings row. (MLS
// and the Argentine league run conferences/zonas that legitimately repeat
// positions, so they're excluded — the schema has no group column yet.)
const SINGLE_TABLE_LEAGUES = [
  "premier-league", "la-liga", "bundesliga", "serie-a", "ligue-1",
  "eredivisie", "primeira-liga",
];

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

async function verifyCronSecret() {
  const authHeader = (await headers()).get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET() {
  if (!(await verifyCronSecret())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return NextResponse.json({ error: "Missing DATABASE_URL" }, { status: 500 });
  }
  const sql = neon(DATABASE_URL);
  const checks: Check[] = [];

  // 1. At least one current season exists, and EVERY season flagged
  //    current actually contains today. Multiple are legitimate: European
  //    leagues (Aug–May) and LATAM/MLS (Jan–Dec) run on different
  //    calendars, so e.g. "2025/26" and "2026" are both current in June.
  //    A current season whose window doesn't span today means a botched
  //    rollover (the original "2026/27 with a future start" bug).
  const seasons = await sql`SELECT label, start_date, end_date FROM seasons WHERE is_current = true`;
  const today = new Date();
  const stale = (seasons as Array<{ label: string; start_date: string; end_date: string }>).filter(
    (s) => !(new Date(s.start_date) <= today && today <= new Date(s.end_date)),
  );
  if (seasons.length === 0) {
    checks.push({ name: "current_season", ok: false, detail: "no current season — rollover needed" });
  } else if (stale.length > 0) {
    checks.push({
      name: "current_season",
      ok: false,
      detail: `current season(s) do NOT span today: ${stale.map((s) => s.label).join(", ")} — rollover/labeling bug`,
    });
  } else {
    checks.push({
      name: "current_season",
      ok: true,
      detail: `${seasons.length} current season(s) all span today: ${(seasons as Array<{ label: string }>).map((s) => s.label).join(", ")}`,
    });
  }

  // 2. Matches table is non-empty.
  const [{ c: matchCount }] = await sql`SELECT count(*)::int AS c FROM matches`;
  checks.push({ name: "matches_present", ok: matchCount > 0, detail: `${matchCount} matches` });

  // 3. Player season stats non-empty.
  const [{ c: pssCount }] = await sql`SELECT count(*)::int AS c FROM player_season_stats`;
  checks.push({ name: "player_stats_present", ok: pssCount > 100, detail: `${pssCount} player_season_stats` });

  // 4. Every top-5 league has a populated current-season standings table.
  // Restrict the competition_season join to current seasons up front —
  // putting is_current on a LEFT JOIN of seasons leaves stale-season
  // competition_seasons in the result and double-counts their standings.
  const standings = await sql`
    SELECT c.slug, count(st.*)::int AS rows
    FROM competitions c
    LEFT JOIN competition_seasons cs ON cs.competition_id = c.id
      AND cs.season_id IN (SELECT id FROM seasons WHERE is_current = true)
    LEFT JOIN standings st ON st.competition_season_id = cs.id
    WHERE c.slug = ANY(${TOP_LEAGUES})
    GROUP BY c.slug
  `;
  const standingsBySlug = new Map(
    (standings as Array<{ slug: string; rows: number }>).map((r) => [r.slug, r.rows] as const),
  );
  for (const slug of TOP_LEAGUES) {
    const rows = standingsBySlug.get(slug) ?? 0;
    checks.push({ name: `standings:${slug}`, ok: rows >= 18, detail: `${rows} rows` });
  }

  // 4b. No duplicate standings positions in single-table leagues — the
  //     signature of a duplicate club entity (two rows for one real club)
  //     or a stale row left by an upsert-only sync.
  const [{ c: posCollisions }] = await sql`
    SELECT count(*)::int AS c FROM (
      SELECT 1
      FROM standings st
      JOIN competition_seasons cs ON cs.id = st.competition_season_id
      JOIN competitions co ON co.id = cs.competition_id
      JOIN seasons se ON se.id = cs.season_id AND se.is_current = true
      WHERE co.slug = ANY(${SINGLE_TABLE_LEAGUES})
      GROUP BY cs.id, st.position
      HAVING count(*) > 1
    ) d
  `;
  checks.push({
    name: "no_standings_collisions",
    ok: posCollisions === 0,
    detail: `${posCollisions} duplicate standings positions`,
  });

  // 5. No dangling external_id mappings (point to deleted entities).
  const [{ c: dangling }] = await sql`
    SELECT (
      (SELECT count(*) FROM external_ids x WHERE x.entity_type='team' AND NOT EXISTS (SELECT 1 FROM teams t WHERE t.id=x.entity_id)) +
      (SELECT count(*) FROM external_ids x WHERE x.entity_type='player' AND NOT EXISTS (SELECT 1 FROM players p WHERE p.id=x.entity_id)) +
      (SELECT count(*) FROM external_ids x WHERE x.entity_type='match' AND NOT EXISTS (SELECT 1 FROM matches m WHERE m.id=x.entity_id))
    )::int AS c
  `;
  checks.push({ name: "no_dangling_mappings", ok: dangling === 0, detail: `${dangling} dangling` });

  // 6. No duplicate fixtures (same teams + date) — the identity-failure signature.
  const [{ c: dupes }] = await sql`
    SELECT count(*)::int AS c FROM (
      SELECT 1 FROM matches GROUP BY home_team_id, away_team_id, scheduled_at::date HAVING count(*) > 1
    ) d
  `;
  checks.push({ name: "no_duplicate_fixtures", ok: dupes === 0, detail: `${dupes} duplicate fixtures` });

  const failed = checks.filter((c) => !c.ok);
  const healthy = failed.length === 0;

  if (!healthy) {
    console.error("[data-health] FAILED checks:", failed);
    const webhook = process.env.HEALTHCHECK_WEBHOOK_URL;
    if (webhook) {
      const text = `🔴 SportsDB data-health FAILED:\n${failed.map((f) => `• ${f.name}: ${f.detail}`).join("\n")}`;
      try {
        await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, content: text }), // text=Slack, content=Discord
        });
      } catch (e) {
        console.error("[data-health] webhook post failed:", e);
      }
    }
  }

  return NextResponse.json(
    { healthy, checks, timestamp: new Date().toISOString() },
    { status: healthy ? 200 : 500 },
  );
}
