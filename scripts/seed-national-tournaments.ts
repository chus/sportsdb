/**
 * Seed `tournaments` lookup + `national_team_tournaments` performance history.
 *
 * Data scope (v1, ahead of FIFA World Cup 2026):
 *   - FIFA World Cup: top-4 finishers for every edition since 1930
 *   - Copa América: top-2 finishers for every edition
 *   - UEFA European Championship: top-2 finishers since 1960
 *   - Africa Cup of Nations: top-2 since 1957
 *   - AFC Asian Cup: top-2 since 1956
 *   - CONCACAF Gold Cup / Championship: top-2 since 1963
 *
 * Historical-team mapping: West Germany → Germany. Predecessor states with
 * no clean modern equivalent (Czechoslovakia, Yugoslavia, USSR, Soviet
 * Union, East Germany) are deliberately skipped — we'd rather miss a row
 * than mis-attribute one.
 *
 * Idempotent: rows are keyed by (team, tournament, year) so re-runs upsert
 * cleanly. Existing rows ARE overwritten so corrections take effect.
 *
 * Usage:
 *   npx tsx scripts/seed-national-tournaments.ts
 *   npx tsx scripts/seed-national-tournaments.ts --dry-run
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const dryRun = process.argv.includes("--dry-run");

// ───────────────────────────────────────────────────────────────────────────
// Tournaments catalog
// ───────────────────────────────────────────────────────────────────────────

interface Tournament {
  key: string;
  name: string;
  shortName: string;
  region: string;
  governingBody: string;
  foundedYear: number;
  editionFrequencyYears: number;
  wikipediaUrl: string;
}

const TOURNAMENTS: Tournament[] = [
  {
    key: "fifa-world-cup",
    name: "FIFA World Cup",
    shortName: "World Cup",
    region: "World",
    governingBody: "FIFA",
    foundedYear: 1930,
    editionFrequencyYears: 4,
    wikipediaUrl: "https://en.wikipedia.org/wiki/FIFA_World_Cup",
  },
  {
    key: "copa-america",
    name: "Copa América",
    shortName: "Copa América",
    region: "South America",
    governingBody: "CONMEBOL",
    foundedYear: 1916,
    editionFrequencyYears: 2,
    wikipediaUrl: "https://en.wikipedia.org/wiki/Copa_Am%C3%A9rica",
  },
  {
    key: "uefa-euro",
    name: "UEFA European Championship",
    shortName: "Euro",
    region: "Europe",
    governingBody: "UEFA",
    foundedYear: 1960,
    editionFrequencyYears: 4,
    wikipediaUrl: "https://en.wikipedia.org/wiki/UEFA_European_Championship",
  },
  {
    key: "afcon",
    name: "Africa Cup of Nations",
    shortName: "AFCON",
    region: "Africa",
    governingBody: "CAF",
    foundedYear: 1957,
    editionFrequencyYears: 2,
    wikipediaUrl: "https://en.wikipedia.org/wiki/Africa_Cup_of_Nations",
  },
  {
    key: "asian-cup",
    name: "AFC Asian Cup",
    shortName: "Asian Cup",
    region: "Asia",
    governingBody: "AFC",
    foundedYear: 1956,
    editionFrequencyYears: 4,
    wikipediaUrl: "https://en.wikipedia.org/wiki/AFC_Asian_Cup",
  },
  {
    key: "gold-cup",
    name: "CONCACAF Gold Cup",
    shortName: "Gold Cup",
    region: "North America",
    governingBody: "CONCACAF",
    foundedYear: 1963,
    editionFrequencyYears: 2,
    wikipediaUrl: "https://en.wikipedia.org/wiki/CONCACAF_Gold_Cup",
  },
];

// ───────────────────────────────────────────────────────────────────────────
// Performance history (curated)
// ───────────────────────────────────────────────────────────────────────────

interface Result {
  year: number;
  host: string;
  /** 1st, 2nd, 3rd, 4th. Use null for "did not exist / unknown / skipped". */
  first: string | null;
  second: string | null;
  third?: string | null;
  fourth?: string | null;
}

