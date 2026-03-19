/**
 * API-Football Sync Script
 *
 * Syncs data from API-Football (api-sports.io) — covers LATAM leagues
 * and enriches existing players with images, heights, and shirt numbers.
 *
 * Free tier: 100 requests/day, 10 requests/minute
 *
 * Usage:
 *   npx tsx scripts/sync-api-football.ts --standings                       # LATAM standings only (~3 req)
 *   npx tsx scripts/sync-api-football.ts --all-standings                   # All configured leagues (~11 req)
 *   npx tsx scripts/sync-api-football.ts --full --slug=liga-profesional-argentina  # Full sync one league (~24 req)
 *   npx tsx scripts/sync-api-football.ts --enrich                          # Fill player images (~1 req/team)
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";
import { eq, sql as drizzleSql, and, isNull } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

config({ path: ".env.local" });

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = "https://v3.football.api-sports.io";

if (!API_KEY) {
  console.error("Missing API_FOOTBALL_KEY in .env.local");
  console.error("Register at: https://www.api-football.com/");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

// ============================================================
// REQUEST BUDGET
// ============================================================

const MAX_REQUESTS = 95; // Hard cap (free tier = 100/day)
let requestCount = 0;

function canMakeRequest(): boolean {
  return requestCount < MAX_REQUESTS;
}

// ============================================================
// RATE LIMITING
// ============================================================

const RATE_LIMIT_MS = 6500; // 10 req/min
let lastRequestTime = 0;

async function apiFetch(endpoint: string): Promise<any> {
  if (!canMakeRequest()) {
    throw new Error(`Request budget exhausted (${requestCount}/${MAX_REQUESTS}). Try again tomorrow.`);
  }

  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    const waitTime = RATE_LIMIT_MS - timeSinceLastRequest;
    console.log(`   Waiting ${Math.round(waitTime / 1000)}s (rate limit)...`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
  requestCount++;

  const url = `${BASE_URL}${endpoint}`;
  console.log(`   [${requestCount}/${MAX_REQUESTS}] GET ${endpoint}`);

  const response = await fetch(url, {
    headers: {
      "x-rapidapi-key": API_KEY!,
      "x-rapidapi-host": "v3.football.api-sports.io",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error ${response.status}: ${error}`);
  }

  const data = await response.json();

  if (data.errors && Object.keys(data.errors).length > 0) {
    // Check if we've hit the daily request limit
    if (data.errors.requests && typeof data.errors.requests === "string" &&
        data.errors.requests.includes("request limit")) {
      console.error(`   DAILY LIMIT REACHED — stopping all requests`);
      requestCount = MAX_REQUESTS; // Prevent further requests
      return { response: [] }; // Return empty so callers handle gracefully
    }
    console.error(`   API errors:`, data.errors);
  }

  return data;
}

// ============================================================
// LEAGUE CONFIGURATION
// ============================================================

interface LeagueConfig {
  slug: string;
  apiId: number;
  season: number;
  country: string;
  name: string;
  type: "league" | "cup";
  isLatam: boolean;
}

// Free tier: access to seasons 2022–2024 only
const LEAGUES: LeagueConfig[] = [
  // LATAM — primary targets (not covered by football-data.org free tier)
  { slug: "liga-profesional-argentina", apiId: 128, season: 2024, country: "Argentina", name: "Liga Profesional Argentina", type: "league", isLatam: true },
  { slug: "liga-mx", apiId: 262, season: 2024, country: "Mexico", name: "Liga MX", type: "league", isLatam: true },
  { slug: "mls", apiId: 253, season: 2024, country: "USA", name: "Major League Soccer", type: "league", isLatam: true },
  // Already synced from football-data.org — API-Football used for enrichment only
  { slug: "brasileirao-serie-a", apiId: 71, season: 2024, country: "Brazil", name: "Brasileirão Série A", type: "league", isLatam: true },
  { slug: "premier-league", apiId: 39, season: 2024, country: "England", name: "Premier League", type: "league", isLatam: false },
  { slug: "la-liga", apiId: 140, season: 2024, country: "Spain", name: "La Liga", type: "league", isLatam: false },
  { slug: "bundesliga", apiId: 78, season: 2024, country: "Germany", name: "Bundesliga", type: "league", isLatam: false },
  { slug: "serie-a", apiId: 135, season: 2024, country: "Italy", name: "Serie A", type: "league", isLatam: false },
  { slug: "ligue-1", apiId: 61, season: 2024, country: "France", name: "Ligue 1", type: "league", isLatam: false },
  { slug: "eredivisie", apiId: 88, season: 2024, country: "Netherlands", name: "Eredivisie", type: "league", isLatam: false },
  { slug: "primeira-liga", apiId: 94, season: 2024, country: "Portugal", name: "Primeira Liga", type: "league", isLatam: false },
];

// ============================================================
// HELPERS
// ============================================================

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function afId(apiId: number): string {
  return `af-${apiId}`;
}

function mapPosition(pos: string | null): string {
  if (!pos) return "Unknown";
  const posMap: Record<string, string> = {
    Goalkeeper: "Goalkeeper",
    Defender: "Defender",
    Midfielder: "Midfielder",
    Attacker: "Forward",
  };
  return posMap[pos] || pos;
}

function mapMatchStatus(statusShort: string): string {
  const statusMap: Record<string, string> = {
    TBD: "scheduled",
    NS: "scheduled",
    "1H": "live",
    HT: "half_time",
    "2H": "live",
    ET: "live",
    BT: "half_time",
    P: "live",
    SUSP: "postponed",
    INT: "postponed",
    FT: "finished",
    AET: "finished",
    PEN: "finished",
    PST: "postponed",
    CANC: "cancelled",
    ABD: "cancelled",
    AWD: "finished",
    WO: "finished",
    LIVE: "live",
  };
  return statusMap[statusShort] || "scheduled";
}

// ============================================================
// UPSERT: SEASON
// ============================================================

async function ensureSeason(year: number): Promise<typeof schema.seasons.$inferSelect> {
  // For most leagues, the "season" param in API-Football is the start year.
  // European leagues: 2025 → 2025/26. Calendar-year leagues: 2025 → 2025.
  const label = `${year}/${String(year + 1).slice(2)}`;
  const altLabel = `${year}`;

  // Try the 2025/26 format first
  let [existing] = await db
    .select()
    .from(schema.seasons)
    .where(eq(schema.seasons.label, label))
    .limit(1);

  if (existing) return existing;

  // Try the single-year format (2025)
  [existing] = await db
    .select()
    .from(schema.seasons)
    .where(eq(schema.seasons.label, altLabel))
    .limit(1);

  if (existing) return existing;

  // Create new season
  const [inserted] = await db
    .insert(schema.seasons)
    .values({
      label,
      startDate: `${year}-07-01`,
      endDate: `${year + 1}-06-30`,
      isCurrent: true,
    })
    .onConflictDoNothing()
    .returning();

  if (inserted) {
    console.log(`   + Season: ${label}`);
    return inserted;
  }

  // Race condition fallback
  const [found] = await db
    .select()
    .from(schema.seasons)
    .where(eq(schema.seasons.label, label))
    .limit(1);
  return found;
}

// ============================================================
// UPSERT: COMPETITION
// ============================================================

async function upsertCompetition(
  league: LeagueConfig
): Promise<typeof schema.competitions.$inferSelect> {
  const extId = afId(league.apiId);

  // 1. Find existing by externalId
  const [byExtId] = await db
    .select()
    .from(schema.competitions)
    .where(eq(schema.competitions.externalId, extId))
    .limit(1);

  if (byExtId) {
    // Update but NEVER overwrite slug
    const [updated] = await db
      .update(schema.competitions)
      .set({
        name: league.name,
        country: league.country,
        type: league.type,
        updatedAt: new Date(),
      })
      .where(eq(schema.competitions.id, byExtId.id))
      .returning();
    return updated;
  }

  // 2. Find existing by slug (may have been created by Wikipedia scraper or football-data.org)
  const [bySlug] = await db
    .select()
    .from(schema.competitions)
    .where(eq(schema.competitions.slug, league.slug))
    .limit(1);

  if (bySlug) {
    // Backfill externalId if the competition was created by another source
    // Only set af- externalId if there's no existing externalId (don't overwrite fd- IDs)
    const updates: any = {
      country: league.country,
      type: league.type,
      updatedAt: new Date(),
    };
    if (!bySlug.externalId) {
      updates.externalId = extId;
    }
    const [updated] = await db
      .update(schema.competitions)
      .set(updates)
      .where(eq(schema.competitions.id, bySlug.id))
      .returning();
    return updated;
  }

  // 3. Brand new competition — insert
  const [result] = await db
    .insert(schema.competitions)
    .values({
      externalId: extId,
      name: league.name,
      slug: league.slug,
      country: league.country,
      type: league.type,
      description: `${league.name} - ${league.country}`,
    })
    .onConflictDoUpdate({
      target: schema.competitions.externalId,
      set: {
        name: league.name,
        country: league.country,
        type: league.type,
        updatedAt: new Date(),
      },
    })
    .returning();

  console.log(`   + Competition: ${league.name}`);
  return result;
}

// ============================================================
// UPSERT: COMPETITION-SEASON
// ============================================================

async function upsertCompetitionSeason(
  competitionId: string,
  seasonId: string
): Promise<typeof schema.competitionSeasons.$inferSelect> {
  const existing = await db
    .select()
    .from(schema.competitionSeasons)
    .where(
      and(
        eq(schema.competitionSeasons.competitionId, competitionId),
        eq(schema.competitionSeasons.seasonId, seasonId)
      )
    )
    .limit(1);

  if (existing.length > 0) return existing[0];

  const [inserted] = await db
    .insert(schema.competitionSeasons)
    .values({
      competitionId,
      seasonId,
      status: "in_progress",
    })
    .onConflictDoNothing()
    .returning();

  if (inserted) return inserted;

  // Fallback
  const [found] = await db
    .select()
    .from(schema.competitionSeasons)
    .where(
      and(
        eq(schema.competitionSeasons.competitionId, competitionId),
        eq(schema.competitionSeasons.seasonId, seasonId)
      )
    )
    .limit(1);
  return found;
}

// ============================================================
// UPSERT: TEAM
// ============================================================

async function upsertTeam(
  apiTeam: any,
  country: string
): Promise<typeof schema.teams.$inferSelect> {
  const extId = afId(apiTeam.id);
  const teamSlug = slugify(apiTeam.name);

  // 1. Find by af- externalId
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
        shortName: apiTeam.code || null,
        country,
        logoUrl: apiTeam.logo || byExtId.logoUrl,
        foundedYear: apiTeam.founded || byExtId.foundedYear,
        updatedAt: new Date(),
      })
      .where(eq(schema.teams.id, byExtId.id))
      .returning();
    return updated;
  }

  // 2. Find by slug (legacy data)
  const [bySlug] = await db
    .select()
    .from(schema.teams)
    .where(eq(schema.teams.slug, teamSlug))
    .limit(1);

  if (bySlug) {
    // Only set af- externalId if no existing externalId
    const updates: any = {
      name: apiTeam.name,
      shortName: apiTeam.code || bySlug.shortName,
      country,
      logoUrl: apiTeam.logo || bySlug.logoUrl,
      foundedYear: apiTeam.founded || bySlug.foundedYear,
      updatedAt: new Date(),
    };
    if (!bySlug.externalId) {
      updates.externalId = extId;
    }
    const [updated] = await db
      .update(schema.teams)
      .set(updates)
      .where(eq(schema.teams.id, bySlug.id))
      .returning();
    return updated;
  }

  // 3. Try fuzzy name match before creating new (API names differ from Wikipedia names)
  const [byName] = await db
    .select()
    .from(schema.teams)
    .where(eq(schema.teams.name, apiTeam.name))
    .limit(1);

  if (byName) {
    const updates: any = {
      logoUrl: apiTeam.logo || byName.logoUrl,
      foundedYear: apiTeam.founded || byName.foundedYear,
      updatedAt: new Date(),
    };
    if (!byName.externalId) {
      updates.externalId = extId;
    }
    const [updated] = await db
      .update(schema.teams)
      .set(updates)
      .where(eq(schema.teams.id, byName.id))
      .returning();
    return updated;
  }

  // 4. Brand new team — insert
  const [result] = await db
    .insert(schema.teams)
    .values({
      externalId: extId,
      name: apiTeam.name,
      shortName: apiTeam.code || null,
      slug: teamSlug,
      country,
      logoUrl: apiTeam.logo || null,
      foundedYear: apiTeam.founded || null,
    })
    .onConflictDoUpdate({
      target: schema.teams.externalId,
      set: {
        name: apiTeam.name,
        shortName: apiTeam.code || null,
        country,
        logoUrl: apiTeam.logo || null,
        foundedYear: apiTeam.founded || null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return result;
}

// ============================================================
// UPSERT: VENUE
// ============================================================

async function upsertVenue(venue: any, country: string): Promise<string | null> {
  if (!venue?.name) return null;

  const venueSlug = slugify(venue.name);

  const [result] = await db
    .insert(schema.venues)
    .values({
      name: venue.name,
      slug: venueSlug,
      city: venue.city || null,
      country,
      capacity: venue.capacity || null,
      imageUrl: venue.image || null,
    })
    .onConflictDoUpdate({
      target: schema.venues.slug,
      set: {
        capacity: venue.capacity || null,
        city: venue.city || null,
        imageUrl: venue.image || null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return result?.id || null;
}

// ============================================================
// UPSERT: PLAYER (from squads endpoint)
// ============================================================

async function upsertPlayer(
  apiPlayer: any,
  teamId: string
): Promise<typeof schema.players.$inferSelect | null> {
  const extId = afId(apiPlayer.id);
  const playerSlug = slugify(apiPlayer.name);

  // 1. Find by af- externalId
  const [byExtId] = await db
    .select()
    .from(schema.players)
    .where(eq(schema.players.externalId, extId))
    .limit(1);

  if (byExtId) {
    const updates: any = {
      imageUrl: apiPlayer.photo || byExtId.imageUrl,
      position: mapPosition(apiPlayer.position) || byExtId.position,
      updatedAt: new Date(),
    };
    if (apiPlayer.age && !byExtId.dateOfBirth) {
      // Approximate date of birth from age
      const approxYear = new Date().getFullYear() - apiPlayer.age;
      updates.dateOfBirth = `${approxYear}-01-01`;
    }
    const [updated] = await db
      .update(schema.players)
      .set(updates)
      .where(eq(schema.players.id, byExtId.id))
      .returning();

    // Update shirt number in player_team_history
    if (apiPlayer.number) {
      await upsertPlayerTeamLink(updated.id, teamId, apiPlayer.number);
    }

    return updated;
  }

  // 2. Find by slug
  const [bySlug] = await db
    .select()
    .from(schema.players)
    .where(eq(schema.players.slug, playerSlug))
    .limit(1);

  if (bySlug) {
    const updates: any = {
      imageUrl: apiPlayer.photo || bySlug.imageUrl,
      position: mapPosition(apiPlayer.position) || bySlug.position,
      updatedAt: new Date(),
    };
    if (!bySlug.externalId) {
      updates.externalId = extId;
    }
    const [updated] = await db
      .update(schema.players)
      .set(updates)
      .where(eq(schema.players.id, bySlug.id))
      .returning();

    if (apiPlayer.number) {
      await upsertPlayerTeamLink(updated.id, teamId, apiPlayer.number);
    }

    return updated;
  }

  // 3. Brand new player — insert
  try {
    const [result] = await db
      .insert(schema.players)
      .values({
        externalId: extId,
        name: apiPlayer.name,
        knownAs: apiPlayer.name.split(" ").pop() || null,
        slug: playerSlug,
        position: mapPosition(apiPlayer.position) || "Unknown",
        status: "active",
        imageUrl: apiPlayer.photo || null,
        nationality: null, // Squads endpoint doesn't provide nationality
      })
      .onConflictDoUpdate({
        target: schema.players.externalId,
        set: {
          imageUrl: apiPlayer.photo || null,
          position: mapPosition(apiPlayer.position) || "Unknown",
          updatedAt: new Date(),
        },
      })
      .returning();

    if (apiPlayer.number) {
      await upsertPlayerTeamLink(result.id, teamId, apiPlayer.number);
    }

    return result;
  } catch {
    // Slug conflict — append API id
    try {
      const dedupSlug = `${playerSlug}-${apiPlayer.id}`;
      const [result] = await db
        .insert(schema.players)
        .values({
          externalId: extId,
          name: apiPlayer.name,
          knownAs: apiPlayer.name.split(" ").pop() || null,
          slug: dedupSlug,
          position: mapPosition(apiPlayer.position) || "Unknown",
          status: "active",
          imageUrl: apiPlayer.photo || null,
          nationality: null,
        })
        .onConflictDoUpdate({
          target: schema.players.externalId,
          set: {
            imageUrl: apiPlayer.photo || null,
            updatedAt: new Date(),
          },
        })
        .returning();

      if (apiPlayer.number) {
        await upsertPlayerTeamLink(result.id, teamId, apiPlayer.number);
      }

      return result;
    } catch {
      console.log(`   ! Skipping player: ${apiPlayer.name} (slug conflict)`);
      return null;
    }
  }
}

// ============================================================
// LINK: PLAYER-TEAM with shirt number
// ============================================================

async function upsertPlayerTeamLink(
  playerId: string,
  teamId: string,
  shirtNumber: number | null
) {
  // Check if link exists
  const [existing] = await db
    .select()
    .from(schema.playerTeamHistory)
    .where(
      and(
        eq(schema.playerTeamHistory.playerId, playerId),
        eq(schema.playerTeamHistory.teamId, teamId),
        isNull(schema.playerTeamHistory.validTo)
      )
    )
    .limit(1);

  if (existing) {
    // Update shirt number if provided
    if (shirtNumber && shirtNumber !== existing.shirtNumber) {
      await db
        .update(schema.playerTeamHistory)
        .set({ shirtNumber })
        .where(eq(schema.playerTeamHistory.id, existing.id));
    }
    return;
  }

  // Create new link
  await db
    .insert(schema.playerTeamHistory)
    .values({
      playerId,
      teamId,
      validFrom: "2024-01-01",
      transferType: "permanent",
      shirtNumber: shirtNumber || null,
    })
    .onConflictDoNothing();
}

// ============================================================
// LINK: TEAM-SEASON
// ============================================================

async function linkTeamSeason(teamId: string, compSeasonId: string) {
  await db
    .insert(schema.teamSeasons)
    .values({ teamId, competitionSeasonId: compSeasonId })
    .onConflictDoNothing();
}

// ============================================================
// LINK: TEAM-VENUE
// ============================================================

async function linkTeamVenue(teamId: string, venueId: string) {
  await db
    .insert(schema.teamVenueHistory)
    .values({ teamId, venueId, validFrom: "2020-01-01" })
    .onConflictDoNothing();
}

// ============================================================
// SYNC: TEAMS for a league
// ============================================================

async function syncTeams(
  league: LeagueConfig,
  compSeasonId: string
): Promise<Map<number, string>> {
  const data = await apiFetch(`/teams?league=${league.apiId}&season=${league.season}`);
  const apiIdToDbId = new Map<number, string>();

  for (const entry of data.response || []) {
    const apiTeam = entry.team;
    const apiVenue = entry.venue;

    const team = await upsertTeam(apiTeam, league.country);
    apiIdToDbId.set(apiTeam.id, team.id);

    // Venue
    if (apiVenue) {
      const venueId = await upsertVenue(apiVenue, league.country);
      if (venueId) await linkTeamVenue(team.id, venueId);
    }

    // Competition-season link
    await linkTeamSeason(team.id, compSeasonId);
  }

  console.log(`   Teams: ${apiIdToDbId.size}`);
  return apiIdToDbId;
}

// ============================================================
// SYNC: SQUADS (players with images + shirt numbers)
// ============================================================

async function syncSquads(
  teamIdMap: Map<number, string>
): Promise<number> {
  let playerCount = 0;

  for (const [apiTeamId, dbTeamId] of teamIdMap) {
    if (!canMakeRequest()) {
      console.log(`   Budget exhausted — stopping squad sync at team ${apiTeamId}`);
      break;
    }

    const data = await apiFetch(`/players/squads?team=${apiTeamId}`);

    for (const teamEntry of data.response || []) {
      for (const apiPlayer of teamEntry.players || []) {
        const player = await upsertPlayer(apiPlayer, dbTeamId);
        if (player) playerCount++;
      }
    }
  }

  console.log(`   Players: ${playerCount}`);
  return playerCount;
}

// ============================================================
// SYNC: STANDINGS
// ============================================================

async function syncStandings(
  league: LeagueConfig,
  compSeasonId: string,
  teamIdMap: Map<number, string>
) {
  const data = await apiFetch(`/standings?league=${league.apiId}&season=${league.season}`);

  if (!data.response || data.response.length === 0) {
    console.log(`   No standings data`);
    return;
  }

  // Flatten all groups (for cup competitions with groups)
  const allStandings = data.response[0].league.standings.flat();

  let count = 0;
  for (const row of allStandings) {
    let teamId = teamIdMap.get(row.team.id);

    // If team not in our map, try to find/create it
    if (!teamId) {
      const team = await upsertTeam(
        { id: row.team.id, name: row.team.name, logo: row.team.logo, code: null, founded: null },
        league.country
      );
      teamId = team.id;
      teamIdMap.set(row.team.id, team.id);
      await linkTeamSeason(team.id, compSeasonId);
    }

    await db
      .insert(schema.standings)
      .values({
        competitionSeasonId: compSeasonId,
        teamId,
        position: row.rank,
        played: row.all.played,
        won: row.all.win,
        drawn: row.all.draw,
        lost: row.all.lose,
        goalsFor: row.all.goals.for,
        goalsAgainst: row.all.goals.against,
        goalDifference: row.goalsDiff,
        points: row.points,
        form: row.form || null,
      })
      .onConflictDoUpdate({
        target: [schema.standings.competitionSeasonId, schema.standings.teamId],
        set: {
          position: row.rank,
          played: row.all.played,
          won: row.all.win,
          drawn: row.all.draw,
          lost: row.all.lose,
          goalsFor: row.all.goals.for,
          goalsAgainst: row.all.goals.against,
          goalDifference: row.goalsDiff,
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
// SYNC: MATCHES (fixtures)
// ============================================================

async function syncMatches(
  league: LeagueConfig,
  compSeasonId: string,
  teamIdMap: Map<number, string>
) {
  const data = await apiFetch(`/fixtures?league=${league.apiId}&season=${league.season}`);

  let count = 0;
  for (const entry of data.response || []) {
    const fixture = entry.fixture;
    const teams = entry.teams;
    const goals = entry.goals;

    const homeTeamId = teamIdMap.get(teams.home.id);
    const awayTeamId = teamIdMap.get(teams.away.id);
    if (!homeTeamId || !awayTeamId) continue;

    const extId = afId(fixture.id);
    const scheduledAt = new Date(fixture.date);

    await db
      .insert(schema.matches)
      .values({
        externalId: extId,
        competitionSeasonId: compSeasonId,
        homeTeamId,
        awayTeamId,
        matchday: entry.league.round ? parseInt(entry.league.round.replace(/\D/g, "")) || null : null,
        scheduledAt,
        status: mapMatchStatus(fixture.status.short),
        homeScore: goals.home ?? null,
        awayScore: goals.away ?? null,
        referee: fixture.referee || null,
      })
      .onConflictDoUpdate({
        target: schema.matches.externalId,
        set: {
          scheduledAt,
          status: mapMatchStatus(fixture.status.short),
          homeScore: goals.home ?? null,
          awayScore: goals.away ?? null,
          referee: fixture.referee || null,
          updatedAt: new Date(),
        },
      });

    count++;
  }

  console.log(`   Matches: ${count}`);
}

// ============================================================
// SYNC: TOP SCORERS
// ============================================================

async function syncScorers(
  league: LeagueConfig,
  compSeasonId: string,
  teamIdMap: Map<number, string>
) {
  const data = await apiFetch(`/players/topscorers?league=${league.apiId}&season=${league.season}`);

  let count = 0;
  for (const entry of data.response || []) {
    const apiPlayer = entry.player;
    const stats = entry.statistics?.[0];
    if (!stats) continue;

    const teamApiId = stats.team?.id;
    let teamId = teamIdMap.get(teamApiId);
    if (!teamId) continue;

    // Upsert player (may already exist from squad sync)
    const extId = afId(apiPlayer.id);
    const playerSlug = slugify(apiPlayer.name);

    let player: typeof schema.players.$inferSelect | null = null;

    // Find existing
    const [byExtId] = await db
      .select()
      .from(schema.players)
      .where(eq(schema.players.externalId, extId))
      .limit(1);

    if (byExtId) {
      // Update with richer data from scorers endpoint
      const [updated] = await db
        .update(schema.players)
        .set({
          nationality: apiPlayer.nationality || byExtId.nationality,
          imageUrl: apiPlayer.photo || byExtId.imageUrl,
          heightCm: apiPlayer.height ? parseInt(apiPlayer.height) || null : byExtId.heightCm,
          dateOfBirth: apiPlayer.birth?.date || byExtId.dateOfBirth,
          updatedAt: new Date(),
        })
        .where(eq(schema.players.id, byExtId.id))
        .returning();
      player = updated;
    } else {
      // Try slug match
      const [bySlug] = await db
        .select()
        .from(schema.players)
        .where(eq(schema.players.slug, playerSlug))
        .limit(1);

      if (bySlug) {
        const updates: any = {
          nationality: apiPlayer.nationality || bySlug.nationality,
          imageUrl: apiPlayer.photo || bySlug.imageUrl,
          heightCm: apiPlayer.height ? parseInt(apiPlayer.height) || null : bySlug.heightCm,
          dateOfBirth: apiPlayer.birth?.date || bySlug.dateOfBirth,
          updatedAt: new Date(),
        };
        if (!bySlug.externalId) updates.externalId = extId;
        const [updated] = await db
          .update(schema.players)
          .set(updates)
          .where(eq(schema.players.id, bySlug.id))
          .returning();
        player = updated;
      } else {
        // Create new
        try {
          const [inserted] = await db
            .insert(schema.players)
            .values({
              externalId: extId,
              name: apiPlayer.name,
              knownAs: apiPlayer.name.split(" ").pop() || null,
              slug: playerSlug,
              nationality: apiPlayer.nationality || null,
              position: mapPosition(stats.games?.position) || "Unknown",
              status: "active",
              imageUrl: apiPlayer.photo || null,
              heightCm: apiPlayer.height ? parseInt(apiPlayer.height) || null : null,
              dateOfBirth: apiPlayer.birth?.date || null,
            })
            .onConflictDoUpdate({
              target: schema.players.externalId,
              set: {
                nationality: apiPlayer.nationality || null,
                imageUrl: apiPlayer.photo || null,
                updatedAt: new Date(),
              },
            })
            .returning();
          player = inserted;
        } catch {
          console.log(`   ! Skipping scorer: ${apiPlayer.name}`);
          continue;
        }
      }
    }

    if (!player) continue;

    // Upsert player_season_stats
    await db
      .insert(schema.playerSeasonStats)
      .values({
        playerId: player.id,
        teamId,
        competitionSeasonId: compSeasonId,
        appearances: stats.games?.appearences || 0,
        goals: stats.goals?.total || 0,
        assists: stats.goals?.assists || 0,
        yellowCards: stats.cards?.yellow || 0,
        redCards: stats.cards?.red || 0,
        minutesPlayed: stats.games?.minutes || 0,
      })
      .onConflictDoUpdate({
        target: [
          schema.playerSeasonStats.playerId,
          schema.playerSeasonStats.teamId,
          schema.playerSeasonStats.competitionSeasonId,
        ],
        set: {
          appearances: stats.games?.appearences || 0,
          goals: stats.goals?.total || 0,
          assists: stats.goals?.assists || 0,
          yellowCards: stats.cards?.yellow || 0,
          redCards: stats.cards?.red || 0,
          minutesPlayed: stats.games?.minutes || 0,
          updatedAt: new Date(),
        },
      });

    count++;
  }

  console.log(`   Scorers: ${count}`);
}

// ============================================================
// FULL SYNC: one league
// ============================================================

async function syncLeagueFull(league: LeagueConfig) {
  console.log(`\n== ${league.name} (af-${league.apiId}) ==`);

  // 1. Ensure season
  const season = await ensureSeason(league.season);

  // 2. Upsert competition
  const competition = await upsertCompetition(league);
  console.log(`   Competition: ${competition.name} (${competition.slug})`);

  // 3. Competition-season link
  const compSeason = await upsertCompetitionSeason(competition.id, season.id);

  // 4. Teams
  let teamIdMap: Map<number, string>;
  try {
    teamIdMap = await syncTeams(league, compSeason.id);
  } catch (err) {
    console.log(`   WARN: Teams failed: ${err}`);
    return;
  }

  // 5. Squads (players with images + shirt numbers)
  try {
    await syncSquads(teamIdMap);
  } catch (err) {
    console.log(`   WARN: Squads failed: ${err}`);
  }

  // 6. Standings
  try {
    await syncStandings(league, compSeason.id, teamIdMap);
  } catch (err) {
    console.log(`   WARN: Standings failed: ${err}`);
  }

  // 7. Matches
  try {
    await syncMatches(league, compSeason.id, teamIdMap);
  } catch (err) {
    console.log(`   WARN: Matches failed: ${err}`);
  }

  // 8. Top scorers
  try {
    await syncScorers(league, compSeason.id, teamIdMap);
  } catch (err) {
    console.log(`   WARN: Scorers failed: ${err}`);
  }

  console.log(`   Done: ${league.name}`);
}

// ============================================================
// STANDINGS-ONLY SYNC
// ============================================================

async function syncStandingsOnly(leagues: LeagueConfig[]) {
  for (const league of leagues) {
    if (!canMakeRequest()) {
      console.log(`Budget exhausted — stopping`);
      break;
    }

    console.log(`\n== ${league.name} (standings only) ==`);

    const season = await ensureSeason(league.season);
    const competition = await upsertCompetition(league);
    const compSeason = await upsertCompetitionSeason(competition.id, season.id);

    // We need the team map for standings
    // First check if we already have teams for this league
    const existingTeamSeasons = await db
      .select({
        teamId: schema.teamSeasons.teamId,
      })
      .from(schema.teamSeasons)
      .where(eq(schema.teamSeasons.competitionSeasonId, compSeason.id));

    // Build a reverse map: we'll need to create teams from standings data
    const teamIdMap = new Map<number, string>();

    try {
      await syncStandings(league, compSeason.id, teamIdMap);
    } catch (err) {
      console.log(`   WARN: Standings failed: ${err}`);
    }
  }
}

// ============================================================
// ENRICH MODE: fill player images from squad data
// ============================================================

async function enrichPlayerImages(targetLeagues: LeagueConfig[]) {
  console.log("\n== Enriching player images ==\n");

  let totalEnriched = 0;

  for (const league of targetLeagues) {
    if (!canMakeRequest()) {
      console.log(`Budget exhausted — stopping enrichment`);
      break;
    }

    console.log(`\n-- ${league.name} --`);

    // Fetch teams from API-Football for this league (1 request)
    const teamsData = await apiFetch(`/teams?league=${league.apiId}&season=${league.season}`);
    const apiTeams = teamsData.response || [];
    console.log(`   API returned ${apiTeams.length} teams`);

    // Match each API team to our DB and build a map: apiTeamId → dbTeamId
    const teamsToEnrich: Array<{ apiTeamId: number; dbTeamId: string; name: string }> = [];

    // Manual alias map for teams whose API names don't match DB slugs
    const TEAM_SLUG_ALIASES: Record<string, string> = {
      "wolves": "wolverhampton-wanderers-fc",
      "celta-vigo": "rc-celta-de-vigo",
      "alaves": "deportivo-alaves",
      "leganes": "cd-leganes",
      "bayer-leverkusen": "bayer-04-leverkusen",
      "saint-etienne": "as-saint-etienne",
      "sc-braga": "sporting-clube-de-braga",
      "famalicao": "fc-famalicao",
      "rennes": "stade-rennais-fc",
      "guimaraes": "vitoria-sc",
    };

    for (const entry of apiTeams) {
      const apiTeam = entry.team;
      const teamSlug = slugify(apiTeam.name);

      // Try matching: alias → af-externalId → exact slug → prefix slug → contains slug → name → shortName
      let dbTeam: { id: string } | undefined;

      // 1. Manual alias map
      const aliasSlug = TEAM_SLUG_ALIASES[teamSlug];
      if (aliasSlug) {
        const [byAlias] = await db.select().from(schema.teams)
          .where(eq(schema.teams.slug, aliasSlug)).limit(1);
        if (byAlias) dbTeam = byAlias;
      }

      // 2. af- externalId
      if (!dbTeam) {
        const [byAfId] = await db.select().from(schema.teams)
          .where(eq(schema.teams.externalId, afId(apiTeam.id))).limit(1);
        if (byAfId) { dbTeam = byAfId; }
      }

      // 3. Exact slug
      if (!dbTeam) {
        const [bySlug] = await db.select().from(schema.teams)
          .where(eq(schema.teams.slug, teamSlug)).limit(1);
        if (bySlug) dbTeam = bySlug;
      }

      // 4. Prefix slug match (e.g. "arsenal" matches "arsenal-fc")
      if (!dbTeam) {
        const [byPartialSlug] = await db.select().from(schema.teams)
          .where(drizzleSql`${schema.teams.slug} LIKE ${teamSlug + '%'}`)
          .limit(1);
        if (byPartialSlug) dbTeam = byPartialSlug;
      }

      // 5. Contains slug match (e.g. "leverkusen" matches "bayer-04-leverkusen")
      if (!dbTeam) {
        const [byContainsSlug] = await db.select().from(schema.teams)
          .where(drizzleSql`${schema.teams.slug} LIKE ${'%' + teamSlug + '%'}`)
          .limit(1);
        if (byContainsSlug) dbTeam = byContainsSlug;
      }

      // 6. Name contains (e.g. "Arsenal" matches "Arsenal FC")
      if (!dbTeam) {
        const [byName] = await db.select().from(schema.teams)
          .where(drizzleSql`${schema.teams.name} ILIKE ${'%' + apiTeam.name + '%'}`)
          .limit(1);
        if (byName) dbTeam = byName;
      }

      // 7. Short name match (e.g. "Wolves" matches shortName "Wolverhampton")
      if (!dbTeam) {
        const [byShortName] = await db.select().from(schema.teams)
          .where(drizzleSql`${schema.teams.shortName} ILIKE ${'%' + apiTeam.name + '%'}`)
          .limit(1);
        if (byShortName) dbTeam = byShortName;
      }

      if (!dbTeam) {
        console.log(`   ? No match for: ${apiTeam.name} (${teamSlug})`);
        continue;
      }

      // Check if this team has players missing images
      const needsImages = await db.execute(drizzleSql`
        SELECT 1 FROM players p
        JOIN player_team_history pth ON pth.player_id = p.id
          AND pth.team_id = ${dbTeam.id} AND pth.valid_to IS NULL
        WHERE p.image_url IS NULL
        LIMIT 1
      `);

      if (needsImages.rows.length > 0) {
        teamsToEnrich.push({ apiTeamId: apiTeam.id, dbTeamId: dbTeam.id, name: apiTeam.name });
      }
    }

    console.log(`   ${teamsToEnrich.length} teams need player image enrichment`);

    // Fetch squads for teams that need enrichment
    for (const team of teamsToEnrich) {
      if (!canMakeRequest()) {
        console.log(`   Budget exhausted — stopping`);
        break;
      }

      const data = await apiFetch(`/players/squads?team=${team.apiTeamId}`);
      let enriched = 0;

      for (const teamEntry of data.response || []) {
        for (const apiPlayer of teamEntry.players || []) {
          if (!apiPlayer.photo) continue;

          // Try to match player and update image
          const player = await upsertPlayer(apiPlayer, team.dbTeamId);
          if (player) enriched++;
        }
      }

      console.log(`   ${team.name}: ${enriched} players enriched`);
      totalEnriched += enriched;
    }
  }

  console.log(`\nTotal enriched: ${totalEnriched} players`);
}

// ============================================================
// SEARCH INDEX REFRESH
// ============================================================

async function refreshSearchIndex() {
  console.log("\n== Refreshing search index ==");

  const [players, teams, competitions, venues] = await Promise.all([
    db.select().from(schema.players),
    db.select().from(schema.teams),
    db.select().from(schema.competitions),
    db.select().from(schema.venues),
  ]);

  console.log(
    `Found: ${players.length} players, ${teams.length} teams, ${competitions.length} competitions, ${venues.length} venues`
  );

  await db.execute(drizzleSql`TRUNCATE TABLE search_index`);

  const searchEntries = [
    ...players.map((p) => ({
      id: p.id,
      entityType: "player" as const,
      slug: p.slug,
      name: p.name,
      subtitle: p.nationality,
      meta: p.position,
    })),
    ...teams.map((t) => ({
      id: t.id,
      entityType: "team" as const,
      slug: t.slug,
      name: t.name,
      subtitle: t.country,
      meta: t.city,
    })),
    ...competitions.map((c) => ({
      id: c.id,
      entityType: "competition" as const,
      slug: c.slug,
      name: c.name,
      subtitle: c.country,
      meta: c.type,
    })),
    ...venues.map((v) => ({
      id: v.id,
      entityType: "venue" as const,
      slug: v.slug,
      name: v.name,
      subtitle: v.city,
      meta: v.country,
    })),
  ];

  const BATCH_SIZE = 500;
  for (let i = 0; i < searchEntries.length; i += BATCH_SIZE) {
    const batch = searchEntries.slice(i, i + BATCH_SIZE);
    await db.insert(schema.searchIndex).values(batch);
  }

  console.log(`Search index: ${searchEntries.length} entries`);
}

// ============================================================
// CLI
// ============================================================

async function main() {
  const args = process.argv.slice(2);

  console.log("API-Football Sync");
  console.log("=".repeat(50));

  if (args.includes("--standings")) {
    // LATAM leagues only
    const latamLeagues = LEAGUES.filter((l) => l.isLatam);
    console.log(`Syncing standings for ${latamLeagues.length} LATAM leagues...\n`);
    await syncStandingsOnly(latamLeagues);
    await refreshSearchIndex();
    console.log(`\nRequests used: ${requestCount}/${MAX_REQUESTS}`);
    return;
  }

  if (args.includes("--all-standings")) {
    console.log(`Syncing standings for all ${LEAGUES.length} leagues...\n`);
    await syncStandingsOnly(LEAGUES);
    await refreshSearchIndex();
    console.log(`\nRequests used: ${requestCount}/${MAX_REQUESTS}`);
    return;
  }

  if (args.includes("--full")) {
    const slugArg = args.find((a) => a.startsWith("--slug="));
    if (!slugArg) {
      console.error("Usage: --full --slug=liga-profesional-argentina");
      console.error("Available leagues:");
      LEAGUES.forEach((l) => console.error(`  ${l.slug} (af-${l.apiId})`));
      process.exit(1);
    }
    const slug = slugArg.split("=")[1];
    const league = LEAGUES.find((l) => l.slug === slug);
    if (!league) {
      console.error(`Unknown slug: ${slug}`);
      console.error("Available:", LEAGUES.map((l) => l.slug).join(", "));
      process.exit(1);
    }

    await syncLeagueFull(league);
    await refreshSearchIndex();
    console.log(`\nRequests used: ${requestCount}/${MAX_REQUESTS}`);
    return;
  }

  if (args.includes("--enrich")) {
    const slugArg = args.find((a) => a.startsWith("--slug="));
    let targetLeagues: LeagueConfig[];
    if (slugArg) {
      const slug = slugArg.split("=")[1];
      const league = LEAGUES.find((l) => l.slug === slug);
      if (!league) {
        console.error(`Unknown slug: ${slug}`);
        console.error("Available:", LEAGUES.map((l) => l.slug).join(", "));
        process.exit(1);
      }
      targetLeagues = [league];
    } else {
      // Default: all non-LATAM leagues (European leagues that need enrichment)
      targetLeagues = LEAGUES.filter((l) => !l.isLatam);
    }
    console.log(`Enriching ${targetLeagues.length} leagues: ${targetLeagues.map((l) => l.slug).join(", ")}\n`);
    await enrichPlayerImages(targetLeagues);
    console.log(`\nRequests used: ${requestCount}/${MAX_REQUESTS}`);
    return;
  }

  console.log("Usage:");
  console.log("  --standings                        Sync LATAM league standings (~3-4 req)");
  console.log("  --all-standings                    Sync all league standings (~11 req)");
  console.log("  --full --slug=<slug>               Full sync one league (~24 req)");
  console.log("  --enrich                           Enrich European league player images (~21 req/league)");
  console.log("  --enrich --slug=<slug>             Enrich one league's player images");
  console.log("\nAvailable leagues:");
  LEAGUES.forEach((l) => console.log(`  ${l.slug} (af-${l.apiId}) ${l.isLatam ? "[LATAM]" : ""}`));
  process.exit(1);
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
