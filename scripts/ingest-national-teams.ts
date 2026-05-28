/**
 * Ingest national football team metadata from Wikidata.
 *
 * For each country we resolve the men's senior team's Wikidata Q-id by
 * looking up its Wikipedia page (deterministic title — "X national football
 * team", with a soccer variant for USA), then query Wikidata for metadata.
 *
 * Idempotent: matches existing rows by slug → name. Never overwrites a
 * column that already has a non-empty value, except for three fields that
 * the previous broken Wikipedia ingest polluted:
 *   - team_type    → always set to 'national'
 *   - country      → always set to the canonical country name (e.g. fixes
 *                    Argentina row that has country='Spain')
 *   - city         → always cleared (national teams have no city)
 *
 * Fields filled from Wikidata when missing:
 *   wikidata_id, wikipedia_url, logo_url (P154), founded_year (P571),
 *   coach_name (P286), short_name (FIFA trigramme P1466)
 *
 * Usage:
 *   npx tsx scripts/ingest-national-teams.ts
 *   npx tsx scripts/ingest-national-teams.ts --dry-run
 *   npx tsx scripts/ingest-national-teams.ts --only=Argentina,Brazil
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { sparqlQuery, val, qid } from "./wikidata/sparql";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const dryRun = process.argv.includes("--dry-run");
const onlyArg = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
const onlyCountries = onlyArg ? new Set(onlyArg.split(",").map((s) => s.trim())) : null;

// Countries we ingest. The Wikipedia page title for the men's senior team is
// almost always "{Country} national football team", with two exceptions:
//   - USA uses "United States men's national soccer team"
//   - South Korea's English Wikipedia article is "South Korea national
//     football team" (canonical)
// Extra candidate titles allow falling through gracefully.
interface CountryEntry {
  name: string;
  /** Override Wikipedia page title. Defaults to "{name} national football team". */
  wikiTitle?: string;
  /** FIFA trigramme (Wikidata P1466 is incomplete for many national teams). */
  fifaCode?: string;
  /** Inception year (Wikidata P571 is incomplete for many national teams). */
  founded?: number;
}

