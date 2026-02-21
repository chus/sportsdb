/**
 * AI Content Generation Script
 *
 * Usage:
 *   ANTHROPIC_API_KEY=xxx npx tsx scripts/generate-summaries.ts
 *   ANTHROPIC_API_KEY=xxx npx tsx scripts/generate-summaries.ts --match-id=xxx
 *   ANTHROPIC_API_KEY=xxx npx tsx scripts/generate-summaries.ts --backfill --limit=10
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and, isNull, inArray, desc, sql } from "drizzle-orm";
import { format } from "date-fns";
import * as schema from "../src/lib/db/schema";
import {
  generateMatchSummary,
  generatePlayerSummary,
  MODEL_VERSION,
} from "./content/openai-client";
import type {
  MatchContext,
  MatchEvent,
  PlayerInfo,
  PlayerMatchContext,
  PlayerMatchEvent,
} from "./content/types";

// Initialize database
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const sqlClient = neon(DATABASE_URL);
const db = drizzle(sqlClient, { schema });

// Parse command line arguments
const args = process.argv.slice(2);
const matchIdArg = args.find((a) => a.startsWith("--match-id="));
const specificMatchId = matchIdArg?.split("=")[1];
const isBackfill = args.includes("--backfill");
const allMatches = args.includes("--all");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = allMatches ? 10000 : (limitArg ? parseInt(limitArg.split("=")[1], 10) : 10);
const dryRun = args.includes("--dry-run");

async function getMatchesNeedingSummaries(maxLimit: number) {
  // Find finished matches without summaries
  const result = await db
    .select({
      match: schema.matches,
    })
    .from(schema.matches)
    .leftJoin(
      schema.matchSummaries,
      eq(schema.matchSummaries.matchId, schema.matches.id)
    )
    .where(
      and(
        eq(schema.matches.status, "finished"),
        isNull(schema.matchSummaries.id)
      )
    )
    .orderBy(desc(schema.matches.scheduledAt))
    .limit(maxLimit);

  return result.map((r) => r.match);
}

async function getMatchContext(matchId: string): Promise<MatchContext | null> {
  // Get match with teams
  const [match] = await db
    .select()
    .from(schema.matches)
    .where(eq(schema.matches.id, matchId));

  if (!match) return null;

  // Get teams
  const [homeTeam] = await db
    .select()
    .from(schema.teams)
    .where(eq(schema.teams.id, match.homeTeamId));

  const [awayTeam] = await db
    .select()
    .from(schema.teams)
    .where(eq(schema.teams.id, match.awayTeamId));

  if (!homeTeam || !awayTeam) return null;

  // Get venue
  const venue = match.venueId
    ? (await db.select().from(schema.venues).where(eq(schema.venues.id, match.venueId)))[0]
    : null;

  // Get competition and season
  const [compSeason] = await db
    .select({
      competition: schema.competitions,
      season: schema.seasons,
    })
    .from(schema.competitionSeasons)
    .innerJoin(
      schema.competitions,
      eq(schema.competitions.id, schema.competitionSeasons.competitionId)
    )
    .innerJoin(
      schema.seasons,
      eq(schema.seasons.id, schema.competitionSeasons.seasonId)
    )
    .where(eq(schema.competitionSeasons.id, match.competitionSeasonId));

  // Get events with players
  const events = await db
    .select({
      event: schema.matchEvents,
      player: schema.players,
    })
    .from(schema.matchEvents)
    .leftJoin(schema.players, eq(schema.players.id, schema.matchEvents.playerId))
    .where(eq(schema.matchEvents.matchId, matchId))
    .orderBy(schema.matchEvents.minute);

  // Get secondary players for events
  const secondaryPlayerIds = events
    .filter((e) => e.event.secondaryPlayerId)
    .map((e) => e.event.secondaryPlayerId!);

  const secondaryPlayers =
    secondaryPlayerIds.length > 0
      ? await db
          .select()
          .from(schema.players)
          .where(inArray(schema.players.id, secondaryPlayerIds))
      : [];

  const secondaryPlayerMap = new Map(secondaryPlayers.map((p) => [p.id, p]));

  // Get lineups
  const lineups = await db
    .select({
      lineup: schema.matchLineups,
      player: schema.players,
    })
    .from(schema.matchLineups)
    .innerJoin(schema.players, eq(schema.players.id, schema.matchLineups.playerId))
    .where(eq(schema.matchLineups.matchId, matchId));

  const homeLineup: PlayerInfo[] = lineups
    .filter((l) => l.lineup.teamId === match.homeTeamId)
    .map((l) => ({
      id: l.player.id,
      name: l.player.name,
      position: l.lineup.position || l.player.position,
      shirtNumber: l.lineup.shirtNumber,
      isStarter: l.lineup.isStarter,
      minutesPlayed: l.lineup.minutesPlayed,
      rating: l.lineup.rating,
    }));

  const awayLineup: PlayerInfo[] = lineups
    .filter((l) => l.lineup.teamId === match.awayTeamId)
    .map((l) => ({
      id: l.player.id,
      name: l.player.name,
      position: l.lineup.position || l.player.position,
      shirtNumber: l.lineup.shirtNumber,
      isStarter: l.lineup.isStarter,
      minutesPlayed: l.lineup.minutesPlayed,
      rating: l.lineup.rating,
    }));

  const matchEvents: MatchEvent[] = events.map((e) => {
    const secondaryPlayer = e.event.secondaryPlayerId
      ? secondaryPlayerMap.get(e.event.secondaryPlayerId)
      : null;

    return {
      minute: e.event.minute,
      addedTime: e.event.addedTime,
      type: e.event.type,
      player: e.player?.name || "Unknown",
      playerId: e.player?.id || "",
      team: e.event.teamId === match.homeTeamId ? homeTeam.name : awayTeam.name,
      teamId: e.event.teamId,
      secondaryPlayer: secondaryPlayer?.name || null,
      secondaryPlayerId: secondaryPlayer?.id || null,
    };
  });

  return {
    id: match.id,
    competition: compSeason?.competition.name || "Unknown Competition",
    season: compSeason?.season.label || "Unknown Season",
    date: format(new Date(match.scheduledAt), "EEEE, MMMM d, yyyy"),
    homeTeam: homeTeam.name,
    homeTeamId: homeTeam.id,
    awayTeam: awayTeam.name,
    awayTeamId: awayTeam.id,
    homeScore: match.homeScore ?? 0,
    awayScore: match.awayScore ?? 0,
    venue: venue?.name || null,
    attendance: match.attendance,
    referee: match.referee,
    events: matchEvents,
    homeLineup,
    awayLineup,
  };
}

function buildPlayerContext(
  player: PlayerInfo,
  matchContext: MatchContext,
  isHome: boolean
): PlayerMatchContext {
  const team = isHome ? matchContext.homeTeam : matchContext.awayTeam;
  const opponent = isHome ? matchContext.awayTeam : matchContext.homeTeam;
  const teamScore = isHome ? matchContext.homeScore : matchContext.awayScore;
  const opponentScore = isHome ? matchContext.awayScore : matchContext.homeScore;

  let result: string;
  if (teamScore > opponentScore) {
    result = `W ${teamScore}-${opponentScore}`;
  } else if (teamScore < opponentScore) {
    result = `L ${teamScore}-${opponentScore}`;
  } else {
    result = `D ${teamScore}-${opponentScore}`;
  }

  // Find player's events
  const playerEvents: PlayerMatchEvent[] = matchContext.events
    .filter((e) => e.playerId === player.id || e.secondaryPlayerId === player.id)
    .map((e) => {
      let description = e.type;
      if (e.playerId === player.id) {
        if (e.type === "goal") description = "Scored a goal";
        else if (e.type === "yellow_card") description = "Received yellow card";
        else if (e.type === "red_card") description = "Received red card";
        else if (e.type === "substitution") description = "Substituted on";
      } else if (e.secondaryPlayerId === player.id) {
        if (e.type === "goal") description = `Assisted ${e.player}'s goal`;
        else if (e.type === "substitution") description = "Substituted off";
      }
      return {
        minute: e.minute,
        type: e.type,
        description,
      };
    });

  return {
    playerId: player.id,
    playerName: player.name,
    position: player.position,
    team,
    opponent,
    isHome,
    matchResult: result,
    minutesPlayed: player.minutesPlayed,
    isStarter: player.isStarter,
    events: playerEvents,
  };
}

async function saveMatchSummary(
  matchId: string,
  summary: {
    headline: string;
    summary: string;
    keyMoments: { minute: number; description: string }[];
    manOfTheMatch: { playerId: string; playerName: string; reason: string } | null;
  },
  modelVersion: string
) {
  await db.insert(schema.matchSummaries).values({
    matchId,
    headline: summary.headline,
    summary: summary.summary,
    keyMoments: JSON.stringify(summary.keyMoments),
    manOfTheMatch: summary.manOfTheMatch?.playerId || null,
    modelVersion,
    promptVersion: 1,
  });
}

async function savePlayerSummary(
  matchId: string,
  playerId: string,
  summary: {
    rating: number;
    summary: string;
    highlights: string[];
  }
) {
  await db.insert(schema.playerMatchSummaries).values({
    matchId,
    playerId,
    rating: summary.rating.toFixed(1),
    summary: summary.summary,
    highlights: JSON.stringify(summary.highlights),
  });
}

async function processMatch(matchId: string) {
  console.log(`\nProcessing match: ${matchId}`);

  // Get match context
  const context = await getMatchContext(matchId);
  if (!context) {
    console.log(`  Could not build context for match ${matchId}`);
    return;
  }

  console.log(
    `  ${context.homeTeam} ${context.homeScore} - ${context.awayScore} ${context.awayTeam}`
  );
  console.log(`  ${context.competition} - ${context.date}`);

  if (dryRun) {
    console.log("  [DRY RUN] Would generate summary");
    return;
  }

  // Generate match summary
  console.log("  Generating match summary...");
  try {
    const { response, modelVersion } = await generateMatchSummary(context);
    console.log(`  Headline: ${response.headline}`);

    await saveMatchSummary(matchId, response, modelVersion);
    console.log("  Match summary saved");

    // Generate player summaries for key players (starters who played significant minutes)
    const keyPlayers = [
      ...context.homeLineup.filter((p) => p.isStarter),
      ...context.awayLineup.filter((p) => p.isStarter),
    ].slice(0, 10); // Limit to 10 players to control API costs

    console.log(`  Generating summaries for ${keyPlayers.length} key players...`);

    for (const player of keyPlayers) {
      const isHome = context.homeLineup.some((p) => p.id === player.id);
      const playerContext = buildPlayerContext(player, context, isHome);

      try {
        const { response: playerResponse } = await generatePlayerSummary(playerContext);
        await savePlayerSummary(matchId, player.id, playerResponse);
        console.log(`    ${player.name}: ${playerResponse.rating}/10`);
      } catch (err) {
        console.error(`    Error generating summary for ${player.name}:`, err);
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } catch (err) {
    console.error(`  Error generating match summary:`, err);
  }
}

async function main() {
  console.log("AI Content Generation Script");
  console.log("============================");

  if (dryRun) {
    console.log("Running in DRY RUN mode - no API calls or data will be saved");
  } else if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY environment variable is required");
    process.exit(1);
  }

  let matchesToProcess: typeof schema.matches.$inferSelect[] = [];

  if (specificMatchId) {
    // Process specific match
    const [match] = await db
      .select()
      .from(schema.matches)
      .where(eq(schema.matches.id, specificMatchId));

    if (!match) {
      console.error(`Match ${specificMatchId} not found`);
      process.exit(1);
    }
    matchesToProcess = [match];
  } else {
    // Find matches needing summaries
    matchesToProcess = await getMatchesNeedingSummaries(limit);
  }

  console.log(`Found ${matchesToProcess.length} matches to process`);

  if (matchesToProcess.length === 0) {
    console.log("No matches need processing");
    return;
  }

  for (const match of matchesToProcess) {
    await processMatch(match.id);

    // Delay between matches to avoid rate limiting
    if (matchesToProcess.indexOf(match) < matchesToProcess.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
