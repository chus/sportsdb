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
  standings?: Array<{
    position: number;
    team: string;
    points: number;
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
  achievement: string;
}

export function buildMatchReportPrompt(ctx: MatchReportContext): string {
  const scoreline = `${ctx.match.homeTeam} ${ctx.match.homeScore}-${ctx.match.awayScore} ${ctx.match.awayTeam}`;

  const homeTeamLink = `[${ctx.match.homeTeam}](/teams/${ctx.match.homeTeamSlug})`;
  const awayTeamLink = `[${ctx.match.awayTeam}](/teams/${ctx.match.awayTeamSlug})`;
  const competitionLink = `[${ctx.match.competition}](/competitions/${ctx.match.competitionSlug})`;

  const playerLinks =
    ctx.topPerformers
      ?.map((p) => `${p.playerName}: /players/${p.playerSlug}`)
      .join(", ") || "";

  const standingsContext = ctx.standings?.length
    ? `\nSTANDINGS CONTEXT (use for analysis):\n${ctx.standings
        .slice(0, 6)
        .map((s) => `${s.position}. ${s.team} - ${s.points} pts`)
        .join("\n")}`
    : "";

  const topPerformerContext = ctx.topPerformers?.length
    ? `\nTOP PERFORMERS (mention season stats):\n${ctx.topPerformers
        .map((p) => `- ${p.playerName} (${p.team}): ${p.stats}`)
        .join("\n")}`
    : "";

  return `You are an SEO-focused sports journalist writing an in-depth match report for a football database website.

LENGTH REQUIREMENT (CRITICAL — READ FIRST):
This article MUST be a MINIMUM of 1300 words. Target 1500-1800 words. Articles shorter than 1300 words will be rejected and regenerated.
This is an in-depth analysis piece, NOT a summary. Do NOT be concise. Expand every observation into multiple sentences. Add tactical context, historical reference, player background, and forward-looking analysis throughout.

MATCH DETAILS:
- Competition: ${ctx.match.competition} (${ctx.match.season})
- Date: ${ctx.match.date}
- Result: ${scoreline}
${ctx.match.venue ? `- Venue: ${ctx.match.venue}` : ""}
${ctx.match.matchday ? `- Matchday: ${ctx.match.matchday}` : ""}

KEY EVENTS:
${ctx.events.map((e) => `${e.minute}' - ${e.type}: ${e.playerName} (${e.teamName})`).join("\n")}
${standingsContext}
${topPerformerContext}

${ctx.existingSummary ? `MATCH SUMMARY (use as reference):\n${ctx.existingSummary}` : ""}

INTERNAL LINKS TO USE:
- Home team: ${homeTeamLink}
- Away team: ${awayTeamLink}
- Competition: ${competitionLink}
${playerLinks ? `- Players: ${playerLinks}` : ""}

REQUIRED STRUCTURE — Each section has a MINIMUM word count. Do not skip any section.

## Pre-Match Context (MIN 200 words)
Cover ALL of:
- The stakes for both teams entering this fixture
- Recent form going into the match (last 5 results if known)
- Standings position and implications for the table
- Tactical expectations and likely formations
- Any narrative threads (rivalries, redemption stories, injury concerns)
- What pundits and fans were expecting

## First Half (MIN 250 words)
Cover ALL of:
- Opening tempo and which team set the pace
- Tactical setup as it played out in practice
- Key chances created (with minute references)
- All goals scored in the half — describe HOW each goal happened, not just that it happened
- Defensive moments, near-misses, and refereeing decisions
- The psychological state at the half-time whistle

## Second Half (MIN 250 words)
Cover ALL of:
- How the second half opened — did patterns continue or shift?
- Tactical adjustments made by either manager
- Substitution impact (who came on, when, and what they changed)
- All second-half goals — describe the build-up and finish in detail
- Late drama, near-misses, momentum swings
- How the final whistle felt

## Key Moments (MIN 200 words)
Cover ALL of:
- The 2-3 individual moments that defined the result
- Standout individual performances on both sides
- Any controversial refereeing decisions
- The single turning point you would highlight if asked

## Player Ratings (MIN 200 words)
Cover ALL of:
- 3-4 key players from each team with a one-paragraph assessment each
- Specific actions that earned or cost them their rating
- Reference season stats where available
- A man-of-the-match selection with justification

## What This Means (MIN 200 words)
Cover ALL of:
- Implications for the league table
- What this changes for both teams' upcoming fixtures
- Season narrative — does this confirm or upset expectations?
- Form trajectories going forward
- Forward-looking takeaways for both sides

SEO REQUIREMENTS:
1. Include the team names and competition in the title for search visibility
2. Include internal markdown links to ${homeTeamLink}, ${awayTeamLink}, ${competitionLink}
3. When mentioning goal scorers, link to their player page using format [Player Name](/players/player-slug)
4. Include keywords: "${ctx.match.homeTeam} vs ${ctx.match.awayTeam}", "${ctx.match.competition} ${ctx.match.season}"
5. Meta description should be 150-160 chars with key result info
6. Reference specific minutes for all events
7. Use standings data for context
8. Reference player season stats when available

READABILITY GUIDELINES:
- Keep paragraphs to 3-4 sentences max for easy scanning
- Vary sentence length: mix short punchy sentences with longer analytical ones
- Use transition words between sections (Meanwhile, However, In contrast, As a result)
- Open each section with a hook sentence that draws the reader in
- Use active voice predominantly
- Include vivid match descriptions, not just dry recaps

Generate SEO-friendly slug: lowercase, hyphens, include team slugs.

Return as JSON:
{
  "title": "...",
  "slug": "...",
  "excerpt": "1-2 sentences, max 150 chars, includes final score",
  "content": "Full markdown article — MINIMUM 1300 WORDS",
  "metaTitle": "Max 60 chars",
  "metaDescription": "150-160 chars"
}

FINAL REMINDER: The "content" field must be at least 1300 words. Each ## section must hit its minimum. If you finish early, expand the analysis sections — never cut sections short.`;
}

