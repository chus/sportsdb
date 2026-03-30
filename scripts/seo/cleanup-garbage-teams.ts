/**
 * Remove garbage team records from the database
 *
 * Two categories:
 * 1. Competition names stored as teams (Copa Libertadores, UEFA CL, etc.)
 * 2. National teams stored as club teams with wrong country assignments
 * 3. Person names stored as teams
 *
 * Usage:
 *   npx tsx scripts/seo/cleanup-garbage-teams.ts --dry-run
 *   npx tsx scripts/seo/cleanup-garbage-teams.ts
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const dryRun = process.argv.includes("--dry-run");

// National team names that should not exist as club teams
const NATIONAL_TEAM_NAMES = [
  "Argentina", "Austria", "Bolivia", "Brazil", "Cape Verde", "Chile",
  "Colombia", "Croatia", "Denmark", "France", "Germany", "Hungary",
  "Italy", "Mexico", "Paraguay", "Portugal", "Spain", "Switzerland",
  "Uruguay", "Venezuela", "Wales",
];

async function deleteTeam(teamId: string, teamName: string) {
  if (dryRun) {
    console.log(`  [DRY RUN] Would delete: ${teamName}`);
    return;
  }

  // FK-safe deletion order
  await sql`DELETE FROM search_index WHERE id = ${teamId}`;
  await sql`UPDATE transfers SET from_team_id = NULL WHERE from_team_id = ${teamId}`;
  await sql`UPDATE transfers SET to_team_id = NULL WHERE to_team_id = ${teamId}`;
  await sql`DELETE FROM player_team_history WHERE team_id = ${teamId}`;
  await sql`DELETE FROM standings WHERE team_id = ${teamId}`;
  await sql`DELETE FROM team_seasons WHERE team_id = ${teamId}`;
  await sql`DELETE FROM team_venue_history WHERE team_id = ${teamId}`;
  await sql`DELETE FROM matches WHERE home_team_id = ${teamId} OR away_team_id = ${teamId}`;
  await sql`UPDATE competition_seasons SET champion_team_id = NULL WHERE champion_team_id = ${teamId}`;
  await sql`DELETE FROM teams WHERE id = ${teamId}`;

  console.log(`  Deleted: ${teamName}`);
}

async function main() {
  console.log(`\nGarbage Team Cleanup${dryRun ? " (DRY RUN)" : ""}\n`);

  let totalDeleted = 0;

  // 1. Competition names stored as teams
  const compTeams = await sql`
    SELECT id, name, country FROM teams
    WHERE name ~ '^\\d{4}'
    OR name ILIKE '%Copa Libertadores%'
    OR name ILIKE '%Copa Sudamericana%'
    OR name ILIKE '%Champions League%'
    OR name ILIKE '%Europa League%'
    OR name ILIKE '%Conference League%'
    OR name ILIKE '%Ligue 2%'
    OR name ILIKE '%Liga Portugal 2%'
  `;
  console.log(`Competition-name teams: ${compTeams.length}`);
  for (const t of compTeams) {
    await deleteTeam(t.id, t.name);
    totalDeleted++;
  }

  // 2. National teams stored as club teams
  const nationals = await sql`
    SELECT id, name, country FROM teams
    WHERE name = ANY(${NATIONAL_TEAM_NAMES})
  `;
  console.log(`\nNational teams as clubs: ${nationals.length}`);
  for (const t of nationals) {
    await deleteTeam(t.id, `${t.name} (stored as ${t.country} club)`);
    totalDeleted++;
  }

  // 3. Person names stored as teams
  const persons = await sql`
    SELECT id, name, country FROM teams
    WHERE name ILIKE '%Noriega%'
    OR name ILIKE '%Santiago Banos%'
    OR name ILIKE '%Santiago Baños%'
  `;
  console.log(`\nPerson-name teams: ${persons.length}`);
  for (const t of persons) {
    await deleteTeam(t.id, t.name);
    totalDeleted++;
  }

  console.log(`\n${"═".repeat(40)}`);
  console.log(`  Total deleted: ${totalDeleted}`);
  console.log(`${"═".repeat(40)}\n`);
}

main().catch(console.error);
