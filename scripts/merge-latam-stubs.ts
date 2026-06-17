/**
 * Merge empty wikipedia-era club stubs into their live API-Football rows.
 *
 * For some LATAM clubs two rows exist: an empty stub carrying the canonical
 * name but no provider mapping or data (e.g. "Club León"), and the live row
 * the af sync writes to under a short name (e.g. "Leon", af-mapped, with
 * fixtures). This repoints any stray data off the stub, deletes it, and
 * renames the live row to the canonical name. The stub's old slug is
 * 301-redirected in middleware (TEAM_SLUG_ALIASES).
 *
 * NOT touched: the four distinct "Nacional" clubs (Colombia / Uruguay /
 * Paraguay / Portugal's C.D. Nacional) — a normalizer groups them but they
 * are different clubs.
 *
 * Usage: npx tsx scripts/merge-latam-stubs.ts [--dry-run]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

const DRY_RUN = process.argv.includes("--dry-run");

// [stub slug (deleted), live slug (kept), canonical name to set on live]
const PAIRS: Array<[string, string, string]> = [
  ["club-leon", "leon", "Club León"],
  ["club-atletico-huracan", "huracan", "Club Atlético Huracán"],
];

async function repointAndDelete(sql: ReturnType<typeof neon>, stubId: string, liveId: string) {
  await sql`
    UPDATE external_ids x SET entity_id = ${liveId}
    WHERE x.entity_id = ${stubId} AND x.entity_type = 'team'
      AND NOT EXISTS (SELECT 1 FROM external_ids y WHERE y.provider=x.provider AND y.provider_id=x.provider_id AND y.entity_type=x.entity_type AND y.entity_id=${liveId})
  `;
  await sql`DELETE FROM external_ids WHERE entity_id = ${stubId} AND entity_type = 'team'`;
  await sql`UPDATE matches SET home_team_id = ${liveId} WHERE home_team_id = ${stubId}`;
  await sql`UPDATE matches SET away_team_id = ${liveId} WHERE away_team_id = ${stubId}`;
  await sql`
    UPDATE player_team_history pth SET team_id = ${liveId}
    WHERE team_id = ${stubId} AND NOT EXISTS (
      SELECT 1 FROM player_team_history p2 WHERE p2.player_id=pth.player_id AND p2.team_id=${liveId} AND p2.valid_from=pth.valid_from)
  `;
  await sql`DELETE FROM player_team_history WHERE team_id = ${stubId}`;
  await sql`
    UPDATE standings st SET team_id = ${liveId}
    WHERE team_id = ${stubId} AND NOT EXISTS (
      SELECT 1 FROM standings s2 WHERE s2.competition_season_id=st.competition_season_id AND s2.team_id=${liveId})
  `;
  await sql`DELETE FROM standings WHERE team_id = ${stubId}`;
  await sql`
    UPDATE player_season_stats ps SET team_id = ${liveId}
    WHERE team_id = ${stubId} AND NOT EXISTS (
      SELECT 1 FROM player_season_stats p2 WHERE p2.player_id=ps.player_id AND p2.team_id=${liveId} AND p2.competition_season_id=ps.competition_season_id)
  `;
  await sql`DELETE FROM player_season_stats WHERE team_id = ${stubId}`;
  await sql`UPDATE match_lineups SET team_id = ${liveId} WHERE team_id = ${stubId}`;
  await sql`UPDATE match_events SET team_id = ${liveId} WHERE team_id = ${stubId}`;
  await sql`UPDATE match_statistics SET team_id = ${liveId} WHERE team_id = ${stubId}`;
  await sql`UPDATE player_match_stats SET team_id = ${liveId} WHERE team_id = ${stubId}`;
  await sql`DELETE FROM injuries WHERE team_id = ${stubId}`;
  await sql`UPDATE transfers SET from_team_id = ${liveId} WHERE from_team_id = ${stubId}`;
  await sql`UPDATE transfers SET to_team_id = ${liveId} WHERE to_team_id = ${stubId}`;
  await sql`DELETE FROM article_teams WHERE team_id = ${stubId}`;
  await sql`DELETE FROM team_seasons WHERE team_id = ${stubId}`;
  await sql`DELETE FROM team_venue_history WHERE team_id = ${stubId}`;
  await sql`DELETE FROM search_index WHERE id = ${stubId}`;
  await sql`DELETE FROM teams WHERE id = ${stubId}`;
}

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  let n = 0;
  for (const [stubSlug, liveSlug, name] of PAIRS) {
    const [stub] = (await sql`SELECT id FROM teams WHERE slug = ${stubSlug} LIMIT 1`) as Array<{ id: string }>;
    const [live] = (await sql`SELECT id FROM teams WHERE slug = ${liveSlug} LIMIT 1`) as Array<{ id: string }>;
    if (!live) { console.log(`  skip: live ${liveSlug} not found`); continue; }
    if (!stub) { console.log(`  ${stubSlug} already gone — just ensuring name`); }
    if (DRY_RUN) { console.log(`  [dry-run] merge ${stubSlug} → ${liveSlug}, rename → "${name}"`); continue; }
    if (stub) await repointAndDelete(sql, stub.id, live.id);
    await sql`UPDATE teams SET name = ${name} WHERE id = ${live.id}`;
    console.log(`  merged ${stubSlug} → ${liveSlug}, renamed → "${name}"`);
    n++;
  }
  console.log(`\n${DRY_RUN ? "[dry-run] " : ""}done (${n})`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
