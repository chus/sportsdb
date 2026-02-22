/**
 * Prompt templates for generating news articles
 */

export interface MatchReportContext {
  match: {
    id: string;
    homeTeam: string;
    homeTeamSlug: string;
    awayTeam: string;
    awayTeamSlug: string;
    homeScore: number;
    awayScore: number;
    competition: string;
    competitionSlug: string;
    season: string;
    matchday?: number;
    date: string;
    venue?: string;
  };
  events: Array<{
    minute: number;
    type: string;
    playerName: string;
    teamName: string;
  }>;
  topPerformers?: Array<{
    playerName: string;
    playerSlug: string;
    team: string;
    stats: string;
  }>;
  existingSummary?: string;
}

export interface RoundRecapContext {
  competition: string;
  competitionSlug: string;
  season: string;
  matchday: number;
  matches: Array<{
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    topScorers: string[];
  }>;
  standings?: Array<{
    position: number;
    team: string;
    points: number;
    goalDiff: number;
  }>;
}

export interface PlayerSpotlightContext {
  player: {
    name: string;
    slug: string;
    position: string;
    nationality: string;
    currentTeam: string;
    currentTeamSlug: string;
  };
  recentMatches: Array<{
    opponent: string;
    result: string;
    goals: number;
    assists: number;
    rating?: number;
  }>;
  seasonStats: {
    appearances: number;
    goals: number;
    assists: number;
    competition: string;
  };
  achievement: string; // "Top scorer of the week", "Hat-trick hero", etc.
}

