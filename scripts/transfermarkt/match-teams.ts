/**
 * Match Transfermarkt clubs to SportsDB teams
 *
 * Strategy:
 * 1. Hardcoded aliases for known name variations
 * 2. Slug-based matching (exact, +fc, +f-c)
 * 3. Significant word overlap within same country
 *
 * Usage:
 *   npx tsx scripts/transfermarkt/match-teams.ts
 *   npx tsx scripts/transfermarkt/match-teams.ts --dry-run
 */

import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const dryRun = process.argv.includes("--dry-run");

// Map Transfermarkt domestic_competition_id → SportsDB country name
const COMP_TO_COUNTRY: Record<string, string> = {
  GB1: "England",
  ES1: "Spain",
  IT1: "Italy",
  L1: "Germany",
  FR1: "France",
  NL1: "Netherlands",
  PO1: "Portugal",
  TR1: "Turkey",
  BE1: "Belgium",
  GR1: "Greece",
  SC1: "Scotland",
  DK1: "Denmark",
  RU1: "Russia",
  UKR1: "Ukraine",
};

// Common prefixes/suffixes that are not distinctive
const NOISE_WORDS = new Set([
  "fc", "f", "c", "cf", "sc", "ac", "as", "us", "ss", "cd", "ud", "sd", "gd",
  "sv", "vfb", "vfl", "bv", "fk", "sk", "nk", "rk", "ks",
  "club", "football", "calcio", "sport", "sporting", "sportiva", "sportif",
  "athletic", "atletico", "association", "de", "del", "da", "di", "do", "la",
  "le", "el", "the", "von", "und", "fur", "van", "den", "het", "des",
  "ssd", "sad", "spa", "srl", "gmbh", "ltd", "sa", "sas", "ag",
  "royal", "real", "koninklijke", "reial",
  "1899", "1900", "1904", "1907", "1909", "1913", "1919", "1946",
]);

