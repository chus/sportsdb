/**
 * Merge duplicate player rows split across the two data providers.
 *
 * Every player exists twice: an fd row with the full canonical name ("Erling
 * Haaland", historical seasons, no image) and an af row with an abbreviated
 * name ("E. Haaland", current-season per-match stats + image). The af short
 * name never bridged to the fd full name, so a second row was created and the
 * af mapping stamped on it — splitting stats, leaderboards, comparisons, and
 * creating duplicate indexable pages.
 *
 * Direction: af abbreviated row (dupe) → fd full-name row (canonical). The
 * canonical keeps the good name + slug; the af row's richer data (per-match
 * stats, image) and external_id move onto it. Collision-safe repoints (same
 * pattern as merge-known-duplicates.ts) drop stat rows the canonical already
 * has — so the shared current season isn't double-counted while extra
 * historical seasons are preserved.
 *
 * SAFETY: only merges high-confidence groups — deterministic legacy-id
 * matches (same provider id on both rows), or exactly TWO rows for one
 * (team, first-initial, surname) where the full-name row has no af identity
 * of its own. Ambiguous groups (e.g. "Ché Adams" + "Chase Adams" +
 * "C. Adams", or two different full names) are skipped untouched.
 *
 * Usage:
 *   npx tsx scripts/merge-duplicate-players.ts --dry-run
 *   npx tsx scripts/merge-duplicate-players.ts --limit 5
 *   npx tsx scripts/merge-duplicate-players.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

const DRY_RUN = process.argv.includes("--dry-run");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;

interface Pair {
  canon_id: string;
  canon_name: string;
  dupe_id: string;
  dupe_name: string;
  dupe_ext: string | null;
}

/**
 * Deterministic pairs: a row whose LEGACY players.external_id ("af-184")
 * points at the same provider id that the external_ids table maps to a
 * DIFFERENT row. Same provider id = same person — no name heuristics needed.
 * These come from code paths that keyed on the legacy column (syncScorers)
 * and re-created players the mapping table already knew.
 */
async function findLegacyIdPairs(sql: ReturnType<typeof neon>): Promise<Pair[]> {
  return (await sql`
    SELECT c.id AS canon_id, c.name AS canon_name,
           d.id AS dupe_id, d.name AS dupe_name, d.external_id AS dupe_ext
    FROM players d
    JOIN external_ids x ON x.entity_type = 'player'
      AND x.provider = substring(d.external_id from '^(af|fd)-[0-9]+$')
      AND x.provider_id = substring(d.external_id from '^[a-z]+-([0-9]+)$')
      AND x.entity_id <> d.id
    JOIN players c ON c.id = x.entity_id
    WHERE d.external_id ~ '^(af|fd)-[0-9]+$'
      AND NOT EXISTS (SELECT 1 FROM external_ids y WHERE y.entity_id = d.id AND y.entity_type = 'player')
  `) as Pair[];
}

/**
 * Same-team name pairs: exactly TWO rows for one (team, first-initial,
 * surname) — one abbreviated af row, one full-name row. The full-name row is
 * canonical whether it is an fd row (the original af↔fd split) or a
 * mapping-less stub (the Wikipedia squad ingest of 2026-06-14, which created
 * full-name rows the af squad sync then duplicated under abbreviated names).
 * Full-name rows that carry their own af identity are skipped — a second af
 * id means the provider says they are two different people.
 */