const COUNTRIES: CountryEntry[] = [
  // South America (CONMEBOL)
  { name: "Argentina", fifaCode: "ARG", founded: 1893 },
  { name: "Brazil", fifaCode: "BRA", founded: 1914 },
  { name: "Uruguay", fifaCode: "URU", founded: 1900 },
  { name: "Colombia", fifaCode: "COL", founded: 1924 },
  { name: "Chile", fifaCode: "CHI", founded: 1895 },
  { name: "Peru", fifaCode: "PER", founded: 1922 },
  { name: "Ecuador", fifaCode: "ECU", founded: 1925 },
  { name: "Paraguay", fifaCode: "PAR", founded: 1906 },
  { name: "Venezuela", fifaCode: "VEN", founded: 1926 },
  { name: "Bolivia", fifaCode: "BOL", founded: 1925 },

  // Europe (UEFA)
  { name: "France", fifaCode: "FRA", founded: 1904 },
  { name: "Germany", fifaCode: "GER", founded: 1900 },
  { name: "Spain", fifaCode: "ESP", founded: 1909 },
  { name: "Italy", fifaCode: "ITA", founded: 1898 },
  { name: "England", fifaCode: "ENG", founded: 1863 },
  { name: "Portugal", fifaCode: "POR", founded: 1914 },
  { name: "Netherlands", fifaCode: "NED", founded: 1889 },
  { name: "Belgium", fifaCode: "BEL", founded: 1895 },
  { name: "Croatia", fifaCode: "CRO", founded: 1912 },
  { name: "Switzerland", fifaCode: "SUI", founded: 1895 },
  { name: "Denmark", fifaCode: "DEN", founded: 1889 },
  { name: "Serbia", fifaCode: "SRB", founded: 1919 },
  { name: "Wales", fifaCode: "WAL", founded: 1876 },
  { name: "Scotland", fifaCode: "SCO", founded: 1873 },

  // Africa (CAF)
  { name: "Morocco", fifaCode: "MAR", founded: 1955 },
  { name: "Senegal", fifaCode: "SEN", founded: 1960 },
  { name: "Nigeria", fifaCode: "NGA", founded: 1933 },
  { name: "Egypt", fifaCode: "EGY", founded: 1921 },
  { name: "Ghana", fifaCode: "GHA", founded: 1957 },
  { name: "Cameroon", fifaCode: "CMR", founded: 1959 },
  { name: "Ivory Coast", fifaCode: "CIV", founded: 1960 },
  { name: "Algeria", fifaCode: "ALG", founded: 1962 },

  // Asia (AFC)
  { name: "Japan", fifaCode: "JPN", founded: 1921 },
  { name: "South Korea", fifaCode: "KOR", founded: 1928 },
  { name: "Iran", fifaCode: "IRN", founded: 1920 },
  { name: "Saudi Arabia", fifaCode: "KSA", founded: 1956 },
  { name: "Australia", fifaCode: "AUS", founded: 1922 },
  { name: "Indonesia", fifaCode: "IDN", founded: 1930 },
  { name: "Bahrain", fifaCode: "BHR", founded: 1957 },
  { name: "Qatar", fifaCode: "QAT", founded: 1960 },

  // CONCACAF
  { name: "United States", wikiTitle: "United States men's national soccer team", fifaCode: "USA", founded: 1913 },
  { name: "Canada", wikiTitle: "Canada men's national soccer team", fifaCode: "CAN", founded: 1912 },
  { name: "Mexico", fifaCode: "MEX", founded: 1923 },
  { name: "Costa Rica", fifaCode: "CRC", founded: 1921 },
  { name: "Panama", fifaCode: "PAN", founded: 1937 },
  { name: "Jamaica", fifaCode: "JAM", founded: 1910 },
  { name: "Honduras", fifaCode: "HON", founded: 1935 },

  // OFC
  { name: "New Zealand", fifaCode: "NZL", founded: 1891 },

  // Additional nations (not in WC 2026 but already in DB as polluted rows
  // from the old Wikipedia ingest, or notable historical sides).
  { name: "Austria", fifaCode: "AUT", founded: 1904 },
  { name: "Hungary", fifaCode: "HUN", founded: 1901 },
  { name: "Cape Verde", fifaCode: "CPV", founded: 1978 },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface WikidataFacts {
  wikidataId: string;
  wikipediaUrl: string;
  logoUrl: string | null;
  foundedYear: number | null;
  coachName: string | null;
  shortName: string | null; // FIFA trigramme, e.g. "ARG"
}

const WIKI_API = "https://en.wikipedia.org/w/api.php";
const USER_AGENT = "SportsDB/1.0 (https://datasports.co; national-team-ingest)";

async function resolveWikidataQid(title: string): Promise<{ qid: string; url: string } | null> {
  const params = new URLSearchParams({
    action: "query",
    prop: "pageprops",
    ppprop: "wikibase_item",
    redirects: "1",
    titles: title,
    format: "json",
    formatversion: "2",
  });
  const res = await fetch(`${WIKI_API}?${params.toString()}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`Wikipedia API ${res.status}`);
  const data = (await res.json()) as {
    query?: {
      pages?: Array<{ missing?: boolean; pageprops?: { wikibase_item?: string }; title: string }>;
    };
  };
  const page = data.query?.pages?.[0];
  if (!page || page.missing || !page.pageprops?.wikibase_item) return null;
  const resolvedTitle = page.title.replace(/ /g, "_");
  return {
    qid: page.pageprops.wikibase_item,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(resolvedTitle)}`,
  };
}

async function fetchFactsForQid(qidStr: string): Promise<{
  logoUrl: string | null;
  foundedYear: number | null;
  coachName: string | null;
  shortName: string | null;
}> {
  const query = `
    SELECT ?logo ?inception ?coachLabel ?fifaCode WHERE {
      VALUES ?item { wd:${qidStr} }
      OPTIONAL { ?item wdt:P154 ?logo . }
      OPTIONAL { ?item wdt:P571 ?inception . }
      OPTIONAL { ?item wdt:P286 ?coach . }
      OPTIONAL { ?item wdt:P1466 ?fifaCode . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
    }
    LIMIT 1
  `;
  const rows = await sparqlQuery(query);
  if (rows.length === 0) {
    return { logoUrl: null, foundedYear: null, coachName: null, shortName: null };
  }
  const r = rows[0];
  const inception = val(r, "inception");
  const founded = inception ? parseInt(inception.substring(0, 4), 10) : null;
  return {
    logoUrl: val(r, "logo"),
    foundedYear: founded && founded > 1850 && founded < 2030 ? founded : null,
    coachName: val(r, "coachLabel"),
    shortName: val(r, "fifaCode"),
  };
}

async function fetchTeam(entry: CountryEntry): Promise<WikidataFacts | null> {
  const title = entry.wikiTitle ?? `${entry.name} national football team`;
  const resolved = await resolveWikidataQid(title);
  if (!resolved) return null;
  const facts = await fetchFactsForQid(resolved.qid);
  return {
    wikidataId: resolved.qid,
    wikipediaUrl: resolved.url,
    logoUrl: facts.logoUrl,
    // Curated values take precedence — Wikidata is incomplete for these.
    foundedYear: entry.founded ?? facts.foundedYear,
    coachName: facts.coachName,
    shortName: entry.fifaCode ?? facts.shortName,
  };
}

interface DbTeam {
  id: string;
  name: string;
  slug: string;
  team_type: string;
  country: string;
  city: string | null;
  founded_year: number | null;
  coach_name: string | null;
  wikidata_id: string | null;
  wikipedia_url: string | null;
  logo_url: string | null;
  short_name: string | null;
}

async function findExistingTeam(country: string): Promise<DbTeam | null> {
  const slug = slugify(country);
  const rows: DbTeam[] = await sql`
    SELECT id, name, slug, team_type, country, city, founded_year, coach_name,
           wikidata_id, wikipedia_url, logo_url, short_name
    FROM teams
    WHERE slug = ${slug} OR name = ${country}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function applyUpdate(teamId: string, changes: Record<string, unknown>) {
  // neon's tagged template can't compose set-clauses, so build raw SQL.
  const setExprs: string[] = [];
  const params: unknown[] = [];
  for (const [k, v] of Object.entries(changes)) {
    params.push(v);
    setExprs.push(`${k} = $${params.length}`);
  }
  params.push(teamId);
  const query = `UPDATE teams SET ${setExprs.join(", ")}, updated_at = NOW() WHERE id = $${params.length}`;
  await (sql.query as (q: string, p?: unknown[]) => Promise<unknown>)(query, params);
}

async function main() {
  console.log(`\n🏴 National-Team Ingest from Wikidata${dryRun ? " (DRY RUN)" : ""}\n`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of COUNTRIES) {
    const country = entry.name;
    if (onlyCountries && !onlyCountries.has(country)) continue;

    process.stdout.write(`  ${country.padEnd(18)} `);

    let facts: WikidataFacts | null = null;
    try {
      facts = await fetchTeam(entry);
    } catch (err) {
      console.log(`✗ lookup error: ${(err as Error).message}`);
      failed++;
      continue;
    }
    if (!facts) {
      console.log(`✗ no team found for "${entry.wikiTitle ?? country + " national football team"}"`);
      failed++;
      continue;
    }

    const existing = await findExistingTeam(country);
    const slug = slugify(country);

    if (existing) {
      const changes: Record<string, unknown> = {};
      // These four are always reset — they were polluted by the old ingest.
      // wikidata_id is authoritative once we resolve it via Wikipedia
      // page-properties (one previous run wrote the wrong Q-id from a fragile
      // SPARQL filter; that bad value should be overwritten).
      if (existing.team_type !== "national") changes.team_type = "national";
      if (existing.country !== country) changes.country = country;
      if (existing.city !== null) changes.city = null;
      if (existing.wikidata_id !== facts.wikidataId) changes.wikidata_id = facts.wikidataId;
      // The rest fill only when missing or visibly bogus.
      if (!existing.wikipedia_url && facts.wikipediaUrl) changes.wikipedia_url = facts.wikipediaUrl;
      if (!existing.logo_url && facts.logoUrl) changes.logo_url = facts.logoUrl;
      if (!existing.founded_year && facts.foundedYear) changes.founded_year = facts.foundedYear;
      if (!existing.coach_name && facts.coachName) changes.coach_name = facts.coachName;
      // short_name should be the FIFA 3-letter code. Reset if it isn't.
      const looksLikeFifaCode = (s: string | null) =>
        !!s && /^[A-Z]{3}$/.test(s);
      if (!looksLikeFifaCode(existing.short_name) && facts.shortName) {
        changes.short_name = facts.shortName;
      }

      if (Object.keys(changes).length === 0) {
        console.log("· up-to-date");
        skipped++;
        continue;
      }

      console.log(`↑ ${Object.keys(changes).join(", ")}`);
      if (!dryRun) await applyUpdate(existing.id, changes);
      updated++;
    } else {
      console.log(`+ creating  (${facts.wikidataId})`);
      if (!dryRun) {
        await sql`
          INSERT INTO teams (
            name, slug, team_type, country, short_name, founded_year,
            coach_name, logo_url, wikidata_id, wikipedia_url
          ) VALUES (
            ${country}, ${slug}, 'national', ${country},
            ${facts.shortName}, ${facts.foundedYear},
            ${facts.coachName}, ${facts.logoUrl}, ${facts.wikidataId}, ${facts.wikipediaUrl}
          )
        `;
      }
      created++;
    }
  }

  console.log("\n═══════════════════════════════════════");
  console.log(`  Created:  ${created}`);
  console.log(`  Updated:  ${updated}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Failed:   ${failed}`);
  console.log("═══════════════════════════════════════\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
