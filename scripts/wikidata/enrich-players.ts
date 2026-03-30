/**
 * Match SportsDB players to Wikidata entities and enrich biographical data
 *
 * Strategy:
 * 1. Batch players with transfermarktId → Wikidata P2446 lookup (high confidence)
 * 2. For remaining: name + nationality fallback
 *
 * Enriches: dateOfBirth, heightCm, preferredFoot, placeOfBirth, imageUrl (fallback)
 * Never overwrites existing non-null values.
 *
 * Usage:
 *   npx tsx scripts/wikidata/enrich-players.ts
 *   npx tsx scripts/wikidata/enrich-players.ts --dry-run
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
  date_of_birth: string | null;
  height_cm: number | null;
  preferred_foot: string | null;
  place_of_birth: string | null;
  image_url: string | null;
  wikidata_id: string | null;
}

async function main() {
  console.log(`\n🔍 Wikidata Player Enrichment${dryRun ? " (DRY RUN)" : ""}\n`);

  // ─── Phase 1: Transfermarkt ID matching ────────────────────
  console.log("Phase 1: Matching via Transfermarkt ID (P2446)...");

  const playersWithTmId: DbPlayer[] = await sql`
    SELECT id, name, transfermarkt_id, nationality, date_of_birth, height_cm,
           preferred_foot, place_of_birth, image_url, wikidata_id
    FROM players
    WHERE transfermarkt_id IS NOT NULL
      AND wikidata_id IS NULL
    ORDER BY transfermarkt_id
  `;

  console.log(`  ${playersWithTmId.length} players with Transfermarkt ID but no Wikidata ID`);

  let matched = 0;
  let enriched = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < playersWithTmId.length; i += BATCH_SIZE) {
    const batch = playersWithTmId.slice(i, i + BATCH_SIZE);
    const tmIds = batch.map((p) => `"${p.transfermarkt_id}"`).join(" ");

    const query = `
      SELECT ?item ?transfermarktId ?dateOfBirth ?height ?foot ?footLabel ?placeOfBirthLabel ?image WHERE {
        VALUES ?transfermarktId { ${tmIds} }
        ?item wdt:P2446 ?transfermarktId .
        OPTIONAL { ?item wdt:P569 ?dateOfBirth . }
        OPTIONAL { ?item wdt:P2048 ?height . }
        OPTIONAL { ?item wdt:P552 ?foot . }
        OPTIONAL { ?item wdt:P19 ?placeOfBirth . }
        OPTIONAL { ?item wdt:P18 ?image . }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
      }
    `;

    try {
      const results = await sparqlQuery(query);

      // Build lookup: transfermarktId → result
      const lookup = new Map<string, typeof results[0]>();
      for (const r of results) {
        const tmId = val(r, "transfermarktId");
        if (tmId && !lookup.has(tmId)) lookup.set(tmId, r);
      }

      for (const player of batch) {
        const r = lookup.get(String(player.transfermarkt_id));
        if (!r) continue;

        const wikidataId = qid(val(r, "item")!);
        const dob = val(r, "dateOfBirth") ? parseDob(val(r, "dateOfBirth")!) : null;
        const height = val(r, "height") ? parseHeight(val(r, "height")!) : null;
        const footUri = val(r, "foot");
        const foot = footUri ? FOOT_MAP[qid(footUri)] || null : null;
        const place = val(r, "placeOfBirthLabel");
        const image = val(r, "image");

        matched++;

        // Check if there's anything new to update
        const updates: string[] = [];
        if (!player.date_of_birth && dob) updates.push("dob");
        if (!player.height_cm && height) updates.push("height");
        if (!player.preferred_foot && foot) updates.push("foot");
        if (!player.place_of_birth && place) updates.push("place");
        if (!player.image_url && image) updates.push("image");

        if (!dryRun) {
          await sql`
            UPDATE players SET
              wikidata_id = ${wikidataId},
              date_of_birth = COALESCE(date_of_birth, ${dob}),
              height_cm = COALESCE(height_cm, ${height}),
              preferred_foot = COALESCE(preferred_foot, ${foot}),
              place_of_birth = COALESCE(place_of_birth, ${place}),
              image_url = COALESCE(image_url, ${image}),
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

  const unmatched: DbPlayer[] = await sql`
    SELECT id, name, transfermarkt_id, nationality, date_of_birth, height_cm,
           preferred_foot, place_of_birth, image_url, wikidata_id
    FROM players
    WHERE wikidata_id IS NULL
      AND nationality IS NOT NULL
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

    // Query all football players from this country
    const query = `
      SELECT ?item ?itemLabel ?dateOfBirth ?height ?foot ?footLabel ?placeOfBirthLabel ?image WHERE {
        ?item wdt:P106 wd:Q937857 .
        ?item wdt:P27 wd:${countryQid} .
        OPTIONAL { ?item wdt:P569 ?dateOfBirth . }
        OPTIONAL { ?item wdt:P2048 ?height . }
        OPTIONAL { ?item wdt:P552 ?foot . }
        OPTIONAL { ?item wdt:P19 ?placeOfBirth . }
        OPTIONAL { ?item wdt:P18 ?image . }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
      }
    `;

    try {
      const results = await sparqlQuery(query);

      // Build name lookup from Wikidata results
      const wdLookup = new Map<string, typeof results[0]>();
      for (const r of results) {
        const label = val(r, "itemLabel");
        if (label) {
          const norm = normalize(label);
          if (!wdLookup.has(norm)) wdLookup.set(norm, r);
        }
      }

      for (const player of players) {
        const normName = normalize(player.name);

        // Try exact normalized name match
        let r = wdLookup.get(normName);

        // Try last-name-only match if player name has multiple parts
        if (!r) {
          const parts = normName.split(" ");
          if (parts.length >= 2) {
            const lastName = parts[parts.length - 1];
            const firstName = parts[0];
            // Search for entries matching "first last" pattern
            for (const [wdName, wdResult] of wdLookup) {
              if (wdName.includes(firstName) && wdName.includes(lastName)) {
                r = wdResult;
                break;
              }
            }
          }
        }

        if (!r) continue;

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

        phase2Matched++;

        const updates: string[] = [];
        if (!player.date_of_birth && dob) updates.push("dob");
        if (!player.height_cm && height) updates.push("height");
        if (!player.preferred_foot && foot) updates.push("foot");
        if (!player.place_of_birth && place) updates.push("place");
        if (!player.image_url && image) updates.push("image");

        if (!dryRun) {
          await sql`
            UPDATE players SET
              wikidata_id = ${wikidataId},
              date_of_birth = COALESCE(date_of_birth, ${dob}),
              height_cm = COALESCE(height_cm, ${height}),
              preferred_foot = COALESCE(preferred_foot, ${foot}),
              place_of_birth = COALESCE(place_of_birth, ${place}),
              image_url = COALESCE(image_url, ${image}),
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
  console.log("\n═══════════════════════════════════════");
  console.log(`  Phase 1 (TM ID):    matched=${matched}, enriched=${enriched}`);
  console.log(`  Phase 2 (name):     matched=${phase2Matched}, enriched=${phase2Enriched}`);
  console.log(`  Total matched:      ${matched + phase2Matched}`);
  console.log(`  Total enriched:     ${enriched + phase2Enriched}`);
  console.log("═══════════════════════════════════════\n");
}

main().catch(console.error);
