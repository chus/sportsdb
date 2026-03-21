/**
 * Shared football-data.org helpers.
 *
 * Used by both sync-football-data.ts and backfill-historical-seasons.ts.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import * as schema from "../../src/lib/db/schema";

config({ path: ".env.local" });

// ============================================================
// TYPES
// ============================================================

export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;
export type FetchFn = (url: string) => Promise<any>;

// ============================================================
// DB SETUP
// ============================================================

export function createDb() {
  const sql = neon(process.env.DATABASE_URL!);
  return drizzle(sql, { schema });
}

// ============================================================
// API CONFIG
// ============================================================

export const BASE_URL = "https://api.football-data.org/v4";

export const COMPETITIONS = [
  { code: "PL", name: "Premier League", country: "England" },
  { code: "PD", name: "La Liga", country: "Spain" },
  { code: "BL1", name: "Bundesliga", country: "Germany" },
  { code: "SA", name: "Serie A", country: "Italy" },
  { code: "FL1", name: "Ligue 1", country: "France" },
  { code: "CL", name: "Champions League", country: "Europe" },
  { code: "ELC", name: "Championship", country: "England" },
  { code: "DED", name: "Eredivisie", country: "Netherlands" },
  { code: "PPL", name: "Primeira Liga", country: "Portugal" },
  { code: "BSA", name: "Brasileirao Serie A", country: "Brazil" },
  { code: "EC", name: "European Championship", country: "Europe" },
  { code: "WC", name: "World Cup", country: "World" },
] as const;

export type CompMeta = (typeof COMPETITIONS)[number];

// ============================================================
// RATE LIMITING
// ============================================================

export function createRateLimitedFetch(apiKey: string, delayMs = 6500): FetchFn {
  let lastRequestTime = 0;

  return async (url: string): Promise<any> => {
    const now = Date.now();
    const timeSince = now - lastRequestTime;

    if (timeSince < delayMs) {
      const wait = delayMs - timeSince;
      console.log(`   Waiting ${Math.round(wait / 1000)}s (rate limit)...`);
      await new Promise((r) => setTimeout(r, wait));
    }

    lastRequestTime = Date.now();

    const response = await fetch(url, {
      headers: { "X-Auth-Token": apiKey },
    });

    if (response.status === 429) {
      console.log("   Rate limited! Waiting 60s...");
      await new Promise((r) => setTimeout(r, 60000));
      lastRequestTime = Date.now();
      const retry = await fetch(url, {
        headers: { "X-Auth-Token": apiKey },
      });
      if (!retry.ok) {
        throw new Error(`API error ${retry.status} after retry: ${await retry.text()}`);
      }
      return retry.json();
    }

    if (!response.ok) {
      throw new Error(`API error ${response.status}: ${await response.text()}`);
    }

    return response.json();
  };
}

// ============================================================
// HELPERS
// ============================================================

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function mapPosition(position: string | null): string {
  if (!position) return "Unknown";
  const posMap: Record<string, string> = {
    Goalkeeper: "Goalkeeper",
    Defence: "Defender",
    "Left-Back": "Defender",
    "Right-Back": "Defender",
    "Centre-Back": "Defender",
    "Defensive Midfield": "Midfielder",
    Midfield: "Midfielder",
    "Central Midfield": "Midfielder",
    "Attacking Midfield": "Midfielder",
    "Left Midfield": "Midfielder",
    "Right Midfield": "Midfielder",
    "Left Winger": "Forward",
    "Right Winger": "Forward",
    Offence: "Forward",
    "Centre-Forward": "Forward",
  };
  return posMap[position] || position;
}

export function mapMatchStatus(status: string): string {
  const statusMap: Record<string, string> = {
    SCHEDULED: "scheduled",
    TIMED: "scheduled",
    IN_PLAY: "live",
    PAUSED: "half_time",
    FINISHED: "finished",
    POSTPONED: "postponed",
    CANCELLED: "cancelled",
    SUSPENDED: "postponed",
    AWARDED: "finished",
  };
  return statusMap[status] || "scheduled";
}

export function fdId(apiId: number): string {
  return `fd-${apiId}`;
}

// ============================================================
// UPSERT: SEASON
// ============================================================

export async function upsertSeason(
  db: DrizzleDb,
  label: string,
  startDate: string,
  endDate: string,
  isCurrent: boolean
) {
  const existing = await db
    .select()
    .from(schema.seasons)
    .where(eq(schema.seasons.label, label))
    .limit(1);

  if (existing.length > 0) return existing[0];

  const [inserted] = await db
    .insert(schema.seasons)
    .values({ label, startDate, endDate, isCurrent })
    .onConflictDoNothing()
    .returning();

  if (inserted) {
    console.log(`   + Season: ${label}`);
    return inserted;
  }

  const [found] = await db
    .select()
    .from(schema.seasons)
    .where(eq(schema.seasons.label, label))
    .limit(1);
  return found;
}

export async function upsertSeasonFromApi(db: DrizzleDb, apiSeason: any) {
  const startYear = parseInt(apiSeason.startDate.slice(0, 4));
  const endYear = parseInt(apiSeason.endDate.slice(0, 4));
  const label =
    startYear === endYear ? `${startYear}` : `${startYear}/${String(endYear).slice(2)}`;

  return upsertSeason(db, label, apiSeason.startDate, apiSeason.endDate, true);
}

// ============================================================
// UPSERT: COMPETITION
// ============================================================

export async function upsertCompetition(
  db: DrizzleDb,
  apiComp: any,
  compMeta: CompMeta
) {
  const extId = fdId(apiComp.id);
  const compSlug = slugify(apiComp.name);
  const type =
    apiComp.type === "CUP"
      ? "cup"
      : apiComp.type === "LEAGUE"
        ? "league"
        : "international";

  const [byExtId] = await db
    .select()
    .from(schema.competitions)
    .where(eq(schema.competitions.externalId, extId))
    .limit(1);

  if (byExtId) {
    const [updated] = await db
      .update(schema.competitions)
      .set({
        name: apiComp.name,
        country: compMeta.country,
        type,
        logoUrl: apiComp.emblem,
        description: `${apiComp.name} - ${compMeta.country}`,
        updatedAt: new Date(),
      })
      .where(eq(schema.competitions.id, byExtId.id))
      .returning();
    return updated;
  }

  const [bySlug] = await db
    .select()
    .from(schema.competitions)
    .where(eq(schema.competitions.slug, compSlug))
    .limit(1);

  if (bySlug) {
    const [updated] = await db
      .update(schema.competitions)
      .set({
        externalId: extId,
        name: apiComp.name,
        country: compMeta.country,
        type,
        logoUrl: apiComp.emblem,
        description: `${apiComp.name} - ${compMeta.country}`,
        updatedAt: new Date(),
      })
      .where(eq(schema.competitions.id, bySlug.id))
      .returning();
    return updated;
  }

  const [result] = await db
    .insert(schema.competitions)
    .values({
      externalId: extId,
      name: apiComp.name,
      slug: compSlug,
      country: compMeta.country,
      type,
      logoUrl: apiComp.emblem,
      description: `${apiComp.name} - ${compMeta.country}`,
    })
    .onConflictDoUpdate({
      target: schema.competitions.externalId,
      set: {
        name: apiComp.name,
        country: compMeta.country,
        type,
        logoUrl: apiComp.emblem,
        description: `${apiComp.name} - ${compMeta.country}`,
        updatedAt: new Date(),
      },
    })
    .returning();

  return result;
}

// ============================================================
// UPSERT: COMPETITION-SEASON
// ============================================================

export async function upsertCompetitionSeason(
  db: DrizzleDb,
  competitionId: string,
  seasonId: string,
  status: "scheduled" | "in_progress" | "completed" = "in_progress"
) {
  const existing = await db
    .select()
    .from(schema.competitionSeasons)
    .where(eq(schema.competitionSeasons.competitionId, competitionId))
    .limit(100)
    .then((rows) => rows.filter((r) => r.seasonId === seasonId));

  if (existing.length > 0) return existing[0];

  const [inserted] = await db
    .insert(schema.competitionSeasons)
    .values({ competitionId, seasonId, status })
    .onConflictDoNothing()
    .returning();

  if (inserted) return inserted;

  const [found] = await db
    .select()
    .from(schema.competitionSeasons)
    .where(eq(schema.competitionSeasons.competitionId, competitionId))
    .limit(100)
    .then((rows) => rows.filter((r) => r.seasonId === seasonId));
  return found;
}

// ============================================================
// UPSERT: TEAM
// ============================================================

export async function upsertTeam(db: DrizzleDb, apiTeam: any) {
  const extId = fdId(apiTeam.id);
  const teamSlug = slugify(apiTeam.name);

  const [byExtId] = await db
    .select()
    .from(schema.teams)
    .where(eq(schema.teams.externalId, extId))
    .limit(1);

  if (byExtId) {
    const [updated] = await db
      .update(schema.teams)
      .set({
        name: apiTeam.name,
        shortName: apiTeam.shortName || null,
        country: apiTeam.area?.name || "Unknown",
        city: apiTeam.address?.split(",")[0] || null,
        foundedYear: apiTeam.founded,
        logoUrl: apiTeam.crest,
        primaryColor: apiTeam.clubColors?.split("/")[0]?.trim() || null,
        secondaryColor: apiTeam.clubColors?.split("/")[1]?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.teams.id, byExtId.id))
      .returning();
    return updated;
  }

  const [bySlug] = await db
    .select()
    .from(schema.teams)
    .where(eq(schema.teams.slug, teamSlug))
    .limit(1);

  if (bySlug) {
    const [updated] = await db
      .update(schema.teams)
      .set({
        externalId: extId,
        name: apiTeam.name,
        shortName: apiTeam.shortName || null,
        country: apiTeam.area?.name || "Unknown",
        city: apiTeam.address?.split(",")[0] || null,
        foundedYear: apiTeam.founded,
        logoUrl: apiTeam.crest,
        primaryColor: apiTeam.clubColors?.split("/")[0]?.trim() || null,
        secondaryColor: apiTeam.clubColors?.split("/")[1]?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.teams.id, bySlug.id))
      .returning();
    return updated;
  }

  const [result] = await db
    .insert(schema.teams)
    .values({
      externalId: extId,
      name: apiTeam.name,
      shortName: apiTeam.shortName || null,
      slug: teamSlug,
      country: apiTeam.area?.name || "Unknown",
      city: apiTeam.address?.split(",")[0] || null,
      foundedYear: apiTeam.founded,
      logoUrl: apiTeam.crest,
      primaryColor: apiTeam.clubColors?.split("/")[0]?.trim() || null,
      secondaryColor: apiTeam.clubColors?.split("/")[1]?.trim() || null,
    })
    .onConflictDoUpdate({
      target: schema.teams.externalId,
      set: {
        name: apiTeam.name,
        shortName: apiTeam.shortName || null,
        country: apiTeam.area?.name || "Unknown",
        city: apiTeam.address?.split(",")[0] || null,
        foundedYear: apiTeam.founded,
        logoUrl: apiTeam.crest,
        primaryColor: apiTeam.clubColors?.split("/")[0]?.trim() || null,
        secondaryColor: apiTeam.clubColors?.split("/")[1]?.trim() || null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return result;
}

// ============================================================
// UPSERT: VENUE
// ============================================================

export async function upsertVenue(db: DrizzleDb, apiTeam: any): Promise<string | null> {
  if (!apiTeam.venue) return null;

  const venueSlug = slugify(apiTeam.venue);

  const [result] = await db
    .insert(schema.venues)
    .values({
      name: apiTeam.venue,
      slug: venueSlug,
      city: apiTeam.address?.split(",")[0] || null,
      country: apiTeam.area?.name || null,
    })
    .onConflictDoUpdate({
      target: schema.venues.slug,
      set: {
        name: apiTeam.venue,
        city: apiTeam.address?.split(",")[0] || null,
        country: apiTeam.area?.name || null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return result?.id || null;
}

// ============================================================
// UPSERT: PLAYER
// ============================================================

export async function upsertPlayer(db: DrizzleDb, apiPlayer: any) {
  const extId = fdId(apiPlayer.id);
  const playerSlug = slugify(apiPlayer.name);

  const [byExtId] = await db
    .select()
    .from(schema.players)
    .where(eq(schema.players.externalId, extId))
    .limit(1);

  if (byExtId) {
    const [updated] = await db
      .update(schema.players)
      .set({
        name: apiPlayer.name,
        knownAs: apiPlayer.name.split(" ").pop() || null,
        dateOfBirth: apiPlayer.dateOfBirth,
        nationality: apiPlayer.nationality,
        position: mapPosition(apiPlayer.position),
        updatedAt: new Date(),
      })
      .where(eq(schema.players.id, byExtId.id))
      .returning();
    return updated;
  }

  const [bySlug] = await db
    .select()
    .from(schema.players)
    .where(eq(schema.players.slug, playerSlug))
    .limit(1);

  if (bySlug) {
    const [updated] = await db
      .update(schema.players)
      .set({
        externalId: extId,
        name: apiPlayer.name,
        knownAs: apiPlayer.name.split(" ").pop() || null,
        dateOfBirth: apiPlayer.dateOfBirth,
        nationality: apiPlayer.nationality,
        position: mapPosition(apiPlayer.position),
        updatedAt: new Date(),
      })
      .where(eq(schema.players.id, bySlug.id))
      .returning();
    return updated;
  }

  try {
    const [result] = await db
      .insert(schema.players)
      .values({
        externalId: extId,
        name: apiPlayer.name,
        knownAs: apiPlayer.name.split(" ").pop() || null,
        slug: playerSlug,
        dateOfBirth: apiPlayer.dateOfBirth,
        nationality: apiPlayer.nationality,
        position: mapPosition(apiPlayer.position),
        status: "active",
      })
      .onConflictDoUpdate({
        target: schema.players.externalId,
        set: {
          name: apiPlayer.name,
          knownAs: apiPlayer.name.split(" ").pop() || null,
          dateOfBirth: apiPlayer.dateOfBirth,
          nationality: apiPlayer.nationality,
          position: mapPosition(apiPlayer.position),
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  } catch {
    try {
      const dedupSlug = `${playerSlug}-${apiPlayer.id}`;
      const [result] = await db
        .insert(schema.players)
        .values({
          externalId: extId,
          name: apiPlayer.name,
          knownAs: apiPlayer.name.split(" ").pop() || null,
          slug: dedupSlug,
          dateOfBirth: apiPlayer.dateOfBirth,
          nationality: apiPlayer.nationality,
          position: mapPosition(apiPlayer.position),
          status: "active",
        })
        .onConflictDoUpdate({
          target: schema.players.externalId,
          set: {
            name: apiPlayer.name,
            knownAs: apiPlayer.name.split(" ").pop() || null,
            dateOfBirth: apiPlayer.dateOfBirth,
            nationality: apiPlayer.nationality,
            position: mapPosition(apiPlayer.position),
            updatedAt: new Date(),
          },
        })
        .returning();
      return result;
    } catch {
      console.log(`   ! Skipping player: ${apiPlayer.name} (slug conflict)`);
      return null;
    }
  }
}

// ============================================================
// LINK FUNCTIONS
// ============================================================

export async function linkTeamVenue(db: DrizzleDb, teamId: string, venueId: string) {
  await db
    .insert(schema.teamVenueHistory)
    .values({ teamId, venueId, validFrom: "2020-01-01" })
    .onConflictDoNothing();
}

export async function linkPlayerTeam(db: DrizzleDb, playerId: string, teamId: string) {
  await db
    .insert(schema.playerTeamHistory)
    .values({ playerId, teamId, validFrom: "2024-01-01", transferType: "permanent" })
    .onConflictDoNothing();
}

export async function linkTeamSeason(db: DrizzleDb, teamId: string, compSeasonId: string) {
  await db
    .insert(schema.teamSeasons)
    .values({ teamId, competitionSeasonId: compSeasonId })
    .onConflictDoNothing();
}

// ============================================================
// SYNC: TEAMS
// ============================================================

export async function syncTeams(
  db: DrizzleDb,
  fetchFn: FetchFn,
  compCode: string,
  compSeasonId: string,
  seasonYear?: number
): Promise<Map<number, string>> {
  const seasonParam = seasonYear ? `?season=${seasonYear}` : "";
  const teamsData = await fetchFn(
    `${BASE_URL}/competitions/${compCode}/teams${seasonParam}`
  );

  const apiIdToDbId = new Map<number, string>();

  for (const apiTeam of teamsData.teams || []) {
    const team = await upsertTeam(db, apiTeam);
    apiIdToDbId.set(apiTeam.id, team.id);

    const venueId = await upsertVenue(db, apiTeam);
    if (venueId) await linkTeamVenue(db, team.id, venueId);

    await linkTeamSeason(db, team.id, compSeasonId);

    // Only process squads for current season
    if (!seasonYear && apiTeam.squad && apiTeam.squad.length > 0) {
      for (const apiPlayer of apiTeam.squad) {
        const player = await upsertPlayer(db, apiPlayer);
        if (player) await linkPlayerTeam(db, player.id, team.id);
      }
    }
  }

  console.log(`   Teams: ${apiIdToDbId.size}`);
  return apiIdToDbId;
}

// ============================================================
// SYNC: STANDINGS
// ============================================================

export async function syncStandings(
  db: DrizzleDb,
  fetchFn: FetchFn,
  compCode: string,
  compSeasonId: string,
  teamIdMap: Map<number, string>,
  seasonYear?: number
) {
  const seasonParam = seasonYear ? `?season=${seasonYear}` : "";
  const standingsData = await fetchFn(
    `${BASE_URL}/competitions/${compCode}/standings${seasonParam}`
  );

  const table =
    standingsData.standings?.find((s: any) => s.type === "TOTAL")?.table || [];

  let count = 0;
  for (const row of table) {
    const teamId = teamIdMap.get(row.team.id);
    if (!teamId) continue;

    await db
      .insert(schema.standings)
      .values({
        competitionSeasonId: compSeasonId,
        teamId,
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
      .onConflictDoUpdate({
        target: [schema.standings.competitionSeasonId, schema.standings.teamId],
        set: {
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
          updatedAt: new Date(),
        },
      });

    count++;
  }

  console.log(`   Standings: ${count} rows`);
}

// ============================================================
// SYNC: MATCHES
// ============================================================

export async function syncMatches(
  db: DrizzleDb,
  fetchFn: FetchFn,
  compCode: string,
  compSeasonId: string,
  teamIdMap: Map<number, string>,
  seasonYear?: number
) {
  const seasonParam = seasonYear ? `?season=${seasonYear}` : "";
  const matchesData = await fetchFn(
    `${BASE_URL}/competitions/${compCode}/matches${seasonParam}`
  );

  let count = 0;
  for (const apiMatch of matchesData.matches || []) {
    const homeTeamId = teamIdMap.get(apiMatch.homeTeam.id);
    const awayTeamId = teamIdMap.get(apiMatch.awayTeam.id);
    if (!homeTeamId || !awayTeamId) continue;

    const extId = fdId(apiMatch.id);

    await db
      .insert(schema.matches)
      .values({
        externalId: extId,
        competitionSeasonId: compSeasonId,
        homeTeamId,
        awayTeamId,
        matchday: apiMatch.matchday,
        scheduledAt: new Date(apiMatch.utcDate),
        status: mapMatchStatus(apiMatch.status),
        homeScore: apiMatch.score?.fullTime?.home ?? null,
        awayScore: apiMatch.score?.fullTime?.away ?? null,
        referee: apiMatch.referees?.[0]?.name || null,
      })
      .onConflictDoUpdate({
        target: schema.matches.externalId,
        set: {
          matchday: apiMatch.matchday,
          scheduledAt: new Date(apiMatch.utcDate),
          status: mapMatchStatus(apiMatch.status),
          homeScore: apiMatch.score?.fullTime?.home ?? null,
          awayScore: apiMatch.score?.fullTime?.away ?? null,
          referee: apiMatch.referees?.[0]?.name || null,
          updatedAt: new Date(),
        },
      });

    count++;
  }

  console.log(`   Matches: ${count}`);
}

// ============================================================
// SYNC: SCORERS
// ============================================================

export async function syncScorers(
  db: DrizzleDb,
  fetchFn: FetchFn,
  compCode: string,
  compSeasonId: string,
  teamIdMap: Map<number, string>,
  seasonYear?: number
) {
  const params = seasonYear ? `?season=${seasonYear}&limit=100` : "?limit=100";
  const scorersData = await fetchFn(
    `${BASE_URL}/competitions/${compCode}/scorers${params}`
  );

  let count = 0;
  for (const scorer of scorersData.scorers || []) {
    const teamId = teamIdMap.get(scorer.team?.id);
    if (!teamId) continue;

    const player = await upsertPlayer(db, scorer.player);
    if (!player) continue;

    await db
      .insert(schema.playerSeasonStats)
      .values({
        playerId: player.id,
        teamId,
        competitionSeasonId: compSeasonId,
        appearances: scorer.playedMatches || 0,
        goals: scorer.goals || 0,
        assists: scorer.assists || 0,
        yellowCards: 0,
        redCards: 0,
        minutesPlayed: 0,
      })
      .onConflictDoUpdate({
        target: [
          schema.playerSeasonStats.playerId,
          schema.playerSeasonStats.teamId,
          schema.playerSeasonStats.competitionSeasonId,
        ],
        set: {
          appearances: scorer.playedMatches || 0,
          goals: scorer.goals || 0,
          assists: scorer.assists || 0,
          updatedAt: new Date(),
        },
      });

    count++;
  }

  console.log(`   Scorers: ${count}`);
}
