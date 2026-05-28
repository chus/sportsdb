/**
 * Match SportsDB players to Wikidata entities and enrich biographical data
 *
 * Strategy:
 * 1. Batch players with transfermarktId → Wikidata P2446 lookup (high confidence)
 * 2. For remaining: name + nationality fallback
 *
 * Enriches: dateOfBirth, heightCm, preferredFoot, placeOfBirth, imageUrl,
 *           nationality, secondNationality (P27 — country of citizenship, multi-valued).
 * Never overwrites existing non-null values.
 *
 * Usage:
 *   npx tsx scripts/wikidata/enrich-players.ts
 *   npx tsx scripts/wikidata/enrich-players.ts --dry-run
 *   npx tsx scripts/wikidata/enrich-players.ts --top 500
 *     (Phase 1 runs against the top-N players by popularity_score, regardless of
 *      whether wikidata_id is already set — useful for back-filling nationality.)
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { sparqlQuery, val, qid } from "./sparql";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const dryRun = process.argv.includes("--dry-run");
const fromNationalTeams = process.argv.includes("--from-national-teams");
const topArgIdx = process.argv.indexOf("--top");
const topN = topArgIdx >= 0 ? parseInt(process.argv[topArgIdx + 1] ?? "", 10) : null;
if (topArgIdx >= 0 && (!topN || topN <= 0)) {
  console.error("--top requires a positive integer (e.g. --top 500)");
  process.exit(1);
}

// Wikidata Q-IDs for preferred foot
const FOOT_MAP: Record<string, string> = {
  Q3029032: "Left",     // left-footedness
  Q18459622: "Right",   // right-footedness
  Q712263: "Both",      // ambidexterity
};

function parseDob(isoDate: string): string | null {
  const match = isoDate.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function parseHeight(heightStr: string): number | null {
  const val = parseFloat(heightStr);
  if (isNaN(val)) return null;
  // Wikidata stores height in meters (e.g. 1.81) or sometimes cm (e.g. 181)
  if (val > 0 && val < 3) return Math.round(val * 100); // meters → cm
  if (val >= 100 && val <= 250) return Math.round(val);  // already cm
  return null;
}

interface DbPlayer {
  id: string;
  name: string;
  transfermarkt_id: number | null;
  nationality: string | null;
  second_nationality: string | null;
  date_of_birth: string | null;
  height_cm: number | null;
  preferred_foot: string | null;
  place_of_birth: string | null;
  image_url: string | null;
  wikidata_id: string | null;
}

async function countNullNationality(): Promise<number> {
  const rows = await sql`SELECT COUNT(*)::int AS n FROM players WHERE nationality IS NULL` as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}

async function main() {
  console.log(`\n🔍 Wikidata Player Enrichment${dryRun ? " (DRY RUN)" : ""}${topN ? ` (top ${topN})` : ""}\n`);

  const nullNationalityBefore = await countNullNationality();
  console.log(`  nationality IS NULL before: ${nullNationalityBefore.toLocaleString()}`);

  // ─── Phase 1: Transfermarkt ID matching ────────────────────
  console.log("\nPhase 1: Matching via Transfermarkt ID (P2446)...");

  // When --top N is passed, Phase 1 targets the top-N popular players regardless
  // of whether wikidata_id is already set — this allows back-filling fields like
  // nationality on previously-matched rows. Default behavior (no flag) is
  // unchanged: only un-matched players with a Transfermarkt ID.
  const playersWithTmId: DbPlayer[] = topN
    ? await sql`
        SELECT id, name, transfermarkt_id, nationality, second_nationality,
               date_of_birth, height_cm, preferred_foot, place_of_birth,
               image_url, wikidata_id
        FROM players
        WHERE transfermarkt_id IS NOT NULL
        ORDER BY popularity_score DESC NULLS LAST
        LIMIT ${topN}
      `
    : await sql`
        SELECT id, name, transfermarkt_id, nationality, second_nationality,
               date_of_birth, height_cm, preferred_foot, place_of_birth,
               image_url, wikidata_id
        FROM players
        WHERE transfermarkt_id IS NOT NULL
          AND wikidata_id IS NULL
        ORDER BY transfermarkt_id
      `;

  console.log(`  ${playersWithTmId.length} players to query`);

  let matched = 0;
  let enriched = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < playersWithTmId.length; i += BATCH_SIZE) {
    const batch = playersWithTmId.slice(i, i + BATCH_SIZE);
    const tmIds = batch.map((p) => `"${p.transfermarkt_id}"`).join(" ");

    // P27 = country of citizenship. Returns one row per citizenship for
    // dual-nationals, so we get back multiple rows per ?item. The Map below
    // collapses those, preserving up to two distinct citizenship labels.
    const query = `
      SELECT ?item ?transfermarktId ?dateOfBirth ?height ?foot ?footLabel
             ?placeOfBirthLabel ?image ?citizenship ?citizenshipLabel WHERE {
        VALUES ?transfermarktId { ${tmIds} }
        ?item wdt:P2446 ?transfermarktId .
        OPTIONAL { ?item wdt:P569 ?dateOfBirth . }
        OPTIONAL { ?item wdt:P2048 ?height . }
        OPTIONAL { ?item wdt:P552 ?foot . }
        OPTIONAL { ?item wdt:P19 ?placeOfBirth . }
        OPTIONAL { ?item wdt:P18 ?image . }
        OPTIONAL { ?item wdt:P27 ?citizenship . }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
      }
    `;

    try {
      const results = await sparqlQuery(query);

      // Group by transfermarktId, collecting distinct citizenship labels in
      // SPARQL result order (Wikidata returns the primary/most-relevant first
      // in practice — e.g. for Messi, Argentina before Spain).
      interface MergedResult {
        first: typeof results[0];
        citizenships: string[];
      }
      const lookup = new Map<string, MergedResult>();
      for (const r of results) {
        const tmId = val(r, "transfermarktId");
        if (!tmId) continue;
        const cit = val(r, "citizenshipLabel");
        let entry = lookup.get(tmId);
        if (!entry) {
          entry = { first: r, citizenships: [] };
          lookup.set(tmId, entry);
        }
        if (cit && !entry.citizenships.includes(cit)) {
          entry.citizenships.push(cit);
        }
      }

      for (const player of batch) {
        const entry = lookup.get(String(player.transfermarkt_id));
        if (!entry) continue;
        const r = entry.first;

        const wikidataId = qid(val(r, "item")!);
        const dob = val(r, "dateOfBirth") ? parseDob(val(r, "dateOfBirth")!) : null;
        const height = val(r, "height") ? parseHeight(val(r, "height")!) : null;
        const footUri = val(r, "foot");
        const foot = footUri ? FOOT_MAP[qid(footUri)] || null : null;
        const place = val(r, "placeOfBirthLabel");
        const image = val(r, "image");
        const nat1 = entry.citizenships[0] ?? null;
        const nat2 = entry.citizenships[1] ?? null;

        matched++;

        // Check if there's anything new to update
        const updates: string[] = [];
        if (!player.date_of_birth && dob) updates.push("dob");
        if (!player.height_cm && height) updates.push("height");
        if (!player.preferred_foot && foot) updates.push("foot");
        if (!player.place_of_birth && place) updates.push("place");
        if (!player.image_url && image) updates.push("image");
        if (!player.nationality && nat1) updates.push("nat");
        if (!player.second_nationality && nat2) updates.push("nat2");

        if (!dryRun) {
          await sql`
            UPDATE players SET
              wikidata_id = ${wikidataId},
              date_of_birth = COALESCE(date_of_birth, ${dob}),
              height_cm = COALESCE(height_cm, ${height}),
              preferred_foot = COALESCE(preferred_foot, ${foot}),
              place_of_birth = COALESCE(place_of_birth, ${place}),
              image_url = COALESCE(image_url, ${image}),
              nationality = COALESCE(nationality, ${nat1}),
              second_nationality = COALESCE(second_nationality, ${nat2}),
              updated_at = NOW()
            WHERE id = ${player.id}
          `;
        }

        if (updates.length > 0) {
          enriched++;
        }
      }

      const pct = Math.min(100, Math.round(((i + batch.length) / playersWithTmId.length) * 100));
      process.stdout.write(`\r  Progress: ${i + batch.length}/${playersWithTmId.length} (${pct}%) | Matched: ${matched} | Enriched: ${enriched}`);
    } catch (err) {
      console.error(`\n  Error at batch ${i}: ${(err as Error).message}`);
    }
  }
  console.log("");

  // ─── Phase 2: Name + nationality fallback ──────────────────
  console.log("\nPhase 2: Matching remaining players via name + nationality...");

  // Phase 2 keys off nationality (it groups by nationality to issue one SPARQL
  // query per country). Players without nationality after Phase 1 are skipped
  // by the grouping loop below — they can be re-tried by running with --top.
  const unmatched: DbPlayer[] = await sql`
    SELECT id, name, transfermarkt_id, nationality, second_nationality,
           date_of_birth, height_cm, preferred_foot, place_of_birth,
           image_url, wikidata_id
    FROM players
    WHERE wikidata_id IS NULL
      AND position != 'Unknown'
    ORDER BY popularity_score DESC NULLS LAST
    LIMIT 2000
  `;

  console.log(`  ${unmatched.length} unmatched players to try`);

  // Group by nationality for efficient SPARQL queries
  const byNationality = new Map<string, DbPlayer[]>();
  for (const p of unmatched) {
    if (!p.nationality) continue;
    const existing = byNationality.get(p.nationality) || [];
    existing.push(p);
    byNationality.set(p.nationality, existing);
  }

  // Map common nationality strings to Wikidata country Q-IDs
  const COUNTRY_QID: Record<string, string> = {
    England: "Q21", "United Kingdom": "Q145", Scotland: "Q22", Wales: "Q25",
    "Northern Ireland": "Q26", Germany: "Q183", France: "Q142", Spain: "Q29",
    Italy: "Q38", Brazil: "Q155", Argentina: "Q414", Portugal: "Q45",
    Netherlands: "Q55", Belgium: "Q31", Croatia: "Q224", Uruguay: "Q77",
    Colombia: "Q739", Mexico: "Q96", USA: "Q30", "United States": "Q30",
    Japan: "Q17", "South Korea": "Q884", "Korea Republic": "Q884",
    Australia: "Q408", Nigeria: "Q1033", Senegal: "Q1041",
    Ghana: "Q117", "Ivory Coast": "Q1008", "Côte d'Ivoire": "Q1008",
    Cameroon: "Q1009", Egypt: "Q79", Morocco: "Q1028", Algeria: "Q262",
    Tunisia: "Q948", Turkey: "Q43", Poland: "Q36", Austria: "Q40",
    Switzerland: "Q39", Denmark: "Q35", Sweden: "Q34", Norway: "Q20",
    Finland: "Q33", "Czech Republic": "Q213", Czechia: "Q213",
    Serbia: "Q403", Ukraine: "Q212", Romania: "Q218", Hungary: "Q28",
    Greece: "Q41", Bulgaria: "Q219", Slovenia: "Q215", Slovakia: "Q214",
    "Bosnia and Herzegovina": "Q225", "North Macedonia": "Q221",
    Montenegro: "Q236", Albania: "Q222", Ireland: "Q27",
    "Republic of Ireland": "Q27", Chile: "Q298", Peru: "Q419",
    Ecuador: "Q736", Venezuela: "Q717", Paraguay: "Q733",
    Bolivia: "Q750", "Costa Rica": "Q800", Honduras: "Q783",
    Panama: "Q804", Jamaica: "Q766", Canada: "Q16",
    China: "Q148", "China PR": "Q148", India: "Q668",
    "Saudi Arabia": "Q851", Iran: "Q794", Iraq: "Q796",
    "DR Congo": "Q974", Mali: "Q912", "Burkina Faso": "Q965",
    Guinea: "Q1006", Gabon: "Q1000", "Congo": "Q971",
    Togo: "Q945", Benin: "Q962", Niger: "Q1032",
    "Central African Republic": "Q929", Chad: "Q657",
    "Equatorial Guinea": "Q983", Angola: "Q916",
    Mozambique: "Q1029", Zambia: "Q953", Zimbabwe: "Q954",
    "South Africa": "Q258", Kenya: "Q114", Tanzania: "Q924",
    Uganda: "Q1036", Ethiopia: "Q115", Sudan: "Q1049",
    Libya: "Q1016", Israel: "Q801", Scotland: "Q22",
    Wales: "Q25", Iceland: "Q189", Luxembourg: "Q32",
    Malta: "Q233", Cyprus: "Q229", Georgia: "Q230",
    Armenia: "Q399", Azerbaijan: "Q227", Kazakhstan: "Q232",
    Uzbekistan: "Q265", "New Zealand": "Q664",
  };

  function normalize(name: string): string {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z\s]/g, "")
      .trim()
      .replace(/\s+/g, " ");
  }

  let phase2Matched = 0;
  let phase2Enriched = 0;
  let nationIdx = 0;
  const totalNations = byNationality.size;

  for (const [nationality, players] of byNationality) {
    nationIdx++;
    const countryQid = COUNTRY_QID[nationality];
    if (!countryQid) continue;

    // Query all football players who hold this country's citizenship. We also
    // SELECT ?otherCitizenship to capture the second nationality of dual-
    // nationals (e.g. for an Italy-grouped player who also holds Argentine
    // citizenship, we'd record both).
    const query = `
      SELECT ?item ?itemLabel ?dateOfBirth ?height ?foot ?footLabel
             ?placeOfBirthLabel ?image
             ?otherCitizenship ?otherCitizenshipLabel WHERE {
        ?item wdt:P106 wd:Q937857 .
        ?item wdt:P27 wd:${countryQid} .
        OPTIONAL { ?item wdt:P569 ?dateOfBirth . }
        OPTIONAL { ?item wdt:P2048 ?height . }
        OPTIONAL { ?item wdt:P552 ?foot . }
        OPTIONAL { ?item wdt:P19 ?placeOfBirth . }
        OPTIONAL { ?item wdt:P18 ?image . }
        OPTIONAL {
          ?item wdt:P27 ?otherCitizenship .
          FILTER(?otherCitizenship != wd:${countryQid})
        }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
      }
    `;

    try {
      const results = await sparqlQuery(query);

      // Build name lookup from Wikidata results; SPARQL returns one row per
      // (?item × ?otherCitizenship) so we collapse on item URI.
      interface WdEntry {
        row: typeof results[0];
        secondCitizenship: string | null;
      }
      const wdLookup = new Map<string, WdEntry>();
      const wdItemLookup = new Map<string, WdEntry>();
      for (const r of results) {
        const label = val(r, "itemLabel");
        const itemUri = val(r, "item");
        if (!itemUri) continue;
        const other = val(r, "otherCitizenshipLabel");
        let entry = wdItemLookup.get(itemUri);
        if (!entry) {
          entry = { row: r, secondCitizenship: other ?? null };
          wdItemLookup.set(itemUri, entry);
          if (label) {
            const norm = normalize(label);
            if (!wdLookup.has(norm)) wdLookup.set(norm, entry);
          }
        } else if (!entry.secondCitizenship && other) {
          entry.secondCitizenship = other;
        }
      }

      for (const player of players) {
        const normName = normalize(player.name);

        // Try exact normalized name match
        let entry = wdLookup.get(normName);

        // Try last-name-only match if player name has multiple parts
        if (!entry) {
          const parts = normName.split(" ");
          if (parts.length >= 2) {
            const lastName = parts[parts.length - 1];
            const firstName = parts[0];
            for (const [wdName, wdEntry] of wdLookup) {
              if (wdName.includes(firstName) && wdName.includes(lastName)) {
                entry = wdEntry;
                break;
              }
            }
          }
        }

        if (!entry) continue;
        const r = entry.row;

        // If both have DOB, verify they match (avoid false positives)
        if (player.date_of_birth) {
          const wdDob = val(r, "dateOfBirth") ? parseDob(val(r, "dateOfBirth")!) : null;
          if (wdDob && wdDob !== player.date_of_birth) continue; // DOB mismatch, skip
        }

        const wikidataId = qid(val(r, "item")!);
        const dob = val(r, "dateOfBirth") ? parseDob(val(r, "dateOfBirth")!) : null;
        const height = val(r, "height") ? parseHeight(val(r, "height")!) : null;
        const footUri = val(r, "foot");
        const foot = footUri ? FOOT_MAP[qid(footUri)] || null : null;
        const place = val(r, "placeOfBirthLabel");
        const image = val(r, "image");
        // The group key IS the nationality for this branch.
        const nat1 = nationality;
        const nat2 = entry.secondCitizenship;

        phase2Matched++;

        const updates: string[] = [];
        if (!player.date_of_birth && dob) updates.push("dob");
        if (!player.height_cm && height) updates.push("height");
        if (!player.preferred_foot && foot) updates.push("foot");
        if (!player.place_of_birth && place) updates.push("place");
        if (!player.image_url && image) updates.push("image");
        if (!player.nationality && nat1) updates.push("nat");
        if (!player.second_nationality && nat2) updates.push("nat2");

        if (!dryRun) {
          await sql`
            UPDATE players SET
              wikidata_id = ${wikidataId},
              date_of_birth = COALESCE(date_of_birth, ${dob}),
              height_cm = COALESCE(height_cm, ${height}),
              preferred_foot = COALESCE(preferred_foot, ${foot}),
              place_of_birth = COALESCE(place_of_birth, ${place}),
              image_url = COALESCE(image_url, ${image}),
              nationality = COALESCE(nationality, ${nat1}),
              second_nationality = COALESCE(second_nationality, ${nat2}),
              updated_at = NOW()
            WHERE id = ${player.id}
          `;
        }

        if (updates.length > 0) phase2Enriched++;
      }

      process.stdout.write(`\r  Nationality ${nationIdx}/${totalNations}: ${nationality} (${results.length} WD results) | Matched: ${phase2Matched} | Enriched: ${phase2Enriched}`);
    } catch (err) {
      console.error(`\n  Error for ${nationality}: ${(err as Error).message}`);
    }
  }
  console.log("");

  // ─── Summary ───────────────────────────────────────────────
  const nullNationalityAfter = dryRun ? nullNationalityBefore : await countNullNationality();
  const filledNationality = nullNationalityBefore - nullNationalityAfter;
  console.log("\n═══════════════════════════════════════");
  console.log(`  Phase 1 (TM ID):    matched=${matched}, enriched=${enriched}`);
  console.log(`  Phase 2 (name):     matched=${phase2Matched}, enriched=${phase2Enriched}`);
  console.log(`  Total matched:      ${matched + phase2Matched}`);
  console.log(`  Total enriched:     ${enriched + phase2Enriched}`);
  console.log(`  nationality NULL:   ${nullNationalityBefore.toLocaleString()} → ${nullNationalityAfter.toLocaleString()} (filled ${filledNationality.toLocaleString()})`);
  console.log("═══════════════════════════════════════\n");
}

/**
 * --from-national-teams mode.
 *
 * The default Phases 1+2 both require pre-existing data on the player rows
 * (transfermarkt_id for Phase 1, nationality for Phase 2). When neither is
 * populated yet, we flip the lookup direction: enumerate the countries that
 * have a national team in the DB and, for each, fetch the Wikidata roster of
 * football players holding that P27 citizenship, then name-match those against
 * the DB regardless of any existing nationality value.
 *
 * This is the seed pass that gives later runs of the default mode something
 * to work with.
 */
