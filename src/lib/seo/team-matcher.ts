/**
 * Match a football-data.org team name to our DB team. The API and DB
 * frequently disagree on punctuation and suffixes:
 *
 *   "FC Famalicão"          → DB "F.C. Famalicão"      (dot mismatch)
 *   "Stade Rennais FC 1901" → DB "Stade Rennais FC"    (year suffix)
 *   "FC Twente '65"         → DB "FC Twente"           (year suffix)
 *   "FC Bayern München"     → DB "FC Bayern Munich"    (translation)
 *   "Sport Lisboa e Benfica"→ DB "S.L. Benfica"        (full vs short)
 *
 * Matcher cascade — return on first hit:
 *   1. Exact match on name or short_name
 *   2. Strip trailing year suffix (1846 / '65) → retry exact
 *   3. Normalize punctuation (remove dots) on both sides → retry
 *   4. Slugify both → retry (handles diacritics)
 *   5. Manual alias map for cases the rules can't reconcile
 *   6. Generic ILIKE partial → strip FC/CF/SC suffix → ILIKE
 *
 * Returns `{ id, slug }` of the matched team or `null`.
 */

// Hand-maintained map for API names that no normalization rule can
// reconcile. Map shape: `{ "API name": "DB slug" }`. Add entries when
// a cron log shows persistent missingTeam counts.
export const TEAM_NAME_ALIASES: Record<string, string> = {
  "FC Bayern München": "fc-bayern-munich",
  "Sport Lisboa e Benfica": "s-l-benfica",
  "Sporting Clube de Portugal": "sporting-cp",
  "Sporting Clube de Braga": "s-c-braga",
  "GD Estoril Praia": "g-d-estoril-praia",
  // Nicknames that aren't substrings of the official name — no
  // normalization rule can bridge these.
  "Wolves": "wolverhampton-wanderers-f-c",
  "Spurs": "tottenham-hotspur-f-c",
  "Man City": "manchester-city-f-c",
  "Man United": "manchester-united-f-c",
  "PSG": "paris-saint-germain-f-c",
  "Inter": "fc-internazionale-milano",
};

// Loose Sql type — neon()'s generic type parameters make a strict alias
// incompatible across callers. We only need to invoke the tag and the
// returned promise resolves to row arrays.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = any;
type TeamHit = { id: string; slug: string };

function stripYearSuffix(name: string): string {
  // Trailing 4-digit year ("Stade Rennais FC 1901") or '65 ("FC Twente '65")
  return name.replace(/\s+(?:'\d{2}|\d{4})\s*$/, "").trim();
}

function stripDots(s: string): string {
  return s.replace(/\./g, "");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function findTeamByName(sql: Sql, apiName: string): Promise<TeamHit | null> {
  // 1. Exact name or short_name
  let result = await sql`
    SELECT id, slug FROM teams WHERE name = ${apiName} OR short_name = ${apiName} LIMIT 1
  `;
  if (result[0]) return result[0] as TeamHit;

  // 2. Strip trailing year, retry exact
  const stripped = stripYearSuffix(apiName);
  if (stripped !== apiName) {
    result = await sql`
      SELECT id, slug FROM teams WHERE name = ${stripped} OR short_name = ${stripped} LIMIT 1
    `;
    if (result[0]) return result[0] as TeamHit;
  }

  // 3. Normalize dots — try API-without-dots against DB-without-dots
  const noDots = stripDots(stripped);
  if (noDots !== stripped) {
    result = await sql`
      SELECT id, slug FROM teams
      WHERE replace(name, '.', '') = ${noDots}
         OR replace(short_name, '.', '') = ${noDots}
      LIMIT 1
    `;
    if (result[0]) return result[0] as TeamHit;
  }
  // Also try with DB names that include dots: API "FC Famalicão" against
  // DB "F.C. Famalicão" → strip dots from DB side.
  result = await sql`
    SELECT id, slug FROM teams
    WHERE replace(name, '.', '') = ${stripped}
       OR replace(short_name, '.', '') = ${stripped}
    LIMIT 1
  `;
  if (result[0]) return result[0] as TeamHit;

  // 4. Slugify and match by slug
  const apiSlug = slugify(stripped);
  result = await sql`SELECT id, slug FROM teams WHERE slug = ${apiSlug} LIMIT 1`;
  if (result[0]) return result[0] as TeamHit;

  // 5. Manual alias
  const aliasSlug = TEAM_NAME_ALIASES[apiName];
  if (aliasSlug) {
    result = await sql`SELECT id, slug FROM teams WHERE slug = ${aliasSlug} LIMIT 1`;
    if (result[0]) return result[0] as TeamHit;
  }

  // 6. ILIKE partial + cleaned ILIKE — last resort
  result = await sql`
    SELECT id, slug FROM teams
    WHERE name ILIKE ${`%${stripped}%`} OR short_name ILIKE ${`%${stripped}%`}
    LIMIT 1
  `;
  if (result[0]) return result[0] as TeamHit;

  const cleanName = stripped.replace(/ FC$| CF$| SC$/i, "").trim();
  result = await sql`
    SELECT id, slug FROM teams
    WHERE name ILIKE ${`%${cleanName}%`} OR short_name ILIKE ${`%${cleanName}%`}
    LIMIT 1
  `;
  return (result[0] as TeamHit) ?? null;
}
