/**
 * Create the external_ids mapping table and seed it from the legacy
 * single external_id columns.
 *
 * One entity can carry IDs from several providers (football-data fd-*,
 * API-Football af-*); a single column can only hold one, which forces
 * the other provider back to name matching — the failure mode Phase A
 * exists to kill. The mapping table is the standard fix.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  await sql.query(`
    CREATE TABLE IF NOT EXISTS external_ids (
      entity_type text NOT NULL,
      entity_id uuid NOT NULL,
      provider text NOT NULL,
      provider_id text NOT NULL,
      created_at timestamptz DEFAULT now(),
      PRIMARY KEY (provider, provider_id, entity_type)
    )
  `);
  await sql.query(`CREATE INDEX IF NOT EXISTS idx_external_ids_entity ON external_ids (entity_type, entity_id)`);

  // Seed from legacy columns. Formats observed:
  //   teams.external_id:   fd-team-{id} | af-{id} | fd-{id}
  //   players.external_id: fd-player-{id} | af-{id}
  //   matches.external_id: fd-{id}
  const seedTeams = await sql.query(`
    INSERT INTO external_ids (entity_type, entity_id, provider, provider_id)
    SELECT 'team', id,
      CASE WHEN external_id LIKE 'af-%' THEN 'af' ELSE 'fd' END,
      regexp_replace(external_id, '^(fd-team-|af-|fd-)', '')
    FROM teams WHERE external_id IS NOT NULL
    ON CONFLICT DO NOTHING
    RETURNING entity_id
  `);
  const seedPlayers = await sql.query(`
    INSERT INTO external_ids (entity_type, entity_id, provider, provider_id)
    SELECT 'player', id,
      CASE WHEN external_id LIKE 'af-%' THEN 'af' ELSE 'fd' END,
      regexp_replace(external_id, '^(fd-player-|af-|fd-)', '')
    FROM players WHERE external_id IS NOT NULL
    ON CONFLICT DO NOTHING
    RETURNING entity_id
  `);
  const seedMatches = await sql.query(`
    INSERT INTO external_ids (entity_type, entity_id, provider, provider_id)
    SELECT 'match', id,
      CASE WHEN external_id LIKE 'af-%' THEN 'af' ELSE 'fd' END,
      regexp_replace(external_id, '^(af-|fd-)', '')
    FROM matches WHERE external_id IS NOT NULL
    ON CONFLICT DO NOTHING
    RETURNING entity_id
  `);

  console.log(`seeded: teams=${seedTeams.length} players=${seedPlayers.length} matches=${seedMatches.length}`);
  const counts = await sql`
    SELECT entity_type, provider, count(*) FROM external_ids GROUP BY entity_type, provider ORDER BY entity_type
  `;
  console.table(counts);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
