/**
 * Match slug helper.
 *
 * Format: ${homeTeamSlug}-vs-${awayTeamSlug}-${YYYY-MM-DD}
 * Example: manchester-united-vs-liverpool-2024-09-15
 *
 * Collision strategy (try in order):
 *   1. primary
 *   2. primary + "-md{matchday}"
 *   3. primary + "-{6charUuid}"
 */

function formatDateUtc(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function buildMatchSlug(
  homeTeamSlug: string,
  awayTeamSlug: string,
  scheduledAt: Date | string
): string {
  const date = typeof scheduledAt === "string" ? new Date(scheduledAt) : scheduledAt;
  return `${homeTeamSlug}-vs-${awayTeamSlug}-${formatDateUtc(date)}`;
}

export function buildMatchSlugWithFallback(
  homeTeamSlug: string,
  awayTeamSlug: string,
  scheduledAt: Date | string,
  matchday: number | null | undefined,
  matchId: string
): { primary: string; withMatchday: string | null; withUuid: string } {
  const primary = buildMatchSlug(homeTeamSlug, awayTeamSlug, scheduledAt);
  const withMatchday = matchday ? `${primary}-md${matchday}` : null;
  const withUuid = `${primary}-${matchId.replace(/-/g, "").slice(0, 6)}`;
  return { primary, withMatchday, withUuid };
}

/**
 * Pick the first variant that isn't already in `usedSlugs`.
 * Mutates `usedSlugs` by adding the chosen slug.
 */
export function pickAvailableMatchSlug(
  variants: { primary: string; withMatchday: string | null; withUuid: string },
  usedSlugs: Set<string>
): string {
  const candidates = [variants.primary];
  if (variants.withMatchday) candidates.push(variants.withMatchday);
  candidates.push(variants.withUuid);

  for (const c of candidates) {
    if (!usedSlugs.has(c)) {
      usedSlugs.add(c);
      return c;
    }
  }
  // Last resort — append a longer suffix
  const fallback = `${variants.primary}-${Date.now().toString(36)}`;
  usedSlugs.add(fallback);
  return fallback;
}

/** Regex matching a UUID (v4-like, used to detect old match URLs in middleware). */
export const MATCH_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
