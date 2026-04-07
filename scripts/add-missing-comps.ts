/**
 * Add missing competitions (La Liga, Champions League) to existing DB
 * without wiping data. Fetches teams + standings + matches.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";
import { eq, and } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { buildMatchSlug } from "../src/lib/utils/match-slug";

config({ path: ".env.local" });

const API_KEY = process.env.FOOTBALL_DATA_API_KEY!;
const BASE_URL = "https://api.football-data.org/v4";
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

const STATUS_MAP: Record<string, string> = {
  SCHEDULED: "scheduled",
  TIMED: "scheduled",
  IN_PLAY: "live",
  PAUSED: "half_time",
  FINISHED: "finished",
  SUSPENDED: "suspended",
  POSTPONED: "postponed",
  CANCELLED: "cancelled",
  AWARDED: "finished",
};

const RATE_LIMIT_MS = 6500;
let lastRequestTime = 0;

async function fetchApi(url: string): Promise<any> {
  const now = Date.now();
  const wait = RATE_LIMIT_MS - (now - lastRequestTime);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestTime = Date.now();
  const res = await fetch(url, { headers: { "X-Auth-Token": API_KEY } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function extractCity(address: string | undefined | null): string | null {
  if (!address) return null;
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  for (let i = parts.length - 2; i >= 0; i--) {
    const part = parts[i];
    if (part && !/^\d+$/.test(part) && !/^\d{4,}/.test(part) && part.length > 2) {
      const cleaned = part.replace(/^\d+\s+/, "");
      if (cleaned.length > 2) return cleaned;
    }
  }
  return null;
}

const TARGETS = [
  { code: "PD", slug: "primera-division", country: "Spain" },
  { code: "CL", slug: "uefa-champions-league", country: "Europe" },
];

async function main() {
  // Find current season
  const [currentSeason] = await db
    .select()
    .from(schema.seasons)
    .where(eq(schema.seasons.isCurrent, true))
    .limit(1);

  if (!currentSeason) {
    console.error("No current season found");
    process.exit(1);
  }

  console.log(`Current season: ${currentSeason.label}`);

  for (const target of TARGETS) {
    console.log(`\n== ${target.code} (${target.slug}) ==`);

    // Find existing competition
    const [comp] = await db
      .select()
      .from(schema.competitions)
      .where(eq(schema.competitions.slug, target.slug))
      .limit(1);

    if (!comp) {
      console.log(`  competition row not found`);
      continue;
    }

    // Ensure competitionSeason exists
    let [compSeason] = await db
      .select()
      .from(schema.competitionSeasons)
      .where(
        and(
          eq(schema.competitionSeasons.competitionId, comp.id),
          eq(schema.competitionSeasons.seasonId, currentSeason.id)
        )
      )
      .limit(1);

    if (!compSeason) {
      [compSeason] = await db
        .insert(schema.competitionSeasons)
        .values({
          competitionId: comp.id,
          seasonId: currentSeason.id,
          status: "in_progress",
        })
        .returning();
      console.log(`  created competition_seasons row`);
    } else {
      console.log(`  competition_seasons row exists`);
    }

    // Fetch teams for this competition
    const teamsData = await fetchApi(`${BASE_URL}/competitions/${target.code}/teams`);
    const apiTeams = teamsData.teams || [];
    console.log(`  ${apiTeams.length} teams from API`);

    const teamIdMap = new Map<number, { id: string; slug: string }>();

    for (const apiTeam of apiTeams) {
      const teamSlug = slugify(apiTeam.name);

      // Try to find existing by slug
      const [existing] = await db
        .select({ id: schema.teams.id, slug: schema.teams.slug })
        .from(schema.teams)
        .where(eq(schema.teams.slug, teamSlug))
        .limit(1);

      if (existing) {
        teamIdMap.set(apiTeam.id, { id: existing.id, slug: existing.slug });
        // Also link to this competition season
        await db
          .insert(schema.teamSeasons)
          .values({
            teamId: existing.id,
            competitionSeasonId: compSeason.id,
          })
          .onConflictDoNothing();
        continue;
      }

      // Insert new team
      try {
        const [newTeam] = await db
          .insert(schema.teams)
          .values({
            externalId: `fd-${apiTeam.id}`,
            name: apiTeam.name,
            shortName: apiTeam.shortName || null,
            slug: teamSlug,
            country: apiTeam.area?.name || target.country,
            city: extractCity(apiTeam.address),
            foundedYear: apiTeam.founded,
            logoUrl: apiTeam.crest,
            primaryColor: apiTeam.clubColors?.split("/")[0]?.trim() || null,
            secondaryColor: apiTeam.clubColors?.split("/")[1]?.trim() || null,
          })
          .returning({ id: schema.teams.id, slug: schema.teams.slug });

        if (newTeam) {
          teamIdMap.set(apiTeam.id, newTeam);
          await db
            .insert(schema.teamSeasons)
            .values({
              teamId: newTeam.id,
              competitionSeasonId: compSeason.id,
            })
            .onConflictDoNothing();
        }
      } catch (err) {
        console.log(`    failed to insert ${apiTeam.name}: ${(err as Error).message}`);
      }
    }
    console.log(`  ${teamIdMap.size} teams in map`);

    // Fetch standings
    try {
      const standingsData = await fetchApi(`${BASE_URL}/competitions/${target.code}/standings`);
      const tableStandings = standingsData.standings?.find((s: any) => s.type === "TOTAL")?.table || [];
      let standingsCount = 0;
      for (const row of tableStandings) {
        const team = teamIdMap.get(row.team.id);
        if (!team) continue;
        await db
          .insert(schema.standings)
          .values({
            competitionSeasonId: compSeason.id,
            teamId: team.id,
            position: row.position,
            played: row.playedGames,
            won: row.won,
            drawn: row.draw,
            lost: row.lost,
            goalsFor: row.goalsFor,
            goalsAgainst: row.goalsAgainst,
            goalDifference: row.goalDifference,
            points: row.points,
            form: row.form || null,
          })
          .onConflictDoNothing();
        standingsCount++;
      }
      console.log(`  ${standingsCount} standings`);
    } catch (err) {
      console.log(`  standings failed: ${(err as Error).message}`);
    }

    // Fetch matches
    try {
      const matchesData = await fetchApi(`${BASE_URL}/competitions/${target.code}/matches`);
      const apiMatches = matchesData.matches || [];
      let matchCount = 0;
      let skipped = 0;
      for (const m of apiMatches) {
        const home = teamIdMap.get(m.homeTeam.id);
        const away = teamIdMap.get(m.awayTeam.id);
        if (!home || !away) {
          skipped++;
          continue;
        }
        const externalId = `fd-${m.id}`;
        const status = STATUS_MAP[m.status] || "scheduled";
        const scheduledAt = new Date(m.utcDate);
        const matchSlug = buildMatchSlug(home.slug, away.slug, scheduledAt);

        try {
          await db
            .insert(schema.matches)
            .values({
              externalId,
              slug: matchSlug,
              competitionSeasonId: compSeason.id,
              homeTeamId: home.id,
              awayTeamId: away.id,
              matchday: m.matchday,
              scheduledAt,
              status,
              homeScore: m.score?.fullTime?.home ?? null,
              awayScore: m.score?.fullTime?.away ?? null,
              referee: m.referees?.[0]?.name || null,
            })
            .onConflictDoUpdate({
              target: schema.matches.externalId,
              set: {
                status,
                homeScore: m.score?.fullTime?.home ?? null,
                awayScore: m.score?.fullTime?.away ?? null,
                matchday: m.matchday,
                scheduledAt,
                updatedAt: new Date(),
              },
            });
          matchCount++;
        } catch {
          // Slug collision fallback
          const fallbackSlug = `${matchSlug}-${externalId.slice(3, 9)}`;
          try {
            await db
              .insert(schema.matches)
              .values({
                externalId,
                slug: fallbackSlug,
                competitionSeasonId: compSeason.id,
                homeTeamId: home.id,
                awayTeamId: away.id,
                matchday: m.matchday,
                scheduledAt,
                status,
                homeScore: m.score?.fullTime?.home ?? null,
                awayScore: m.score?.fullTime?.away ?? null,
                referee: m.referees?.[0]?.name || null,
              })
              .onConflictDoUpdate({
                target: schema.matches.externalId,
                set: { updatedAt: new Date() },
              });
            matchCount++;
          } catch {
            skipped++;
          }
        }
      }
      console.log(`  ${matchCount} matches (${skipped} skipped)`);
    } catch (err) {
      console.log(`  matches failed: ${(err as Error).message}`);
    }
  }

  console.log("\nDone");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
