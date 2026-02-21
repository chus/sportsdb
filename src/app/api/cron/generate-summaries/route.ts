import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import {
  matches,
  matchSummaries,
  playerMatchSummaries,
  matchEvents,
  matchLineups,
  teams,
  players,
  venues,
  competitions,
  competitionSeasons,
  seasons,
} from "@/lib/db/schema";
import { eq, and, isNull, inArray, desc } from "drizzle-orm";
import { format } from "date-fns";
import OpenAI from "openai";

const MODEL_VERSION = "gpt-3.5-turbo";
const MATCHES_PER_RUN = 20; // Process 20 matches per cron run

// Verify cron secret
async function verifyCronSecret() {
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn("CRON_SECRET not set - skipping auth check in development");
    return true;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET() {
  // Verify authorization
  const isAuthorized = await verifyCronSecret();
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 500 }
    );
  }

  const openai = new OpenAI();

  try {
    // Find finished matches without summaries
    const matchesNeedingSummaries = await db
      .select({ match: matches })
      .from(matches)
      .leftJoin(matchSummaries, eq(matchSummaries.matchId, matches.id))
      .where(
        and(eq(matches.status, "finished"), isNull(matchSummaries.id))
      )
      .orderBy(desc(matches.scheduledAt))
      .limit(MATCHES_PER_RUN);

    if (matchesNeedingSummaries.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No matches need summaries",
        processed: 0,
      });
    }

    let processed = 0;
    let errors = 0;

    for (const { match } of matchesNeedingSummaries) {
      try {
        // Get match context
        const context = await buildMatchContext(match.id);
        if (!context) {
          errors++;
          continue;
        }

        // Generate summary
        const completion = await openai.chat.completions.create({
          model: MODEL_VERSION,
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: buildMatchPrompt(context),
            },
          ],
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          errors++;
          continue;
        }

        // Parse response
        const summary = parseJsonResponse(content);

        // Save to database
        await db.insert(matchSummaries).values({
          matchId: match.id,
          headline: summary.headline,
          summary: summary.summary,
          keyMoments: JSON.stringify(summary.keyMoments || []),
          manOfTheMatch: null, // Skip MOTM to avoid UUID issues
          modelVersion: MODEL_VERSION,
          promptVersion: 1,
        });

        processed++;

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error processing match ${match.id}:`, error);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      errors,
      remaining: matchesNeedingSummaries.length - processed,
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface MatchContext {
  id: string;
  competition: string;
  season: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  venue: string | null;
  events: { minute: number; type: string; player: string; team: string }[];
}

async function buildMatchContext(matchId: string): Promise<MatchContext | null> {
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId));

  if (!match) return null;

  const [homeTeam] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, match.homeTeamId));

  const [awayTeam] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, match.awayTeamId));

  if (!homeTeam || !awayTeam) return null;

  const venue = match.venueId
    ? (await db.select().from(venues).where(eq(venues.id, match.venueId)))[0]
    : null;

  const [compSeason] = await db
    .select({
      competition: competitions,
      season: seasons,
    })
    .from(competitionSeasons)
    .innerJoin(competitions, eq(competitions.id, competitionSeasons.competitionId))
    .innerJoin(seasons, eq(seasons.id, competitionSeasons.seasonId))
    .where(eq(competitionSeasons.id, match.competitionSeasonId));

  // Get events
  const events = await db
    .select({ event: matchEvents, player: players })
    .from(matchEvents)
    .leftJoin(players, eq(players.id, matchEvents.playerId))
    .where(eq(matchEvents.matchId, matchId))
    .orderBy(matchEvents.minute);

  return {
    id: match.id,
    competition: compSeason?.competition.name || "Unknown",
    season: compSeason?.season.label || "Unknown",
    date: format(new Date(match.scheduledAt), "EEEE, MMMM d, yyyy"),
    homeTeam: homeTeam.name,
    awayTeam: awayTeam.name,
    homeScore: match.homeScore ?? 0,
    awayScore: match.awayScore ?? 0,
    venue: venue?.name || null,
    events: events.map((e) => ({
      minute: e.event.minute,
      type: e.event.type,
      player: e.player?.name || "Unknown",
      team: e.event.teamId === match.homeTeamId ? homeTeam.name : awayTeam.name,
    })),
  };
}

function buildMatchPrompt(match: MatchContext): string {
  const eventsText =
    match.events.length > 0
      ? match.events
          .map((e) => `${e.minute}' - ${e.type}: ${e.player} (${e.team})`)
          .join("\n")
      : "No events recorded";

  return `You are a professional sports journalist writing a match report.

MATCH: ${match.homeTeam} ${match.homeScore} - ${match.awayScore} ${match.awayTeam}
COMPETITION: ${match.competition} (${match.season})
DATE: ${match.date}
VENUE: ${match.venue || "Unknown"}

EVENTS:
${eventsText}

Generate a match report with:
1. headline - Max 60 characters, engaging
2. summary - 2-3 paragraphs, professional tone
3. keyMoments - Array of {minute, description} for 3-5 key moments

Return ONLY valid JSON:
{"headline": "string", "summary": "string", "keyMoments": [{"minute": number, "description": "string"}]}`;
}

function parseJsonResponse(content: string) {
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
  return JSON.parse(jsonStr);
}