// West Germany (1949–1990) attributed to Germany (current).
// East Germany, Czechoslovakia, Yugoslavia, USSR are intentionally null
// (no clean modern attribution).

const WORLD_CUP: Result[] = [
  { year: 1930, host: "Uruguay", first: "Uruguay", second: "Argentina", third: "United States", fourth: null },
  { year: 1934, host: "Italy", first: "Italy", second: null, third: "Germany", fourth: null },
  { year: 1938, host: "France", first: "Italy", second: null, third: "Brazil", fourth: null },
  { year: 1950, host: "Brazil", first: "Uruguay", second: "Brazil", third: null, fourth: "Spain" },
  { year: 1954, host: "Switzerland", first: "Germany", second: null, third: null, fourth: "Uruguay" },
  { year: 1958, host: "Sweden", first: "Brazil", second: null, third: "France", fourth: "Germany" },
  { year: 1962, host: "Chile", first: "Brazil", second: null, third: "Chile", fourth: null },
  { year: 1966, host: "England", first: "England", second: "Germany", third: "Portugal", fourth: null },
  { year: 1970, host: "Mexico", first: "Brazil", second: "Italy", third: "Germany", fourth: "Uruguay" },
  { year: 1974, host: "Germany", first: "Germany", second: "Netherlands", third: null, fourth: "Brazil" },
  { year: 1978, host: "Argentina", first: "Argentina", second: "Netherlands", third: "Brazil", fourth: "Italy" },
  { year: 1982, host: "Spain", first: "Italy", second: "Germany", third: null, fourth: "France" },
  { year: 1986, host: "Mexico", first: "Argentina", second: "Germany", third: "France", fourth: "Belgium" },
  { year: 1990, host: "Italy", first: "Germany", second: "Argentina", third: "Italy", fourth: "England" },
  { year: 1994, host: "United States", first: "Brazil", second: "Italy", third: "Sweden", fourth: "Bulgaria" },
  { year: 1998, host: "France", first: "France", second: "Brazil", third: "Croatia", fourth: "Netherlands" },
  { year: 2002, host: "South Korea", first: "Brazil", second: "Germany", third: "Turkey", fourth: "South Korea" },
  { year: 2006, host: "Germany", first: "Italy", second: "France", third: "Germany", fourth: "Portugal" },
  { year: 2010, host: "South Africa", first: "Spain", second: "Netherlands", third: "Germany", fourth: "Uruguay" },
  { year: 2014, host: "Brazil", first: "Germany", second: "Argentina", third: "Netherlands", fourth: "Brazil" },
  { year: 2018, host: "Russia", first: "France", second: "Croatia", third: "Belgium", fourth: "England" },
  { year: 2022, host: "Qatar", first: "Argentina", second: "France", third: "Croatia", fourth: "Morocco" },
];

