/**
 * Untangle Paris Saint-Germain (af 85) from Paris FC (af 114).
 *
 * Two genuinely different clubs collapsed into one row:
 *   - The row named "Paris Saint-Germain FC" was mapped to af 114 — which
 *     is *Paris FC*, not PSG (fd 524 = real PSG). A pre-existing mis-stamp.
 *   - The correct PSG (af 85) lived in a second row the dedup pass then
 *     merged in, fusing both clubs. The loose `ILIKE '%Paris%'` matcher
 *     fallback is what let "Paris FC" resolve onto the PSG row originally.
 *
 * This splits them back apart using API-Football provenance:
 *   - matches: by fixture id (which fixtures belong to af 114)
 *   - squad / stats / lineups / events: by player id (who plays for 114)
 *
 * The Paris FC row is created fresh, so every repoint onto it is
 * conflict-free. Re-run scripts/sync-api-football.ts --full --slug=ligue-1
 * afterwards to refresh standings (PSG #1, Paris FC #11) and team links.
 *
 * Usage:
 *   npx tsx scripts/untangle-psg-parisfc.ts --dry-run
 *   npx tsx scripts/untangle-psg-parisfc.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const DRY_RUN = process.argv.includes("--dry-run");
const KEY = process.env.API_FOOTBALL_KEY!;
const BASE = "https://v3.football.api-sports.io";

async function af(ep: string) {
  const r = await fetch(BASE + ep, {
    headers: { "x-rapidapi-key": KEY, "x-rapidapi-host": "v3.football.api-sports.io" },
  });
  return r.json();
}

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  // 1. The fused row (currently mislabeled "Paris FC", slug kept for PSG).
  const [psg] = (await sql`SELECT id, name, slug FROM teams WHERE slug = 'paris-saint-germain-fc' LIMIT 1`) as Array<{ id: string; name: string; slug: string }>;
  if (!psg) throw new Error("paris-saint-germain-fc row not found");
  console.log(`fused row: "${psg.name}" (${psg.id})`);

  // 2. Provenance from API-Football.
  const sq114 = await af(`/players/squads?team=114`);
  const parisFcPlayerAfIds = new Set<string>(
    (sq114.response?.[0]?.players || []).map((p: { id: number }) => String(p.id)),
  );
  const fx114 = await af(`/fixtures?team=114&season=2025`);
  const homeFixtureIds = new Set<string>();
  const awayFixtureIds = new Set<string>();
  for (const e of fx114.response || []) {
    const fid = String(e.fixture.id);
    if (e.teams.home.id === 114) homeFixtureIds.add(fid);
    else if (e.teams.away.id === 114) awayFixtureIds.add(fid);
  }
  console.log(`Paris FC provenance: ${parisFcPlayerAfIds.size} players, ${homeFixtureIds.size + awayFixtureIds.size} fixtures`);

  // 3. Our player UUIDs that belong to Paris FC.
  const allParisFcAf = [...parisFcPlayerAfIds];
  const parisFcPlayerUuids = allParisFcAf.length
    ? ((await sql`SELECT entity_id FROM external_ids WHERE entity_type='player' AND provider='af' AND provider_id = ANY(${allParisFcAf})`) as Array<{ entity_id: string }>).map((r) => r.entity_id)
    : [];
  console.log(`matched ${parisFcPlayerUuids.length} Paris FC players in DB`);

  // 4. Our match UUIDs for Paris FC home / away fixtures.
  async function matchesFor(fixtureIds: Set<string>): Promise<string[]> {
    const ids = [...fixtureIds];
    if (!ids.length) return [];
    return ((await sql`SELECT entity_id FROM external_ids WHERE entity_type='match' AND provider='af' AND provider_id = ANY(${ids})`) as Array<{ entity_id: string }>).map((r) => r.entity_id);
  }
  const homeMatchUuids = await matchesFor(homeFixtureIds);
  const awayMatchUuids = await matchesFor(awayFixtureIds);
  console.log(`Paris FC matches in DB: ${homeMatchUuids.length} home, ${awayMatchUuids.length} away`);

  if (DRY_RUN) {
    console.log("\n[dry-run] would:");
    console.log(`  - create team "Paris FC" (paris-fc), move af:114 onto it`);
    console.log(`  - drop fd:1045 from PSG row (unverified, not PSG's fd 524)`);
    console.log(`  - rename fused row → "Paris Saint-Germain FC"`);
    console.log(`  - repoint ${homeMatchUuids.length}+${awayMatchUuids.length} matches, ${parisFcPlayerUuids.length} players' pth/stats/lineups/events to Paris FC`);
    return;
  }

  // 5. Create the Paris FC row.
  const [parisFc] = (await sql`
    INSERT INTO teams (external_id, name, short_name, slug, country, team_type)
    VALUES ('af-team-114', 'Paris FC', 'Paris FC', 'paris-fc', 'France', 'club')
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `) as Array<{ id: string }>;
  const parisFcId = parisFc.id;
  console.log(`Paris FC row: ${parisFcId}`);

  // 6. Fix external_id mappings.
  await sql`UPDATE external_ids SET entity_id = ${parisFcId} WHERE entity_type='team' AND provider='af' AND provider_id='114'`;
  await sql`DELETE FROM external_ids WHERE entity_type='team' AND provider='fd' AND provider_id='1045'`;
  console.log("mappings: af:114 → Paris FC, fd:1045 dropped, PSG keeps af:85 + fd:524");

  // 7. Rename the fused row back to PSG.
  await sql`UPDATE teams SET name = 'Paris Saint-Germain FC', short_name = 'PSG' WHERE id = ${psg.id}`;

  // 8. Repoint matches (home/away sides that were Paris FC).
  if (homeMatchUuids.length) await sql`UPDATE matches SET home_team_id = ${parisFcId} WHERE id = ANY(${homeMatchUuids}) AND home_team_id = ${psg.id}`;
  if (awayMatchUuids.length) await sql`UPDATE matches SET away_team_id = ${parisFcId} WHERE id = ANY(${awayMatchUuids}) AND away_team_id = ${psg.id}`;

  // 9. Repoint player-scoped data by Paris FC squad membership.
  if (parisFcPlayerUuids.length) {
    const p = parisFcPlayerUuids;
    await sql`UPDATE player_team_history SET team_id = ${parisFcId} WHERE team_id = ${psg.id} AND player_id = ANY(${p})`;
    await sql`UPDATE player_season_stats SET team_id = ${parisFcId} WHERE team_id = ${psg.id} AND player_id = ANY(${p})`;
    await sql`UPDATE match_lineups SET team_id = ${parisFcId} WHERE team_id = ${psg.id} AND player_id = ANY(${p})`;
    await sql`UPDATE match_events SET team_id = ${parisFcId} WHERE team_id = ${psg.id} AND player_id = ANY(${p})`;
  }

  // 10. Clear the fused row's ligue-1 standings (it holds Paris FC's rank
  //     11). The full re-sync rewrites PSG #1 and Paris FC #11 correctly.
  await sql`
    DELETE FROM standings WHERE team_id IN (${psg.id}, ${parisFcId})
      AND competition_season_id IN (
        SELECT cs.id FROM competition_seasons cs
        JOIN competitions co ON co.id = cs.competition_id
        JOIN seasons se ON se.id = cs.season_id AND se.is_current = true
        WHERE co.slug = 'ligue-1'
      )
  `;

  console.log("\nDone. Now run: npx tsx scripts/sync-api-football.ts --full --slug=ligue-1");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
