import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function cleanup() {
  console.log("=== Data Cleanup ===\n");

  // 1. Delete player named "Unknown"
  const badPlayers = await sql`
    SELECT id, name, slug FROM players WHERE name = 'Unknown' OR name = '' OR name IS NULL
  `;
  console.log(`Players with bad names: ${badPlayers.length}`);

  for (const p of badPlayers) {
    console.log(`  Deleting: "${p.name}" (${p.slug})`);

    // Remove from search index first
    await sql`DELETE FROM search_index WHERE id = ${p.id}`;

    // Remove from player_team_history
    await sql`DELETE FROM player_team_history WHERE player_id = ${p.id}`;

    // Remove player
    await sql`DELETE FROM players WHERE id = ${p.id}`;
    console.log(`  Deleted`);
  }

  // 2. Delete orphan players (no team link, no stats, position = Unknown)
  const orphanUnknowns = await sql`
    SELECT p.id, p.name, p.slug
    FROM players p
    WHERE p.position = 'Unknown'
    AND NOT EXISTS (SELECT 1 FROM player_team_history pth WHERE pth.player_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM player_season_stats pss WHERE pss.player_id = p.id)
  `;
  console.log(`\nOrphan Unknown-position players (no team, no stats): ${orphanUnknowns.length}`);

  for (const p of orphanUnknowns) {
    await sql`DELETE FROM search_index WHERE id = ${p.id}`;
    await sql`DELETE FROM players WHERE id = ${p.id}`;
  }
  console.log(`  Deleted ${orphanUnknowns.length} orphan unknowns`);

  // 3. Final counts
  const [total] = await sql`SELECT count(*) FROM players`;
  const [unknowns] = await sql`SELECT count(*) FROM players WHERE position = 'Unknown'`;
  const [nullNat] = await sql`SELECT count(*) FROM players WHERE nationality IS NULL OR nationality = ''`;
  const [nullDob] = await sql`SELECT count(*) FROM players WHERE date_of_birth IS NULL`;
  const [noImage] = await sql`SELECT count(*) FROM players WHERE image_url IS NULL OR image_url = ''`;

  console.log(`\n=== Post-Cleanup Summary ===`);
  console.log(`Total players: ${total.count}`);
  console.log(`Unknown position: ${unknowns.count}`);
  console.log(`NULL nationality: ${nullNat.count}`);
  console.log(`NULL DOB: ${nullDob.count}`);
  console.log(`No image: ${noImage.count}`);

  // Data completeness
  const t = Number(total.count);
  const natKnown = t - Number(nullNat.count);
  const dobKnown = t - Number(nullDob.count);
  const posKnown = t - Number(unknowns.count);
  const imgKnown = t - Number(noImage.count);

  console.log(`\nData completeness:`);
  console.log(`  Position: ${posKnown}/${t} (${((posKnown / t) * 100).toFixed(1)}%)`);
  console.log(`  Nationality: ${natKnown}/${t} (${((natKnown / t) * 100).toFixed(1)}%)`);
  console.log(`  DOB: ${dobKnown}/${t} (${((dobKnown / t) * 100).toFixed(1)}%)`);
  console.log(`  Image: ${imgKnown}/${t} (${((imgKnown / t) * 100).toFixed(1)}%)`);

  console.log("\n=== Done ===");
}

cleanup().catch(console.error);