const COPA_AMERICA: Result[] = [
  // Curated champions and runners-up only (top-2). Pre-1975 editions used
  // round-robin so "runner-up" = best non-champion.
  { year: 1916, host: "Argentina", first: "Uruguay", second: "Argentina" },
  { year: 1917, host: "Uruguay", first: "Uruguay", second: "Argentina" },
  { year: 1919, host: "Brazil", first: "Brazil", second: "Uruguay" },
  { year: 1920, host: "Chile", first: "Uruguay", second: "Argentina" },
  { year: 1921, host: "Argentina", first: "Argentina", second: "Brazil" },
  { year: 1922, host: "Brazil", first: "Brazil", second: "Paraguay" },
  { year: 1923, host: "Uruguay", first: "Uruguay", second: "Argentina" },
  { year: 1924, host: "Uruguay", first: "Uruguay", second: "Argentina" },
  { year: 1925, host: "Argentina", first: "Argentina", second: "Brazil" },
  { year: 1926, host: "Chile", first: "Uruguay", second: "Argentina" },
  { year: 1927, host: "Peru", first: "Argentina", second: "Uruguay" },
  { year: 1929, host: "Argentina", first: "Argentina", second: "Paraguay" },
  { year: 1935, host: "Peru", first: "Uruguay", second: "Argentina" },
  { year: 1937, host: "Argentina", first: "Argentina", second: "Brazil" },
  { year: 1939, host: "Peru", first: "Peru", second: "Uruguay" },
  { year: 1941, host: "Chile", first: "Argentina", second: "Uruguay" },
  { year: 1942, host: "Uruguay", first: "Uruguay", second: "Argentina" },
  { year: 1945, host: "Chile", first: "Argentina", second: "Brazil" },
  { year: 1946, host: "Argentina", first: "Argentina", second: "Brazil" },
  { year: 1947, host: "Ecuador", first: "Argentina", second: "Paraguay" },
  { year: 1949, host: "Brazil", first: "Brazil", second: "Paraguay" },
  { year: 1953, host: "Peru", first: "Paraguay", second: "Brazil" },
  { year: 1955, host: "Chile", first: "Argentina", second: "Chile" },
  { year: 1956, host: "Uruguay", first: "Uruguay", second: "Chile" },
  { year: 1957, host: "Peru", first: "Argentina", second: "Brazil" },
  { year: 1959, host: "Argentina", first: "Argentina", second: "Brazil" },
  { year: 1963, host: "Bolivia", first: "Bolivia", second: "Paraguay" },
  { year: 1967, host: "Uruguay", first: "Uruguay", second: "Argentina" },
  { year: 1975, host: "Multiple", first: "Peru", second: "Colombia" },
  { year: 1979, host: "Multiple", first: "Paraguay", second: "Chile" },
  { year: 1983, host: "Multiple", first: "Uruguay", second: "Brazil" },
  { year: 1987, host: "Argentina", first: "Uruguay", second: "Chile" },
  { year: 1989, host: "Brazil", first: "Brazil", second: "Uruguay" },
  { year: 1991, host: "Chile", first: "Argentina", second: "Brazil" },
  { year: 1993, host: "Ecuador", first: "Argentina", second: "Mexico" },
  { year: 1995, host: "Uruguay", first: "Uruguay", second: "Brazil" },
  { year: 1997, host: "Bolivia", first: "Brazil", second: "Bolivia" },
  { year: 1999, host: "Paraguay", first: "Brazil", second: "Uruguay" },
  { year: 2001, host: "Colombia", first: "Colombia", second: "Mexico" },
  { year: 2004, host: "Peru", first: "Brazil", second: "Argentina" },
  { year: 2007, host: "Venezuela", first: "Brazil", second: "Argentina" },
  { year: 2011, host: "Argentina", first: "Uruguay", second: "Paraguay" },
  { year: 2015, host: "Chile", first: "Chile", second: "Argentina" },
  { year: 2016, host: "United States", first: "Chile", second: "Argentina" }, // Centenario
  { year: 2019, host: "Brazil", first: "Brazil", second: "Peru" },
  { year: 2021, host: "Brazil", first: "Argentina", second: "Brazil" },
  { year: 2024, host: "United States", first: "Argentina", second: "Colombia" },
];

const UEFA_EURO: Result[] = [
  // Pre-2008 winners. Czechoslovakia/USSR/Yugoslavia results omitted.
  { year: 1960, host: "France", first: null, second: null }, // USSR vs Yugoslavia — skip
  { year: 1964, host: "Spain", first: "Spain", second: null },
  { year: 1968, host: "Italy", first: "Italy", second: null },
  { year: 1972, host: "Belgium", first: "Germany", second: null },
  { year: 1976, host: "Yugoslavia", first: null, second: "Germany" }, // Czechoslovakia winners
  { year: 1980, host: "Italy", first: "Germany", second: "Belgium" },
  { year: 1984, host: "France", first: "France", second: "Spain" },
  { year: 1988, host: "Germany", first: "Netherlands", second: null },
  { year: 1992, host: "Sweden", first: "Denmark", second: "Germany" },
  { year: 1996, host: "England", first: "Germany", second: null },
  { year: 2000, host: "Belgium/Netherlands", first: "France", second: "Italy" },
  { year: 2004, host: "Portugal", first: null, second: "Portugal" }, // Greece winners (not in our DB)
  { year: 2008, host: "Austria/Switzerland", first: "Spain", second: "Germany" },
  { year: 2012, host: "Poland/Ukraine", first: "Spain", second: "Italy" },
  { year: 2016, host: "France", first: "Portugal", second: "France" },
  { year: 2020, host: "Multiple", first: "Italy", second: "England" }, // Held 2021
  { year: 2024, host: "Germany", first: "Spain", second: "England" },
];

