import type { SearchResult, PlayerSeasonStat, Match, Standing, Player } from "./entities";

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
}

export interface LiveMatchesResponse {
  matches: Match[];
  updatedAt: string;
}

export interface PlayerStatsResponse {
  stats: PlayerSeasonStat[];
  seasonLabel: string;
}

export interface SquadResponse {
  players: (Player & { shirtNumber: number | null; position: string })[];
  seasonLabel: string;
}

export interface StandingsResponse {
  standings: Standing[];
  competitionName: string;
  seasonLabel: string;
}

export interface SeasonsResponse {
  seasons: { id: string; label: string; isCurrent: boolean }[];
}

export type ApiError = {
  error: string;
  status: number;
};
