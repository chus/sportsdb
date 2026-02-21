// Types for AI content generation

export interface MatchContext {
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
  venue: string | null;
  attendance: number | null;
  referee: string | null;
  events: MatchEvent[];
  homeLineup: PlayerInfo[];
  awayLineup: PlayerInfo[];
}

export interface MatchEvent {
  minute: number;
  addedTime: number | null;
  type: string;
  player: string;
  playerId: string;
  team: string;
  teamId: string;
  secondaryPlayer: string | null;
  secondaryPlayerId: string | null;
}

export interface PlayerInfo {
  id: string;
  name: string;
  position: string;
  shirtNumber: number | null;
  isStarter: boolean;
  minutesPlayed: number | null;
  rating: string | null;
}

export interface MatchSummaryResponse {
  headline: string;
  summary: string;
  keyMoments: KeyMoment[];
  manOfTheMatch: {
    playerId: string;
    playerName: string;
    reason: string;
  } | null;
}

export interface KeyMoment {
  minute: number;
  description: string;
}

export interface PlayerMatchContext {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  opponent: string;
  isHome: boolean;
  matchResult: string; // "W 3-1", "D 1-1", "L 0-2"
  minutesPlayed: number | null;
  isStarter: boolean;
  events: PlayerMatchEvent[];
}

export interface PlayerMatchEvent {
  minute: number;
  type: string;
  description: string;
}

export interface PlayerSummaryResponse {
  rating: number;
  summary: string;
  highlights: string[];
}

export interface TournamentContext {
  competitionSeasonId: string;
  competition: string;
  season: string;
  periodType: "matchday" | "week" | "month";
  periodValue: number;
  periodStart: string;
  periodEnd: string;
  matches: TournamentMatch[];
  standingsChanges: StandingsChange[];
}

export interface TournamentMatch {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  date: string;
}

export interface StandingsChange {
  team: string;
  previousPosition: number;
  currentPosition: number;
  change: number;
}

export interface TournamentSummaryResponse {
  headline: string;
  summary: string;
  topPerformers: TopPerformer[];
  standingsMovement: StandingsMovementSummary;
}

export interface TopPerformer {
  playerId: string;
  playerName: string;
  reason: string;
}

export interface StandingsMovementSummary {
  biggestRiser: { team: string; change: number } | null;
  biggestFaller: { team: string; change: number } | null;
  leaderChange: boolean;
}
