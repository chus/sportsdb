/**
 * Entity-existence check for middleware.
 *
 * Middleware uses this to 308-redirect deleted-entity URLs (Google flags
 * them as Soft 404 or Excluded by noindex when the page renders the
 * not-found template). The page-level permanentRedirect() doesn't fire
 * on ISR-eligible routes due to a Next.js 16 streaming bug — middleware
 * is the only place we can return a real 308.
 *
 * Performance:
 *   - Cache hit:  <1 ms (in-memory Map, 5-min TTL, capped at 10k entries)
 *   - Cache miss: ~50-100 ms (neon serverless from edge → us-east-1)
 *
 * Cold edge workers pay the DB cost on the first request per entity;
 * subsequent requests in the same worker reuse the cache. Caches both
 * positive and negative results so valid pages also benefit.
 */
import { neon } from "@neondatabase/serverless";

export type EntityType =
  | "news"
  | "matches"
  | "players"
  | "teams"
  | "venues"
  | "competitions";

interface CacheEntry {
  exists: boolean;
  expires: number;
}

const TTL_MS = 5 * 60 * 1000;
const MAX_CACHE = 10_000;
const cache = new Map<string, CacheEntry>();

function pruneCache() {
  if (cache.size < MAX_CACHE) return;
  // Drop the oldest 20% so we don't run a delete loop on every call.
  const drop = Math.floor(MAX_CACHE * 0.2);
  let i = 0;
  for (const key of cache.keys()) {
    if (i++ >= drop) break;
    cache.delete(key);
  }
}

// Each entity type has its own table + slug column + optional WHERE
// filter. Listed individually instead of dynamic SQL so the queries
// stay parameterized and the table names are compile-time constants.
async function lookupArticle(slug: string): Promise<boolean> {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`SELECT 1 FROM articles WHERE slug = ${slug} AND status = 'published' LIMIT 1`;
  return rows.length > 0;
}
async function lookupMatch(slug: string): Promise<boolean> {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`SELECT 1 FROM matches WHERE slug = ${slug} LIMIT 1`;
  return rows.length > 0;
}
// Player check ALSO requires is_indexable=true. Tier C/D players
// (bio-only profiles with no on-pitch evidence) exist in DB but are
// thin content — Google flags them as "Excluded by noindex" and
// AdSense reviewers count them against the "low value content" check.
// 308-redirecting these to /players removes them from the domain's
// visible surface entirely.
async function lookupPlayer(slug: string): Promise<boolean> {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`SELECT 1 FROM players WHERE slug = ${slug} AND is_indexable = true LIMIT 1`;
  return rows.length > 0;
}
async function lookupTeam(slug: string): Promise<boolean> {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`SELECT 1 FROM teams WHERE slug = ${slug} LIMIT 1`;
  return rows.length > 0;
}
async function lookupVenue(slug: string): Promise<boolean> {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`SELECT 1 FROM venues WHERE slug = ${slug} LIMIT 1`;
  return rows.length > 0;
}
async function lookupCompetition(slug: string): Promise<boolean> {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`SELECT 1 FROM competitions WHERE slug = ${slug} LIMIT 1`;
  return rows.length > 0;
}

const LOOKUPS: Record<EntityType, (slug: string) => Promise<boolean>> = {
  news: lookupArticle,
  matches: lookupMatch,
  players: lookupPlayer,
  teams: lookupTeam,
  venues: lookupVenue,
  competitions: lookupCompetition,
};

/**
 * Returns true if the entity slug exists in the DB (cached up to 5 min).
 * On any error, returns true so we don't break the page — better to
 * render normally than to wrongly redirect a working URL.
 */
export async function entityExists(type: EntityType, slug: string): Promise<boolean> {
  const key = `${type}:${slug}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.exists;

  try {
    const exists = await LOOKUPS[type](slug);
    pruneCache();
    cache.set(key, { exists, expires: Date.now() + TTL_MS });
    return exists;
  } catch (err) {
    // Don't redirect if the lookup failed — better to render the page
    // and let the page's own handling kick in. Log so we notice.
    console.warn(`[entity-exists] ${type}/${slug} lookup failed:`, err);
    return true;
  }
}
