/**
 * Generate player match summaries for existing matches
 *
 * Usage:
 *   OPENAI_API_KEY=xxx npx tsx scripts/generate-player-summaries.ts --limit=20
 */

import { db } from "../src/lib/db";
import {
  matches,
  matchSummaries,
  playerMatchSummaries,
  matchLineups,
  matchEvents,
  players,
  teams,
  competitions,
  competitionSeasons,
  seasons,
} from "../src/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import OpenAI from "openai";
import { format } from "date-fns";

const openai = new OpenAI();
const MODEL_VERSION = "gpt-4o-mini";

const args = process.argv.slice(2);
const limitArg = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] || "20");

interface MatchContext {
  id: string;
  competition: string;
  season: string;
  date: string;
  homeTeam: string;
  homeTeamId: string;
  awayTeam: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
}

async function main() {
  console.log(`\n⚽ Generating player summaries for ${limitArg} matches\n`);

  // Find matches with match summaries but few/no player summaries
  const matchesWithSummaries = await db
    .select({ matchId: matchSummaries.matchId })
    .from(matchSummaries)
    .orderBy(desc(matchSummaries.generatedAt))
    .limit(limitArg * 2);

  const matchIds = matchesWithSummaries.map(m => m.matchId);

  // Get matches that need player summaries
  let processedCount = 0;
  let totalPlayers = 0;
  let errors = 0;

  for (const matchId of matchIds) {
    if (processedCount >= limitArg) break;

    // Check if this match already has player summaries
    const existingSummaries = await db
      .select()
      .from(playerMatchSummaries)
      .where(eq(playerMatchSummaries.matchId, matchId))
      .limit(1);

    if (existingSummaries.length > 0) {
      continue; // Skip matches that already have player summaries
    }

    try {
      const context = await getMatchContext(matchId);
      if (!context) {
        console.log(`⏭️  Skipping match ${matchId} - no context`);
        continue;
      }

      console.log(`🏟️  Processing: ${context.homeTeam} vs ${context.awayTeam}`);

      const playersGenerated = await generatePlayerSummariesForMatch(matchId, context);
      totalPlayers += playersGenerated;
      processedCount++;

      console.log(`   ✅ Generated ${playersGenerated} player summaries`);

      // Rate limit between matches
      await new Promise(r => setTimeout(r, 500));
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      errors++;
    }
  }

  console.log(`\n✅ Done! Matches: ${processedCount}, Players: ${totalPlayers}, Errors: ${errors}`);
}

async function getMatchContext(matchId: string): Promise<MatchContext | null> {
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId));

  if (!match) return null;

  const [homeTeam] = await db.select().from(teams).where(eq(teams.id, match.homeTeamId));
  const [awayTeam] = await db.select().from(teams).where(eq(teams.id, match.awayTeamId));

  if (!homeTeam || !awayTeam) return null;

  const [compSeason] = await db
    .select({ competition: competitions, season: seasons })
    .from(competitionSeasons)
    .innerJoin(competitions, eq(competitions.id, competitionSeasons.competitionId))
    .innerJoin(seasons, eq(seasons.id, competitionSeasons.seasonId))
    .where(eq(competitionSeasons.id, match.competitionSeasonId));

  return {
    id: match.id,
    competition: compSeason?.competition.name || "Unknown",
    season: compSeason?.season.label || "Unknown",
    date: format(new Date(match.scheduledAt), "MMMM d, yyyy"),
    homeTeam: homeTeam.name,
    homeTeamId: homeTeam.id,
    awayTeam: awayTeam.name,
    awayTeamId: awayTeam.id,
    homeScore: match.homeScore ?? 0,
    awayScore: match.awayScore ?? 0,
  };
}