// Hardcoded aliases: Transfermarkt club_code → SportsDB slug
const ALIASES: Record<string, string> = {
  // England
  "wolverhampton-wanderers": "wolverhampton-wanderers-fc",
  "tottenham-hotspur": "tottenham-hotspur-f-c",
  "newcastle-united": "newcastle-united-f-c",
  "manchester-city": "manchester-city-f-c",
  "manchester-united": "manchester-united-f-c",
  "west-ham-united": "west-ham-united-f-c",
  "nottingham-forest": "nottingham-forest-f-c",
  "brighton-amp-hove-albion": "brighton-and-hove-albion-f-c",
  "brighton-hove-albion": "brighton-and-hove-albion-f-c",
  "sheffield-united": "sheffield-united-fc",
  // Spain
  "atletico-de-madrid": "club-atletico-de-madrid",
  "atletico-madrid": "club-atletico-de-madrid",
  "real-madrid": "real-madrid-cf",
  "real-betis-sevilla": "real-betis-balompie",
  "real-betis-balompie": "real-betis-balompie",
  "rayo-vallecano-de-madrid": "rayo-vallecano-de-madrid-sad",
  "ca-osasuna": "club-atletico-osasuna",
  "real-valladolid": "real-valladolid-cf",
  "celta-de-vigo": "real-club-celta-de-vigo",
  "real-sociedad-san-sebastian": "real-sociedad",
  "fc-valencia": "valencia-cf",
  "fc-villarreal": "villarreal-cf",
  "fc-sevilla": "sevilla-fc",
  "fc-getafe": "getafe-cf",
  "fc-girona": "girona-fc",
  "fc-elche": "elche-cf",
  // Italy
  "inter-mailand": "fc-internazionale-milano",
  "ssc-neapel": "ssc-napoli",
  "ac-mailand": "ac-milan",
  "ac-florenz": "acf-fiorentina",
  "lazio-rom": "ss-lazio",
  "as-rom": "as-roma",
  "us-sassuolo": "us-sassuolo-calcio",
  "juventus-turin": "juventus-fc",
  "fc-turin": "torino-fc",
  "atalanta-bergamo": "atalanta-bc",
  // Germany
  "bayern-munich": "fc-bayern-munchen",
  "fc-bayern-munchen": "fc-bayern-munchen",
  "rasenballsport-leipzig": "rb-leipzig",
  // France
  "paris-saint-germain": "paris-saint-germain-fc",
  "as-monaco": "as-monaco-fc",
  "stade-rennais-fc": "stade-rennais-fc-1901",
  "losc-lille": "lille-osc",
  // Portugal
  "sporting-cp": "sporting-clube-de-portugal",
  "sl-benfica": "sport-lisboa-e-benfica",
  "boavista-porto-fc": "boavista-f-c",
  "vitoria-guimaraes-sc": "vitoria-sc",
  // Netherlands
  "ajax-amsterdam": "afc-ajax",
  "psv-eindhoven": "psv",
  "az-alkmaar": "az",
  "fc-twente-enschede": "fc-twente",
  "sbv-excelsior-rotterdam": "sbv-excelsior",
  "vitesse-arnheim": "vitesse",
  // Scotland
  "celtic-glasgow": "celtic-fc",
  "glasgow-rangers": "rangers-fc",
  // Denmark
  "fc-kopenhagen": "fc-kobenhavn",
  "fc-nordsjaelland": "fc-nordsjaelland",
  "fc-midtjylland": "fc-midtjylland",
  "brondby-if": "brondby-if",
  // Belgium
  "rsc-anderlecht": "rsc-anderlecht",
  "standard-luttich": "standard-liege",
  "fc-brugge": "club-brugge-kv",
  // Greece
  "olympiakos-piraus": "olympiacos-fc",
  "panathinaikos-athen": "panathinaikos-fc",
  "aek-athen": "aek-athens-fc",
  "paok-thessaloniki": "paok-fc",
  // Turkey
  "galatasaray-istanbul": "galatasaray-sk",
  "fenerbahce-istanbul": "fenerbahce-sk",
  "besiktas-istanbul": "besiktas-jk",
  "trabzonspor": "trabzonspor",
  "istanbul-basaksehir-fk": "istanbul-basaksehir-fk",
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Extract significant (non-noise) words from a slug */
function significantWords(slug: string): Set<string> {
  return new Set(
    slug.split("-").filter((w) => w.length > 1 && !NOISE_WORDS.has(w))
  );
}

/** Count how many significant words overlap between two sets */
function wordOverlap(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const w of a) {
    if (b.has(w)) count++;
  }
  return count;
}

interface TmClub {
  club_id: string;
  club_code: string;
  name: string;
  domestic_competition_id: string;
  total_market_value: string;
  squad_size: string;
  coach_name: string;
  last_season: string;
}

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.split("\n").filter(Boolean);
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    // Handle CSV fields that might contain commas inside quotes
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = values[i] || ""));
    return row;
  });
}