export function buildRoundRecapPrompt(ctx: RoundRecapContext): string {
  const competitionLink = `[${ctx.competition}](/competitions/${ctx.competitionSlug})`;

  return `You are an SEO-focused sports journalist writing a matchday recap for a football database website.

LENGTH REQUIREMENT (CRITICAL — READ FIRST):
This article MUST be a MINIMUM of 1000 words. Target 1100-1400 words. Articles shorter than 1000 words will be rejected and regenerated.
This is a comprehensive matchday review, NOT a results dump. Discuss every notable match in detail. Add table context, form analysis, and individual performances throughout.

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

REQUIRED STRUCTURE — Each section has a MINIMUM word count. Do not skip sections.

## Top of the Table (MIN 200 words)
Cover:
- Title contenders and their results this round
- How the standings shifted at the top
- Key performances from leading clubs
- Implications for the title race

## The Headline Result (MIN 200 words)
Pick the single biggest story of the matchday and dig in:
- Pre-match expectations vs what happened
- The key moments that decided it
- Standout individuals
- What it means going forward

## Mid-Table & European Race (MIN 150 words)
Cover:
- Battles for European qualification spots
- Surprise results from mid-table sides
- Form trends in this section of the table

## Relegation Battle (MIN 150 words)
Cover:
- Results from teams in the bottom third
- Survival hopes and dwindling chances
- Standout individual performances from relegation-threatened sides

## Standout Performers (MIN 150 words)
Cover:
- 3-4 individual players who shaped the matchday with stats
- A goal-of-the-round nominee
- Tactical or managerial highlights worth noting

## Matchday in Numbers (MIN 100 words)
Cover:
- Goals scored across the round
- Notable streaks (winning runs, clean sheets, scoring runs)
- Records or milestones reached

SEO REQUIREMENTS:
1. Title must include "${ctx.competition}" and "Matchday ${ctx.matchday}"
2. Link all team mentions to /teams/team-slug
3. Include keywords: "${ctx.competition} matchday ${ctx.matchday}", "${ctx.competition} ${ctx.season} results"
4. Meta description: 150-160 chars summarizing key results

READABILITY GUIDELINES:
- Keep paragraphs to 3-4 sentences max for easy scanning
- Open with the biggest storyline of the matchday as a hook
- Use transition words between sections (Meanwhile, Elsewhere, In contrast)
- Vary sentence length for rhythm
- Use active voice and vivid verbs ("demolished", "edged past", "stunned")
- Every match mention should feel like a mini-story, not just a scoreline

Slug format: "${ctx.competitionSlug}-matchday-${ctx.matchday}-recap-${ctx.season.replace("/", "-")}"

Return as JSON:
{
  "title": "Max 80 chars",
  "slug": "...",
  "excerpt": "1-2 sentences, key storyline",
  "content": "Full markdown — MINIMUM 1000 WORDS",
  "metaTitle": "Max 60 chars",
  "metaDescription": "150-160 chars"
}

FINAL REMINDER: The "content" field must be at least 1000 words. Each ## section must hit its minimum. If you finish early, expand the storylines — never cut sections short.`;
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
  homeTeamForm?: string;
  awayTeamForm?: string;
  headToHead?: Array<{
    date: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
  }>;
  standingsContext?: string;
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

  return `You are an SEO-focused sports journalist writing a professional match preview for a football database website. Write in a factual, authoritative tone like BBC Sport — no tabloid hype or sensationalism.

LENGTH REQUIREMENT (CRITICAL — READ FIRST):
This article MUST be a MINIMUM of 800 words. Target 900-1100 words. Articles shorter than 800 words will be rejected and regenerated.
This is a thorough preview, NOT a paragraph summary. Discuss form, players, tactics, and historical context in depth.

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

REQUIRED STRUCTURE — Each section has a MINIMUM word count. Do not skip sections.

## Why This Match Matters (MIN 150 words)
Cover:
- The stakes for both sides
- Table implications and points at stake
- Any rivalry, history, or narrative context
- What pundits and fans are watching for

## Form Guide (MIN 150 words)
Cover:
- Recent results (last 5) for both teams with brief commentary on each
- Patterns: scoring trends, defensive solidity, home/away splits
- Injury or suspension news where relevant

## Key Players to Watch (MIN 150 words)
Cover:
- 2-3 players per side likely to decide the match
- Their season stats and current form
- Tactical role and the matchups they'll face
- Link to player pages where possible

## Head-to-Head History (MIN 100 words)
Cover:
- Past meetings between these teams
- Patterns from previous fixtures (high-scoring, defensive, home dominance, etc.)
- Memorable moments from recent encounters

## Tactical Battle (MIN 150 words)
Cover:
- Expected formations from both managers
- Key matchups (e.g., wing-back vs winger)
- How each side will look to win the game
- Where the match could be decided on the pitch

## Prediction (MIN 100 words)
Cover:
- An informed take on the likely outcome
- Reasoning grounded in the form, head-to-head, and tactical analysis above
- A specific scoreline prediction

REQUIREMENTS:
1. Factual headline (max 80 chars) — include both team names and competition. No hype words (no "epic", "showdown", "clash", "battle", "titans"). No exclamation marks.
2. Concise excerpt (150 chars max)
3. ALL team/player/competition mentions linked
4. SEO keywords: "${ctx.match.homeTeam} vs ${ctx.match.awayTeam} prediction", "${ctx.match.competition} preview"

READABILITY GUIDELINES:
- Keep paragraphs to 3-4 sentences max
- Build anticipation: start with context, end with prediction
- Use active voice and present tense for immediacy
- Vary sentence length for rhythm

Generate SEO slug: "${ctx.match.homeTeamSlug}-vs-${ctx.match.awayTeamSlug}-preview-${ctx.match.competitionSlug}"

Return as JSON:
{
  "title": "Max 80 chars",
  "slug": "...",
  "excerpt": "Max 150 chars",
  "content": "Full markdown — MINIMUM 800 WORDS",
  "metaTitle": "Max 60 chars",
  "metaDescription": "150-160 chars"
}

FINAL REMINDER: The "content" field must be at least 800 words. Each ## section must hit its minimum. If you finish early, expand the analysis — never cut sections short.`;
}

