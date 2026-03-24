/**
 * Regenerate articles with improved prompts for better length and readability
 *
 * Usage:
 *   OPENAI_API_KEY=xxx npx tsx scripts/regenerate-articles.ts --limit=10
 *   OPENAI_API_KEY=xxx npx tsx scripts/regenerate-articles.ts --type=match_report --limit=5
 *   OPENAI_API_KEY=xxx npx tsx scripts/regenerate-articles.ts --type=all --limit=20
 *   OPENAI_API_KEY=xxx npx tsx scripts/regenerate-articles.ts --min-words=600 --limit=20
 */

import { neon } from "@neondatabase/serverless";
import OpenAI from "openai";
import {
  buildMatchReportPrompt,
  buildRoundRecapPrompt,
  buildPlayerSpotlightPrompt,
  buildMatchPreviewPrompt,
  buildSeasonRecapPrompt,
  type MatchReportContext,
  type RoundRecapContext,
  type PlayerSpotlightContext,
  type MatchPreviewContext,
  type SeasonRecapContext,
} from "./content/article-prompts";

const DATABASE_URL = process.env.DATABASE_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY environment variable is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const args = process.argv.slice(2);
const limitArg = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] || "10");
const typeArg = args.find(a => a.startsWith("--type="))?.split("=")[1] || "all";
const minWordsArg = parseInt(args.find(a => a.startsWith("--min-words="))?.split("=")[1] || "0");

const VALID_TYPES = ["match_report", "round_recap", "player_spotlight", "match_preview", "season_review", "all"] as const;

async function main() {
  if (!VALID_TYPES.includes(typeArg as any)) {
    console.log(`Invalid type: ${typeArg}. Valid types: ${VALID_TYPES.join(", ")}`);
    process.exit(1);
  }

  console.log(`\nRegenerating ${limitArg} articles (type: ${typeArg}${minWordsArg > 0 ? `, under ${minWordsArg} words` : ""}) with improved prompts\n`);

  // Get articles to regenerate, filtered by type and optional min-words
  let oldArticles;
  if (minWordsArg > 0) {
    // Target short articles based on word_count column
    oldArticles = typeArg !== "all"
      ? await sql`SELECT * FROM articles WHERE type = ${typeArg} AND status = 'published' AND (word_count IS NULL OR word_count < ${minWordsArg}) ORDER BY word_count ASC NULLS FIRST LIMIT ${limitArg}`
      : await sql`SELECT * FROM articles WHERE status = 'published' AND (word_count IS NULL OR word_count < ${minWordsArg}) ORDER BY word_count ASC NULLS FIRST LIMIT ${limitArg}`;
  } else {
    oldArticles = typeArg !== "all"
      ? await sql`SELECT * FROM articles WHERE type = ${typeArg} AND (model_version != 'gpt-4o-mini-improved' OR model_version IS NULL) ORDER BY created_at LIMIT ${limitArg}`
      : await sql`SELECT * FROM articles WHERE model_version != 'gpt-4o-mini-improved' OR model_version IS NULL ORDER BY created_at LIMIT ${limitArg}`;
  }

  console.log(`Found ${oldArticles.length} articles to regenerate\n`);

  let regenerated = 0;
  let errors = 0;

  for (const article of oldArticles) {
    try {
      console.log(`[${article.type}] Regenerating: ${article.title}`);

      let prompt: string | null = null;

      switch (article.type) {
        case "match_report":
          prompt = await buildMatchReportPromptFromArticle(article);
          break;
        case "round_recap":
          prompt = await buildRoundRecapPromptFromArticle(article);
          break;
        case "player_spotlight":
          prompt = await buildPlayerSpotlightPromptFromArticle(article);
          break;
        case "match_preview":
          prompt = await buildMatchPreviewPromptFromArticle(article);
          break;
        case "season_review":
          prompt = await buildSeasonRecapPromptFromArticle(article);
          break;
        default:
          console.log(`   Unsupported type: ${article.type}`);
          continue;
      }

      if (!prompt) {
        console.log(`   Could not build prompt (missing data)`);
        errors++;
        continue;
      }

      const newArticle = await generateArticle(prompt);

      if (!newArticle) {
        console.log(`   Generation failed`);
        errors++;
        continue;
      }

      let wordCount = estimateWordCount(newArticle.content);

      // Retry once if under minimum word count
      const MIN_WORDS: Record<string, number> = {
        match_report: 600,
        round_recap: 600,
        match_preview: 500,
        season_review: 600,
        player_spotlight: 500,
      };
      const minRequired = MIN_WORDS[article.type] || 500;

      if (wordCount < minRequired && prompt) {
        console.log(`   Under minimum (${wordCount}/${minRequired} words), retrying...`);
        const retry = await generateArticle(prompt);
        if (retry && estimateWordCount(retry.content) > wordCount) {
          Object.assign(newArticle, retry);
          wordCount = estimateWordCount(retry.content);
        }
      }

      // Update the article (preserve slug for SEO continuity)
      await sql`
        UPDATE articles SET
          title = ${newArticle.title},
          excerpt = ${newArticle.excerpt},
          content = ${newArticle.content},
          meta_title = ${newArticle.metaTitle},
          meta_description = ${newArticle.metaDescription},
          model_version = ${"gpt-4o-mini-improved"},
          word_count = ${wordCount},
          updated_at = NOW()
        WHERE id = ${article.id}
      `;

      console.log(`   Regenerated (${wordCount} words)`);
      regenerated++;

      // Rate limit
      await new Promise(r => setTimeout(r, 1000));
    } catch (error: any) {
      console.log(`   Error: ${error.message}`);
      errors++;
    }
  }

  console.log(`\nDone! Regenerated: ${regenerated}, Errors: ${errors}, Skipped: ${oldArticles.length - regenerated - errors}`);
}