async function generatePlayerSummariesForMatch(matchId: string, context: MatchContext): Promise<number> {
  // Get lineups
  const lineups = await db
    .select({ lineup: matchLineups, player: players })
    .from(matchLineups)
    .innerJoin(players, eq(players.id, matchLineups.playerId))
    .where(eq(matchLineups.matchId, matchId));

  if (lineups.length === 0) return 0;

  // Get all events
  const events = await db
    .select({ event: matchEvents, player: players })
    .from(matchEvents)
    .leftJoin(players, eq(players.id, matchEvents.playerId))
    .where(eq(matchEvents.matchId, matchId));

  // Group events by player
  const playerEvents = new Map<string, typeof events>();
  for (const e of events) {
    if (e.player?.id) {
      const existing = playerEvents.get(e.player.id) || [];
      existing.push(e);
      playerEvents.set(e.player.id, existing);
    }
  }

  // Get starters (up to 8 per team)
  const homeStarters = lineups
    .filter(l => l.lineup.isStarter && l.lineup.teamId === context.homeTeamId)
    .slice(0, 4);
  const awayStarters = lineups
    .filter(l => l.lineup.isStarter && l.lineup.teamId === context.awayTeamId)
    .slice(0, 4);

  const playersToAnalyze = [...homeStarters, ...awayStarters];
  let generated = 0;

  for (const { lineup, player } of playersToAnalyze) {
    try {
      const playerEventsList = playerEvents.get(player.id) || [];
      const teamName = lineup.teamId === context.homeTeamId ? context.homeTeam : context.awayTeam;

      const prompt = buildPlayerPrompt(player, teamName, context, playerEventsList);

      const completion = await openai.chat.completions.create({
        model: MODEL_VERSION,
        max_tokens: 512,
        messages: [
          {
            role: "system",
            content: "You are a football analyst providing brief, insightful player performance assessments. Return only valid JSON."
          },
          { role: "user", content: prompt }
        ],
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) continue;

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      const summary = JSON.parse(jsonMatch[0]);

      await db.insert(playerMatchSummaries).values({
        matchId,
        playerId: player.id,
        rating: summary.rating?.toString() || "6.5",
        summary: summary.summary || "Solid performance.",
        highlights: JSON.stringify(summary.highlights || []),
      });

      generated++;

      // Small delay between players
      await new Promise(r => setTimeout(r, 300));
    } catch (error) {
      // Skip individual player errors
    }
  }

  return generated;
}

function buildPlayerPrompt(
  player: typeof players.$inferSelect,
  teamName: string,
  match: MatchContext,
  events: { event: typeof matchEvents.$inferSelect; player: typeof players.$inferSelect | null }[]
): string {
  const eventsText = events.length > 0
    ? events.map(e => `${e.event.minute}' - ${e.event.type}`).join(", ")
    : "No recorded key events";

  const wasWinner = (teamName === match.homeTeam && match.homeScore > match.awayScore) ||
                    (teamName === match.awayTeam && match.awayScore > match.homeScore);
  const wasLoser = (teamName === match.homeTeam && match.homeScore < match.awayScore) ||
                   (teamName === match.awayTeam && match.awayScore < match.homeScore);

  return `Analyze this player's performance:

PLAYER: ${player.name}
POSITION: ${player.position}
TEAM: ${teamName}
MATCH: ${match.homeTeam} ${match.homeScore} - ${match.awayScore} ${match.awayTeam}
COMPETITION: ${match.competition} (${match.season})
RESULT: ${wasWinner ? "Won" : wasLoser ? "Lost" : "Draw"}

PLAYER'S KEY EVENTS: ${eventsText}

Generate a performance assessment with:
1. rating - Number from 5.0 to 9.5 (typical range: 6.0-7.5 for average, 8.0+ for excellent)
2. summary - 1-2 sentences about their performance, mentioning specific contributions
3. highlights - Array of 1-3 short phrases (e.g., "Key assist", "Solid defending", "Clinical finish")

Return ONLY valid JSON:
{"rating": 7.0, "summary": "Description here", "highlights": ["Highlight 1", "Highlight 2"]}`;
}

main().catch(console.error);
