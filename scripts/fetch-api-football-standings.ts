/**
 * Fetch standings from API-Football for leagues not covered by football-data.org
 *
 * API-Football free tier: 100 requests/day
 * Register at: https://www.api-football.com/
 *
 * Usage:
 *   API_FOOTBALL_KEY=your_key npx tsx scripts/fetch-api-football-standings.ts
 *   npx tsx scripts/fetch-api-football-standings.ts --dry-run
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
const API_KEY = process.env.API_FOOTBALL_KEY;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

if (!API_KEY) {
  console.error("API_FOOTBALL_KEY environment variable is required");
  console.error("Register for free at: https://www.api-football.com/");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// API-Football league IDs mapped to our slugs
// Find league IDs at: https://www.api-football.com/demo
const LEAGUE_MAP: Record<string, { id: number; season: number }> = {
  // South America
  "brasileirao-serie-a": { id: 71, season: 2024 },
  "liga-profesional-argentina": { id: 128, season: 2024 },

  // North/Central America
  "liga-mx": { id: 262, season: 2024 },
  "mls": { id: 253, season: 2024 },

  // Europe (not covered by football-data.org free tier)
  "eredivisie": { id: 88, season: 2024 },
  "primeira-liga": { id: 94, season: 2024 },

  // Other South American leagues
  "primera-division-de-chile": { id: 265, season: 2024 },
  "liga-betplay": { id: 239, season: 2024 }, // Colombia
  "primera-division-de-uruguay": { id: 268, season: 2024 },
  "liga-1-peru": { id: 281, season: 2024 },

  // Champions League
  "uefa-champions-league": { id: 2, season: 2024 },
};

interface APIFootballStanding {
  rank: number;
  team: {
    id: number;
    name: string;
    logo: string;
  };
  points: number;
  goalsDiff: number;
  group: string;
  form: string;
  status: string;
  description: string | null;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: {
      for: number;
      against: number;
    };
  };
}

interface APIFootballResponse {
  response: Array<{
    league: {
      id: number;
      name: string;
      country: string;
      season: number;
      standings: APIFootballStanding[][];
    };
  }>;
}

async function fetchStandings(leagueId: number, season: number): Promise<APIFootballStanding[]> {
  const url = `https://v3.football.api-sports.io/standings?league=${leagueId}&season=${season}`;
  console.log(`  Fetching league ${leagueId} season ${season}...`);

  const res = await fetch(url, {
    headers: {
      "x-rapidapi-key": API_KEY!,
      "x-rapidapi-host": "v3.football.api-sports.io",
    },
  });

  if (!res.ok) {
    console.error(`  Failed to fetch: ${res.status} ${res.statusText}`);
    return [];
  }

  const data: APIFootballResponse = await res.json();

  if (!data.response || data.response.length === 0) {
    console.log(`  No data available`);
    return [];
  }

  // Flatten all groups (for Champions League, etc.)
  const allStandings = data.response[0].league.standings.flat();
  return allStandings;
}

async function getTeamByName(name: string): Promise<{ id: string; slug: string } | null> {
  // Normalize team names
  const normalizedName = name
    .replace(/\s+(FC|CF|SC|AC|AS|SS|US|Calcio|Club|Clube)$/i, "")
    .replace(/^(FC|CF|SC|AC|AS|SS|US)\s+/i, "")
    .trim();

  // Try exact match
  const exact = await sql`
    SELECT id, slug FROM teams
    WHERE name = ${name} OR short_name = ${name}
    LIMIT 1
  `;
  if (exact.length > 0) return exact[0];

  // Try partial match
  const partial = await sql`
    SELECT id, slug FROM teams
    WHERE name ILIKE ${`%${normalizedName}%`} OR short_name ILIKE ${`%${normalizedName}%`}
    LIMIT 1
  `;
  if (partial.length > 0) return partial[0];

  return null;
}

async function ensureTeamExists(standing: APIFootballStanding, country: string): Promise<string | null> {
  let team = await getTeamByName(standing.team.name);

  if (team) {
    // Update logo if missing
    if (standing.team.logo) {
      await sql`
        UPDATE teams SET logo_url = ${standing.team.logo}
        WHERE id = ${team.id} AND logo_url IS NULL
      `;
    }
    return team.id;
  }

  // Create new team
  const slug = standing.team.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const result = await sql`
    INSERT INTO teams (name, slug, country, logo_url)
    VALUES (${standing.team.name}, ${slug}, ${country}, ${standing.team.logo || null})
    ON CONFLICT (slug) DO UPDATE SET logo_url = COALESCE(teams.logo_url, EXCLUDED.logo_url)
    RETURNING id
  `;

  // Add to search index
  await sql`
    INSERT INTO search_index (id, entity_type, slug, name, subtitle, meta)
    VALUES (${result[0].id}, 'team', ${slug}, ${standing.team.name}, ${country}, null)
    ON CONFLICT (id) DO NOTHING
  `;

  console.log(`    Created team: ${standing.team.name}`);
  return result[0].id;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log("=== API-Football Standings Fetcher ===");
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}\n`);

  let totalRequests = 0;

  for (const [slug, config] of Object.entries(LEAGUE_MAP)) {
    console.log(`\nProcessing ${slug}...`);

    // Get competition
    const comp = await sql`
      SELECT c.id, c.country, cs.id as competition_season_id
      FROM competitions c
      JOIN competition_seasons cs ON cs.competition_id = c.id
      JOIN seasons s ON s.id = cs.season_id
      WHERE c.slug = ${slug} AND s.is_current = true
      LIMIT 1
    `;

    if (comp.length === 0) {
      console.log(`  Competition ${slug} not found or no current season - skipping`);
      continue;
    }

    const competitionSeasonId = comp[0].competition_season_id;
    const country = comp[0].country || "Unknown";
    console.log(`  Found: season_id=${competitionSeasonId}, country=${country}`);

    if (dryRun) {
      console.log(`  [DRY-RUN] Would fetch standings for league ${config.id}`);
      continue;
    }

    // Fetch standings
    const standings = await fetchStandings(config.id, config.season);
    totalRequests++;
    console.log(`  Fetched ${standings.length} teams`);

    if (standings.length === 0) continue;

    let inserted = 0;
    for (const entry of standings) {
      const teamId = await ensureTeamExists(entry, country);
      if (!teamId) continue;

      await sql`
        INSERT INTO standings (
          competition_season_id, team_id, position, played, won, drawn, lost,
          goals_for, goals_against, goal_difference, points, form
        )
        VALUES (
          ${competitionSeasonId}, ${teamId}, ${entry.rank}, ${entry.all.played},
          ${entry.all.win}, ${entry.all.draw}, ${entry.all.lose},
          ${entry.all.goals.for}, ${entry.all.goals.against}, ${entry.goalsDiff},
          ${entry.points}, ${entry.form || null}
        )
        ON CONFLICT (competition_season_id, team_id)
        DO UPDATE SET
          position = EXCLUDED.position,
          played = EXCLUDED.played,
          won = EXCLUDED.won,
          drawn = EXCLUDED.drawn,
          lost = EXCLUDED.lost,
          goals_for = EXCLUDED.goals_for,
          goals_against = EXCLUDED.goals_against,
          goal_difference = EXCLUDED.goal_difference,
          points = EXCLUDED.points,
          form = EXCLUDED.form,
          updated_at = now()
      `;
      inserted++;
    }

    console.log(`  Inserted ${inserted} standings`);

    // Rate limit: 10 requests per minute for free tier
    await new Promise(r => setTimeout(r, 6500));
  }

  console.log(`\nTotal API requests made: ${totalRequests}`);

  // Show summary
  const counts = await sql`
    SELECT c.name, COUNT(s.id) as standings
    FROM competitions c
    JOIN competition_seasons cs ON cs.competition_id = c.id
    JOIN standings s ON s.competition_season_id = cs.id
    GROUP BY c.name
    ORDER BY standings DESC
  `;

  console.log("\nStandings per competition:");
  counts.forEach((c: { name: string; standings: string }) =>
    console.log(`  ${c.name}: ${c.standings}`)
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