function estimateWordCount(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}

// --- Prompt builders for each article type ---

async function buildMatchReportPromptFromArticle(article: any): Promise<string | null> {
  if (!article.match_id) return null;

  const matchData = await getMatchData(article.match_id);
  if (!matchData) return null;

  const events = await sql`
    SELECT
      me.minute,
      me.type,
      p.name as player_name,
      t.name as team_name
    FROM match_events me
    INNER JOIN players p ON me.player_id = p.id
    INNER JOIN teams t ON me.team_id = t.id
    WHERE me.match_id = ${article.match_id}
    ORDER BY me.minute
  `;

  const ctx: MatchReportContext = {
    match: {
      id: matchData.id,
      homeTeam: matchData.home_team,
      homeTeamSlug: matchData.home_team_slug,
      awayTeam: matchData.away_team,
      awayTeamSlug: matchData.away_team_slug,
      homeScore: matchData.home_score ?? 0,
      awayScore: matchData.away_score ?? 0,
      competition: matchData.competition,
      competitionSlug: matchData.competition_slug,
      season: matchData.season,
      matchday: matchData.matchday ?? undefined,
      date: String(matchData.scheduled_at),
      venue: matchData.venue ?? undefined,
    },
    events: events.map((e: any) => ({
      minute: e.minute,
      type: e.type,
      playerName: e.player_name,
      teamName: e.team_name,
    })),
  };

  return buildMatchReportPrompt(ctx);
}

async function buildRoundRecapPromptFromArticle(article: any): Promise<string | null> {
  if (!article.competition_season_id || !article.matchday) return null;

  const compSeasonRows = await sql`
    SELECT
      c.name as competition_name,
      c.slug as competition_slug,
      s.label as season_label
    FROM competition_seasons cs
    INNER JOIN competitions c ON c.id = cs.competition_id
    INNER JOIN seasons s ON s.id = cs.season_id
    WHERE cs.id = ${article.competition_season_id}
  `;

  if (compSeasonRows.length === 0) return null;
  const compSeason = compSeasonRows[0];

  // Get matches for this matchday
  const matchdayMatches = await sql`
    SELECT
      m.id,
      m.home_score,
      m.away_score,
      ht.name as home_team,
      at2.name as away_team
    FROM matches m
    INNER JOIN teams ht ON m.home_team_id = ht.id
    INNER JOIN teams at2 ON m.away_team_id = at2.id
    WHERE m.competition_season_id = ${article.competition_season_id}
      AND m.matchday = ${article.matchday}
  `;

  const matchResults = [];
  for (const m of matchdayMatches) {
    const goalEvents = await sql`
      SELECT p.name as player_name
      FROM match_events me
      INNER JOIN players p ON p.id = me.player_id
      WHERE me.match_id = ${m.id}
        AND me.type IN ('goal', 'penalty')
    `;

    matchResults.push({
      homeTeam: m.home_team,
      awayTeam: m.away_team,
      homeScore: m.home_score ?? 0,
      awayScore: m.away_score ?? 0,
      topScorers: goalEvents.map((e: any) => e.player_name),
    });
  }

  const ctx: RoundRecapContext = {
    competition: compSeason.competition_name,
    competitionSlug: compSeason.competition_slug,
    season: compSeason.season_label,
    matchday: article.matchday,
    matches: matchResults,
  };

  return buildRoundRecapPrompt(ctx);
}