export function buildMatchReportPrompt(ctx: MatchReportContext): string {
  const scoreline = `${ctx.match.homeTeam} ${ctx.match.homeScore}-${ctx.match.awayScore} ${ctx.match.awayTeam}`;

  // Build internal link references
  const homeTeamLink = `[${ctx.match.homeTeam}](/teams/${ctx.match.homeTeamSlug})`;
  const awayTeamLink = `[${ctx.match.awayTeam}](/teams/${ctx.match.awayTeamSlug})`;
  const competitionLink = `[${ctx.match.competition}](/competitions/${ctx.match.competitionSlug})`;

  const playerLinks = ctx.topPerformers
    ?.map((p) => `${p.playerName}: /players/${p.playerSlug}`)
    .join(", ") || "";

  return `You are an SEO-focused sports journalist writing a match report for a football database website.

MATCH DETAILS:
- Competition: ${ctx.match.competition} (${ctx.match.season})
- Date: ${ctx.match.date}
- Result: ${scoreline}
${ctx.match.venue ? `- Venue: ${ctx.match.venue}` : ""}
${ctx.match.matchday ? `- Matchday: ${ctx.match.matchday}` : ""}

KEY EVENTS:
${ctx.events.map((e) => `${e.minute}' - ${e.type}: ${e.playerName} (${e.teamName})`).join("\n")}

${ctx.existingSummary ? `MATCH SUMMARY (use as reference):\n${ctx.existingSummary}` : ""}

INTERNAL LINKS TO USE:
- Home team: ${homeTeamLink}
- Away team: ${awayTeamLink}
- Competition: ${competitionLink}
${playerLinks ? `- Players: ${playerLinks}` : ""}

SEO REQUIREMENTS:
1. Include the team names and competition in the title for search visibility
2. Use H2/H3 subheadings to structure content (## First Half, ## Second Half, ## Key Moments)
3. Include internal markdown links to team pages: ${homeTeamLink}, ${awayTeamLink}
4. Include internal markdown links to the competition: ${competitionLink}
5. When mentioning goal scorers, link to their player page using format [Player Name](/players/player-slug)
6. Include keywords: "${ctx.match.homeTeam} vs ${ctx.match.awayTeam}", "${ctx.match.competition} ${ctx.match.season}"
7. Write for search intent: people searching for match results and analysis
8. Meta description should be 150-160 chars with key result info

ARTICLE REQUIREMENTS:
1. Engaging headline with team names and score (max 80 chars)
2. Brief excerpt for cards/social (1-2 sentences, 150 chars max, include final score)
3. 400-600 words, professional sports journalism style
4. Clear structure with H2 headings for sections
5. All team/player mentions should be internal links where possible

Generate SEO-friendly slug: lowercase, hyphens, include team slugs (e.g., "team1-vs-team2-result-competition-matchday")

Return as JSON:
{
  "title": "...",
  "slug": "...",
  "excerpt": "...",
  "content": "...",
  "metaTitle": "...",
  "metaDescription": "..."
}`;
}

export function buildRoundRecapPrompt(ctx: RoundRecapContext): string {
  const competitionLink = `[${ctx.competition}](/competitions/${ctx.competitionSlug})`;

  return `You are an SEO-focused sports journalist writing a matchday recap for a football database website.

COMPETITION: ${ctx.competition} (${ctx.season})
MATCHDAY: ${ctx.matchday}

RESULTS:
${ctx.matches.map((m) => `${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam}${m.topScorers.length ? ` (Goals: ${m.topScorers.join(", ")})` : ""}`).join("\n")}

${
  ctx.standings?.length
    ? `CURRENT STANDINGS (Top 5):
${ctx.standings.slice(0, 5).map((s) => `${s.position}. ${s.team} - ${s.points} pts (GD: ${s.goalDiff > 0 ? "+" : ""}${s.goalDiff})`).join("\n")}`
    : ""
}

INTERNAL LINKS:
- Competition: ${competitionLink}
- Use format [Team Name](/teams/team-slug) for all team mentions (convert team name to slug: lowercase, spaces to hyphens)

SEO REQUIREMENTS:
1. Title must include "${ctx.competition}" and "Matchday ${ctx.matchday}" for search
2. Use H2 headings for each major story (## Title Race Heats Up, ## Relegation Battle, etc.)
3. Use H3 for individual match highlights when needed
4. Link all team mentions to /teams/team-slug
5. Include keywords: "${ctx.competition} matchday ${ctx.matchday}", "${ctx.competition} ${ctx.season} results"
6. Meta description: 150-160 chars summarizing key results
7. Structure content with clear hierarchy for readability and SEO

ARTICLE REQUIREMENTS:
1. Headline with competition name and matchday number (max 80 chars)
2. Excerpt for social/cards (1-2 sentences, key storyline)
3. 500-700 words organized by storyline, not just match-by-match
4. Group matches by narrative: title implications, relegation fights, surprise results
5. All team names should be markdown links

Slug format: "${ctx.competitionSlug}-matchday-${ctx.matchday}-recap-${ctx.season.replace("/", "-")}"

Return as JSON:
{
  "title": "...",
  "slug": "...",
  "excerpt": "...",
  "content": "...",
  "metaTitle": "...",
  "metaDescription": "..."
}`;
}

export interface MatchPreviewContext {
  match: {
    homeTeam: string;
    homeTeamSlug: string;
    awayTeam: string;
    awayTeamSlug: string;
    competition: string;
    competitionSlug: string;
    season: string;
    matchday?: number;
    date: string;
    venue?: string;
  };
  homeTeamForm?: string; // "WWDLW"
  awayTeamForm?: string;
  headToHead?: Array<{
    date: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
  }>;
  standingsContext?: string; // "1st vs 4th place clash"
}

export interface SeasonRecapContext {
  competition: string;
  competitionSlug: string;
  season: string;
  winner?: string;
  winnerSlug?: string;
  runnerUp?: string;
  topScorer?: { name: string; slug: string; goals: number };
  relegated?: string[];
  promoted?: string[];
  keyStats: {
    totalGoals: number;
    matches: number;
    avgGoalsPerMatch: number;
  };
  dramaticMoments?: string[];
}

export function buildMatchPreviewPrompt(ctx: MatchPreviewContext): string {
  const homeTeamLink = `[${ctx.match.homeTeam}](/teams/${ctx.match.homeTeamSlug})`;
  const awayTeamLink = `[${ctx.match.awayTeam}](/teams/${ctx.match.awayTeamSlug})`;
  const competitionLink = `[${ctx.match.competition}](/competitions/${ctx.match.competitionSlug})`;

  return `You are an SEO-focused sports journalist writing an exciting match preview for a football database website.

MATCH DETAILS:
- Competition: ${ctx.match.competition} (${ctx.match.season})
- Date: ${ctx.match.date}
- Teams: ${ctx.match.homeTeam} vs ${ctx.match.awayTeam}
${ctx.match.venue ? `- Venue: ${ctx.match.venue}` : ""}
${ctx.match.matchday ? `- Matchday: ${ctx.match.matchday}` : ""}

${ctx.homeTeamForm ? `HOME TEAM FORM: ${ctx.homeTeamForm}` : ""}
${ctx.awayTeamForm ? `AWAY TEAM FORM: ${ctx.awayTeamForm}` : ""}

${ctx.headToHead?.length ? `RECENT HEAD-TO-HEAD:\n${ctx.headToHead.map((h) => `${h.date}: ${h.homeTeam} ${h.homeScore}-${h.awayScore} ${h.awayTeam}`).join("\n")}` : ""}

${ctx.standingsContext || ""}

INTERNAL LINKS:
- Home team: ${homeTeamLink}
- Away team: ${awayTeamLink}
- Competition: ${competitionLink}

REQUIREMENTS:
1. CLICKBAIT headline that builds excitement (max 80 chars) - use power words like "CLASH", "BATTLE", "SHOWDOWN"
2. Engaging excerpt that teases the stakes (150 chars max)
3. 400-500 words covering:
   - Why this match matters
   - Recent form analysis
   - Key players to watch (link to player pages)
   - Historical context
   - Prediction or key battles
4. Use H2 headings for structure
5. Include ALL internal links to teams, players, competition
6. SEO keywords: "${ctx.match.homeTeam} vs ${ctx.match.awayTeam} prediction", "${ctx.match.competition} preview"

Generate SEO slug: "${ctx.match.homeTeamSlug}-vs-${ctx.match.awayTeamSlug}-preview-${ctx.match.competitionSlug}"

Return as JSON:
{
  "title": "...",
  "slug": "...",
  "excerpt": "...",
  "content": "...",
  "metaTitle": "...",
  "metaDescription": "..."
}`;
}

export function buildSeasonRecapPrompt(ctx: SeasonRecapContext): string {
  const competitionLink = `[${ctx.competition}](/competitions/${ctx.competitionSlug})`;
  const winnerLink = ctx.winnerSlug ? `[${ctx.winner}](/teams/${ctx.winnerSlug})` : ctx.winner;

  return `You are an SEO-focused sports journalist writing a dramatic season recap for a football database website.

SEASON: ${ctx.competition} ${ctx.season}

${ctx.winner ? `CHAMPIONS: ${ctx.winner}` : ""}
${ctx.runnerUp ? `RUNNERS-UP: ${ctx.runnerUp}` : ""}
${ctx.topScorer ? `TOP SCORER: ${ctx.topScorer.name} (${ctx.topScorer.goals} goals)` : ""}
${ctx.relegated?.length ? `RELEGATED: ${ctx.relegated.join(", ")}` : ""}
${ctx.promoted?.length ? `PROMOTED: ${ctx.promoted.join(", ")}` : ""}

STATS:
- Total Matches: ${ctx.keyStats.matches}
- Total Goals: ${ctx.keyStats.totalGoals}
- Average Goals/Match: ${ctx.keyStats.avgGoalsPerMatch.toFixed(2)}

${ctx.dramaticMoments?.length ? `DRAMATIC MOMENTS:\n${ctx.dramaticMoments.join("\n")}` : ""}

INTERNAL LINKS:
- Competition: ${competitionLink}
${ctx.winnerSlug ? `- Champions: ${winnerLink}` : ""}
${ctx.topScorer?.slug ? `- Top Scorer: [${ctx.topScorer.name}](/players/${ctx.topScorer.slug})` : ""}

REQUIREMENTS:
1. CLICKBAIT headline that captures the season drama (max 80 chars)
   - Examples: "How [Team] Defied All Odds", "The Season That Changed Everything", "Glory and Heartbreak"
2. Engaging excerpt highlighting the main story (150 chars)
3. 600-800 words covering:
   - The title race narrative
   - Key turning points
   - Star performers (link to player pages)
   - Relegation battles
   - Memorable moments
   - Legacy and impact
4. Use H2 headings for major sections
5. Include dramatic language and storytelling
6. ALL team and player mentions must be links

SEO keywords: "${ctx.competition} ${ctx.season} review", "${ctx.competition} champions", "${ctx.competition} season recap"

Generate slug: "${ctx.competitionSlug}-${ctx.season.replace("/", "-")}-season-review"

Return as JSON:
{
  "title": "...",
  "slug": "...",
  "excerpt": "...",
  "content": "...",
  "metaTitle": "...",
  "metaDescription": "..."
}`;
}

export function buildPlayerSpotlightPrompt(ctx: PlayerSpotlightContext): string {
  const playerLink = `[${ctx.player.name}](/players/${ctx.player.slug})`;
  const teamLink = `[${ctx.player.currentTeam}](/teams/${ctx.player.currentTeamSlug})`;

  return `You are an SEO-focused sports journalist writing a player spotlight for a football database website.

PLAYER PROFILE:
- Name: ${ctx.player.name}
- Position: ${ctx.player.position}
- Nationality: ${ctx.player.nationality}
- Current Club: ${ctx.player.currentTeam}

ACHIEVEMENT: ${ctx.achievement}

RECENT FORM (Last 5 matches):
${ctx.recentMatches.map((m) => `vs ${m.opponent} (${m.result}): ${m.goals}G ${m.assists}A${m.rating ? ` - Rating: ${m.rating}` : ""}`).join("\n")}

SEASON STATS (${ctx.seasonStats.competition}):
- Appearances: ${ctx.seasonStats.appearances}
- Goals: ${ctx.seasonStats.goals}
- Assists: ${ctx.seasonStats.assists}

INTERNAL LINKS (MUST USE):
- Player: ${playerLink}
- Team: ${teamLink}
- Use format [Team Name](/teams/team-slug) for opponent mentions
- Use format [Competition](/competitions/competition-slug) for competition mentions

SEO REQUIREMENTS:
1. Title MUST include player's full name for search (e.g., "${ctx.player.name}")
2. Include team name in title or first paragraph
3. Use H2 headings for sections (## Recent Form, ## Season Statistics, ## Impact Analysis)
4. First paragraph should link to the player page: ${playerLink}
5. Second mention should link to team page: ${teamLink}
6. Include keywords: "${ctx.player.name} stats", "${ctx.player.name} ${ctx.player.currentTeam}"
7. Meta title: "${ctx.player.name} | Player Spotlight | SportsDB" (max 60 chars)
8. Meta description: Include achievement, stats, and team name (150-160 chars)

ARTICLE REQUIREMENTS:
1. Headline with player name and achievement (max 80 chars)
2. Excerpt summarizing the achievement (1-2 sentences)
3. 400-500 words with clear H2 structure
4. Open by linking to the player's main page
5. Mention and link to the team
6. Compare to other players if relevant (link to their pages)
7. End with forward-looking statement about upcoming matches

Slug format: "${ctx.player.slug}-spotlight-${Date.now()}"

Return as JSON:
{
  "title": "...",
  "slug": "...",
  "excerpt": "...",
  "content": "...",
  "metaTitle": "...",
  "metaDescription": "..."
}`;
}
