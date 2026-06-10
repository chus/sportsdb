/**
 * Identity-first entity resolution for ingestion.
 *
 * Every data provider sends stable numeric IDs with every payload
 * (football-data.org: team.id, player.id). Historically our ingestion
 * threw those away and matched by name string — every name variant
 * ("FC Bayern München" vs "FC Bayern Munich") spawned a duplicate row,
 * duplicates attracted fixtures, cleanup scripts deleted duplicates
 * plus their fixtures, and pages went empty. Months of that cycle.
 *
 * The contract here:
 *   1. Look up by external_id — the only steady-state path.
 *   2. On miss, fall back to name matching ONCE, and stamp the
 *      external_id onto the matched row so the next sync hits step 1.
 *   3. Optionally create the entity, always with external_id set.
 *
 * Name matching is a linker, never an identifier.
 *
 * external_id conventions:
 *   teams:   fd-team-{id}     (football-data.org)
 *   players: fd-player-{id}
 *   matches: fd-{id}          (legacy format, kept for compatibility)
 *   Future API-Football entities: af-team-{id}, af-player-{id}.
 */
import { findTeamByName } from "@/lib/seo/team-matcher";

// Loose Sql type — neon()'s generics make a strict alias incompatible
// across callers (same pattern as team-matcher.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = any;

export interface ResolvedEntity {
  id: string;
  slug: string;
  /** How the entity was found — useful for cron telemetry. */
  via: "external_id" | "name_match" | "created";
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function fdTeamExternalId(providerTeamId: number): string {
  return `fd-team-${providerTeamId}`;
}

export function fdPlayerExternalId(providerPlayerId: number): string {
  return `fd-player-${providerPlayerId}`;
}

/**
 * Resolve a team by provider ID, stamping the external_id on name-match
 * fallback. Pass `create` to insert the team when nothing matches —
 * callers that should never create (e.g. stats ingestion, where an
 * unknown team signals a data problem) leave it undefined and get null.
 */
export async function resolveTeam(
  sql: Sql,
  providerTeamId: number,
  name: string,
  create?: { shortName?: string | null; country?: string | null; logoUrl?: string | null },
): Promise<ResolvedEntity | null> {
  const externalId = fdTeamExternalId(providerTeamId);

  const byId = await sql`
    SELECT id, slug FROM teams WHERE external_id = ${externalId} LIMIT 1
  `;
  if (byId[0]) return { ...byId[0], via: "external_id" } as ResolvedEntity;

  const byName = await findTeamByName(sql, name);
  if (byName) {
    // One-time link: stamp the provider ID so the next sync resolves by
    // ID. Never overwrite an existing different external_id — that means
    // two provider IDs claim the same row, which needs human eyes.
    const stamped = await sql`
      UPDATE teams SET external_id = ${externalId}, updated_at = NOW()
      WHERE id = ${byName.id} AND external_id IS NULL
      RETURNING id
    `;
    if (stamped.length === 0) {
      const existing = await sql`SELECT external_id FROM teams WHERE id = ${byName.id}`;
      if (existing[0]?.external_id !== externalId) {
        console.warn(
          `[resolve-team] conflict: "${name}" matched team ${byName.slug} which already has external_id ${existing[0]?.external_id} (provider sent ${externalId})`,
        );
      }
    }
    return { ...byName, via: "name_match" };
  }

  if (!create) return null;

  const slug = slugify(name);
  const inserted = await sql`
    INSERT INTO teams (external_id, name, short_name, slug, country, logo_url, team_type)
    VALUES (${externalId}, ${name}, ${create.shortName ?? null}, ${slug}, ${create.country ?? null}, ${create.logoUrl ?? null}, 'club')
    ON CONFLICT (slug) DO NOTHING
    RETURNING id, slug
  `;
  if (inserted[0]) return { ...inserted[0], via: "created" } as ResolvedEntity;

  // Slug collision raced or pre-existed — return the slug owner.
  const owner = await sql`SELECT id, slug FROM teams WHERE slug = ${slug} LIMIT 1`;
  return owner[0] ? ({ ...owner[0], via: "name_match" } as ResolvedEntity) : null;
}

/**
 * Resolve a player by provider ID. Fallback matches by slugified name,
 * stamps the external_id, never creates (player creation belongs to the
 * dedicated squad-ingestion pipeline which carries full bio data).
 */
export async function resolvePlayer(
  sql: Sql,
  providerPlayerId: number,
  name: string,
): Promise<ResolvedEntity | null> {
  const externalId = fdPlayerExternalId(providerPlayerId);

  const byId = await sql`
    SELECT id, slug FROM players WHERE external_id = ${externalId} LIMIT 1
  `;
  if (byId[0]) return { ...byId[0], via: "external_id" } as ResolvedEntity;

  const slug = slugify(name);
  const bySlug = await sql`SELECT id, slug FROM players WHERE slug = ${slug} LIMIT 1`;
  if (!bySlug[0]) return null;

  const stamped = await sql`
    UPDATE players SET external_id = ${externalId}, updated_at = NOW()
    WHERE id = ${bySlug[0].id} AND external_id IS NULL
    RETURNING id
  `;
  if (stamped.length === 0) {
    const existing = await sql`SELECT external_id FROM players WHERE id = ${bySlug[0].id}`;
    if (existing[0]?.external_id !== externalId) {
      console.warn(
        `[resolve-player] conflict: "${name}" matched player ${slug} which already has external_id ${existing[0]?.external_id} (provider sent ${externalId})`,
      );
    }
  }
  return { ...bySlug[0], via: "name_match" } as ResolvedEntity;
}