async function buildPlayerSpotlightPromptFromArticle(article: any): Promise<string | null> {
  if (!article.primary_player_id) return null;

  const playerRows = await sql`
    SELECT * FROM players WHERE id = ${article.primary_player_id}
  `;
  if (playerRows.length === 0) return null;
  const player = playerRows[0];

  // Get current team
  const teamRows = article.primary_team_id
    ? await sql`SELECT * FROM teams WHERE id = ${article.primary_team_id}`
    : [];
  const team = teamRows[0] || null;

  const ctx: PlayerSpotlightContext = {
    player: {
      name: player.name,
      slug: player.slug,
      position: player.position || "Unknown",
      nationality: player.nationality || "Unknown",
      currentTeam: team?.name || "Unknown",
      currentTeamSlug: team?.slug || "unknown",
    },
    recentMatches: [],
    seasonStats: {
      appearances: 0,
      goals: 0,
      assists: 0,
      competition: "League",
    },
    achievement: article.title || "Outstanding recent form",
  };

  return buildPlayerSpotlightPrompt(ctx);
}

async function buildMatchPreviewPromptFromArticle(article: any): Promise<string | null> {
  if (!article.match_id) return null;

  const matchData = await getMatchData(article.match_id);
  if (!matchData) return null;

  const ctx: MatchPreviewContext = {
    match: {
      homeTeam: matchData.home_team,
      homeTeamSlug: matchData.home_team_slug,
      awayTeam: matchData.away_team,
      awayTeamSlug: matchData.away_team_slug,
      competition: matchData.competition,
      competitionSlug: matchData.competition_slug,
      season: matchData.season,
      matchday: matchData.matchday ?? undefined,
      date: String(matchData.scheduled_at),
      venue: matchData.venue ?? undefined,
    },
  };

  return buildMatchPreviewPrompt(ctx);
}

async function buildSeasonRecapPromptFromArticle(article: any): Promise<string | null> {
  if (!article.competition_season_id) return null;

  const compSeasonRows = await sql`
    SELECT
      c.name as competition_name,
      c.slug as competition_slug,
      s.label as season_label
    FROM competition_seasons cs
    INNER JOIN competitions c ON c.id = cs.competition_id
    INNER JOIN seasons s ON s.id = cs.season_id
    WHERE cs.id = ${article.competition_season_id}
  `;

  if (compSeasonRows.length === 0) return null;
  const compSeason = compSeasonRows[0];

  const matchStats = await sql`
    SELECT
      COUNT(*)::int as total_matches,
      COALESCE(SUM(home_score) + SUM(away_score), 0)::int as total_goals
    FROM matches
    WHERE competition_season_id = ${article.competition_season_id}
  `;

  const totalMatches = Number(matchStats[0]?.total_matches) || 0;
  const totalGoals = Number(matchStats[0]?.total_goals) || 0;

  const ctx: SeasonRecapContext = {
    competition: compSeason.competition_name,
    competitionSlug: compSeason.competition_slug,
    season: compSeason.season_label,
    keyStats: {
      totalGoals,
      matches: totalMatches,
      avgGoalsPerMatch: totalMatches > 0 ? totalGoals / totalMatches : 0,
    },
  };

  return buildSeasonRecapPrompt(ctx);
}

// --- Shared helpers ---

async function getMatchData(matchId: string) {
  const rows = await sql`
    SELECT
      m.id,
      m.matchday,
      m.scheduled_at,
      m.home_score,
      m.away_score,
      ht.name as home_team,
      ht.slug as home_team_slug,
      at2.name as away_team,
      at2.slug as away_team_slug,
      c.name as competition,
      c.slug as competition_slug,
      s.label as season,
      v.name as venue
    FROM matches m
    INNER JOIN teams ht ON m.home_team_id = ht.id
    INNER JOIN teams at2 ON m.away_team_id = at2.id
    INNER JOIN competition_seasons cs ON m.competition_season_id = cs.id
    INNER JOIN competitions c ON cs.competition_id = c.id
    INNER JOIN seasons s ON cs.season_id = s.id
    LEFT JOIN venues v ON m.venue_id = v.id
    WHERE m.id = ${matchId}
  `;

  return rows[0] || null;
}

async function generateArticle(prompt: string): Promise<any | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert sports journalist writing for a professional football database website. Write engaging, detailed articles with vivid language, clear structure, and excellent readability. Use short paragraphs (3-4 sentences max), varied sentence lengths, active voice, and strong transition words. Articles should be comprehensive and informative — never thin or generic. Always return valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 6000,
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