async function findPairs(sql: ReturnType<typeof neon>): Promise<Pair[]> {
  return (await sql`
    WITH cur AS (
      SELECT p.id, p.name, p.external_id,
        upper(left(p.name,1)) AS initial,
        lower(regexp_replace(p.name,'^.* ','')) AS surname,
        (substr(p.name,2,1) = '.') AS abbrev,
        pt.team_id,
        EXISTS (SELECT 1 FROM external_ids x WHERE x.entity_id=p.id AND x.entity_type='player' AND x.provider='af') AS has_af
      FROM players p
      LEFT JOIN player_team_history pt ON pt.player_id=p.id AND pt.valid_to IS NULL
    ),
    grp AS (
      SELECT team_id, initial, surname
      FROM cur
      WHERE team_id IS NOT NULL AND length(surname) >= 3
      GROUP BY team_id, initial, surname
      HAVING count(*) = 2
         AND count(*) FILTER (WHERE abbrev) = 1
         AND count(*) FILTER (WHERE NOT abbrev) = 1
         AND bool_or(abbrev AND has_af)            -- the abbreviated row is the af one
         AND NOT bool_or((NOT abbrev) AND has_af)  -- full-name row has no af identity of its own
    )
    SELECT cf.id AS canon_id, cf.name AS canon_name,
           ca.id AS dupe_id, ca.name AS dupe_name, ca.external_id AS dupe_ext
    FROM grp g
    JOIN cur cf ON cf.team_id=g.team_id AND upper(left(cf.name,1))=g.initial
       AND lower(regexp_replace(cf.name,'^.* ',''))=g.surname AND NOT (substr(cf.name,2,1)='.')
       AND (cf.external_id IS NULL OR cf.external_id !~ '^af-')  -- direction conflict guard
    JOIN cur ca ON ca.team_id=g.team_id AND upper(left(ca.name,1))=g.initial
       AND lower(regexp_replace(ca.name,'^.* ',''))=g.surname AND (substr(ca.name,2,1)='.')
  `) as Pair[];
}