async function main() {
  console.log(
    `\nTransfermarkt → SportsDB Team Matching${dryRun ? " (DRY RUN)" : ""}\n`
  );

  // Load clubs CSV
  const clubsCsv = readFileSync("data/transfermarkt/clubs.csv", "utf-8");
  const clubs = parseCsv(clubsCsv) as unknown as TmClub[];
  console.log(`Loaded ${clubs.length} Transfermarkt clubs`);

  // Filter to latest season per club
  const latestClubs = new Map<string, TmClub>();
  for (const club of clubs) {
    const existing = latestClubs.get(club.club_id);
    if (
      !existing ||
      parseInt(club.last_season) > parseInt(existing.last_season)
    ) {
      latestClubs.set(club.club_id, club);
    }
  }
  console.log(`Unique clubs (latest season): ${latestClubs.size}`);

  // Load all SportsDB teams
  const dbTeams = await sql`
    SELECT id, slug, name, country FROM teams WHERE transfermarkt_id IS NULL
  `;
  console.log(`SportsDB teams without transfermarkt_id: ${dbTeams.length}\n`);

  // Build lookup maps
  const teamBySlug = new Map<string, (typeof dbTeams)[0]>();
  const teamsByCountry = new Map<string, (typeof dbTeams)[0][]>();

  for (const team of dbTeams) {
    teamBySlug.set(team.slug, team);
    const country = team.country || "";
    if (!teamsByCountry.has(country)) teamsByCountry.set(country, []);
    teamsByCountry.get(country)!.push(team);
  }

  let matched = 0;
  let unmatched = 0;
  const unmatchedList: string[] = [];
  const usedTeamIds = new Set<string>();

  for (const [, club] of latestClubs) {
    const country = COMP_TO_COUNTRY[club.domestic_competition_id] || "";
    let dbTeam: (typeof dbTeams)[0] | null = null;

    // 1. Check hardcoded aliases
    if (ALIASES[club.club_code]) {
      dbTeam = teamBySlug.get(ALIASES[club.club_code]) || null;
    }

    // 2. Try slug-based matching with common variations
    if (!dbTeam) {
      const tmSlug = slugify(club.name);
      const candidates = [
        tmSlug,
        tmSlug + "-fc",
        tmSlug + "-f-c",
        club.club_code,
        club.club_code + "-fc",
        club.club_code + "-f-c",
      ];
      for (const slug of candidates) {
        const t = teamBySlug.get(slug);
        if (t && !usedTeamIds.has(t.id)) {
          dbTeam = t;
          break;
        }
      }
    }

    // 3. Significant word overlap within same country (require >= 2 matching words)
    if (!dbTeam && country) {
      const countryTeams = teamsByCountry.get(country) || [];
      const tmWords = significantWords(slugify(club.name));
      const tmCodeWords = significantWords(club.club_code);
      const allTmWords = new Set([...tmWords, ...tmCodeWords]);

      if (allTmWords.size >= 1) {
        let bestMatch: (typeof dbTeams)[0] | null = null;
        let bestOverlap = 0;

        for (const ct of countryTeams) {
          if (usedTeamIds.has(ct.id)) continue;
          const dbWords = significantWords(ct.slug);
          const overlap = wordOverlap(allTmWords, dbWords);
          // Require at least 2 overlapping significant words, OR
          // 1 word if both sides have exactly 1 significant word
          const minRequired =
            allTmWords.size === 1 && dbWords.size === 1 ? 1 : 2;
          if (overlap >= minRequired && overlap > bestOverlap) {
            bestOverlap = overlap;
            bestMatch = ct;
          }
        }

        if (bestMatch) dbTeam = bestMatch;
      }
    }

    if (dbTeam && !usedTeamIds.has(dbTeam.id)) {
      usedTeamIds.add(dbTeam.id);
      matched++;

      const marketValue = parseMarketValue(club.total_market_value);

      if (!dryRun) {
        await sql`
          UPDATE teams SET
            transfermarkt_id = ${parseInt(club.club_id)},
            coach_name = ${club.coach_name || null},
            squad_market_value = ${marketValue}
          WHERE id = ${dbTeam.id}
        `;
      }

      console.log(`  ✓ ${club.name} → ${dbTeam.name} (${dbTeam.slug})`);
    } else {
      unmatched++;
      unmatchedList.push(
        `${club.name} [${club.club_code}] (${club.domestic_competition_id})`
      );
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Matched: ${matched} / ${latestClubs.size}`);
  console.log(`Unmatched: ${unmatched}`);

  if (unmatchedList.length > 0) {
    console.log(`\nUnmatched clubs:`);
    for (const u of unmatchedList) {
      console.log(`  ✗ ${u}`);
    }
  }

  console.log("\nDone!");
}

function parseMarketValue(val: string): number | null {
  if (!val) return null;
  const num = parseFloat(val.replace(/[€,]/g, ""));
  if (isNaN(num)) return null;
  if (val.includes("m")) return Math.round(num * 1_000_000);
  if (val.includes("k") || val.includes("K")) return Math.round(num * 1_000);
  return Math.round(num);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
