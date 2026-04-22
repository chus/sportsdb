/**
 * Quick script to ingest matches only (teams/competitions must already exist)
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { buildMatchSlug } from "../src/lib/utils/match-slug";

config({ path: ".env.local" });

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const BASE_URL = "https://api.football-data.org/v4";

if (!API_KEY) {
  console.error("❌ Missing FOOTBALL_DATA_API_KEY");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

const RATE_LIMIT_MS = 6500;
let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<any> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    const waitTime = RATE_LIMIT_MS - timeSinceLastRequest;
    console.log(`   ⏳ Rate limiting: waiting ${Math.round(waitTime / 1000)}s...`);
    await new Promise((r) => setTimeout(r, waitTime));
  }
  lastRequestTime = Date.now();
  const res = await fetch(url, { headers: { "X-Auth-Token": API_KEY! } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

const COMP_CODES = ["PL", "PD", "BL1", "SA", "FL1", "CL", "ELC", "DED", "PPL", "EC", "WC"];

async function main() {
  console.log("⚽ Ingesting matches only...\n");

  // Build team map from existing DB data — we need football-data.org IDs
  // Since we don't store the API ID, we'll match by team name
  const allTeams = await db.select().from(schema.teams);
  const teamsByName = new Map<string, typeof schema.teams.$inferSelect>();
  for (const team of allTeams) {
    teamsByName.set(team.name.toLowerCase(), team);
  }

  // Get competition seasons
  const compSeasons = await db
    .select({
      id: schema.competitionSeasons.id,
      competitionId: schema.competitionSeasons.competitionId,
      competitionName: schema.competitions.name,
      competitionSlug: schema.competitions.slug,
    })
    .from(schema.competitionSeasons)
    .innerJoin(schema.competitions, eq(schema.competitionSeasons.competitionId, schema.competitions.id));

  let totalMatches = 0;

  for (const compCode of COMP_CODES) {
    try {
      const matchesData = await rateLimitedFetch(
        `${BASE_URL}/competitions/${compCode}/matches?status=FINISHED&limit=500`
      );

      const compName = matchesData.competition?.name || compCode;
      console.log(`📋 ${compName}: ${matchesData.resultSet?.count || 0} matches available`);

      // Find matching competition season
      const compSeason = compSeasons.find(
        (cs) => cs.competitionName === compName || cs.competitionSlug === compName.toLowerCase().replace(/\s+/g, "-")
      );

      if (!compSeason) {
        console.log(`   ⚠️  No competition_season found for ${compName}, skipping`);
        continue;
      }

      let matchCount = 0;
      let skippedTeams = 0;

      for (const apiMatch of matchesData.matches || []) {
        const homeName = apiMatch.homeTeam?.name?.toLowerCase();
        const awayName = apiMatch.awayTeam?.name?.toLowerCase();
        const homeTeam = teamsByName.get(homeName);
        const awayTeam = teamsByName.get(awayName);

        if (!homeTeam || !awayTeam) {
          skippedTeams++;
          continue;
        }

        const matchSlug = buildMatchSlug(
          homeTeam.slug,
          awayTeam.slug,
          new Date(apiMatch.utcDate)
        );

        try {
          await db.insert(schema.matches).values({
            slug: matchSlug,
            competitionSeasonId: compSeason.id,
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            matchday: apiMatch.matchday,
            scheduledAt: new Date(apiMatch.utcDate),
            status: "finished",
            homeScore: apiMatch.score?.fullTime?.home,
            awayScore: apiMatch.score?.fullTime?.away,
            referee: apiMatch.referees?.[0]?.name || null,
          }).onConflictDoNothing();
          matchCount++;
        } catch (err: any) {
          console.log(`   ❌ Match insert error: ${err.message}`);
        }
      }

      console.log(`   ✅ ${matchCount} matches inserted (${skippedTeams} skipped - team not found)`);
      totalMatches += matchCount;
    } catch (error: any) {
      console.log(`   ⚠️  Error fetching ${compCode}: ${error.message}`);
    }
  }

  // Also fetch scheduled (upcoming) matches for previews
  console.log("\n📅 Fetching upcoming matches...\n");
  for (const compCode of COMP_CODES) {
    try {
      const matchesData = await rateLimitedFetch(
        `${BASE_URL}/competitions/${compCode}/matches?status=SCHEDULED&limit=100`
      );

      const compName = matchesData.competition?.name || compCode;
      const compSeason = compSeasons.find(
        (cs) => cs.competitionName === compName || cs.competitionSlug === compName.toLowerCase().replace(/\s+/g, "-")
      );

      if (!compSeason) continue;

      let matchCount = 0;
      for (const apiMatch of matchesData.matches || []) {
        const homeName = apiMatch.homeTeam?.name?.toLowerCase();
        const awayName = apiMatch.awayTeam?.name?.toLowerCase();
        const homeTeam = teamsByName.get(homeName);
        const awayTeam = teamsByName.get(awayName);
        if (!homeTeam || !awayTeam) continue;

        const matchSlug = buildMatchSlug(
          homeTeam.slug,
          awayTeam.slug,
          new Date(apiMatch.utcDate)
        );

        try {
          await db.insert(schema.matches).values({
            slug: matchSlug,
            competitionSeasonId: compSeason.id,
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            matchday: apiMatch.matchday,
            scheduledAt: new Date(apiMatch.utcDate),
            status: "scheduled",
            homeScore: null,
            awayScore: null,
            referee: apiMatch.referees?.[0]?.name || null,
          }).onConflictDoNothing();
          matchCount++;
        } catch {}
      }
      console.log(`   📋 ${compName}: ${matchCount} upcoming matches`);
      totalMatches += matchCount;
    } catch {
      // Skip
    }
  }

  console.log(`\n🎉 Done! ${totalMatches} total matches inserted`);
}

main().catch(console.error);
