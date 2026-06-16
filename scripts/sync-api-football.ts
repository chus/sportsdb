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
import { eq, sql as drizzleSql, and, isNull, inArray, notInArray } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { buildMatchSlug } from "../src/lib/utils/match-slug";
import { resolveMatch, resolvePlayer, resolveTeam } from "../src/lib/ingestion/resolve";

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

const MAX_REQUESTS = 7000; // Hard cap (Pro tier = 7,500/day)
let requestCount = 0;

function canMakeRequest(): boolean {
  return requestCount < MAX_REQUESTS;
}

// ============================================================
// RATE LIMITING
// ============================================================

const RATE_LIMIT_MS = 250; // Pro tier: 300 req/min — 250ms keeps headroom
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

// Pro tier (paid 2026-06): all seasons available, 7,500 req/day.
// European leagues: season 2025 = the 2025/26 campaign.
// Calendar-year leagues (LATAM, MLS): season 2026.
const LEAGUES: LeagueConfig[] = [
  // LATAM — primary targets (not covered by football-data.org free tier)
  { slug: "liga-profesional-argentina", apiId: 128, season: 2026, country: "Argentina", name: "Liga Profesional Argentina", type: "league", isLatam: true },
  { slug: "liga-mx", apiId: 262, season: 2026, country: "Mexico", name: "Liga MX", type: "league", isLatam: true },
  { slug: "mls", apiId: 253, season: 2026, country: "USA", name: "Major League Soccer", type: "league", isLatam: true },
  // Already synced from football-data.org — API-Football used for enrichment only
  { slug: "brasileirao-serie-a", apiId: 71, season: 2026, country: "Brazil", name: "Brasileirão Série A", type: "league", isLatam: true },
  { slug: "premier-league", apiId: 39, season: 2025, country: "England", name: "Premier League", type: "league", isLatam: false },
  { slug: "la-liga", apiId: 140, season: 2025, country: "Spain", name: "La Liga", type: "league", isLatam: false },
  { slug: "bundesliga", apiId: 78, season: 2025, country: "Germany", name: "Bundesliga", type: "league", isLatam: false },
  { slug: "serie-a", apiId: 135, season: 2025, country: "Italy", name: "Serie A", type: "league", isLatam: false },
  { slug: "ligue-1", apiId: 61, season: 2025, country: "France", name: "Ligue 1", type: "league", isLatam: false },
  { slug: "eredivisie", apiId: 88, season: 2025, country: "Netherlands", name: "Eredivisie", type: "league", isLatam: false },
  { slug: "primeira-liga", apiId: 94, season: 2025, country: "Portugal", name: "Primeira Liga", type: "league", isLatam: false },
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

async function ensureSeason(
  year: number,
  isCalendarYear = false,
): Promise<typeof schema.seasons.$inferSelect> {
  // The "season" param in API-Football is the start year. European
  // leagues span two calendar years (2025 → "2025/26", Jul–Jun);
  // LATAM/MLS run a single calendar year (2026 → "2026", Jan–Dec).
  //
  // Getting this wrong is what created a bogus "2026/27" season marked
  // current with a *future* start date — the data-health canary caught
  // it. Label, bounds, and the is_current flag must all match the
  // league's real calendar.
  const europeanLabel = `${year}/${String(year + 1).slice(2)}`;
  const calendarLabel = `${year}`;
  const label = isCalendarYear ? calendarLabel : europeanLabel;
  const startDate = isCalendarYear ? `${year}-01-01` : `${year}-07-01`;
  const endDate = isCalendarYear ? `${year}-12-31` : `${year + 1}-06-30`;

  // Try the canonical label, then the other format (in case a prior run
  // created it under the wrong convention).
  const altLabel = isCalendarYear ? europeanLabel : calendarLabel;
  let [existing] = await db
    .select()
    .from(schema.seasons)
    .where(eq(schema.seasons.label, label))
    .limit(1);
  if (existing) return existing;

  [existing] = await db
    .select()
    .from(schema.seasons)
    .where(eq(schema.seasons.label, altLabel))
    .limit(1);
  if (existing) return existing;

  // Only mark the new season current if today actually falls inside it.
  // Never blindly set is_current on a freshly created (possibly future)
  // season — that was the original bug.
  const today = new Date().toISOString().slice(0, 10);
  const isCurrent = startDate <= today && today <= endDate;

  const [inserted] = await db
    .insert(schema.seasons)
    .values({ label, startDate, endDate, isCurrent })
    .onConflictDoNothing()
    .returning();

  if (inserted) {
    console.log(`   + Season: ${label}${isCurrent ? " (current)" : ""}`);
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
  const logoUrl = `https://media.api-sports.io/football/leagues/${league.apiId}.png`;

  // 1. Find existing by externalId
  const [byExtId] = await db
    .select()
    .from(schema.competitions)
    .where(eq(schema.competitions.externalId, extId))
    .limit(1);

  if (byExtId) {
    // Update but NEVER overwrite slug. Set logo only if missing.
    const [updated] = await db
      .update(schema.competitions)
      .set({
        name: league.name,
        country: league.country,
        type: league.type,
        logoUrl: byExtId.logoUrl || logoUrl,
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
      logoUrl: bySlug.logoUrl || logoUrl,
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
      logoUrl,
      description: `${league.name} - ${league.country}`,
    })
    .onConflictDoUpdate({
      target: schema.competitions.externalId,
      set: {
        name: league.name,
        country: league.country,
        type: league.type,
        logoUrl,
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
  // Identity-first: the external_ids mapping table is the steady-state
  // path (one entity can hold both fd- and af- IDs; the single
  // external_id column can't). On mapping hit, refresh data fields and
  // return. On miss, run the legacy cascade once and record the mapping
  // so the next sync resolves by ID.
  const [mapped] = await db
    .select({ team: schema.teams })
    .from(schema.externalIds)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.externalIds.entityId))
    .where(
      and(
        eq(schema.externalIds.provider, "af"),
        eq(schema.externalIds.providerId, String(apiTeam.id)),
        eq(schema.externalIds.entityType, "team")
      )
    )
    .limit(1);

  if (mapped) {
    const [updated] = await db
      .update(schema.teams)
      .set({
        name: apiTeam.name,
        shortName: apiTeam.code || mapped.team.shortName,
        country,
        logoUrl: apiTeam.logo || mapped.team.logoUrl,
        foundedYear: apiTeam.founded || mapped.team.foundedYear,
        updatedAt: new Date(),
      })
      .where(eq(schema.teams.id, mapped.team.id))
      .returning();
    return updated;
  }

  // First contact: resolveTeam runs the smart matcher (exact name,
  // year-suffix strip, dot normalization, slugify, aliases) so
  // API-Football's short names ("Liverpool") land on the canonical row
  // ("Liverpool FC") instead of spawning a duplicate — the old
  // slug/exact-name cascade here created 28 duplicate teams that had to
  // be merged back. resolveTeam also records the af mapping.
  const resolved = await resolveTeam(sql, "af", apiTeam.id, apiTeam.name, {
    shortName: apiTeam.code || null,
    country,
    logoUrl: apiTeam.logo || null,
  });
  if (!resolved) throw new Error(`unresolvable team: ${apiTeam.name}`);

  const [row] = await db
    .update(schema.teams)
    .set({
      logoUrl: apiTeam.logo || undefined,
      foundedYear: apiTeam.founded || undefined,
      updatedAt: new Date(),
    })
    .where(eq(schema.teams.id, resolved.id))
    .returning();
  return row;
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
  // Identity-first via the external_ids mapping table; see upsertTeam.
  const [mapped] = await db
    .select({ player: schema.players })
    .from(schema.externalIds)
    .innerJoin(schema.players, eq(schema.players.id, schema.externalIds.entityId))
    .where(
      and(
        eq(schema.externalIds.provider, "af"),
        eq(schema.externalIds.providerId, String(apiPlayer.id)),
        eq(schema.externalIds.entityType, "player")
      )
    )
    .limit(1);

  if (mapped) {
    const updates: any = {
      imageUrl: apiPlayer.photo || mapped.player.imageUrl,
      position: mapPosition(apiPlayer.position) || mapped.player.position,
      updatedAt: new Date(),
    };
    if (apiPlayer.age && !mapped.player.dateOfBirth) {
      const approxYear = new Date().getFullYear() - apiPlayer.age;
      updates.dateOfBirth = `${approxYear}-01-01`;
    }
    const [updated] = await db
      .update(schema.players)
      .set(updates)
      .where(eq(schema.players.id, mapped.player.id))
      .returning();
    if (apiPlayer.number) {
      await upsertPlayerTeamLink(updated.id, teamId, apiPlayer.number);
    }
    return updated;
  }

  const row = await upsertPlayerLegacy(apiPlayer, teamId);
  if (row) {
    await db
      .insert(schema.externalIds)
      .values({ entityType: "player", entityId: row.id, provider: "af", providerId: String(apiPlayer.id) })
      .onConflictDoNothing();
  }
  return row;
}

async function upsertPlayerLegacy(
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
  const freshTeamIds = new Set<string>();
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
    freshTeamIds.add(teamId);

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

  // Drop stale rows: any standings row for this competition_season whose
  // team isn't in the fresh payload. Without this, upsert-only writes let
  // old-provider rows and wrong-league contamination accumulate forever
  // (e.g. a relegated team's row, or two providers' rows at conflicting
  // positions after an identity change). This is what left SS Lazio /
  // Club Necaxa sitting in the Eredivisie table and produced duplicate
  // standings positions the data-health canary flags.
  if (freshTeamIds.size > 0) {
    const keep = [...freshTeamIds];
    const deleted = await db
      .delete(schema.standings)
      .where(
        and(
          eq(schema.standings.competitionSeasonId, compSeasonId),
          notInArray(schema.standings.teamId, keep),
        ),
      )
      .returning({ id: schema.standings.id });
    if (deleted.length > 0) console.log(`   Standings: dropped ${deleted.length} stale rows`);
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

  // Look up slugs for all teams in this league once.
  const teamDbIds = Array.from(teamIdMap.values());
  const teamSlugRows = teamDbIds.length
    ? await db
        .select({ id: schema.teams.id, slug: schema.teams.slug })
        .from(schema.teams)
        .where(inArray(schema.teams.id, teamDbIds))
    : [];
  const slugById = new Map(teamSlugRows.map((r) => [r.id, r.slug]));

  let count = 0;
  for (const entry of data.response || []) {
    const fixture = entry.fixture;
    const teams = entry.teams;
    const goals = entry.goals;

    const homeTeamId = teamIdMap.get(teams.home.id);
    const awayTeamId = teamIdMap.get(teams.away.id);
    if (!homeTeamId || !awayTeamId) continue;

    const scheduledAt = new Date(fixture.date);

    // Identity-first: the same real-world fixture also arrives from
    // football-data with an unrelated ID. resolveMatch finds it via the
    // af mapping or the natural key (home, away, kickoff ±1d) and
    // records the mapping; keying inserts on external_id alone created
    // duplicate match rows for every fixture both providers covered.
    const existing = await resolveMatch(
      sql, "af", fixture.id, homeTeamId, awayTeamId, scheduledAt,
    );

    if (existing) {
      await db
        .update(schema.matches)
        .set({
          scheduledAt,
          status: mapMatchStatus(fixture.status.short),
          homeScore: goals.home ?? null,
          awayScore: goals.away ?? null,
          referee: fixture.referee || null,
          updatedAt: new Date(),
        })
        .where(eq(schema.matches.id, existing.id));
      count++;
      continue;
    }

    // Genuinely new fixture (e.g. league only covered by API-Football).
    // matches.slug is NOT NULL — skip rather than insert a slug-less row.
    const homeSlug = slugById.get(homeTeamId);
    const awaySlug = slugById.get(awayTeamId);
    if (!homeSlug || !awaySlug) continue;
    const matchSlug = buildMatchSlug(homeSlug, awaySlug, scheduledAt);

    const [inserted] = await db
      .insert(schema.matches)
      .values({
        externalId: afId(fixture.id),
        slug: matchSlug,
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
      .onConflictDoNothing({ target: schema.matches.slug })
      .returning({ id: schema.matches.id });

    if (inserted) {
      await db
        .insert(schema.externalIds)
        .values({ entityType: "match", entityId: inserted.id, provider: "af", providerId: String(fixture.id) })
        .onConflictDoNothing();
    }

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
  const season = await ensureSeason(league.season, league.isLatam);

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

    const season = await ensureSeason(league.season, league.isLatam);
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
// SYNC: FULL PER-PLAYER SEASON STATS (Pro tier)
// ============================================================
// /players?league&season returns EVERY player with a full stat line
// (appearances, minutes, goals, assists, cards, rating) — versus the
// top-100 scorers that football-data.org caps us at. ~30-60 pages per
// league at 20 players/page.

async function getCurrentCompSeasonId(slug: string): Promise<string | null> {
  const rows = await sql`
    SELECT cs.id FROM competition_seasons cs
    JOIN competitions c ON c.id = cs.competition_id
    JOIN seasons s ON s.id = cs.season_id
    WHERE c.slug = ${slug} AND s.is_current = true
    LIMIT 1
  `;
  return (rows[0] as { id: string } | undefined)?.id ?? null;
}

async function syncPlayerStats(league: LeagueConfig) {
  console.log(`\n=== Player stats: ${league.name} ===`);
  const compSeasonId = await getCurrentCompSeasonId(league.slug);
  if (!compSeasonId) {
    console.warn(`   no current competition_season for ${league.slug}, skipping`);
    return;
  }

  let page = 1;
  let totalPages = 1;
  let upserted = 0;
  let missed = 0;

  do {
    const data = await apiFetch(`/players?league=${league.apiId}&season=${league.season}&page=${page}`);
    totalPages = data.paging?.total ?? 1;

    for (const entry of data.response || []) {
      const ap = entry.player;
      const stats = (entry.statistics || []).find((st: any) => st?.league?.id === league.apiId) ?? entry.statistics?.[0];
      if (!ap?.id || !stats?.team?.id) continue;

      const team = await resolveTeam(sql, "af", stats.team.id, stats.team.name);
      if (!team) { missed++; continue; }

      const player = await resolvePlayer(sql, "af", ap.id, ap.name, {
        position: mapPosition(stats.games?.position) || "Unknown",
        nationality: ap.nationality ?? null,
        imageUrl: ap.photo ?? null,
      });
      if (!player) { missed++; continue; }

      // Backfill photo for existing players that lack one.
      if (ap.photo) {
        await sql`UPDATE players SET image_url = ${ap.photo}, updated_at = NOW() WHERE id = ${player.id} AND image_url IS NULL`;
      }

      await sql`
        INSERT INTO player_season_stats (
          player_id, team_id, competition_season_id,
          appearances, goals, assists, yellow_cards, red_cards, minutes_played, clean_sheets,
          updated_at
        ) VALUES (
          ${player.id}, ${team.id}, ${compSeasonId},
          ${stats.games?.appearences ?? 0}, ${stats.goals?.total ?? 0}, ${stats.goals?.assists ?? 0},
          ${stats.cards?.yellow ?? 0}, ${stats.cards?.red ?? 0}, ${stats.games?.minutes ?? 0}, 0,
          NOW()
        )
        ON CONFLICT (player_id, team_id, competition_season_id)
        DO UPDATE SET
          appearances = EXCLUDED.appearances,
          goals = EXCLUDED.goals,
          assists = EXCLUDED.assists,
          yellow_cards = EXCLUDED.yellow_cards,
          red_cards = EXCLUDED.red_cards,
          minutes_played = EXCLUDED.minutes_played,
          updated_at = NOW()
      `;
      upserted++;
    }
    page++;
  } while (page <= totalPages);

  console.log(`   stats upserted: ${upserted}, missed: ${missed}`);
}

// ============================================================
// SYNC: LINEUPS + EVENTS PER FIXTURE (Pro tier)
// ============================================================
// Fills the match-page slots that have never had data: formations,
// starting XIs, substitutions, goal/card timelines. 2 requests per
// finished fixture; fixtures that already have lineups are skipped so
// the daily incremental run only pays for new matches.

const EVENT_TYPE_MAP: Record<string, string> = {
  "Normal Goal": "goal",
  "Own Goal": "own_goal",
  "Penalty": "penalty",
  "Missed Penalty": "penalty_missed",
  "Yellow Card": "yellow_card",
  "Red Card": "red_card",
};

async function syncMatchDetails(league: LeagueConfig, force = false) {
  console.log(`\n=== Match details: ${league.name} ===`);

  const fixtures = (await sql`
    SELECT m.id, x.provider_id AS af_id,
      (SELECT count(*) FROM match_lineups ml WHERE ml.match_id = m.id) AS lineup_count
    FROM matches m
    JOIN external_ids x ON x.entity_id = m.id AND x.entity_type = 'match' AND x.provider = 'af'
    JOIN competition_seasons cs ON cs.id = m.competition_season_id
    JOIN competitions c ON c.id = cs.competition_id
    JOIN seasons s ON s.id = cs.season_id
    WHERE c.slug = ${league.slug} AND s.is_current = true AND m.status = 'finished'
    ORDER BY m.scheduled_at
  `) as Array<{ id: string; af_id: string; lineup_count: string }>;

  const pending = force ? fixtures : fixtures.filter((f) => Number(f.lineup_count) === 0);
  console.log(`   ${fixtures.length} finished fixtures with af mapping, ${pending.length} to process`);

  let lineupsDone = 0;
  let eventsDone = 0;

  for (const fx of pending) {
    // --- Lineups ---
    const lu = await apiFetch(`/fixtures/lineups?fixture=${fx.af_id}`);
    for (const side of lu.response || []) {
      const team = await resolveTeam(sql, "af", side.team.id, side.team.name);
      if (!team) continue;
      const everyone = [
        ...(side.startXI || []).map((x: any) => ({ ...x.player, starter: true })),
        ...(side.substitutes || []).map((x: any) => ({ ...x.player, starter: false })),
      ];
      for (const lp of everyone) {
        if (!lp?.id || !lp?.name) continue;
        const player = await resolvePlayer(sql, "af", lp.id, lp.name, {
          position: mapPosition(lp.pos) || "Unknown",
        });
        if (!player) continue;
        await sql`
          INSERT INTO match_lineups (match_id, team_id, player_id, shirt_number, position, is_starter)
          VALUES (${fx.id}, ${team.id}, ${player.id}, ${lp.number ?? null}, ${lp.pos ?? null}, ${lp.starter})
          ON CONFLICT (match_id, player_id) DO UPDATE SET
            shirt_number = EXCLUDED.shirt_number,
            position = EXCLUDED.position,
            is_starter = EXCLUDED.is_starter
        `;
      }
      lineupsDone++;
    }

    // --- Events (delete-then-insert: the feed is a full snapshot) ---
    const ev = await apiFetch(`/fixtures/events?fixture=${fx.af_id}`);
    const rows = ev.response || [];
    if (rows.length > 0) {
      await sql`DELETE FROM match_events WHERE match_id = ${fx.id}`;
      for (const e of rows) {
        let type: string | null = null;
        if (e.type === "Goal") type = EVENT_TYPE_MAP[e.detail] ?? "goal";
        else if (e.type === "Card") type = EVENT_TYPE_MAP[e.detail] ?? null;
        else if (e.type === "subst") type = "substitution";
        if (!type) continue; // VAR etc.

        const team = await resolveTeam(sql, "af", e.team.id, e.team.name);
        if (!team) continue;
        const player = e.player?.id
          ? await resolvePlayer(sql, "af", e.player.id, e.player.name ?? "Unknown")
          : null;
        const secondary = e.assist?.id
          ? await resolvePlayer(sql, "af", e.assist.id, e.assist.name ?? "Unknown")
          : null;

        await sql`
          INSERT INTO match_events (match_id, type, minute, added_time, team_id, player_id, secondary_player_id, description)
          VALUES (${fx.id}, ${type}, ${e.time?.elapsed ?? 0}, ${e.time?.extra ?? null}, ${team.id}, ${player?.id ?? null}, ${secondary?.id ?? null}, ${e.detail ?? null})
        `;
      }
      eventsDone++;
    }
  }

  console.log(`   lineups for ${lineupsDone} team-sides, events for ${eventsDone} fixtures`);
}

// ============================================================
// MATCH STATISTICS (possession, shots, passes, xG)
// ============================================================

// API-Football reports values as numbers, percent strings ("55%"), or
// null. Normalize to a number (drops the %); xG arrives as "1.50".
function parseStat(stats: Array<{ type: string; value: unknown }>, type: string): number | null {
  const s = stats.find((x) => x.type === type);
  if (!s || s.value == null) return null;
  if (typeof s.value === "number") return s.value;
  const n = parseFloat(String(s.value).replace("%", "").trim());
  return Number.isFinite(n) ? n : null;
}

async function syncMatchStats(league: LeagueConfig, force = false) {
  console.log(`\n=== Match statistics: ${league.name} ===`);

  const fixtures = (await sql`
    SELECT m.id, x.provider_id AS af_id,
      (SELECT count(*) FROM match_statistics ms WHERE ms.match_id = m.id) AS stat_count
    FROM matches m
    JOIN external_ids x ON x.entity_id = m.id AND x.entity_type = 'match' AND x.provider = 'af'
    JOIN competition_seasons cs ON cs.id = m.competition_season_id
    JOIN competitions c ON c.id = cs.competition_id
    JOIN seasons s ON s.id = cs.season_id
    WHERE c.slug = ${league.slug} AND s.is_current = true AND m.status = 'finished'
    ORDER BY m.scheduled_at
  `) as Array<{ id: string; af_id: string; stat_count: string }>;

  const pending = force ? fixtures : fixtures.filter((f) => Number(f.stat_count) === 0);
  console.log(`   ${fixtures.length} finished fixtures with af mapping, ${pending.length} to process`);

  let done = 0;
  for (const fx of pending) {
    if (!canMakeRequest()) {
      console.log(`   Budget exhausted — stopping`);
      break;
    }
    const res = await apiFetch(`/fixtures/statistics?fixture=${fx.af_id}`);
    for (const side of res.response || []) {
      const team = await resolveTeam(sql, "af", side.team.id, side.team.name);
      if (!team) continue;
      const st = (side.statistics || []) as Array<{ type: string; value: unknown }>;
      await sql`
        INSERT INTO match_statistics (
          match_id, team_id, possession, shots_total, shots_on_target, shots_off_target,
          blocked_shots, shots_inside_box, shots_outside_box, corners, fouls, offsides,
          yellow_cards, red_cards, goalkeeper_saves, passes_total, passes_accurate,
          pass_accuracy, expected_goals
        ) VALUES (
          ${fx.id}, ${team.id}, ${parseStat(st, "Ball Possession")}, ${parseStat(st, "Total Shots")},
          ${parseStat(st, "Shots on Goal")}, ${parseStat(st, "Shots off Goal")},
          ${parseStat(st, "Blocked Shots")}, ${parseStat(st, "Shots insidebox")},
          ${parseStat(st, "Shots outsidebox")}, ${parseStat(st, "Corner Kicks")},
          ${parseStat(st, "Fouls")}, ${parseStat(st, "Offsides")}, ${parseStat(st, "Yellow Cards")},
          ${parseStat(st, "Red Cards")}, ${parseStat(st, "Goalkeeper Saves")},
          ${parseStat(st, "Total passes")}, ${parseStat(st, "Passes accurate")},
          ${parseStat(st, "Passes %")}, ${parseStat(st, "expected_goals")}
        )
        ON CONFLICT (match_id, team_id) DO UPDATE SET
          possession = EXCLUDED.possession, shots_total = EXCLUDED.shots_total,
          shots_on_target = EXCLUDED.shots_on_target, shots_off_target = EXCLUDED.shots_off_target,
          blocked_shots = EXCLUDED.blocked_shots, shots_inside_box = EXCLUDED.shots_inside_box,
          shots_outside_box = EXCLUDED.shots_outside_box, corners = EXCLUDED.corners,
          fouls = EXCLUDED.fouls, offsides = EXCLUDED.offsides, yellow_cards = EXCLUDED.yellow_cards,
          red_cards = EXCLUDED.red_cards, goalkeeper_saves = EXCLUDED.goalkeeper_saves,
          passes_total = EXCLUDED.passes_total, passes_accurate = EXCLUDED.passes_accurate,
          pass_accuracy = EXCLUDED.pass_accuracy, expected_goals = EXCLUDED.expected_goals,
          updated_at = now()
      `;
    }
    done++;
  }
  console.log(`   statistics for ${done} fixtures`);
}

// ============================================================
// PLAYER MATCH STATS (per-player performance line per fixture)
// ============================================================

function numStat(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace("%", "").trim());
  return Number.isFinite(n) ? n : null;
}

async function syncPlayerMatchStats(league: LeagueConfig, force = false) {
  console.log(`\n=== Player match stats: ${league.name} ===`);

  const fixtures = (await sql`
    SELECT m.id, x.provider_id AS af_id,
      (SELECT count(*) FROM player_match_stats pms WHERE pms.match_id = m.id) AS stat_count
    FROM matches m
    JOIN external_ids x ON x.entity_id = m.id AND x.entity_type = 'match' AND x.provider = 'af'
    JOIN competition_seasons cs ON cs.id = m.competition_season_id
    JOIN competitions c ON c.id = cs.competition_id
    JOIN seasons s ON s.id = cs.season_id
    WHERE c.slug = ${league.slug} AND s.is_current = true AND m.status = 'finished'
    ORDER BY m.scheduled_at
  `) as Array<{ id: string; af_id: string; stat_count: string }>;

  const pending = force ? fixtures : fixtures.filter((f) => Number(f.stat_count) === 0);
  console.log(`   ${fixtures.length} finished fixtures with af mapping, ${pending.length} to process`);

  let done = 0;
  let playerRows = 0;
  for (const fx of pending) {
    if (!canMakeRequest()) {
      console.log(`   Budget exhausted — stopping`);
      break;
    }
    // One request returns every player's full line for both teams.
    const res = await apiFetch(`/fixtures/players?fixture=${fx.af_id}`);
    for (const side of res.response || []) {
      const team = await resolveTeam(sql, "af", side.team.id, side.team.name);
      if (!team) continue;
      for (const entry of side.players || []) {
        const ap = entry.player;
        const st = entry.statistics?.[0];
        if (!ap?.id || !st) continue;
        // Stats-only: never create a player here (an unknown player would
        // become a thin, un-indexable page). Record only known players.
        const player = await resolvePlayer(sql, "af", ap.id, ap.name ?? "Unknown");
        if (!player) continue;
        const g = st.games || {};
        // passes.accuracy is the COUNT of accurate passes (not a %).
        // Convert to a true percentage for display.
        const passTotal = numStat(st.passes?.total);
        const passAccurate = numStat(st.passes?.accuracy);
        const passAccPct =
          passTotal && passTotal > 0 && passAccurate != null
            ? Math.round((passAccurate / passTotal) * 100)
            : null;
        await sql`
          INSERT INTO player_match_stats (
            match_id, team_id, player_id, minutes, position, rating, captain, substitute,
            goals, assists, shots_total, shots_on_target, passes_total, key_passes, pass_accuracy,
            tackles_total, interceptions, duels_total, duels_won, dribbles_attempts, dribbles_success,
            fouls_drawn, fouls_committed, yellow_cards, red_cards
          ) VALUES (
            ${fx.id}, ${team.id}, ${player.id}, ${numStat(g.minutes)}, ${g.position ?? null},
            ${numStat(g.rating)}, ${!!g.captain}, ${!!g.substitute}, ${numStat(st.goals?.total)},
            ${numStat(st.goals?.assists)}, ${numStat(st.shots?.total)}, ${numStat(st.shots?.on)},
            ${passTotal}, ${numStat(st.passes?.key)}, ${passAccPct},
            ${numStat(st.tackles?.total)}, ${numStat(st.tackles?.interceptions)}, ${numStat(st.duels?.total)},
            ${numStat(st.duels?.won)}, ${numStat(st.dribbles?.attempts)}, ${numStat(st.dribbles?.success)},
            ${numStat(st.fouls?.drawn)}, ${numStat(st.fouls?.committed)}, ${numStat(st.cards?.yellow)},
            ${numStat(st.cards?.red)}
          )
          ON CONFLICT (match_id, player_id) DO UPDATE SET
            minutes = EXCLUDED.minutes, position = EXCLUDED.position, rating = EXCLUDED.rating,
            captain = EXCLUDED.captain, substitute = EXCLUDED.substitute, goals = EXCLUDED.goals,
            assists = EXCLUDED.assists, shots_total = EXCLUDED.shots_total,
            shots_on_target = EXCLUDED.shots_on_target, passes_total = EXCLUDED.passes_total,
            key_passes = EXCLUDED.key_passes, pass_accuracy = EXCLUDED.pass_accuracy,
            tackles_total = EXCLUDED.tackles_total, interceptions = EXCLUDED.interceptions,
            duels_total = EXCLUDED.duels_total, duels_won = EXCLUDED.duels_won,
            dribbles_attempts = EXCLUDED.dribbles_attempts, dribbles_success = EXCLUDED.dribbles_success,
            fouls_drawn = EXCLUDED.fouls_drawn, fouls_committed = EXCLUDED.fouls_committed,
            yellow_cards = EXCLUDED.yellow_cards, red_cards = EXCLUDED.red_cards, updated_at = now()
        `;
        playerRows++;
      }
    }
    done++;
  }
  console.log(`   player stats for ${done} fixtures, ${playerRows} player-rows`);
}

// ============================================================
// CLI
// ============================================================

async function main() {
  const args = process.argv.slice(2);

  console.log("API-Football Sync");
  console.log("=".repeat(50));

  const slugArg = args.find((a) => a.startsWith("--slug="))?.split("=")[1];

  if (args.includes("--player-stats")) {
    const targets = slugArg ? LEAGUES.filter((l) => l.slug === slugArg) : LEAGUES;
    for (const league of targets) await syncPlayerStats(league);
    console.log(`\nRequests used: ${requestCount}/${MAX_REQUESTS}`);
    return;
  }

  if (args.includes("--match-details")) {
    const targets = slugArg ? LEAGUES.filter((l) => l.slug === slugArg) : LEAGUES;
    for (const league of targets) await syncMatchDetails(league, args.includes("--force"));
    console.log(`\nRequests used: ${requestCount}/${MAX_REQUESTS}`);
    return;
  }

  if (args.includes("--match-stats")) {
    const targets = slugArg ? LEAGUES.filter((l) => l.slug === slugArg) : LEAGUES;
    for (const league of targets) await syncMatchStats(league, args.includes("--force"));
    console.log(`\nRequests used: ${requestCount}/${MAX_REQUESTS}`);
    return;
  }

  if (args.includes("--player-match-stats")) {
    const targets = slugArg ? LEAGUES.filter((l) => l.slug === slugArg) : LEAGUES;
    for (const league of targets) await syncPlayerMatchStats(league, args.includes("--force"));
    console.log(`\nRequests used: ${requestCount}/${MAX_REQUESTS}`);
    return;
  }

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