async function mergePlayer(sql: ReturnType<typeof neon>, canon: string, dupe: string, dupeExt: string | null) {
  // Enrich canonical with fields the af dupe has (image, bio) before delete.
  await sql`
    UPDATE players c SET
      image_url     = coalesce(c.image_url, d.image_url),
      nationality   = coalesce(c.nationality, d.nationality),
      date_of_birth = coalesce(c.date_of_birth, d.date_of_birth),
      height_cm     = coalesce(c.height_cm, d.height_cm),
      position      = coalesce(nullif(c.position,'Unknown'), d.position, c.position),
      is_indexable  = c.is_indexable OR d.is_indexable,
      popularity_score = greatest(coalesce(c.popularity_score,0), coalesce(d.popularity_score,0))
    FROM players d WHERE c.id = ${canon} AND d.id = ${dupe}
  `;

  // Provider mappings move first (conflict-safe), then drop leftovers.
  await sql`
    UPDATE external_ids x SET entity_id = ${canon}
    WHERE x.entity_id = ${dupe} AND x.entity_type='player'
      AND NOT EXISTS (SELECT 1 FROM external_ids y WHERE y.provider=x.provider AND y.provider_id=x.provider_id AND y.entity_type=x.entity_type AND y.entity_id=${canon})
  `;
  await sql`DELETE FROM external_ids WHERE entity_id=${dupe} AND entity_type='player'`;

  // Collision-safe repoints (drop rows the canonical already has).
  await sql`UPDATE player_season_stats s SET player_id=${canon} WHERE s.player_id=${dupe}
    AND NOT EXISTS (SELECT 1 FROM player_season_stats t WHERE t.player_id=${canon} AND t.team_id=s.team_id AND t.competition_season_id=s.competition_season_id)`;
  await sql`DELETE FROM player_season_stats WHERE player_id=${dupe}`;

  await sql`UPDATE player_match_stats s SET player_id=${canon} WHERE s.player_id=${dupe}
    AND NOT EXISTS (SELECT 1 FROM player_match_stats t WHERE t.player_id=${canon} AND t.match_id=s.match_id)`;
  await sql`DELETE FROM player_match_stats WHERE player_id=${dupe}`;

  await sql`UPDATE player_match_summaries s SET player_id=${canon} WHERE s.player_id=${dupe}
    AND NOT EXISTS (SELECT 1 FROM player_match_summaries t WHERE t.player_id=${canon} AND t.match_id=s.match_id)`;
  await sql`DELETE FROM player_match_summaries WHERE player_id=${dupe}`;

  await sql`UPDATE match_lineups s SET player_id=${canon} WHERE s.player_id=${dupe}
    AND NOT EXISTS (SELECT 1 FROM match_lineups t WHERE t.player_id=${canon} AND t.match_id=s.match_id)`;
  await sql`DELETE FROM match_lineups WHERE player_id=${dupe}`;

  await sql`UPDATE injuries s SET player_id=${canon} WHERE s.player_id=${dupe}
    AND NOT EXISTS (SELECT 1 FROM injuries t WHERE t.player_id=${canon} AND t.competition_season_id=s.competition_season_id)`;
  await sql`DELETE FROM injuries WHERE player_id=${dupe}`;

  await sql`UPDATE player_team_history s SET player_id=${canon} WHERE s.player_id=${dupe}
    AND NOT EXISTS (SELECT 1 FROM player_team_history t WHERE t.player_id=${canon} AND t.team_id=s.team_id AND t.valid_from=s.valid_from)`;
  await sql`DELETE FROM player_team_history WHERE player_id=${dupe}`;

  await sql`UPDATE article_players s SET player_id=${canon} WHERE s.player_id=${dupe}
    AND NOT EXISTS (SELECT 1 FROM article_players t WHERE t.player_id=${canon} AND t.article_id=s.article_id)`;
  await sql`DELETE FROM article_players WHERE player_id=${dupe}`;

  await sql`UPDATE follows s SET entity_id=${canon} WHERE s.entity_id=${dupe} AND s.entity_type='player'
    AND NOT EXISTS (SELECT 1 FROM follows t WHERE t.user_id=s.user_id AND t.entity_type='player' AND t.entity_id=${canon})`;
  await sql`DELETE FROM follows WHERE entity_id=${dupe} AND entity_type='player'`;

  // Plain repoints (no unique constraint on player).
  await sql`UPDATE match_events SET player_id=${canon} WHERE player_id=${dupe}`;
  await sql`UPDATE match_events SET secondary_player_id=${canon} WHERE secondary_player_id=${dupe}`;
  await sql`UPDATE articles SET primary_player_id=${canon} WHERE primary_player_id=${dupe}`;
  await sql`UPDATE transfers SET player_id=${canon} WHERE player_id=${dupe}`;
  await sql`UPDATE match_summaries SET motm_player_id=${canon} WHERE motm_player_id=${dupe}`;
  await sql`DELETE FROM search_index WHERE id=${dupe}`;

  await sql`DELETE FROM players WHERE id=${dupe}`;

  // Inherit the dupe's legacy external_id (now freed by the delete) so any
  // remaining legacy-column lookups land on the canonical row. Guarded
  // against another row already holding it (unique constraint).
  if (dupeExt) {
    await sql`
      UPDATE players SET external_id = ${dupeExt}
      WHERE id = ${canon} AND external_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM players WHERE external_id = ${dupeExt})
    `;
  }
}

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const legacy = await findLegacyIdPairs(sql);
  const byName = await findPairs(sql);
  console.log(`Found ${legacy.length} legacy-external-id pairs, ${byName.length} same-team name pairs.`);

  // Each player id may participate in at most ONE merge per run. A player
  // with two open team stints groups under two teams and would otherwise
  // appear as the dupe of two different canonicals — the second merge then
  // operates on an already-deleted row. Legacy pairs claim their ids first.
  const taken = new Set<string>();
  const pairs: Pair[] = [];
  for (const p of [...legacy, ...byName]) {
    if (taken.has(p.dupe_id) || taken.has(p.canon_id)) continue;
    taken.add(p.dupe_id);
    taken.add(p.canon_id);
    pairs.push(p);
  }
  console.log(`Merging ${pairs.length} pairs total (${legacy.length + byName.length - pairs.length} skipped as overlapping).`);

  if (DRY_RUN) {
    for (const p of pairs.slice(0, 30)) console.log(`  [dry-run] ${p.dupe_name} → ${p.canon_name}`);
    if (pairs.length > 30) console.log(`  … and ${pairs.length - 30} more`);
    console.log(`\n[dry-run] would merge ${pairs.length} pairs. Re-run without --dry-run (optionally --limit N).`);
    return;
  }

  let merged = 0;
  let failed = 0;
  for (const p of pairs) {
    if (merged >= LIMIT) break;
    // Every statement in mergePlayer is idempotent, so retrying a pair after
    // a transient network drop (Neon HTTP ECONNRESET) is safe.
    let done = false;
    for (let attempt = 1; attempt <= 3 && !done; attempt++) {
      try {
        await mergePlayer(sql, p.canon_id, p.dupe_id, p.dupe_ext);
        done = true;
      } catch (e) {
        if (attempt === 3) {
          failed++;
          console.error(`  FAILED ${p.dupe_name} → ${p.canon_name}: ${e instanceof Error ? e.message : e}`);
        } else {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
    }
    if (done) merged++;
    if (merged % 100 === 0) console.log(`  merged ${merged}/${Math.min(LIMIT, pairs.length)}…`);
  }
  console.log(`\nMerged ${merged} duplicate players${failed ? `, ${failed} pairs failed (re-run to retry)` : ""}.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
