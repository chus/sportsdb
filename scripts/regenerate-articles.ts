/**
 * Regenerate articles with improved prompts
 *
 * Usage:
 *   OPENAI_API_KEY=xxx npx tsx scripts/regenerate-articles.ts --limit=10
 */

import { db } from "../src/lib/db";
import {
  articles,
  matches,
  teams,
  competitions,
  competitionSeasons,
  seasons,
  venues,
  matchEvents,
  players,
  articleTeams,
} from "../src/lib/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI();

const args = process.argv.slice(2);
const limitArg = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] || "10");

async function main() {
  console.log(`\n📝 Regenerating ${limitArg} articles with improved prompts\n`);

  // Get oldest articles to regenerate
  const oldArticles = await db
    .select()
    .from(articles)
    .where(eq(articles.type, "match_report"))
    .orderBy(articles.createdAt)
    .limit(limitArg);

  console.log(`Found ${oldArticles.length} articles to regenerate\n`);

  let regenerated = 0;
  let errors = 0;

  for (const article of oldArticles) {
    if (!article.matchId) {
      console.log(`⏭️  Skipping ${article.slug} - no match ID`);
      continue;
    }

    try {
      console.log(`🔄 Regenerating: ${article.title}`);

      // Get match data
      const matchData = await getMatchData(article.matchId);
      if (!matchData) {
        console.log(`   ❌ Could not fetch match data`);
        errors++;
        continue;
      }

      // Get match events
      const events = await db
        .select({
          minute: matchEvents.minute,
          type: matchEvents.type,
          player_name: players.name,
          team_name: teams.name,
        })
        .from(matchEvents)
        .innerJoin(players, eq(players.id, matchEvents.playerId))
        .innerJoin(teams, eq(teams.id, matchEvents.teamId))
        .where(eq(matchEvents.matchId, article.matchId))
        .orderBy(matchEvents.minute);

      // Build prompt and generate
      const prompt = buildMatchReportPrompt(matchData, events);
      const newArticle = await generateArticle(prompt);

      if (!newArticle) {
        console.log(`   ❌ Generation failed`);
        errors++;
        continue;
      }

      // Update the article
      await db
        .update(articles)
        .set({
          title: newArticle.title,
          excerpt: newArticle.excerpt,
          content: newArticle.content,
          metaTitle: newArticle.metaTitle,
          metaDescription: newArticle.metaDescription,
          modelVersion: "gpt-4o-mini",
          updatedAt: new Date(),
        })
        .where(eq(articles.id, article.id));

      console.log(`   ✅ Regenerated successfully`);
      regenerated++;

      // Rate limit
      await new Promise(r => setTimeout(r, 1000));
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      errors++;
    }
  }

  console.log(`\n✅ Done! Regenerated: ${regenerated}, Errors: ${errors}`);
}

async function getMatchData(matchId: string) {
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

  const [compSeason] = await db
    .select({
      competition: competitions,
      season: seasons,
    })
    .from(competitionSeasons)
    .innerJoin(competitions, eq(competitions.id, competitionSeasons.competitionId))
    .innerJoin(seasons, eq(seasons.id, competitionSeasons.seasonId))
    .where(eq(competitionSeasons.id, match.competitionSeasonId));

  const venue = match.venueId
    ? (await db.select().from(venues).where(eq(venues.id, match.venueId)))[0]
    : null;

  return {
    id: match.id,
    matchday: match.matchday,
    scheduled_at: match.scheduledAt,
    home_score: match.homeScore,
    away_score: match.awayScore,
    home_team: homeTeam?.name || "Unknown",
    home_team_slug: homeTeam?.slug || "unknown",
    away_team: awayTeam?.name || "Unknown",
    away_team_slug: awayTeam?.slug || "unknown",
    competition: compSeason?.competition.name || "Unknown",
    competition_slug: compSeason?.competition.slug || "unknown",
    season: compSeason?.season.label || "Unknown",
    venue: venue?.name || null,
  };
}

function buildMatchReportPrompt(match: any, events: any[]): string {
  const scoreline = `${match.home_team} ${match.home_score}-${match.away_score} ${match.away_team}`;
  const homeTeamLink = `[${match.home_team}](/teams/${match.home_team_slug})`;
  const awayTeamLink = `[${match.away_team}](/teams/${match.away_team_slug})`;
  const competitionLink = `[${match.competition}](/competitions/${match.competition_slug})`;

  // Group events by type for analysis
  const goals = events.filter(e => e.type === 'goal' || e.type === 'penalty');
  const cards = events.filter(e => e.type === 'yellow_card' || e.type === 'red_card');

  return `You are an experienced sports journalist writing an in-depth match report for SportsDB, a professional football database website. Write with authority, insight, and engaging storytelling.

MATCH INFORMATION:
- Competition: ${match.competition} (${match.season})
- Matchday: ${match.matchday || 'N/A'}
- Date: ${match.scheduled_at}
- Final Score: ${scoreline}
${match.venue ? `- Venue: ${match.venue}` : ""}

MATCH EVENTS TIMELINE:
${events.length > 0 ? events.map((e: any) => `${e.minute}' - ${e.type.toUpperCase()}: ${e.player_name} (${e.team_name})`).join("\n") : "No detailed events available"}

LINKS TO INCLUDE (use these exact markdown formats):
- Home team: ${homeTeamLink}
- Away team: ${awayTeamLink}
- Competition: ${competitionLink}
- For players: [Player Name](/players/player-slug-lowercase-with-dashes)

WRITING GUIDELINES:

1. OPENING PARAGRAPH (hook the reader):
   - Start with the most dramatic or significant aspect of the match
   - Set the scene and context (rivalry, standings implications, etc.)
   - Make readers want to continue reading

2. STRUCTURE (use ## for H2 headings):
   ## Match Overview
   - Brief tactical setup and early game flow
   - How both teams approached the match

   ## First Half Action
   - Key moments, goals, chances
   - Tactical battles and momentum shifts

   ## Second Half Drama
   - How the game evolved
   - Decisive moments and turning points

   ## Key Performances
   - Highlight 2-3 standout players
   - Specific contributions that influenced the result

   ## Looking Ahead
   - What this result means for both teams
   - Upcoming fixtures or implications

3. WRITING STYLE:
   - Use vivid, descriptive language ("thunderous strike" not "good shot")
   - Include specific minute references for key moments
   - Build narrative tension and drama
   - Professional but engaging tone
   - Vary sentence length for rhythm
   - Use active voice predominantly

4. SEO & LINKING:
   - Link team names on first mention using provided links
   - Create player links as [Full Name](/players/firstname-lastname)
   - Natural keyword integration: "${match.home_team} vs ${match.away_team}", "${match.competition}"
   - Include competition context throughout

5. LENGTH: 800-1000 words minimum. This should be a comprehensive match report.

OUTPUT FORMAT (return valid JSON only):
{
  "title": "Compelling headline with teams and key narrative (max 80 chars)",
  "slug": "team-vs-team-competition-result-keyword",
  "excerpt": "Engaging 1-2 sentence summary that hooks readers (max 160 chars)",
  "content": "Full markdown article content with ## headings and [links](/path)",
  "metaTitle": "SEO title with teams, score, competition (max 60 chars)",
  "metaDescription": "Meta description with result and key info (150-160 chars)"
}`;
}

async function generateArticle(prompt: string): Promise<any | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert sports journalist. Write engaging, detailed match reports with vivid language and professional analysis. Always return valid JSON."
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 4000,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("OpenAI API error:", error);
    return null;
  }
}

main().catch(console.error);
