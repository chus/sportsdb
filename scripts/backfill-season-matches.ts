/**
 * One-off backfill: ingest the entire 2025/26 season for the top 5
 * European leagues. The update-matches cron uses a 10-day rolling
 * window and so can never catch up on a season that's already over.
 *
 * Idempotent — every match upserts on external_id.
 *
 * Expected volume: ~380 matches per league × 5 leagues ≈ 1,900 rows.
 * Runs in a few minutes (5 API calls + ~2k DB upserts).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { buildMatchSlugWithFallback } from "../src/lib/utils/match-slug";
import { findTeamByName } from "../src/lib/seo/team-matcher";

const API_KEY =
  process.env.FOOTBALL_DATA_API_KEY ?? "226de578459844eeb0c5539b1859ed1e";
const SEASON_LABEL = "2025/26";
const DATE_FROM = "2025-07-01";
const DATE_TO = "2026-06-30";

const LEAGUES: Record<string, { slug: string; country: string }> = {
  PL: { slug: "premier-league", country: "England" },
  PD: { slug: "la-liga", country: "Spain" },
  BL1: { slug: "bundesliga", country: "Germany" },
  SA: { slug: "serie-a", country: "Italy" },
  FL1: { slug: "ligue-1", country: "France" },
};

const STATUS_MAP: Record<string, string> = {
  SCHEDULED: "scheduled",
  TIMED: "scheduled",
  IN_PLAY: "live",
  PAUSED: "half_time",
  FINISHED: "finished",
  SUSPENDED: "suspended",
  POSTPONED: "postponed",
  CANCELLED: "cancelled",
  AWARDED: "finished",
};

interface ApiMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  minute: number | null;
  homeTeam: { id: number; name: string; shortName: string; crest: string | null };
  awayTeam: { id: number; name: string; shortName: string; crest: string | null };
  score: {
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
  referees?: { name: string }[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  // Pre-load competition_season_id per league for the target season
  const seasonRow = (await sql`SELECT id FROM seasons WHERE label = ${SEASON_LABEL} LIMIT 1`)[0];
  if (!seasonRow) {
    console.error(`Season ${SEASON_LABEL} not found — run rollover script first`);
    process.exit(1);
  }
  const seasonId = seasonRow.id;

  const compSeasonByLeague: Record<string, string> = {};
  for (const [, league] of Object.entries(LEAGUES)) {
    const cs = await sql`
      SELECT cs.id
      FROM competition_seasons cs
      JOIN competitions c ON c.id = cs.competition_id
      WHERE c.slug = ${league.slug} AND cs.season_id = ${seasonId}
      LIMIT 1
    `;
    if (cs[0]) compSeasonByLeague[league.slug] = cs[0].id;
    else console.warn(`⚠ no competition_season for ${league.slug}`);
  }

  let grandTotal = 0;
  const summary: Record<string, { fetched: number; upserted: number; teamMisses: number }> = {};

  for (const [code, league] of Object.entries(LEAGUES)) {
    const compSeasonId = compSeasonByLeague[league.slug];
    if (!compSeasonId) {
      summary[code] = { fetched: 0, upserted: 0, teamMisses: 0 };
      continue;
    }

    console.log(`\n--- ${code} (${league.slug}) ---`);
    const res = await fetch(
      `https://api.football-data.org/v4/competitions/${code}/matches?dateFrom=${DATE_FROM}&dateTo=${DATE_TO}`,
      { headers: { "X-Auth-Token": API_KEY } },
    );
    if (!res.ok) {
      console.warn(`  API ${res.status}`);
      summary[code] = { fetched: 0, upserted: 0, teamMisses: 0 };
      continue;
    }
    const data = await res.json();
    const apiMatches: ApiMatch[] = data.matches ?? [];
    console.log(`  fetched ${apiMatches.length}`);

    let upserted = 0;
    let teamMisses = 0;

    for (const m of apiMatches) {
      // Use the smart matcher (year-suffix strip, punctuation normalize,
      // diacritics, manual aliases) — beats the naive slugify approach.
      const homeRow = await findTeamByName(sql, m.homeTeam.name);
      const awayRow = await findTeamByName(sql, m.awayTeam.name);
      if (!homeRow || !awayRow) {
        teamMisses++;
        continue;
      }

      const externalId = `fd-${m.id}`;
      const status = STATUS_MAP[m.status] || "scheduled";
      const homeScore = m.score.fullTime.home ?? m.score.halfTime.home ?? null;
      const awayScore = m.score.fullTime.away ?? m.score.halfTime.away ?? null;

      const slugVariants = buildMatchSlugWithFallback(
        homeRow.slug,
        awayRow.slug,
        new Date(m.utcDate),
        m.matchday,
        externalId,
      );
      // Use the primary slug; conflict handling on external_id below
      const matchSlug = slugVariants.primary;

      await sql`
        INSERT INTO matches (
          external_id, slug, competition_season_id,
          home_team_id, away_team_id,
          scheduled_at, status,
          home_score, away_score,
          matchday, referee, minute
        ) VALUES (
          ${externalId}, ${matchSlug}, ${compSeasonId},
          ${homeRow.id}, ${awayRow.id},
          ${new Date(m.utcDate).toISOString()}, ${status},
          ${homeScore}, ${awayScore},
          ${m.matchday}, ${m.referees?.[0]?.name ?? null}, ${m.minute}
        )
        ON CONFLICT (external_id) DO UPDATE SET
          status = EXCLUDED.status,
          home_score = EXCLUDED.home_score,
          away_score = EXCLUDED.away_score,
          minute = EXCLUDED.minute,
          updated_at = now()
      `;
      upserted++;
    }
    summary[code] = { fetched: apiMatches.length, upserted, teamMisses };
    grandTotal += upserted;
    console.log(`  upserted ${upserted}, teamMisses ${teamMisses}`);

    // Rate limit between leagues
    await new Promise((r) => setTimeout(r, 6500));
  }

  console.log("\n=== Summary ===");
  console.table(summary);
  console.log(`Total upserted: ${grandTotal}`);

  const finalCount = await sql`
    SELECT count(*) AS c FROM matches m
    JOIN competition_seasons cs ON cs.id = m.competition_season_id
    JOIN seasons s ON s.id = cs.season_id
    WHERE s.label = ${SEASON_LABEL}
  `;
  console.log(`Matches in ${SEASON_LABEL}: ${finalCount[0].c}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