async function enrichFromNationalTeams() {
  console.log(`\n🌎 Wikidata Enrichment from National Teams${dryRun ? " (DRY RUN)" : ""}\n`);

  const nullBefore = await countNullNationality();
  console.log(`  nationality IS NULL before: ${nullBefore.toLocaleString()}`);

  // Same country mapping as Phase 2, redeclared locally to avoid threading
  // a shared module-scope const through the existing main() implementation.
  const COUNTRY_QID: Record<string, string> = {
    England: "Q21", "United Kingdom": "Q145", Scotland: "Q22", Wales: "Q25",
    "Northern Ireland": "Q26", Germany: "Q183", France: "Q142", Spain: "Q29",
    Italy: "Q38", Brazil: "Q155", Argentina: "Q414", Portugal: "Q45",
    Netherlands: "Q55", Belgium: "Q31", Croatia: "Q224", Uruguay: "Q77",
    Colombia: "Q739", Mexico: "Q96", USA: "Q30", "United States": "Q30",
    Japan: "Q17", "South Korea": "Q884", "Korea Republic": "Q884",
    Australia: "Q408", Nigeria: "Q1033", Senegal: "Q1041",
    Ghana: "Q117", "Ivory Coast": "Q1008", "Côte d'Ivoire": "Q1008",
    Cameroon: "Q1009", Egypt: "Q79", Morocco: "Q1028", Algeria: "Q262",
    Tunisia: "Q948", Turkey: "Q43", Poland: "Q36", Austria: "Q40",
    Switzerland: "Q39", Denmark: "Q35", Sweden: "Q34", Norway: "Q20",
    Finland: "Q33", "Czech Republic": "Q213", Czechia: "Q213",
    Serbia: "Q403", Ukraine: "Q212", Romania: "Q218", Hungary: "Q28",
    Greece: "Q41", Bulgaria: "Q219", Slovenia: "Q215", Slovakia: "Q214",
    "Bosnia and Herzegovina": "Q225", "North Macedonia": "Q221",
    Montenegro: "Q236", Albania: "Q222", Ireland: "Q27",
    "Republic of Ireland": "Q27", Chile: "Q298", Peru: "Q419",
    Ecuador: "Q736", Venezuela: "Q717", Paraguay: "Q733",
    Bolivia: "Q750", "Costa Rica": "Q800", Honduras: "Q783",
    Panama: "Q804", Jamaica: "Q766", Canada: "Q16",
    China: "Q148", "China PR": "Q148", India: "Q668",
    "Saudi Arabia": "Q851", Iran: "Q794", Iraq: "Q796",
    "DR Congo": "Q974", Mali: "Q912", "Burkina Faso": "Q965",
    Guinea: "Q1006", Gabon: "Q1000", Congo: "Q971",
    Togo: "Q945", Benin: "Q962", Niger: "Q1032",
    "Central African Republic": "Q929", Chad: "Q657",
    "Equatorial Guinea": "Q983", Angola: "Q916",
    Mozambique: "Q1029", Zambia: "Q953", Zimbabwe: "Q954",
    "South Africa": "Q258", Kenya: "Q114", Tanzania: "Q924",
    Uganda: "Q1036", Ethiopia: "Q115", Sudan: "Q1049",
    Libya: "Q1016", Israel: "Q801", Iceland: "Q189",
    Luxembourg: "Q32", Malta: "Q233", Cyprus: "Q229",
    Georgia: "Q230", Armenia: "Q399", Azerbaijan: "Q227",
    Kazakhstan: "Q232", Uzbekistan: "Q265", "New Zealand": "Q664",
  };

  function normalize(name: string): string {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z\s]/g, "")
      .trim()
      .replace(/\s+/g, " ");
  }

  // Build a global name index of every player in the DB, keyed by the
  // normalized full name. Collisions are stored as arrays so we can later
  // filter by DOB if needed. We exclude position='Unknown' rows: they're
  // typically scrape artifacts and contribute to false-positive name matches.
  const allDbPlayers = await sql`
    SELECT id, name, known_as, nationality, second_nationality, date_of_birth,
           height_cm, preferred_foot, place_of_birth, image_url, wikidata_id
    FROM players
    WHERE position != 'Unknown'
  ` as Array<{
    id: string;
    name: string;
    known_as: string | null;
    nationality: string | null;
    second_nationality: string | null;
    date_of_birth: string | null;
    height_cm: number | null;
    preferred_foot: string | null;
    place_of_birth: string | null;
    image_url: string | null;
    wikidata_id: string | null;
  }>;

  console.log(`  ${allDbPlayers.length.toLocaleString()} candidate DB players (excluding position=Unknown)`);

  type DbRow = typeof allDbPlayers[number];
  const byNormName = new Map<string, DbRow[]>();
  for (const p of allDbPlayers) {
    const key = normalize(p.name);
    if (!key) continue;
    const existing = byNormName.get(key) ?? [];
    existing.push(p);
    byNormName.set(key, existing);
  }

  // Country source: every distinct country that has at least one
  // teams.team_type='national' row. Falls back to no enrichment for countries
  // we don't have a Wikidata Q-ID for.
  const teamCountries = await sql`
    SELECT DISTINCT country FROM teams
    WHERE team_type = 'national' AND country IS NOT NULL
    ORDER BY country
  ` as Array<{ country: string }>;

  console.log(`  ${teamCountries.length} national-team countries in DB`);
  const knownCountries = teamCountries.filter((c) => COUNTRY_QID[c.country]);
  const unknownCountries = teamCountries.filter((c) => !COUNTRY_QID[c.country]);
  if (unknownCountries.length > 0) {
    console.log(`  ⚠️  Skipping ${unknownCountries.length} countries with no Wikidata Q-ID mapping:`);
    console.log(`     ${unknownCountries.map((c) => c.country).join(", ")}`);
  }

  let totalMatched = 0;
  let totalWritten = 0;
  let totalDobConflicts = 0;
  let countryIdx = 0;

  // Countries known to return >5MB JSON from the SPARQL endpoint, exceeding
  // its truncation threshold. These get chunked by birth-year bucket so each
  // sub-query stays under the limit. We also fall back to chunking on any
  // country that fails the unchunked attempt with a JSON parse error.
  const LARGE_COUNTRIES = new Set([
    "Argentina", "Brazil", "France", "Germany", "Italy", "Japan", "Mexico",
    "Iran", "Spain", "Portugal", "United States",
  ]);

  // Birth-year buckets chosen so each holds ~1-2k active+retired pros.
  // The final entry is null-DOB players (Wikidata has them but no birth date).
  const BIRTH_BUCKETS: Array<[number | null, number | null]> = [
    [null, 1960], [1960, 1980], [1980, 1990], [1990, 1995],
    [1995, 2000], [2000, 2005], [2005, 2010], [2010, null],
  ];

  function buildSparql(countryQid: string, lo: number | null, hi: number | null, dobOnly: boolean): string {
    let dobClause = "OPTIONAL { ?item wdt:P569 ?dateOfBirth . }";
    if (dobOnly) {
      const parts: string[] = ["?item wdt:P569 ?dateOfBirth ."];
      if (lo !== null) parts.push(`FILTER(YEAR(?dateOfBirth) >= ${lo})`);
      if (hi !== null) parts.push(`FILTER(YEAR(?dateOfBirth) < ${hi})`);
      dobClause = parts.join("\n        ");
    }
    return `
      SELECT ?item ?itemLabel ?dateOfBirth ?height ?foot ?placeOfBirthLabel
             ?image ?otherCitizenship ?otherCitizenshipLabel WHERE {
        ?item wdt:P106 wd:Q937857 .
        ?item wdt:P27 wd:${countryQid} .
        ${dobClause}
        OPTIONAL { ?item wdt:P2048 ?height . }
        OPTIONAL { ?item wdt:P552 ?foot . }
        OPTIONAL { ?item wdt:P19 ?placeOfBirth . }
        OPTIONAL { ?item wdt:P18 ?image . }
        OPTIONAL {
          ?item wdt:P27 ?otherCitizenship .
          FILTER(?otherCitizenship != wd:${countryQid})
        }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
      }
    `;
  }

  function isTruncationError(err: unknown): boolean {
    const msg = (err as Error)?.message ?? "";
    return /JSON|Unexpected end|property name/i.test(msg);
  }

  async function fetchCountry(country: string, countryQid: string): Promise<Record<string, unknown>[] | null> {
    // Try unchunked first unless we know this country is too big.
    if (!LARGE_COUNTRIES.has(country)) {
      try {
        return await sparqlQuery(buildSparql(countryQid, null, null, false));
      } catch (err) {
        if (!isTruncationError(err)) {
          console.error(`\n  Error for ${country}: ${(err as Error).message}`);
          return null;
        }
        // Fall through to chunked retry.
        process.stdout.write(`\n  ${country}: unchunked failed (truncation), retrying chunked...`);
      }
    }

    // Chunked path: one query per birth-year bucket + one for no-DOB rows.
    const allRows: Record<string, unknown>[] = [];
    let chunkOk = 0;
    let chunkErr = 0;
    for (const [lo, hi] of BIRTH_BUCKETS) {
      try {
        const rows = await sparqlQuery(buildSparql(countryQid, lo, hi, true));
        allRows.push(...rows);
        chunkOk++;
      } catch (err) {
        chunkErr++;
        process.stdout.write(`\n  ${country} bucket [${lo ?? "−∞"},${hi ?? "+∞"}): ${(err as Error).message}`);
      }
    }
    // Catch players whose Wikidata entry has no birth date.
    try {
      const noDob = await sparqlQuery(`
        SELECT ?item ?itemLabel ?height ?foot ?placeOfBirthLabel ?image
               ?otherCitizenship ?otherCitizenshipLabel WHERE {
          ?item wdt:P106 wd:Q937857 .
          ?item wdt:P27 wd:${countryQid} .
          FILTER NOT EXISTS { ?item wdt:P569 ?dob . }
          OPTIONAL { ?item wdt:P2048 ?height . }
          OPTIONAL { ?item wdt:P552 ?foot . }
          OPTIONAL { ?item wdt:P19 ?placeOfBirth . }
          OPTIONAL { ?item wdt:P18 ?image . }
          OPTIONAL {
            ?item wdt:P27 ?otherCitizenship .
            FILTER(?otherCitizenship != wd:${countryQid})
          }
          SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
        }
      `);
      allRows.push(...noDob);
      chunkOk++;
    } catch (err) {
      chunkErr++;
      process.stdout.write(`\n  ${country} no-DOB bucket: ${(err as Error).message}`);
    }
    if (allRows.length === 0 && chunkErr > 0) return null;
    process.stdout.write(`\n  ${country}: chunked OK (${chunkOk}/${chunkOk + chunkErr} buckets, ${allRows.length} rows total)`);
    return allRows;
  }

  for (const { country } of knownCountries) {
    countryIdx++;
    const countryQid = COUNTRY_QID[country];

    const results = await fetchCountry(country, countryQid);
    if (results === null) continue;

    // Group the per-(item × otherCitizenship) rows back into one entry per item.
    interface WdEntry {
      itemUri: string;
      label: string;
      dob: string | null;
      height: number | null;
      foot: string | null;
      place: string | null;
      image: string | null;
      secondNationality: string | null;
    }
    const wdByItem = new Map<string, WdEntry>();
    for (const r of results) {
      const itemUri = val(r, "item");
      const label = val(r, "itemLabel");
      if (!itemUri || !label) continue;
      const other = val(r, "otherCitizenshipLabel");
      let entry = wdByItem.get(itemUri);
      if (!entry) {
        const footUri = val(r, "foot");
        entry = {
          itemUri,
          label,
          dob: val(r, "dateOfBirth") ? parseDob(val(r, "dateOfBirth")!) : null,
          height: val(r, "height") ? parseHeight(val(r, "height")!) : null,
          foot: footUri ? FOOT_MAP[qid(footUri)] || null : null,
          place: val(r, "placeOfBirthLabel"),
          image: val(r, "image"),
          secondNationality: other ?? null,
        };
        wdByItem.set(itemUri, entry);
      } else if (!entry.secondNationality && other) {
        entry.secondNationality = other;
      }
    }

    let countryMatched = 0;
    let countryWritten = 0;

    for (const entry of wdByItem.values()) {
      const normLabel = normalize(entry.label);
      const candidates = byNormName.get(normLabel);
      if (!candidates || candidates.length === 0) continue;

      // If multiple DB players share the same name (e.g. two Diego Lopez),
      // pick a single match: prefer one with a DOB that matches the WD DOB,
      // otherwise skip rather than gamble.
      let target: DbRow | null = null;
      if (candidates.length === 1) {
        target = candidates[0];
        // If both have DOB and they conflict, skip.
        if (target.date_of_birth && entry.dob && target.date_of_birth !== entry.dob) {
          totalDobConflicts++;
          continue;
        }
      } else {
        const dobMatches = candidates.filter(
          (c) => c.date_of_birth && entry.dob && c.date_of_birth === entry.dob
        );
        if (dobMatches.length === 1) {
          target = dobMatches[0];
        } else {
          // Ambiguous; skip to avoid contaminating nationality data.
          continue;
        }
      }

      countryMatched++;
      const wikidataIdNew = qid(entry.itemUri);

      if (!dryRun) {
        await sql`
          UPDATE players SET
            wikidata_id = COALESCE(wikidata_id, ${wikidataIdNew}),
            date_of_birth = COALESCE(date_of_birth, ${entry.dob}),
            height_cm = COALESCE(height_cm, ${entry.height}),
            preferred_foot = COALESCE(preferred_foot, ${entry.foot}),
            place_of_birth = COALESCE(place_of_birth, ${entry.place}),
            image_url = COALESCE(image_url, ${entry.image}),
            nationality = COALESCE(nationality, ${country}),
            second_nationality = COALESCE(second_nationality, ${entry.secondNationality}),
            updated_at = NOW()
          WHERE id = ${target.id}
        `;
      }

      // Update the in-memory index so we don't re-match the same DB row to
      // a different country later (e.g. dual-nationals): keep them eligible
      // only via second_nationality, which our subsequent COALESCEs preserve.
      target.nationality = target.nationality ?? country;
      target.wikidata_id = target.wikidata_id ?? wikidataIdNew;
      countryWritten++;
    }

    totalMatched += countryMatched;
    totalWritten += countryWritten;
    process.stdout.write(
      `\r  [${countryIdx}/${knownCountries.length}] ${country.padEnd(22)} WD=${wdByItem.size.toString().padStart(5)} matched=${countryMatched.toString().padStart(4)} written=${countryWritten.toString().padStart(4)} | totals m=${totalMatched} w=${totalWritten}`
    );
  }
  console.log("");

  const nullAfter = dryRun ? nullBefore : await countNullNationality();
  console.log("\n═══════════════════════════════════════");
  console.log(`  Countries processed: ${knownCountries.length}`);
  console.log(`  DB players matched:  ${totalMatched.toLocaleString()}`);
  console.log(`  Rows written:        ${totalWritten.toLocaleString()}`);
  console.log(`  DOB conflicts skip:  ${totalDobConflicts}`);
  console.log(`  nationality NULL:    ${nullBefore.toLocaleString()} → ${nullAfter.toLocaleString()} (filled ${(nullBefore - nullAfter).toLocaleString()})`);
  console.log("═══════════════════════════════════════\n");
}

(fromNationalTeams ? enrichFromNationalTeams() : main()).catch(console.error);