export function buildSeasonRecapPrompt(ctx: SeasonRecapContext): string {
  const competitionLink = `[${ctx.competition}](/competitions/${ctx.competitionSlug})`;
  const winnerLink = ctx.winnerSlug ? `[${ctx.winner}](/teams/${ctx.winnerSlug})` : ctx.winner;

  return `You are an SEO-focused sports journalist writing a comprehensive season recap for a football database website. Write in a factual, authoritative tone like BBC Sport — no tabloid hype or sensationalism.

LENGTH REQUIREMENT (CRITICAL — READ FIRST):
This article MUST be a MINIMUM of 1300 words. Target 1500-1800 words. Articles shorter than 1300 words will be rejected and regenerated.
This is a definitive season retrospective, NOT a summary. Cover every major storyline in depth with chronological narrative and historical context.

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

REQUIRED STRUCTURE — Each section has a MINIMUM word count.

## The Title Race (MIN 250 words)
Cover:
- Pre-season expectations and early favourites
- How the title race unfolded month by month
- The decisive results and moments
- The eventual winner's path to the trophy

## Key Turning Points (MIN 200 words)
Cover:
- 3-4 pivotal moments that shaped the season
- For each: what happened, when, and why it mattered
- Manager changes, transfer windows, big results

## Star Performers (MIN 200 words)
Cover:
- 4-5 players who defined the campaign (link to player pages)
- Goals, assists, and decisive contributions for each
- Who deserves player of the season and why

## The Relegation Battle (MIN 200 words)
Cover:
- The fight to avoid the drop
- Which clubs survived, which fell
- Key moments and managerial decisions at the bottom

## Season in Numbers (MIN 150 words)
Cover:
- Goals scored, clean sheets, attendance highlights
- Records broken or approached
- Notable streaks and statistical anomalies

## Memorable Moments (MIN 150 words)
Cover:
- Dramatic finishes, upsets, milestones
- Goals or matches that will be remembered
- Off-pitch storylines that shaped the season

## Legacy (MIN 150 words)
Cover:
- Where this season sits in historical context
- What it means for the clubs involved going forward
- A forward-looking statement about next season

REQUIREMENTS:
1. Factual headline (max 80 chars) — include competition and season. No hype words.
2. Engaging excerpt (150 chars)
3. ALL team and player mentions must be links

READABILITY GUIDELINES:
- Keep paragraphs to 3-4 sentences max
- Open with a dramatic scene-setting paragraph
- Use chronological narrative within sections
- Vary sentence length
- Use active voice and vivid language

SEO keywords: "${ctx.competition} ${ctx.season} review", "${ctx.competition} champions", "${ctx.competition} season recap"

Generate slug: "${ctx.competitionSlug}-${ctx.season.replace("/", "-")}-season-review"

Return as JSON:
{
  "title": "Max 80 chars",
  "slug": "...",
  "excerpt": "Max 150 chars",
  "content": "Full markdown — MINIMUM 1300 WORDS",
  "metaTitle": "Max 60 chars",
  "metaDescription": "150-160 chars"
}

FINAL REMINDER: The "content" field must be at least 1300 words. Each ## section must hit its minimum.`;
}

