// ============================================================
// Entity types — used across server and client
// ============================================================

export type PlayerStatus = "active" | "retired" | "deceased";
export type MatchStatus = "scheduled" | "live" | "half_time" | "finished" | "postponed" | "cancelled";
export type CompetitionType = "league" | "cup" | "international";
export type CompetitionSeasonStatus = "scheduled" | "in_progress" | "completed";
export type TransferType = "permanent" | "loan" | "free" | "youth";
export type MatchEventType = "goal" | "yellow_card" | "red_card" | "substitution" | "penalty_missed" | "own_goal";

export interface Player {
  id: string;
  name: string;
  knownAs: string | null;
  slug: string;
  dateOfBirth: string | null;
  nationality: string | null;
  secondNationality: string | null;
  heightCm: number | null;
  position: string;
  preferredFoot: string | null;
  status: PlayerStatus;
  imageUrl: string | null;
}

export interface Team {
  id: string;
  name: string;
  shortName: string | null;
  slug: string;
  country: string;
  city: string | null;
  foundedYear: number | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

export interface Competition {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  type: CompetitionType;
  foundedYear: number | null;
  logoUrl: string | null;
  description: string | null;
}

export interface Season {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface Venue {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  country: string | null;
  capacity: number | null;
  openedYear: number | null;
  imageUrl: string | null;
}

export interface Match {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number | null;
  awayScore: number | null;
  scheduledAt: string;
  status: MatchStatus;
  matchday: number | null;
  venue: Venue | null;
  attendance: number | null;
  referee: string | null;
  minute: number | null;
  competition: Competition;
  season: Season;
}

export interface MatchEvent {
  id: string;
  matchId: string;
  type: MatchEventType;
  minute: number;
  addedTime: number | null;
  teamId: string;
  player: Player | null;
  secondaryPlayer: Player | null;
  description: string | null;
}

export interface Standing {
  id: string;
  team: Team;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: string | null;
}

export interface PlayerSeasonStat {
  id: string;
  playerId: string;
  teamId: string;
  competitionSeasonId: string;
  appearances: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  minutesPlayed: number;
  cleanSheets: number;
}

export interface PlayerCareerEntry {
  id: string;
  team: Team;
  shirtNumber: number | null;
  validFrom: string;
  validTo: string | null;
  transferType: string | null;
  appearances: number;
  goals: number;
}

export interface SearchResult {
  id: string;
  entityType: "player" | "team" | "competition" | "venue";
  slug: string;
  name: string;
  subtitle: string | null;
  meta: string | null;
}