const AFCON: Result[] = [
  { year: 1957, host: "Sudan", first: "Egypt", second: null },
  { year: 1959, host: "Egypt", first: "Egypt", second: null },
  { year: 1962, host: "Ethiopia", first: null, second: "Egypt" },
  { year: 1963, host: "Ghana", first: "Ghana", second: null },
  { year: 1965, host: "Tunisia", first: "Ghana", second: null },
  { year: 1968, host: "Ethiopia", first: null, second: "Ghana" }, // Congo-Kinshasa
  { year: 1970, host: "Sudan", first: null, second: "Ghana" },
  { year: 1972, host: "Cameroon", first: null, second: null }, // Congo
  { year: 1974, host: "Egypt", first: null, second: null }, // Zaire
  { year: 1976, host: "Ethiopia", first: "Morocco", second: null },
  { year: 1978, host: "Ghana", first: "Ghana", second: null },
  { year: 1980, host: "Nigeria", first: "Nigeria", second: "Algeria" },
  { year: 1982, host: "Libya", first: "Ghana", second: null },
  { year: 1984, host: "Ivory Coast", first: "Cameroon", second: "Nigeria" },
  { year: 1986, host: "Egypt", first: "Egypt", second: "Cameroon" },
  { year: 1988, host: "Morocco", first: "Cameroon", second: "Nigeria" },
  { year: 1990, host: "Algeria", first: "Algeria", second: "Nigeria" },
  { year: 1992, host: "Senegal", first: "Ivory Coast", second: "Ghana" },
  { year: 1994, host: "Tunisia", first: "Nigeria", second: null }, // Zambia
  { year: 1996, host: "South Africa", first: null, second: null }, // SA winners
  { year: 1998, host: "Burkina Faso", first: "Egypt", second: null },
  { year: 2000, host: "Ghana/Nigeria", first: "Cameroon", second: "Nigeria" },
  { year: 2002, host: "Mali", first: "Cameroon", second: "Senegal" },
  { year: 2004, host: "Tunisia", first: null, second: "Morocco" }, // Tunisia winners
  { year: 2006, host: "Egypt", first: "Egypt", second: "Ivory Coast" },
  { year: 2008, host: "Ghana", first: "Egypt", second: "Cameroon" },
  { year: 2010, host: "Angola", first: "Egypt", second: "Ghana" },
  { year: 2012, host: "Gabon/Equatorial Guinea", first: null, second: "Ivory Coast" }, // Zambia winners
  { year: 2013, host: "South Africa", first: "Nigeria", second: null }, // Burkina Faso runners-up
  { year: 2015, host: "Equatorial Guinea", first: "Ivory Coast", second: "Ghana" },
  { year: 2017, host: "Gabon", first: "Cameroon", second: "Egypt" },
  { year: 2019, host: "Egypt", first: "Algeria", second: "Senegal" },
  { year: 2021, host: "Cameroon", first: "Senegal", second: "Egypt" }, // Held 2022
  { year: 2023, host: "Ivory Coast", first: "Ivory Coast", second: "Nigeria" }, // Held 2024
];

const ASIAN_CUP: Result[] = [
  { year: 1956, host: "Hong Kong", first: "South Korea", second: null },
  { year: 1960, host: "South Korea", first: "South Korea", second: null },
  { year: 1964, host: "Israel", first: null, second: null }, // Israel winners
  { year: 1968, host: "Iran", first: "Iran", second: null },
  { year: 1972, host: "Thailand", first: "Iran", second: null },
  { year: 1976, host: "Iran", first: "Iran", second: null },
  { year: 1980, host: "Kuwait", first: null, second: "South Korea" }, // Kuwait
  { year: 1984, host: "Singapore", first: "Saudi Arabia", second: null },
  { year: 1988, host: "Qatar", first: "Saudi Arabia", second: "South Korea" },
  { year: 1992, host: "Japan", first: "Japan", second: "Saudi Arabia" },
  { year: 1996, host: "United Arab Emirates", first: "Saudi Arabia", second: null },
  { year: 2000, host: "Lebanon", first: "Japan", second: "Saudi Arabia" },
  { year: 2004, host: "China", first: "Japan", second: null },
  { year: 2007, host: "Multiple", first: "Iraq", second: "Saudi Arabia" }, // Iraq not seeded
  { year: 2011, host: "Qatar", first: "Japan", second: "Australia" },
  { year: 2015, host: "Australia", first: "Australia", second: "South Korea" },
  { year: 2019, host: "United Arab Emirates", first: "Qatar", second: "Japan" },
  { year: 2023, host: "Qatar", first: "Qatar", second: "Jordan" }, // Held 2024
];