export function buildPlayerSpotlightPrompt(ctx: PlayerSpotlightContext): string {
  const playerLink = `[${ctx.player.name}](/players/${ctx.player.slug})`;
  const teamLink = `[${ctx.player.currentTeam}](/teams/${ctx.player.currentTeamSlug})`;

  return `You are an SEO-focused sports journalist writing a player spotlight for a football database website.

LENGTH REQUIREMENT (CRITICAL — READ FIRST):
This article MUST be a MINIMUM of 900 words. Target 1000-1200 words. Articles shorter than 900 words will be rejected and regenerated.
This is an in-depth player feature, NOT a quick stat recap. Cover the player's story, style, performances, and outlook in real depth.

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

REQUIRED STRUCTURE — Each section has a MINIMUM word count.

## The Achievement (MIN 150 words)
Cover:
- What ${ctx.player.name} has accomplished and why it matters
- Context: how rare or significant this is
- What it tells us about the player's level
- Open with a vivid scene-setting paragraph

## Recent Form (MIN 200 words)
Cover:
- A detailed breakdown of the last 5 matches
- For each notable match: opponent, result, individual contribution, key moments
- Trends visible across the run (scoring streaks, assists, big-game performances)
- How form compares to earlier in the season

## Season in Context (MIN 150 words)
Cover:
- How this stretch fits into the overall campaign
- Where ${ctx.player.name} sits in scoring/assist charts
- Impact on the team's results and standing
- Comparison with their previous seasons

## Playing Style (MIN 150 words)
Cover:
- Tactical role and on-pitch responsibilities
- Strengths that make them effective
- Signature moves, finishing technique, link-up play
- What sets them apart from peers in the same position

## Comparison (MIN 100 words)
Cover:
- How they stack up against 2-3 peers in the same position this season
- Stat comparisons where useful
- What they do better and what they could improve

## What's Next (MIN 150 words)
Cover:
- Upcoming fixtures and what to watch for
- Personal targets (records within reach, milestones)
- Implications for their team's season
- A forward-looking statement

SEO REQUIREMENTS:
1. Title MUST include player's full name (e.g., "${ctx.player.name}")
2. Include team name in title or first paragraph
3. First paragraph must link to ${playerLink}
4. Include keywords: "${ctx.player.name} stats", "${ctx.player.name} ${ctx.player.currentTeam}"
5. Meta title: "${ctx.player.name} | Player Spotlight | SportsDB" (max 60 chars)
6. Meta description: Include achievement, stats, and team name (150-160 chars)

READABILITY GUIDELINES:
- Keep paragraphs to 3-4 sentences max
- Open with a vivid description of the player's standout moment
- Use stats naturally within prose, not as dry lists
- Vary sentence length for rhythm
- Use active voice and strong verbs
- Include analytical insights, not just stat recaps

Slug format: "${ctx.player.slug}-season-spotlight-2025-26"

Return as JSON:
{
  "title": "Max 80 chars",
  "slug": "...",
  "excerpt": "1-2 sentences",
  "content": "Full markdown — MINIMUM 900 WORDS",
  "metaTitle": "Max 60 chars",
  "metaDescription": "150-160 chars"
}

FINAL REMINDER: The "content" field must be at least 900 words. Each ## section must hit its minimum.`;
}

