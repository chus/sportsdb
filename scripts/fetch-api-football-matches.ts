/**
 * Fetch matches from API-Football for leagues not covered by football-data.org
 *
 * API-Football free tier: 100 requests/day
 *
 * Usage:
 *   npx tsx scripts/fetch-api-football-matches.ts
 *   npx tsx scripts/fetch-api-football-matches.ts --dry-run
 *   npx tsx scripts/fetch-api-football-matches.ts --league=liga-profesional-argentina
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
const API_KEY = process.env.API_FOOTBALL_KEY;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

if (!API_KEY) {
  console.error("API_FOOTBALL_KEY environment variable is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// API-Football league IDs mapped to our slugs
const LEAGUE_MAP: Record<string, { id: number; season: number }> = {
  // South America
  "brasileirao-serie-a": { id: 71, season: 2024 },
  "liga-profesional-argentina": { id: 128, season: 2024 },
  "primera-division-de-chile": { id: 265, season: 2024 },
  "liga-betplay": { id: 239, season: 2024 },
  "primera-division-de-uruguay": { id: 268, season: 2024 },
  "liga-1-peru": { id: 281, season: 2024 },

  // North/Central America
  "liga-mx": { id: 262, season: 2024 },
  "mls": { id: 253, season: 2024 },
};

interface APIMatch {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    venue: { id: number; name: string; city: string };
    status: { long: string; short: string; elapsed: number | null };
  };
  league: {
    id: number;
    name: string;
    round: string;
  };
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null };
    away: { id: number; name: string; logo: string; winner: boolean | null };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
  };
}

interface APIResponse {
  response: APIMatch[];
  paging: { current: number; total: number };
}

const RATE_LIMIT_MS = 6500;
let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<any> {
  const now = Date.now();
  const timeSince = now - lastRequestTime;
  if (timeSince < RATE_LIMIT_MS) {
    const wait = RATE_LIMIT_MS - timeSince;
    console.log(`  ⏳ Rate limit: waiting ${Math.round(wait / 1000)}s...`);
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestTime = Date.now();

  const res = await fetch(url, {
    headers: {
      "x-rapidapi-key": API_KEY!,
      "x-rapidapi-host": "v3.football.api-sports.io",
    },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildMatchSlug(homeSlug: string, awaySlug: string, date: Date): string {
  const dateStr = date.toISOString().split("T")[0];
  return `${homeSlug}-vs-${awaySlug}-${dateStr}`;
}

async function getTeamByName(name: string): Promise<{ id: string; slug: string } | null> {
  const normalizedName = name
    .replace(/\s+(FC|CF|SC|AC|AS|SS|US|Calcio|Club|Clube)$/i, "")
    .replace(/^(FC|CF|SC|AC|AS|SS|US)\s+/i, "")
    .trim();

  const exact = await sql`
    SELECT id, slug FROM teams
    WHERE name = ${name} OR short_name = ${name}
    LIMIT 1
  `;
  if (exact.length > 0) return exact[0] as { id: string; slug: string };

  const partial = await sql`
    SELECT id, slug FROM teams
    WHERE name ILIKE ${`%${normalizedName}%`} OR short_name ILIKE ${`%${normalizedName}%`}
    LIMIT 1
  `;
  if (partial.length > 0) return partial[0] as { id: string; slug: string };

  return null;
}

async function ensureTeamExists(
  apiTeam: { id: number; name: string; logo: string },
  country: string
): Promise<{ id: string; slug: string } | null> {
  let team = await getTeamByName(apiTeam.name);

  if (team) {
    // Update logo if missing
    if (apiTeam.logo) {
      await sql`
        UPDATE teams SET logo_url = ${apiTeam.logo}
        WHERE id = ${team.id} AND logo_url IS NULL
      `;
    }
    return team;
  }

  // Create new team
  const slug = slugify(apiTeam.name);

  const result = await sql`
    INSERT INTO teams (name, slug, country, logo_url)
    VALUES (${apiTeam.name}, ${slug}, ${country}, ${apiTeam.logo || null})
    ON CONFLICT (slug) DO UPDATE SET logo_url = COALESCE(teams.logo_url, EXCLUDED.logo_url)
    RETURNING id, slug
  `;

  console.log(`    Created team: ${apiTeam.name}`);
  return result[0] as { id: string; slug: string };
}

function parseMatchday(round: string | null): number | null {
  if (!round) return null;
  // Extract number from strings like "Regular Season - 24" or "2nd Phase - 1"
  const match = round.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

function getMatchStatus(apiStatus: string): string {
  const statusMap: Record<string, string> = {
    FT: "finished",
    AET: "finished",
    PEN: "finished",
    NS: "scheduled",
    "1H": "live",
    HT: "live",
    "2H": "live",
    ET: "live",
    BT: "live",
    P: "live",
    SUSP: "suspended",
    INT: "interrupted",
    PST: "postponed",
    CANC: "cancelled",
    ABD: "abandoned",
    AWD: "awarded",
    WO: "walkover",
    TBD: "scheduled",
  };
  return statusMap[apiStatus] || "scheduled";
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const leagueArg = process.argv.find((a) => a.startsWith("--league="));
  const singleLeague = leagueArg ? leagueArg.split("=")[1] : null;

  console.log("=== API-Football Matches Fetcher ===");
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  if (singleLeague) console.log(`League filter: ${singleLeague}`);
  console.log();

  const leaguesToProcess = singleLeague
    ? { [singleLeague]: LEAGUE_MAP[singleLeague] }
    : LEAGUE_MAP;

  let totalMatches = 0;
  let totalRequests = 0;

  for (const [slug, config] of Object.entries(leaguesToProcess)) {
    if (!config) {
      console.log(`Unknown league: ${slug}`);
      continue;
    }

    console.log(`\n📋 Processing ${slug}...`);

    // Get competition season
    const comp = await sql`
      SELECT c.id, c.country, cs.id as competition_season_id
      FROM competitions c
      JOIN competition_seasons cs ON cs.competition_id = c.id
      JOIN seasons s ON s.id = cs.season_id
      WHERE c.slug = ${slug} AND s.is_current = true
      LIMIT 1
    `;

    if (comp.length === 0) {
      console.log(`  ⚠️ Competition ${slug} not found or no current season`);
      continue;
    }

    const competitionSeasonId = comp[0].competition_season_id;
    const country = comp[0].country || "Unknown";
    console.log(`  Competition season: ${competitionSeasonId}`);

    if (dryRun) {
      console.log(`  [DRY-RUN] Would fetch matches for league ${config.id}`);
      continue;
    }

    // Fetch finished matches
    console.log(`  Fetching finished matches...`);
    const finishedUrl = `https://v3.football.api-sports.io/fixtures?league=${config.id}&season=${config.season}&status=FT-AET-PEN`;
    const finishedData: APIResponse = await rateLimitedFetch(finishedUrl);
    totalRequests++;

    // Fetch upcoming matches
    console.log(`  Fetching upcoming matches...`);
    const upcomingUrl = `https://v3.football.api-sports.io/fixtures?league=${config.id}&season=${config.season}&status=NS-TBD`;
    const upcomingData: APIResponse = await rateLimitedFetch(upcomingUrl);
    totalRequests++;

    const allMatches = [...finishedData.response, ...upcomingData.response];
    console.log(`  Found ${allMatches.length} matches (${finishedData.response.length} finished, ${upcomingData.response.length} upcoming)`);

    let inserted = 0;
    let skipped = 0;

    for (const match of allMatches) {
      const homeTeam = await ensureTeamExists(match.teams.home, country);
      const awayTeam = await ensureTeamExists(match.teams.away, country);

      if (!homeTeam || !awayTeam) {
        skipped++;
        continue;
      }

      const matchDate = new Date(match.fixture.date);
      const matchSlug = buildMatchSlug(homeTeam.slug, awayTeam.slug, matchDate);
      const status = getMatchStatus(match.fixture.status.short);

      try {
        await sql`
          INSERT INTO matches (
            slug, competition_season_id, home_team_id, away_team_id,
            matchday, scheduled_at, status, home_score, away_score, referee
          )
          VALUES (
            ${matchSlug}, ${competitionSeasonId}, ${homeTeam.id}, ${awayTeam.id},
            ${parseMatchday(match.league.round)}, ${matchDate.toISOString()},
            ${status}, ${match.goals.home}, ${match.goals.away},
            ${match.fixture.referee || null}
          )
          ON CONFLICT (slug) DO UPDATE SET
            status = EXCLUDED.status,
            home_score = EXCLUDED.home_score,
            away_score = EXCLUDED.away_score,
            updated_at = NOW()
        `;
        inserted++;
      } catch (err: any) {
        if (!err.message.includes("duplicate")) {
          console.log(`    ❌ Error inserting match: ${err.message}`);
        }
        skipped++;
      }
    }

    console.log(`  ✅ Inserted ${inserted} matches (${skipped} skipped)`);
    totalMatches += inserted;
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Total matches inserted: ${totalMatches}`);
  console.log(`Total API requests: ${totalRequests}`);

  // Show match counts by competition
  const counts = await sql`
    SELECT c.name, COUNT(m.id) as matches
    FROM competitions c
    JOIN competition_seasons cs ON cs.competition_id = c.id
    JOIN matches m ON m.competition_season_id = cs.id
    GROUP BY c.name
    ORDER BY matches DESC
  `;

  console.log("\nMatches per competition:");
  counts.forEach((c: { name: string; matches: string }) =>
    console.log(`  ${c.name}: ${c.matches}`)
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
