import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function audit() {
  console.log("=== SportsDB Data Quality Audit ===\n");

  // 1. PLAYERS
  console.log("--- PLAYERS ---");
  const [playerCount] = await sql`SELECT count(*) FROM players`;
  console.log(`Total players: ${playerCount.count}`);

  const unknownPosition = await sql`SELECT count(*) FROM players WHERE position = 'Unknown' OR position IS NULL`;
  console.log(`Unknown/null position: ${unknownPosition[0].count}`);

  const unknownNationality = await sql`SELECT count(*) FROM players WHERE nationality IS NULL OR nationality = '' OR nationality = 'Unknown'`;
  console.log(`Unknown/null nationality: ${unknownNationality[0].count}`);

  const nullName = await sql`SELECT count(*) FROM players WHERE name IS NULL OR name = '' OR name = 'Unknown'`;
  console.log(`Null/empty/Unknown name: ${nullName[0].count}`);

  const nullDob = await sql`SELECT count(*) FROM players WHERE date_of_birth IS NULL`;
  console.log(`Null date of birth: ${nullDob[0].count}`);

  const nullHeight = await sql`SELECT count(*) FROM players WHERE height_cm IS NULL`;
  console.log(`Null height: ${nullHeight[0].count}`);

  const nullFoot = await sql`SELECT count(*) FROM players WHERE preferred_foot IS NULL OR preferred_foot = ''`;
  console.log(`Null preferred foot: ${nullFoot[0].count}`);

  const nullImage = await sql`SELECT count(*) FROM players WHERE image_url IS NULL OR image_url = ''`;
  console.log(`Null image URL: ${nullImage[0].count}`);

  // Position breakdown
  const posBreakdown = await sql`SELECT position, count(*) FROM players GROUP BY position ORDER BY count DESC`;
  console.log("\nPosition breakdown:");
  for (const row of posBreakdown) {
    console.log(`  ${row.position || 'NULL'}: ${row.count}`);
  }

  // Sample Unknown position players with their team links
  const unknownSamples = await sql`
    SELECT p.name, p.slug, p.nationality, p.position, p.status,
           t.name as team_name, pth.valid_to
    FROM players p
    LEFT JOIN player_team_history pth ON pth.player_id = p.id
    LEFT JOIN teams t ON t.id = pth.team_id
    WHERE p.position = 'Unknown'
    ORDER BY p.name
    LIMIT 30
  `;
  if (unknownSamples.length > 0) {
    console.log("\nSample Unknown-position players (with team):");
    for (const p of unknownSamples) {
      const current = p.valid_to === null ? " [CURRENT]" : "";
      console.log(`  ${p.name} - team: ${p.team_name || 'none'}${current}, nationality: ${p.nationality || 'null'}`);
    }
  }

  // 2. TEAMS
  console.log("\n--- TEAMS ---");
  const [teamCount] = await sql`SELECT count(*) FROM teams`;
  console.log(`Total teams: ${teamCount.count}`);

  const teamNoLogo = await sql`SELECT count(*) FROM teams WHERE logo_url IS NULL OR logo_url = ''`;
  console.log(`No logo: ${teamNoLogo[0].count}`);

  const teamNoCity = await sql`SELECT count(*) FROM teams WHERE city IS NULL OR city = ''`;
  console.log(`No city: ${teamNoCity[0].count}`);

  // 3. MATCHES
  console.log("\n--- MATCHES ---");
  const [matchCount] = await sql`SELECT count(*) FROM matches`;
  console.log(`Total matches: ${matchCount.count}`);

  const matchNoVenue = await sql`SELECT count(*) FROM matches WHERE venue_id IS NULL`;
  console.log(`Matches with no venue: ${matchNoVenue[0].count}`);

  // 4. SQUAD DATA (player_team_history)
  console.log("\n--- SQUAD DATA (player_team_history) ---");
  const [squadCount] = await sql`SELECT count(*) FROM player_team_history`;
  console.log(`Total player-team links: ${squadCount.count}`);

  const activeSquads = await sql`SELECT count(*) FROM player_team_history WHERE valid_to IS NULL`;
  console.log(`Active (current) links: ${activeSquads[0].count}`);

  // Players not in any squad
  const orphanPlayers = await sql`SELECT count(*) FROM players p WHERE NOT EXISTS (SELECT 1 FROM player_team_history pth WHERE pth.player_id = p.id)`;
  console.log(`Players not in any team (ever): ${orphanPlayers[0].count}`);

  // Players with no CURRENT team
  const noCurrentTeam = await sql`SELECT count(*) FROM players p WHERE NOT EXISTS (SELECT 1 FROM player_team_history pth WHERE pth.player_id = p.id AND pth.valid_to IS NULL)`;
  console.log(`Players with no current team: ${noCurrentTeam[0].count}`);

  // Teams with empty current squads
  const emptySquads = await sql`
    SELECT t.name, t.slug
    FROM teams t
    WHERE NOT EXISTS (
      SELECT 1 FROM player_team_history pth
      WHERE pth.team_id = t.id AND pth.valid_to IS NULL
    )
    ORDER BY t.name
  `;
  console.log(`Teams with no current squad: ${emptySquads.length}`);

  // 5. PLAYER STATS
  console.log("\n--- PLAYER STATS ---");
  const [statsCount] = await sql`SELECT count(*) FROM player_season_stats`;
  console.log(`Total stat rows: ${statsCount.count}`);

  // Players with stats but Unknown position
  const unknownWithStats = await sql`
    SELECT count(DISTINCT p.id)
    FROM players p
    INNER JOIN player_season_stats pss ON pss.player_id = p.id
    WHERE p.position = 'Unknown'
  `;
  console.log(`Unknown-position players WITH stats: ${unknownWithStats[0].count}`);

  // 6. Check what appears on search page
  console.log("\n--- SEARCH/BROWSE EXPOSURE ---");

  // How many Unknown players are in current squads (shown on team pages)?
  const unknownInSquads = await sql`
    SELECT count(*)
    FROM players p
    INNER JOIN player_team_history pth ON pth.player_id = p.id AND pth.valid_to IS NULL
    WHERE p.position = 'Unknown'
  `;
  console.log(`Unknown-position players in CURRENT squads (visible on team pages): ${unknownInSquads[0].count}`);

  // List them
  if (Number(unknownInSquads[0].count) > 0) {
    const unknownInSquadsList = await sql`
      SELECT p.name, p.slug, t.name as team_name, t.slug as team_slug
      FROM players p
      INNER JOIN player_team_history pth ON pth.player_id = p.id AND pth.valid_to IS NULL
      INNER JOIN teams t ON t.id = pth.team_id
      WHERE p.position = 'Unknown'
      ORDER BY t.name, p.name
      LIMIT 50
    `;
    console.log("Unknown-position players in current squads:");
    for (const p of unknownInSquadsList) {
      console.log(`  ${p.name} (${p.slug}) → ${p.team_name}`);
    }
  }

  // Are Unknown players appearing in search index?
  const searchIndexUnknown = await sql`
    SELECT count(*) FROM search_index WHERE entity_type = 'player'
    AND id IN (SELECT id FROM players WHERE position = 'Unknown')
  `;
  console.log(`\nUnknown-position players in search index: ${searchIndexUnknown[0].count}`);

  // 7. DATA COMPLETENESS SUMMARY
  console.log("\n=== DATA COMPLETENESS SUMMARY ===");
  const total = Number(playerCount.count);
  const unknownPos = Number(unknownPosition[0].count);
  const unknownNat = Number(unknownNationality[0].count);
  const unknownDob = Number(nullDob[0].count);
  const unknownImg = Number(nullImage[0].count);

  console.log(`Players: ${total}`);
  console.log(`  Position known: ${total - unknownPos} (${((total - unknownPos) / total * 100).toFixed(1)}%)`);
  console.log(`  Nationality known: ${total - unknownNat} (${((total - unknownNat) / total * 100).toFixed(1)}%)`);
  console.log(`  DOB known: ${total - unknownDob} (${((total - unknownDob) / total * 100).toFixed(1)}%)`);
  console.log(`  Has image: ${total - unknownImg} (${((total - unknownImg) / total * 100).toFixed(1)}%)`);

  console.log("\n=== Audit Complete ===");
}

audit().catch(console.error);
