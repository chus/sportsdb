/**
 * Fetch standings from football-data.org and populate the database
 *
 * Usage: npx tsx scripts/fetch-standings.ts
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
const API_KEY = "226de578459844eeb0c5539b1859ed1e";

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// Map football-data.org codes to our slugs
const LEAGUE_MAP: Record<string, string> = {
  PL: "premier-league",
  PD: "la-liga",
  BL1: "bundesliga",
  SA: "serie-a",
  FL1: "ligue-1",
};

interface StandingEntry {
  position: number;
  team: {
    id: number;
    name: string;
    shortName: string;
    crest: string;
  };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  form: string | null;
}

async function fetchStandings(leagueCode: string): Promise<StandingEntry[]> {
  const res = await fetch(
    `https://api.football-data.org/v4/competitions/${leagueCode}/standings`,
    { headers: { "X-Auth-Token": API_KEY } }
  );

  if (!res.ok) {
    console.error(`Failed to fetch ${leagueCode}:`, res.status);
    return [];
  }

  const data = await res.json();
  return data.standings?.[0]?.table || [];
}

async function getTeamByName(name: string): Promise<{ id: string; slug: string } | null> {
  // Try exact match first
  const exact = await sql`
    SELECT id, slug FROM teams WHERE name = ${name} OR short_name = ${name} LIMIT 1
  `;
  if (exact.length > 0) return exact[0];

  // Try partial match
  const partial = await sql`
    SELECT id, slug FROM teams
    WHERE name ILIKE ${`%${name}%`} OR short_name ILIKE ${`%${name}%`}
    LIMIT 1
  `;
  if (partial.length > 0) return partial[0];

  // Try without common suffixes
  const cleanName = name.replace(/ FC$| CF$| SC$/i, "").trim();
  const clean = await sql`
    SELECT id, slug FROM teams
    WHERE name ILIKE ${`%${cleanName}%`} OR short_name ILIKE ${`%${cleanName}%`}
    LIMIT 1
  `;
  return clean[0] || null;
}

async function main() {
  console.log("=== Fetching Standings ===\n");

  for (const [code, slug] of Object.entries(LEAGUE_MAP)) {
    console.log(`\nProcessing ${code} (${slug})...`);

    // Get competition and current season
    const comp = await sql`
      SELECT c.id, cs.id as competition_season_id
      FROM competitions c
      JOIN competition_seasons cs ON cs.competition_id = c.id
      JOIN seasons s ON s.id = cs.season_id
      WHERE c.slug = ${slug} AND s.is_current = true
      LIMIT 1
    `;

    if (comp.length === 0) {
      console.log(`  Competition ${slug} not found or no current season`);
      continue;
    }

    const competitionSeasonId = comp[0].competition_season_id;
    console.log(`  Competition season ID: ${competitionSeasonId}`);

    // Fetch standings from API
    const standings = await fetchStandings(code);
    console.log(`  Fetched ${standings.length} teams`);

    let inserted = 0;
    let notFound = 0;

    for (const entry of standings) {
      const team = await getTeamByName(entry.team.name);

      if (!team) {
        console.log(`  Team not found: ${entry.team.name}`);
        notFound++;
        continue;
      }

      // Upsert standing
      await sql`
        INSERT INTO standings (
          competition_season_id, team_id, position, played, won, drawn, lost,
          goals_for, goals_against, goal_difference, points, form
        )
        VALUES (
          ${competitionSeasonId}, ${team.id}, ${entry.position}, ${entry.playedGames},
          ${entry.won}, ${entry.draw}, ${entry.lost},
          ${entry.goalsFor}, ${entry.goalsAgainst}, ${entry.goalDifference},
          ${entry.points}, ${entry.form}
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

    console.log(`  Inserted: ${inserted}, Not found: ${notFound}`);

    // Rate limit
    await new Promise((r) => setTimeout(r, 7000));
  }

  // Show final counts
  const counts = await sql`SELECT COUNT(*) as count FROM standings`;
  console.log(`\nTotal standings in DB: ${counts[0].count}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
