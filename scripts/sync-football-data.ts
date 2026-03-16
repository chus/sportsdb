/**
 * Incremental Football-Data.org Sync Script
 *
 * Upserts data from football-data.org without clearing existing data.
 * Safe to run repeatedly — uses externalId for deduplication.
 *
 * Usage:
 *   npx tsx scripts/sync-football-data.ts --all
 *   npx tsx scripts/sync-football-data.ts --competition --slug=premier-league
 *   npx tsx scripts/sync-football-data.ts --live
 *
 * Free tier: 10 requests/minute, covers major leagues + cups
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";
import { eq, sql as drizzleSql } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

config({ path: ".env.local" });

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const BASE_URL = "https://api.football-data.org/v4";

if (!API_KEY) {
  console.error("Missing FOOTBALL_DATA_API_KEY in .env.local");
  console.error("Get your free key at: https://www.football-data.org/");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

// ============================================================
// RATE LIMITING
// ============================================================

const RATE_LIMIT_MS = 6500;
let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<any> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    const waitTime = RATE_LIMIT_MS - timeSinceLastRequest;
    console.log(`   Waiting ${Math.round(waitTime / 1000)}s (rate limit)...`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();

  const response = await fetch(url, {
    headers: { "X-Auth-Token": API_KEY! },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error ${response.status}: ${error}`);
  }

  return response.json();
}

// ============================================================
// COMPETITION CODES (free tier)
// ============================================================

const COMPETITIONS = [
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

function mapPosition(position: string | null): string {
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

function mapMatchStatus(status: string): string {
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

function fdId(apiId: number): string {
  return `fd-${apiId}`;
}

// ============================================================
// UPSERT: SEASON
// ============================================================

async function upsertCurrentSeason(
  apiSeason: any
): Promise<typeof schema.seasons.$inferSelect> {
  const startYear = parseInt(apiSeason.startDate.slice(0, 4));
  const endYear = parseInt(apiSeason.endDate.slice(0, 4));
  const label =
    startYear === endYear ? `${startYear}` : `${startYear}/${String(endYear).slice(2)}`;

  const existing = await db
    .select()
    .from(schema.seasons)
    .where(eq(schema.seasons.label, label))
    .limit(1);

  if (existing.length > 0) return existing[0];

  const [inserted] = await db
    .insert(schema.seasons)
    .values({
      label,
      startDate: apiSeason.startDate,
      endDate: apiSeason.endDate,
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
  apiComp: any,
  compMeta: (typeof COMPETITIONS)[number]
): Promise<typeof schema.competitions.$inferSelect> {
  const extId = fdId(apiComp.id);
  const compSlug = slugify(apiComp.name);
  const type =
    apiComp.type === "CUP"
      ? "cup"
      : apiComp.type === "LEAGUE"
        ? "league"
        : "international";

  // Try to find existing by slug (pre-existing data without externalId)
  const [existing] = await db
    .select()
    .from(schema.competitions)
    .where(eq(schema.competitions.slug, compSlug))
    .limit(1);

  if (existing) {
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
      .where(eq(schema.competitions.id, existing.id))
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
        slug: compSlug,
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

async function upsertCompetitionSeason(
  competitionId: string,
  seasonId: string
): Promise<typeof schema.competitionSeasons.$inferSelect> {
  const existing = await db
    .select()
    .from(schema.competitionSeasons)
    .where(eq(schema.competitionSeasons.competitionId, competitionId))
    .limit(1)
    .then((rows) => rows.filter((r) => r.seasonId === seasonId));

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

  // Fallback: read it back
  const [found] = await db
    .select()
    .from(schema.competitionSeasons)
    .where(eq(schema.competitionSeasons.competitionId, competitionId))
    .then((rows) => rows.filter((r) => r.seasonId === seasonId));
  return found;
}

// ============================================================
// UPSERT: TEAM + VENUE + PLAYERS + HISTORY
// ============================================================

async function upsertTeam(
  apiTeam: any
): Promise<typeof schema.teams.$inferSelect> {
  const extId = fdId(apiTeam.id);
  const teamSlug = slugify(apiTeam.name);

  // Try to find existing by slug (pre-existing data without externalId)
  const [existing] = await db
    .select()
    .from(schema.teams)
    .where(eq(schema.teams.slug, teamSlug))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(schema.teams)
      .set({
        externalId: extId,
        name: apiTeam.name,
        shortName: apiTeam.shortName || apiTeam.tla,
        country: apiTeam.area?.name || "Unknown",
        city: apiTeam.address?.split(",")[0] || null,
        foundedYear: apiTeam.founded,
        logoUrl: apiTeam.crest,
        primaryColor: apiTeam.clubColors?.split("/")[0]?.trim() || null,
        secondaryColor: apiTeam.clubColors?.split("/")[1]?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.teams.id, existing.id))
      .returning();
    return updated;
  }

  const [result] = await db
    .insert(schema.teams)
    .values({
      externalId: extId,
      name: apiTeam.name,
      shortName: apiTeam.shortName || apiTeam.tla,
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
        shortName: apiTeam.shortName || apiTeam.tla,
        slug: teamSlug,
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

async function upsertVenue(
  apiTeam: any
): Promise<string | null> {
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

async function upsertPlayer(
  apiPlayer: any
): Promise<typeof schema.players.$inferSelect | null> {
  const extId = fdId(apiPlayer.id);
  const playerSlug = slugify(apiPlayer.name);

  // Try to find existing by slug (pre-existing data without externalId)
  const [existing] = await db
    .select()
    .from(schema.players)
    .where(eq(schema.players.slug, playerSlug))
    .limit(1);

  if (existing) {
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
      .where(eq(schema.players.id, existing.id))
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
          slug: playerSlug,
          dateOfBirth: apiPlayer.dateOfBirth,
          nationality: apiPlayer.nationality,
          position: mapPosition(apiPlayer.position),
          updatedAt: new Date(),
        },
      })
      .returning();

    return result;
  } catch {
    // Slug conflict with a different player — append external id
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

async function linkTeamVenue(teamId: string, venueId: string) {
  await db
    .insert(schema.teamVenueHistory)
    .values({
      teamId,
      venueId,
      validFrom: "2020-01-01",
    })
    .onConflictDoNothing();
}

async function linkPlayerTeam(playerId: string, teamId: string) {
  await db
    .insert(schema.playerTeamHistory)
    .values({
      playerId,
      teamId,
      validFrom: "2024-01-01",
      transferType: "permanent",
    })
    .onConflictDoNothing();
}

async function linkTeamSeason(teamId: string, compSeasonId: string) {
  await db
    .insert(schema.teamSeasons)
    .values({
      teamId,
      competitionSeasonId: compSeasonId,
    })
    .onConflictDoNothing();
}

// ============================================================
// SYNC: TEAMS + SQUADS FOR A COMPETITION
// ============================================================

async function syncTeams(
  compCode: string,
  compSeasonId: string
): Promise<Map<number, string>> {
  const teamsData = await rateLimitedFetch(
    `${BASE_URL}/competitions/${compCode}/teams`
  );

  const apiIdToDbId = new Map<number, string>();

  for (const apiTeam of teamsData.teams || []) {
    const team = await upsertTeam(apiTeam);
    apiIdToDbId.set(apiTeam.id, team.id);

    // Venue
    const venueId = await upsertVenue(apiTeam);
    if (venueId) await linkTeamVenue(team.id, venueId);

    // Competition-season link
    await linkTeamSeason(team.id, compSeasonId);

    // Squad — only fetch if this competition provides squad data
    // (cups like EC/WC may not have squads in the teams endpoint)
    if (apiTeam.squad && apiTeam.squad.length > 0) {
      for (const apiPlayer of apiTeam.squad) {
        const player = await upsertPlayer(apiPlayer);
        if (player) await linkPlayerTeam(player.id, team.id);
      }
    }
  }

  console.log(`   Teams: ${apiIdToDbId.size}`);
  return apiIdToDbId;
}

// ============================================================
// SYNC: STANDINGS
// ============================================================

async function syncStandings(
  compCode: string,
  compSeasonId: string,
  teamIdMap: Map<number, string>
) {
  const standingsData = await rateLimitedFetch(
    `${BASE_URL}/competitions/${compCode}/standings`
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

async function syncMatches(
  compCode: string,
  compSeasonId: string,
  teamIdMap: Map<number, string>
) {
  const matchesData = await rateLimitedFetch(
    `${BASE_URL}/competitions/${compCode}/matches`
  );

  let count = 0;
  for (const apiMatch of matchesData.matches || []) {
    const homeTeamId = teamIdMap.get(apiMatch.homeTeam.id);
    const awayTeamId = teamIdMap.get(apiMatch.awayTeam.id);
    if (!homeTeamId || !awayTeamId) continue;

    const extId = fdId(apiMatch.id);

    const scheduledAt = new Date(apiMatch.utcDate);

    await db
      .insert(schema.matches)
      .values({
        externalId: extId,
        competitionSeasonId: compSeasonId,
        homeTeamId,
        awayTeamId,
        matchday: apiMatch.matchday,
        scheduledAt,
        status: mapMatchStatus(apiMatch.status),
        homeScore: apiMatch.score?.fullTime?.home ?? null,
        awayScore: apiMatch.score?.fullTime?.away ?? null,
        referee: apiMatch.referees?.[0]?.name || null,
      })
      .onConflictDoUpdate({
        target: schema.matches.externalId,
        set: {
          matchday: apiMatch.matchday,
          scheduledAt,
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
// SYNC: SCORERS (top scorers → player_season_stats)
// ============================================================

async function syncScorers(
  compCode: string,
  compSeasonId: string,
  teamIdMap: Map<number, string>
) {
  const scorersData = await rateLimitedFetch(
    `${BASE_URL}/competitions/${compCode}/scorers?limit=100`
  );

  let count = 0;
  for (const scorer of scorersData.scorers || []) {
    const teamId = teamIdMap.get(scorer.team?.id);
    if (!teamId) continue;

    // Ensure player exists
    const player = await upsertPlayer(scorer.player);
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

// ============================================================
// SYNC: ONE COMPETITION (full flow)
// ============================================================

async function syncCompetition(compMeta: (typeof COMPETITIONS)[number]) {
  console.log(`\n== ${compMeta.name} (${compMeta.code}) ==`);

  // 1. Fetch competition info
  let apiComp;
  try {
    apiComp = await rateLimitedFetch(
      `${BASE_URL}/competitions/${compMeta.code}`
    );
  } catch (err) {
    console.log(`   SKIP: Could not fetch competition (${err})`);
    return;
  }

  if (!apiComp.currentSeason) {
    console.log(`   SKIP: No current season`);
    return;
  }

  // 2. Upsert season
  const season = await upsertCurrentSeason(apiComp.currentSeason);

  // 3. Upsert competition
  const competition = await upsertCompetition(apiComp, compMeta);
  console.log(`   Competition: ${competition.name} (${competition.externalId})`);

  // 4. Upsert competition-season link
  const compSeason = await upsertCompetitionSeason(competition.id, season.id);

  // 5. Teams + squads
  let teamIdMap: Map<number, string>;
  try {
    teamIdMap = await syncTeams(compMeta.code, compSeason.id);
  } catch (err) {
    console.log(`   WARN: Could not fetch teams (${err})`);
    return;
  }

  // 6. Standings
  try {
    await syncStandings(compMeta.code, compSeason.id, teamIdMap);
  } catch (err) {
    console.log(`   WARN: Standings failed: ${err}`);
  }

  // 7. Matches
  try {
    await syncMatches(compMeta.code, compSeason.id, teamIdMap);
  } catch (err) {
    console.log(`   WARN: Matches failed: ${err}`);
  }

  // 8. Scorers
  try {
    await syncScorers(compMeta.code, compSeason.id, teamIdMap);
  } catch (err) {
    console.log(`   WARN: Scorers failed: ${err}`);
  }

  console.log(`   Done: ${compMeta.name}`);
}

// ============================================================
// SYNC: LIVE MATCHES (today only)
// ============================================================

async function syncLiveMatches() {
  console.log("\n== Syncing today's matches ==\n");

  const data = await rateLimitedFetch(`${BASE_URL}/matches`);

  let updated = 0;
  for (const apiMatch of data.matches || []) {
    const extId = fdId(apiMatch.id);

    // Try to update existing match
    const result = await db
      .update(schema.matches)
      .set({
        status: mapMatchStatus(apiMatch.status),
        homeScore: apiMatch.score?.fullTime?.home ?? null,
        awayScore: apiMatch.score?.fullTime?.away ?? null,
        minute:
          apiMatch.status === "IN_PLAY" ? apiMatch.minute ?? null : null,
        updatedAt: new Date(),
      })
      .where(eq(schema.matches.externalId, extId))
      .returning();

    if (result.length > 0) updated++;
  }

  console.log(`Updated ${updated} matches from ${data.matches?.length || 0} returned`);
}

// ============================================================
// SEARCH INDEX REFRESH (inline)
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
// CLI ENTRY POINT
// ============================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--live")) {
    await syncLiveMatches();
    return;
  }

  if (args.includes("--competition")) {
    const slugArg = args.find((a) => a.startsWith("--slug="));
    if (!slugArg) {
      console.error("Usage: --competition --slug=premier-league");
      process.exit(1);
    }
    const slug = slugArg.split("=")[1];
    const comp = COMPETITIONS.find((c) => slugify(c.name) === slug);
    if (!comp) {
      console.error(`Unknown slug: ${slug}`);
      console.error(
        "Available:",
        COMPETITIONS.map((c) => slugify(c.name)).join(", ")
      );
      process.exit(1);
    }

    await syncCompetition(comp);
    await refreshSearchIndex();
    return;
  }

  if (args.includes("--all")) {
    console.log("Syncing all competitions...\n");

    for (const comp of COMPETITIONS) {
      try {
        await syncCompetition(comp);
      } catch (err) {
        console.error(`FAILED: ${comp.name} — ${err}`);
      }
    }

    await refreshSearchIndex();

    console.log("\nSync complete!");
    return;
  }

  console.log("Usage:");
  console.log("  --all                        Sync all 12 competitions");
  console.log("  --competition --slug=<slug>  Sync one competition");
  console.log("  --live                       Update today's match scores");
  process.exit(1);
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