export interface EventMatchSummary {
  homeTeam: string;
  homeTeamSlug: string;
  awayTeam: string;
  awayTeamSlug: string;
  competition: string;
  competitionSlug: string;
  date: string;
  venue?: string;
  matchday?: number;
}

export interface EventFinishedMatchSummary extends EventMatchSummary {
  homeScore: number;
  awayScore: number;
  topScorers?: string[];
}

export interface EventPreviewContext {
  event: {
    slug: string;
    title: string;
    description?: string;
    type: string;
    date: string;
    importance: number;
    competition?: { name: string; slug: string };
  };
  matches: EventMatchSummary[];
  recentForm?: Record<string, string>;
  headToHead?: Array<{
    date: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
  }>;
  standingsContext?: string;
}

export interface EventRecapContext {
  event: {
    slug: string;
    title: string;
    description?: string;
    type: string;
    date: string;
    importance: number;
    competition?: { name: string; slug: string };
  };
  finishedMatches: EventFinishedMatchSummary[];
  standoutPerformers?: Array<{
    name: string;
    slug: string;
    team: string;
    teamSlug: string;
    line: string;
  }>;
  standingsContext?: string;
}

function formatEventDateForSlug(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  } catch {
    return "";
  }
}

export function buildEventPreviewPrompt(ctx: EventPreviewContext): string {
  const competitionLink = ctx.event.competition
    ? `[${ctx.event.competition.name}](/competitions/${ctx.event.competition.slug})`
    : "";

  const matchesBlock = ctx.matches.length
    ? ctx.matches
        .map((m) => {
          const home = `[${m.homeTeam}](/teams/${m.homeTeamSlug})`;
          const away = `[${m.awayTeam}](/teams/${m.awayTeamSlug})`;
          const comp = `[${m.competition}](/competitions/${m.competitionSlug})`;
          const md = m.matchday ? ` (MD ${m.matchday})` : "";
          return `- ${home} vs ${away} — ${comp}${md} — ${m.date}${m.venue ? ` — ${m.venue}` : ""}`;
        })
        .join("\n")
    : "- No fixture list available";

  const formBlock = ctx.recentForm
    ? Object.entries(ctx.recentForm)
        .map(([team, form]) => `- ${team}: ${form}`)
        .join("\n")
    : "";

  const h2hBlock = ctx.headToHead?.length
    ? ctx.headToHead
        .map(
          (h) =>
            `- ${h.date}: ${h.homeTeam} ${h.homeScore}-${h.awayScore} ${h.awayTeam}`
        )
        .join("\n")
    : "";

  const slugDate = formatEventDateForSlug(ctx.event.date);

  return `You are an SEO-focused sports journalist writing an in-depth preview for a high-importance football event. Write in a factual, authoritative tone like BBC Sport — no tabloid hype or sensationalism.

LENGTH REQUIREMENT (CRITICAL — READ FIRST):
This article MUST be a MINIMUM of 1200 words. Target 1400-1800 words. Articles shorter than 1200 words will be rejected and regenerated.
This is a definitive preview of a marquee football event, NOT a paragraph summary. Cover storylines, tactics, players, and context in real depth.

EVENT DETAILS:
- Title: ${ctx.event.title}
- Type: ${ctx.event.type}
- Date: ${ctx.event.date}
- Importance: ${ctx.event.importance}/5
${ctx.event.competition ? `- Competition: ${ctx.event.competition.name}` : ""}
${ctx.event.description ? `- Context: ${ctx.event.description}` : ""}

FIXTURES INVOLVED:
${matchesBlock}

${formBlock ? `RECENT FORM:\n${formBlock}` : ""}

${h2hBlock ? `RECENT HEAD-TO-HEAD:\n${h2hBlock}` : ""}

${ctx.standingsContext || ""}

INTERNAL LINKS:
- Every team mention: [Team Name](/teams/team-slug)
- Every competition mention: [Competition](/competitions/competition-slug)
${competitionLink ? `- Primary competition: ${competitionLink}` : ""}

REQUIRED STRUCTURE — Each section has a MINIMUM word count. Do not skip sections.

## Why ${ctx.event.title} Matters (MIN 200 words)
Cover:
- What makes this event a marquee fixture or moment
- Historical, sporting, or narrative stakes
- Why fans and pundits are circling the date
- Standings, qualification, or silverware implications

## Teams and Storylines (MIN 200 words)
Cover:
- The main protagonists and their current trajectories
- Ongoing narratives heading into the event (recent form, controversies, key signings)
- Manager profiles and season context
- What each side needs from this event

## Key Players to Watch (MIN 200 words)
Cover:
- 3-5 players likely to decide the outcome
- Season stats and current form for each
- Their tactical role and expected matchups
- Internal links to player pages where possible

## Tactical Battlegrounds (MIN 200 words)
Cover:
- Expected formations and systems
- Key positional matchups (wing-back vs winger, midfield press, etc.)
- How each team will try to win
- Where the event could be decided tactically

## Recent Form and Head-to-Head (MIN 150 words)
Cover:
- Form guides for each side (last 5 results with context)
- Relevant historical meetings and their patterns
- Momentum shifts heading into the event
- What the numbers say about the matchup

## Viewing Notes and Predictions (MIN 150 words)
Cover:
- Kick-off times, venues, and broadcast details if available
- Informed outcome predictions grounded in the analysis above
- Specific scorelines or key storylines to watch
- A forward-looking close tying back to the event's importance

REQUIREMENTS:
1. Factual headline (max 80 chars) — include the event name. No hype words (no "epic", "showdown", "clash", "battle", "titans"). No exclamation marks.
2. Concise excerpt (150 chars max)
3. ALL team/player/competition mentions must be internal markdown links
4. SEO keywords: "${ctx.event.title} preview"${ctx.event.competition ? `, "${ctx.event.competition.name} ${ctx.event.type}"` : ""}

READABILITY GUIDELINES:
- Keep paragraphs to 3-4 sentences max
- Open with a scene-setting paragraph that names the event
- Use active voice and present tense for immediacy
- Vary sentence length for rhythm
- Stay factual — no speculation dressed up as fact

Generate SEO slug: "${ctx.event.slug}-preview${slugDate ? `-${slugDate}` : ""}"

Return as JSON:
{
  "title": "Max 80 chars",
  "slug": "...",
  "excerpt": "Max 150 chars",
  "content": "Full markdown — MINIMUM 1200 WORDS",
  "metaTitle": "Max 60 chars",
  "metaDescription": "150-160 chars"
}

FINAL REMINDER: The "content" field must be at least 1200 words. Each ## section must hit its minimum. If you finish early, expand the analysis — never cut sections short.`;
}

