/**
 * Identity-first entity resolution for ingestion.
 *
 * Every data provider sends stable numeric IDs with every payload
 * (football-data.org: team.id, player.id; API-Football: team.id,
 * player.id). Historically our ingestion threw those away and matched
 * by name string — every name variant ("FC Bayern München" vs
 * "FC Bayern Munich") spawned a duplicate row, duplicates attracted
 * fixtures, cleanup scripts deleted duplicates plus their fixtures,
 * and pages went empty. Months of that cycle.
 *
 * Identity lives in the external_ids mapping table:
 *   (entity_type, entity_id, provider, provider_id)
 * One entity can carry IDs from several providers simultaneously —
 * fd-* from football-data and af-* from API-Football resolve to the
 * same row. (The legacy single external_id column couldn't express
 * that: whichever provider stamped first locked the other out and
 * forced it back to name matching.)
 *
 * The contract:
 *   1. Look up the (provider, provider_id) mapping — the only
 *      steady-state path.
 *   2. On miss, fall back to name matching ONCE, and write the mapping
 *      so the next sync hits step 1.
 *   3. Optionally create the entity, always writing the mapping.
 *
 * Name matching is a linker, never an identifier.
 */
import { findTeamByName } from "@/lib/seo/team-matcher";

// Loose Sql type — neon()'s generics make a strict alias incompatible
// across callers (same pattern as team-matcher.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = any;

export type Provider = "fd" | "af";

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

async function lookupMapping(
  sql: Sql,
  entityType: "team" | "player",
  provider: Provider,
  providerId: number,
): Promise<{ id: string; slug: string } | null> {
  const table = entityType === "team" ? "teams" : "players";
  const rows = await sql.query(
    `SELECT e.id, e.slug
     FROM external_ids x
     JOIN ${table} e ON e.id = x.entity_id
     WHERE x.entity_type = $1 AND x.provider = $2 AND x.provider_id = $3
     LIMIT 1`,
    [entityType, provider, String(providerId)],
  );
  return rows[0] ?? null;
}

async function writeMapping(
  sql: Sql,
  entityType: "team" | "player",
  entityId: string,
  provider: Provider,
  providerId: number,
): Promise<void> {
  await sql`
    INSERT INTO external_ids (entity_type, entity_id, provider, provider_id)
    VALUES (${entityType}, ${entityId}, ${provider}, ${String(providerId)})
    ON CONFLICT (provider, provider_id, entity_type) DO NOTHING
  `;
}

/**
 * Resolve a team by provider ID, writing the mapping on name-match
 * fallback. Pass `create` to insert the team when nothing matches —
 * callers that should never create (e.g. stats ingestion, where an
 * unknown team signals a data problem) leave it undefined and get null.
 */
export async function resolveTeam(
  sql: Sql,
  provider: Provider,
  providerTeamId: number,
  name: string,
  create?: { shortName?: string | null; country?: string | null; logoUrl?: string | null },
): Promise<ResolvedEntity | null> {
  const mapped = await lookupMapping(sql, "team", provider, providerTeamId);
  if (mapped) return { ...mapped, via: "external_id" };

  const byName = await findTeamByName(sql, name);
  if (byName) {
    await writeMapping(sql, "team", byName.id, provider, providerTeamId);
    return { ...byName, via: "name_match" };
  }

  if (!create) return null;

  const slug = slugify(name);
  const inserted = await sql`
    INSERT INTO teams (external_id, name, short_name, slug, country, logo_url, team_type)
    VALUES (${`${provider}-team-${providerTeamId}`}, ${name}, ${create.shortName ?? null}, ${slug}, ${create.country ?? null}, ${create.logoUrl ?? null}, 'club')
    ON CONFLICT (slug) DO NOTHING
    RETURNING id, slug
  `;
  const row = inserted[0] ?? (await sql`SELECT id, slug FROM teams WHERE slug = ${slug} LIMIT 1`)[0];
  if (!row) return null;
  await writeMapping(sql, "team", row.id, provider, providerTeamId);
  return { ...row, via: inserted[0] ? "created" : "name_match" } as ResolvedEntity;
}