const GOLD_CUP: Result[] = [
  // CONCACAF Championship (1963-1989), then Gold Cup (1991-).
  { year: 1963, host: "El Salvador", first: "Costa Rica", second: null },
  { year: 1965, host: "Guatemala", first: "Mexico", second: null },
  { year: 1967, host: "Honduras", first: "Mexico", second: null },
  { year: 1969, host: "Costa Rica", first: "Costa Rica", second: null },
  { year: 1971, host: "Trinidad and Tobago", first: "Mexico", second: null },
  { year: 1973, host: "Haiti", first: null, second: null }, // Haiti
  { year: 1977, host: "Mexico", first: "Mexico", second: null },
  { year: 1981, host: "Honduras", first: "Honduras", second: null },
  { year: 1985, host: "Various", first: "Canada", second: "Honduras" },
  { year: 1989, host: "Various", first: "Costa Rica", second: "United States" },
  { year: 1991, host: "United States", first: "United States", second: "Honduras" },
  { year: 1993, host: "United States/Mexico", first: "Mexico", second: "United States" },
  { year: 1996, host: "United States", first: "Mexico", second: "Brazil" }, // Brazil guest
  { year: 1998, host: "United States", first: "Mexico", second: "United States" },
  { year: 2000, host: "United States", first: "Canada", second: "Colombia" }, // Colombia guest
  { year: 2002, host: "United States", first: "United States", second: "Costa Rica" },
  { year: 2003, host: "United States/Mexico", first: "Mexico", second: "Brazil" }, // Brazil guest
  { year: 2005, host: "United States", first: "United States", second: "Panama" },
  { year: 2007, host: "United States", first: "United States", second: "Mexico" },
  { year: 2009, host: "United States", first: "Mexico", second: "United States" },
  { year: 2011, host: "United States", first: "Mexico", second: "United States" },
  { year: 2013, host: "United States", first: "United States", second: "Panama" },
  { year: 2015, host: "United States/Canada", first: "Mexico", second: "Jamaica" },
  { year: 2017, host: "United States", first: "United States", second: "Jamaica" },
  { year: 2019, host: "United States/Costa Rica/Jamaica", first: "Mexico", second: "United States" },
  { year: 2021, host: "United States", first: "United States", second: "Mexico" },
  { year: 2023, host: "United States/Canada", first: "Mexico", second: "Panama" },
  { year: 2025, host: "United States/Canada", first: "Mexico", second: "United States" },
];

// ───────────────────────────────────────────────────────────────────────────
// Upsert logic
// ───────────────────────────────────────────────────────────────────────────

const STAGE_BY_POSITION: Record<number, string> = {
  1: "Champions",
  2: "Runners-up",
  3: "Third place",
  4: "Fourth place",
};

interface Appearance {
  tournamentKey: string;
  year: number;
  host: string;
  country: string;
  position: 1 | 2 | 3 | 4;
}

function expand(results: Result[], tournamentKey: string): Appearance[] {
  const out: Appearance[] = [];
  for (const r of results) {
    if (r.first) out.push({ tournamentKey, year: r.year, host: r.host, country: r.first, position: 1 });
    if (r.second) out.push({ tournamentKey, year: r.year, host: r.host, country: r.second, position: 2 });
    if (r.third) out.push({ tournamentKey, year: r.year, host: r.host, country: r.third, position: 3 });
    if (r.fourth) out.push({ tournamentKey, year: r.year, host: r.host, country: r.fourth, position: 4 });
  }
  return out;
}