export function buildEventRecapPrompt(ctx: EventRecapContext): string {
  const competitionLink = ctx.event.competition
    ? `[${ctx.event.competition.name}](/competitions/${ctx.event.competition.slug})`
    : "";

  const resultsBlock = ctx.finishedMatches.length
    ? ctx.finishedMatches
        .map((m) => {
          const home = `[${m.homeTeam}](/teams/${m.homeTeamSlug})`;
          const away = `[${m.awayTeam}](/teams/${m.awayTeamSlug})`;
          const comp = `[${m.competition}](/competitions/${m.competitionSlug})`;
          const md = m.matchday ? ` (MD ${m.matchday})` : "";
          const scorers = m.topScorers?.length
            ? ` — scorers: ${m.topScorers.join(", ")}`
            : "";
          return `- ${home} ${m.homeScore}-${m.awayScore} ${away} — ${comp}${md}${scorers}`;
        })
        .join("\n")
    : "- No results recorded";

  const performersBlock = ctx.standoutPerformers?.length
    ? ctx.standoutPerformers
        .map(
          (p) =>
            `- [${p.name}](/players/${p.slug}) ([${p.team}](/teams/${p.teamSlug})): ${p.line}`
        )
        .join("\n")
    : "";

  const slugDate = formatEventDateForSlug(ctx.event.date);

  return `You are an SEO-focused sports journalist writing an in-depth recap of a high-importance football event. Write in a factual, authoritative tone like BBC Sport — no tabloid hype or sensationalism.

LENGTH REQUIREMENT (CRITICAL — READ FIRST):
This article MUST be a MINIMUM of 1200 words. Target 1400-1800 words. Articles shorter than 1200 words will be rejected and regenerated.
This is a definitive recap of a marquee football event, NOT a paragraph summary. Cover results, performances, tactics, and implications in real depth.

EVENT DETAILS:
- Title: ${ctx.event.title}
- Type: ${ctx.event.type}
- Date: ${ctx.event.date}
- Importance: ${ctx.event.importance}/5
${ctx.event.competition ? `- Competition: ${ctx.event.competition.name}` : ""}
${ctx.event.description ? `- Context: ${ctx.event.description}` : ""}

RESULTS:
${resultsBlock}

${performersBlock ? `STANDOUT PERFORMERS:\n${performersBlock}` : ""}

${ctx.standingsContext || ""}

INTERNAL LINKS:
- Every team mention: [Team Name](/teams/team-slug)
- Every player mention: [Player Name](/players/player-slug)
- Every competition mention: [Competition](/competitions/competition-slug)
${competitionLink ? `- Primary competition: ${competitionLink}` : ""}

REQUIRED STRUCTURE — Each section has a MINIMUM word count. Do not skip sections.

## ${ctx.event.title}: The Story of the Day (MIN 200 words)
Cover:
- A scene-setting narrative of how the event unfolded
- The headline storylines that defined the day
- Where this event sits in the wider season context
- The emotional arc across the fixtures involved

## Headline Results (MIN 200 words)
Cover:
- Each major result with a short tactical and narrative summary
- The decisive moments (goals, red cards, substitutions)
- Context: were results expected or upsets?
- Links to every team involved

## Standout Performers (MIN 200 words)
Cover:
- 3-5 players who shaped the event
- Their contributions (goals, assists, key passes, defensive actions)
- How their performances compare to season norms
- Internal links to player pages

## Tactical Takeaways (MIN 200 words)
Cover:
- Formations and in-game adjustments that mattered
- Pressing patterns, transitional play, set-piece routines
- Managerial calls that paid off or backfired
- What opposing coaches will note going forward

## Table and Standings Impact (MIN 150 words)
Cover:
- How the event reshaped league tables, qualification races, or knockout brackets
- Gap to leaders, relegation implications, seeding effects
- Which clubs gained or lost the most ground
- Key standings snapshot after the event

## What Comes Next (MIN 150 words)
Cover:
- The immediate fixtures ahead for the clubs involved
- Storylines to track in the coming weeks
- Injuries, suspensions, or selection headaches triggered by the event
- A forward-looking close tying back to the event's significance

REQUIREMENTS:
1. Factual headline (max 80 chars) — include the event name. No hype words (no "epic", "showdown", "clash", "battle", "titans"). No exclamation marks.
2. Concise excerpt (150 chars max)
3. ALL team/player/competition mentions must be internal markdown links
4. SEO keywords: "${ctx.event.title} recap", "${ctx.event.title} results"${ctx.event.competition ? `, "${ctx.event.competition.name} ${ctx.event.type}"` : ""}

READABILITY GUIDELINES:
- Keep paragraphs to 3-4 sentences max
- Open with a vivid sentence anchoring the day
- Use past tense consistently for the match action
- Vary sentence length for rhythm
- Stay factual — describe what happened, don't embellish

Generate SEO slug: "${ctx.event.slug}-recap${slugDate ? `-${slugDate}` : ""}"

Return as JSON:
{
  "title": "Max 80 chars",
  "slug": "...",
  "excerpt": "Max 150 chars",
  "content": "Full markdown — MINIMUM 1200 WORDS",
  "metaTitle": "Max 60 chars",
  "metaDescription": "150-160 chars"
}

FINAL REMINDER: The "content" field must be at least 1200 words. Each ## section must hit its minimum. If you finish early, expand the analysis — never cut sections short.`;
}