/**
 * Resolve a player by provider ID. Fallback matches by slugified name
 * and writes the mapping. Creation is opt-in via `create` — the
 * API-Football squad sync passes bio data; stats-only ingestion doesn't.
 */
export async function resolvePlayer(
  sql: Sql,
  provider: Provider,
  providerPlayerId: number,
  name: string,
  create?: { position?: string | null; nationality?: string | null; imageUrl?: string | null },
): Promise<ResolvedEntity | null> {
  const mapped = await lookupMapping(sql, "player", provider, providerPlayerId);
  if (mapped) return { ...mapped, via: "external_id" };

  const slug = slugify(name);
  const bySlug = await sql`SELECT id, slug FROM players WHERE slug = ${slug} LIMIT 1`;
  if (bySlug[0]) {
    await writeMapping(sql, "player", bySlug[0].id, provider, providerPlayerId);
    return { ...bySlug[0], via: "name_match" } as ResolvedEntity;
  }

  if (!create) return null;

  const inserted = await sql`
    INSERT INTO players (external_id, name, slug, position, nationality, image_url)
    VALUES (${`${provider}-player-${providerPlayerId}`}, ${name}, ${slug}, ${create.position ?? "Unknown"}, ${create.nationality ?? null}, ${create.imageUrl ?? null})
    ON CONFLICT (slug) DO NOTHING
    RETURNING id, slug
  `;
  const row = inserted[0] ?? (await sql`SELECT id, slug FROM players WHERE slug = ${slug} LIMIT 1`)[0];
  if (!row) return null;
  await writeMapping(sql, "player", row.id, provider, providerPlayerId);
  return { ...row, via: inserted[0] ? "created" : "name_match" } as ResolvedEntity;
}

/**
 * Resolve a match by provider fixture ID.
 *
 * Matches are special: the same real-world fixture arrives from both
 * providers with unrelated IDs (fd-12345 vs af-998877). Keying inserts
 * on external_id alone therefore creates duplicate match rows — the
 * fallback here identifies a fixture by its natural key instead:
 * same home team, same away team, kickoff within ±1 day (timezone
 * differences shift the calendar date across providers).
 *
 * Returns the match row id. Never creates — fixture creation stays in
 * the dedicated sync paths which carry slug/matchday/season context.
 */
export async function resolveMatch(
  sql: Sql,
  provider: Provider,
  providerFixtureId: number,
  homeTeamId: string,
  awayTeamId: string,
  kickoff: Date,
): Promise<{ id: string } | null> {
  const rows = await sql.query(
    `SELECT m.id
     FROM external_ids x
     JOIN matches m ON m.id = x.entity_id
     WHERE x.entity_type = 'match' AND x.provider = $1 AND x.provider_id = $2
     LIMIT 1`,
    [provider, String(providerFixtureId)],
  );
  if (rows[0]) return rows[0];

  const natural = await sql`
    SELECT id FROM matches
    WHERE home_team_id = ${homeTeamId}
      AND away_team_id = ${awayTeamId}
      AND scheduled_at BETWEEN ${new Date(kickoff.getTime() - 86400000).toISOString()}
                           AND ${new Date(kickoff.getTime() + 86400000).toISOString()}
    ORDER BY abs(extract(epoch FROM scheduled_at - ${kickoff.toISOString()}::timestamptz))
    LIMIT 1
  `;
  if (!natural[0]) return null;

  await sql`
    INSERT INTO external_ids (entity_type, entity_id, provider, provider_id)
    VALUES ('match', ${natural[0].id}, ${provider}, ${String(providerFixtureId)})
    ON CONFLICT (provider, provider_id, entity_type) DO NOTHING
  `;
  return natural[0];
}
