import { db } from "@/lib/db";
import {
  matchSummaries,
  playerMatchSummaries,
  tournamentSummaries,
  matches,
  players,
  competitionSeasons,
} from "@/lib/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";

/**
 * Get match summary with MOTM player details.
 */
export async function getMatchSummary(matchId: string) {
  const result = await db
    .select({
      summary: matchSummaries,
      motmPlayer: players,
    })
    .from(matchSummaries)
    .leftJoin(players, eq(players.id, matchSummaries.manOfTheMatch))
    .where(eq(matchSummaries.matchId, matchId))
    .limit(1);

  if (!result[0]) return null;

  const { summary, motmPlayer } = result[0];

  return {
    id: summary.id,
    matchId: summary.matchId,
    headline: summary.headline,
    summary: summary.summary,
    keyMoments: summary.keyMoments ? JSON.parse(summary.keyMoments) : [],
    manOfTheMatch: motmPlayer
      ? {
          id: motmPlayer.id,
          name: motmPlayer.name,
          slug: motmPlayer.slug,
          position: motmPlayer.position,
          imageUrl: motmPlayer.imageUrl,
        }
      : null,
    generatedAt: summary.generatedAt,
    modelVersion: summary.modelVersion,
  };
}

/**
 * Get recent match summaries for a player.
 */
export async function getPlayerMatchSummaries(playerId: string, limit = 5) {
  const result = await db
    .select({
      summary: playerMatchSummaries,
      match: matches,
    })
    .from(playerMatchSummaries)
    .innerJoin(matches, eq(matches.id, playerMatchSummaries.matchId))
    .where(eq(playerMatchSummaries.playerId, playerId))
    .orderBy(desc(matches.scheduledAt))
    .limit(limit);

  return result.map(({ summary, match }) => ({
    id: summary.id,
    matchId: match.id,
    rating: summary.rating ? parseFloat(summary.rating) : null,
    summary: summary.summary,
    highlights: summary.highlights ? JSON.parse(summary.highlights) : [],
    scheduledAt: match.scheduledAt,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    generatedAt: summary.generatedAt,
  }));
}

/**
 * Get player summaries for a match.
 */
export async function getMatchPlayerSummaries(matchId: string) {
  const result = await db
    .select({
      summary: playerMatchSummaries,
      player: players,
    })
    .from(playerMatchSummaries)
    .innerJoin(players, eq(players.id, playerMatchSummaries.playerId))
    .where(eq(playerMatchSummaries.matchId, matchId))
    .orderBy(desc(playerMatchSummaries.rating));

  return result.map(({ summary, player }) => ({
    id: summary.id,
    playerId: player.id,
    playerName: player.name,
    playerSlug: player.slug,
    playerPosition: player.position,
    playerImageUrl: player.imageUrl,
    rating: summary.rating ? parseFloat(summary.rating) : null,
    summary: summary.summary,
    highlights: summary.highlights ? JSON.parse(summary.highlights) : [],
  }));
}

/**
 * Get tournament summary for specific period.
 */
export async function getTournamentSummary(
  competitionSeasonId: string,
  periodType: string,
  periodValue: number
) {
  const result = await db
    .select()
    .from(tournamentSummaries)
    .where(
      and(
        eq(tournamentSummaries.competitionSeasonId, competitionSeasonId),
        eq(tournamentSummaries.periodType, periodType),
        eq(tournamentSummaries.periodValue, periodValue)
      )
    )
    .limit(1);

  if (!result[0]) return null;

  const summary = result[0];

  return {
    id: summary.id,
    competitionSeasonId: summary.competitionSeasonId,
    periodType: summary.periodType,
    periodValue: summary.periodValue,
    periodStart: summary.periodStart,
    periodEnd: summary.periodEnd,
    headline: summary.headline,
    summary: summary.summary,
    topPerformers: summary.topPerformers ? JSON.parse(summary.topPerformers) : [],
    standingsMovement: summary.standingsMovement
      ? JSON.parse(summary.standingsMovement)
      : null,
    generatedAt: summary.generatedAt,
  };
}

/**
 * Get the latest tournament summary for a competition season.
 */
export async function getLatestTournamentSummary(competitionSeasonId: string) {
  const result = await db
    .select()
    .from(tournamentSummaries)
    .where(eq(tournamentSummaries.competitionSeasonId, competitionSeasonId))
    .orderBy(desc(tournamentSummaries.generatedAt))
    .limit(1);

  if (!result[0]) return null;

  const summary = result[0];

  return {
    id: summary.id,
    competitionSeasonId: summary.competitionSeasonId,
    periodType: summary.periodType,
    periodValue: summary.periodValue,
    periodStart: summary.periodStart,
    periodEnd: summary.periodEnd,
    headline: summary.headline,
    summary: summary.summary,
    topPerformers: summary.topPerformers ? JSON.parse(summary.topPerformers) : [],
    standingsMovement: summary.standingsMovement
      ? JSON.parse(summary.standingsMovement)
      : null,
    generatedAt: summary.generatedAt,
  };
}

/**
 * Get finished matches without summaries (for backfill).
 */
export async function getMatchesNeedingSummaries(limit = 20) {
  const result = await db
    .select({
      match: matches,
    })
    .from(matches)
    .leftJoin(matchSummaries, eq(matchSummaries.matchId, matches.id))
    .where(
      and(
        eq(matches.status, "finished"),
        isNull(matchSummaries.id)
      )
    )
    .orderBy(desc(matches.scheduledAt))
    .limit(limit);

  return result.map((r) => r.match);
}
