/**
 * Known football rivalries used by the sports calendar generator.
 *
 * Lookup is order-independent — `findDerby(a, b)` will match regardless of
 * which team is home. Team slugs must match the `teams.slug` column.
 */

export type Derby = {
  teams: [string, string]; // team slugs
  name: string;
  importance: 3 | 4 | 5;
  competitionSlug?: string; // optional scope
};

export const DERBIES: Derby[] = [
  { teams: ["real-madrid-cf", "fc-barcelona"], name: "El Clásico", importance: 5 },
  { teams: ["manchester-united-fc", "liverpool-fc"], name: "North West Derby", importance: 5 },
  { teams: ["manchester-city-fc", "manchester-united-fc"], name: "Manchester Derby", importance: 5 },
  { teams: ["arsenal-fc", "tottenham-hotspur-fc"], name: "North London Derby", importance: 5 },
  { teams: ["liverpool-fc", "everton-fc"], name: "Merseyside Derby", importance: 4 },
  { teams: ["ac-milan", "fc-internazionale-milano"], name: "Derby della Madonnina", importance: 5 },
  { teams: ["juventus-fc", "fc-internazionale-milano"], name: "Derby d'Italia", importance: 5 },
  { teams: ["as-roma", "ss-lazio"], name: "Derby della Capitale", importance: 5 },
  { teams: ["fc-bayern-munchen", "borussia-dortmund"], name: "Der Klassiker", importance: 5 },
  { teams: ["paris-saint-germain-fc", "olympique-de-marseille"], name: "Le Classique", importance: 5 },
  { teams: ["club-atletico-de-madrid", "real-madrid-cf"], name: "Madrid Derby", importance: 5 },
  { teams: ["club-atletico-de-madrid", "fc-barcelona"], name: "Barcelona vs Atleti", importance: 4 },
];

const pairKey = (a: string, b: string): string => [a, b].sort().join("::");

const DERBY_INDEX = new Map<string, Derby>(
  DERBIES.map((d) => [pairKey(d.teams[0], d.teams[1]), d])
);

/**
 * Look up a derby by team slugs (order-independent).
 */
export function findDerby(homeSlug: string, awaySlug: string): Derby | null {
  return DERBY_INDEX.get(pairKey(homeSlug, awaySlug)) ?? null;
}

/**
 * Top-5 European leagues used for matchday importance scoring.
 */
export const TOP_5_LEAGUE_SLUGS = new Set<string>([
  "premier-league",
  "la-liga",
  "serie-a",
  "bundesliga",
  "ligue-1",
]);
