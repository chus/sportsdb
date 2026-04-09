/**
 * Fetch matches for current season across all major competitions.
 * Assumes teams already exist (matched by slug).
 *
 * Usage: npx tsx scripts/fetch-matches-only.ts
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";
import { eq, and, inArray } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { buildMatchSlug } from "../src/lib/utils/match-slug";

config({ path: ".env.local" });

const API_KEY = process.env.FOOTBALL_DATA_API_KEY!;
const BASE_URL = "https://api.football-data.org/v4";

if (!API_KEY) {
  console.error("Missing FOOTBALL_DATA_API_KEY");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

const COMPETITIONS = [
  { code: "PL", slug: "premier-league" },
  { code: "PD", slug: "la-liga" },
  { code: "BL1", slug: "bundesliga" },
  { code: "SA", slug: "serie-a" },
  { code: "FL1", slug: "ligue-1" },
  { code: "CL", slug: "uefa-champions-league" },
  { code: "ELC", slug: "championship" },
  { code: "DED", slug: "eredivisie" },
  { code: "PPL", slug: "primeira-liga" },
];

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

const RATE_LIMIT_MS = 6500;
let lastRequestTime = 0;

async function fetchApi(url: string): Promise<any> {
  const now = Date.now();
  const wait = RATE_LIMIT_MS - (now - lastRequestTime);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestTime = Date.now();

  const res = await fetch(url, { headers: { "X-Auth-Token": API_KEY } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err}`);
  }
  return res.json();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  console.log("Fetching matches for all major competitions...\n");

  // Build slug -> id maps
  const allTeams = await db.select({ id: schema.teams.id, slug: schema.teams.slug, name: schema.teams.name }).from(schema.teams);
  const teamBySlug = new Map(allTeams.map((t) => [t.slug, { id: t.id, slug: t.slug }]));
  const teamByName = new Map(allTeams.map((t) => [t.name.toLowerCase(), { id: t.id, slug: t.slug }]));

  let totalMatches = 0;

  for (const comp of COMPETITIONS) {
    console.log(`\n== ${comp.code} (${comp.slug}) ==`);

    // Find competitionSeasonId
    const compSeasonRows = await sql`
      SELECT cs.id
      FROM competition_seasons cs
      INNER JOIN competitions c ON c.id = cs.competition_id
      INNER JOIN seasons s ON s.id = cs.season_id
      WHERE c.slug = ${comp.slug}
        AND s.is_current = true
      LIMIT 1
    `;

    if (compSeasonRows.length === 0) {
      console.log(`  SKIP: no current season found for ${comp.slug}`);
      continue;
    }

    const compSeasonId = compSeasonRows[0].id;

    let data;
    try {
      data = await fetchApi(`${BASE_URL}/competitions/${comp.code}/matches`);
    } catch (err) {
      console.log(`  ERROR fetching matches: ${(err as Error).message}`);
      continue;
    }

    const apiMatches = data.matches || [];
    console.log(`  ${apiMatches.length} matches from API`);

    let inserted = 0;
    let skipped = 0;

    for (const m of apiMatches) {
      // Try to match teams: by slug derived from API name, then by exact name
      const homeApiSlug = slugify(m.homeTeam.name);
      const awayApiSlug = slugify(m.awayTeam.name);

      let home = teamBySlug.get(homeApiSlug) || teamByName.get(m.homeTeam.name.toLowerCase());
      let away = teamBySlug.get(awayApiSlug) || teamByName.get(m.awayTeam.name.toLowerCase());

      // Try shortName slug fallback
      if (!home && m.homeTeam.shortName) {
        home = teamBySlug.get(slugify(m.homeTeam.shortName));
      }
      if (!away && m.awayTeam.shortName) {
        away = teamBySlug.get(slugify(m.awayTeam.shortName));
      }

      if (!home || !away) {
        skipped++;
        continue;
      }

      const externalId = `fd-${m.id}`;
      const status = STATUS_MAP[m.status] || "scheduled";
      const scheduledAt = new Date(m.utcDate);
      const matchSlug = buildMatchSlug(home.slug, away.slug, scheduledAt);
      const homeScore = m.score?.fullTime?.home ?? null;
      const awayScore = m.score?.fullTime?.away ?? null;

      try {
        await db
          .insert(schema.matches)
          .values({
            externalId,
            slug: matchSlug,
            competitionSeasonId: compSeasonId,
            homeTeamId: home.id,
            awayTeamId: away.id,
            matchday: m.matchday,
            scheduledAt,
            status,
            homeScore,
            awayScore,
            referee: m.referees?.[0]?.name || null,
          })
          .onConflictDoUpdate({
            target: schema.matches.externalId,
            set: {
              status,
              homeScore,
              awayScore,
              matchday: m.matchday,
              scheduledAt,
              updatedAt: new Date(),
            },
          });
        inserted++;
      } catch (err) {
        // Slug collision — fall back to externalId-suffixed slug
        const fallbackSlug = `${matchSlug}-${externalId.slice(3, 9)}`;
        try {
          await db
            .insert(schema.matches)
            .values({
              externalId,
              slug: fallbackSlug,
              competitionSeasonId: compSeasonId,
              homeTeamId: home.id,
              awayTeamId: away.id,
              matchday: m.matchday,
              scheduledAt,
              status,
              homeScore,
              awayScore,
              referee: m.referees?.[0]?.name || null,
            })
            .onConflictDoUpdate({
              target: schema.matches.externalId,
              set: {
                status,
                homeScore,
                awayScore,
                matchday: m.matchday,
                scheduledAt,
                updatedAt: new Date(),
              },
            });
          inserted++;
        } catch (err2) {
          skipped++;
        }
      }
    }

    console.log(`  Inserted/updated: ${inserted}, skipped: ${skipped}`);
    totalMatches += inserted;
  }

  console.log(`\n=== Total matches inserted: ${totalMatches} ===`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
