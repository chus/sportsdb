import type {
  MatchContext,
  PlayerMatchContext,
  TournamentContext,
} from "./types";

export function buildMatchPrompt(match: MatchContext): string {
  const eventsText =
    match.events.length > 0
      ? match.events
          .map((e) => {
            const minuteStr = e.addedTime
              ? `${e.minute}+${e.addedTime}'`
              : `${e.minute}'`;
            const secondary = e.secondaryPlayer
              ? ` (${e.type === "goal" ? "assist: " : ""}${e.secondaryPlayer})`
              : "";
            return `${minuteStr} - ${e.type}: ${e.player}${secondary} (${e.team})`;
          })
          .join("\n")
      : "No events recorded";

  const homeStartersText = match.homeLineup
    .filter((p) => p.isStarter)
    .map((p) => `${p.name} (${p.position})`)
    .join(", ");

  const awayStartersText = match.awayLineup
    .filter((p) => p.isStarter)
    .map((p) => `${p.name} (${p.position})`)
    .join(", ");

  return `You are a professional sports journalist writing a match report.

MATCH DATA:
- Competition: ${match.competition} (${match.season})
- Date: ${match.date}
- Teams: ${match.homeTeam} ${match.homeScore} - ${match.awayScore} ${match.awayTeam}
- Venue: ${match.venue || "Unknown"}
- Attendance: ${match.attendance?.toLocaleString() || "Unknown"}
- Referee: ${match.referee || "Unknown"}

MATCH EVENTS:
${eventsText}

STARTING LINEUPS:
${match.homeTeam}: ${homeStartersText || "Unknown"}
${match.awayTeam}: ${awayStartersText || "Unknown"}

Generate a match report with:
1. headline - Max 60 characters, engaging, captures the key story of the match
2. summary - 2-3 paragraphs, professional sports journalism tone, covers key moments and flow of the match
3. keyMoments - Array of objects with "minute" (number) and "description" (string) for 3-5 key moments
4. manOfTheMatch - Object with "playerId", "playerName", and "reason" (or null if unclear)

For manOfTheMatch, you MUST use the exact playerId from the lineups or events provided. If you cannot determine a clear standout, set it to null.

Return ONLY valid JSON in this exact format:
{
  "headline": "string",
  "summary": "string",
  "keyMoments": [{"minute": number, "description": "string"}],
  "manOfTheMatch": {"playerId": "uuid", "playerName": "string", "reason": "string"} | null
}`;
}

export function buildPlayerPrompt(player: PlayerMatchContext): string {
  const eventsText =
    player.events.length > 0
      ? player.events
          .map((e) => `${e.minute}' - ${e.type}: ${e.description}`)
          .join("\n")
      : "No notable events";

  return `You are a sports analyst writing a brief player performance summary.

PLAYER: ${player.playerName}
POSITION: ${player.position}
TEAM: ${player.team}
OPPONENT: ${player.opponent} (${player.isHome ? "Home" : "Away"})
RESULT: ${player.matchResult}
MINUTES PLAYED: ${player.minutesPlayed || "Unknown"}
STARTED: ${player.isStarter ? "Yes" : "No (substitute)"}

PLAYER EVENTS:
${eventsText}

Generate a performance assessment:
1. rating - A number from 1.0 to 10.0 (one decimal place)
2. summary - 1-2 sentences describing their performance
3. highlights - Array of 1-3 short highlight strings (or empty if none)

Return ONLY valid JSON in this exact format:
{
  "rating": number,
  "summary": "string",
  "highlights": ["string"]
}`;
}

export function buildTournamentPrompt(tournament: TournamentContext): string {
  const matchesText = tournament.matches
    .map((m) => `${m.date}: ${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam}`)
    .join("\n");

  const standingsText = tournament.standingsChanges
    .map((s) => {
      const direction = s.change > 0 ? "▲" : s.change < 0 ? "▼" : "—";
      return `${s.team}: ${s.previousPosition} → ${s.currentPosition} (${direction}${Math.abs(s.change)})`;
    })
    .join("\n");

  return `You are a sports journalist writing a ${tournament.periodType} recap.

COMPETITION: ${tournament.competition} (${tournament.season})
PERIOD: ${tournament.periodType === "matchday" ? `Matchday ${tournament.periodValue}` : `${tournament.periodType} ${tournament.periodValue}`}
DATES: ${tournament.periodStart} to ${tournament.periodEnd}

MATCHES:
${matchesText}

STANDINGS MOVEMENT:
${standingsText}

Generate a tournament recap:
1. headline - Max 70 characters, captures the main storyline of this period
2. summary - 2-3 paragraphs covering key results, surprises, and implications
3. topPerformers - Array of 2-4 objects with "playerId", "playerName", and "reason"
4. standingsMovement - Object with:
   - biggestRiser: {team, change} or null
   - biggestFaller: {team, change} or null
   - leaderChange: boolean

For topPerformers, use "unknown" as playerId if you don't have the exact ID.

Return ONLY valid JSON in this exact format:
{
  "headline": "string",
  "summary": "string",
  "topPerformers": [{"playerId": "string", "playerName": "string", "reason": "string"}],
  "standingsMovement": {
    "biggestRiser": {"team": "string", "change": number} | null,
    "biggestFaller": {"team": "string", "change": number} | null,
    "leaderChange": boolean
  }
}`;
}