async function getTeamIdByName(name: string): Promise<string | null> {
  const rows = await sql`
    SELECT id FROM teams WHERE name = ${name} AND team_type = 'national' LIMIT 1
  `;
  return rows[0] ? (rows[0] as { id: string }).id : null;
}

async function main() {
  console.log(`\n🏆 Seeding national-team tournaments${dryRun ? " (DRY RUN)" : ""}\n`);

  // 1. Upsert tournaments catalog
  const tournamentIds = new Map<string, string>();
  for (const t of TOURNAMENTS) {
    if (dryRun) {
      console.log(`  [dry] tournament ${t.key}`);
      tournamentIds.set(t.key, "00000000-0000-0000-0000-000000000000");
      continue;
    }
    const rows = await sql`
      INSERT INTO tournaments (
        key, name, short_name, region, governing_body,
        founded_year, edition_frequency_years, wikipedia_url
      ) VALUES (
        ${t.key}, ${t.name}, ${t.shortName}, ${t.region}, ${t.governingBody},
        ${t.foundedYear}, ${t.editionFrequencyYears}, ${t.wikipediaUrl}
      )
      ON CONFLICT (key) DO UPDATE SET
        name = EXCLUDED.name,
        short_name = EXCLUDED.short_name,
        region = EXCLUDED.region,
        governing_body = EXCLUDED.governing_body,
        founded_year = EXCLUDED.founded_year,
        edition_frequency_years = EXCLUDED.edition_frequency_years,
        wikipedia_url = EXCLUDED.wikipedia_url,
        updated_at = NOW()
      RETURNING id
    `;
    tournamentIds.set(t.key, (rows[0] as { id: string }).id);
  }
  console.log(`  ${TOURNAMENTS.length} tournaments upserted`);

  // 2. Expand all results
  const appearances: Appearance[] = [
    ...expand(WORLD_CUP, "fifa-world-cup"),
    ...expand(COPA_AMERICA, "copa-america"),
    ...expand(UEFA_EURO, "uefa-euro"),
    ...expand(AFCON, "afcon"),
    ...expand(ASIAN_CUP, "asian-cup"),
    ...expand(GOLD_CUP, "gold-cup"),
  ];
  console.log(`  ${appearances.length} top-4 appearances to upsert`);

  // 3. Resolve team IDs
  const teamCache = new Map<string, string | null>();
  async function teamId(name: string): Promise<string | null> {
    if (!teamCache.has(name)) {
      teamCache.set(name, await getTeamIdByName(name));
    }
    return teamCache.get(name) ?? null;
  }

  // 4. Upsert appearances
  let inserted = 0;
  let updated = 0;
  let missingTeam = new Set<string>();
  for (const a of appearances) {
    const tId = tournamentIds.get(a.tournamentKey);
    if (!tId) throw new Error(`missing tournament ${a.tournamentKey}`);
    const teamUuid = await teamId(a.country);
    if (!teamUuid) {
      missingTeam.add(a.country);
      continue;
    }
    if (dryRun) {
      inserted++;
      continue;
    }
    const result = await sql`
      INSERT INTO national_team_tournaments (
        team_id, tournament_id, year, host_country,
        stage_reached, finishing_position
      ) VALUES (
        ${teamUuid}, ${tId}, ${a.year}, ${a.host},
        ${STAGE_BY_POSITION[a.position]}, ${a.position}
      )
      ON CONFLICT (team_id, tournament_id, year) DO UPDATE SET
        host_country = EXCLUDED.host_country,
        stage_reached = EXCLUDED.stage_reached,
        finishing_position = EXCLUDED.finishing_position,
        updated_at = NOW()
      RETURNING (xmax = 0) AS inserted
    `;
    if ((result[0] as { inserted: boolean }).inserted) inserted++;
    else updated++;
  }

  console.log("\n═══════════════════════════════════════");
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Updated:  ${updated}`);
  if (missingTeam.size > 0) {
    console.log(`  Skipped (team not in DB): ${[...missingTeam].join(", ")}`);
  }
  console.log("═══════════════════════════════════════\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
