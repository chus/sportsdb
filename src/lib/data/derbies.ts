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
  { teams: ["real-madrid", "barcelona"], name: "El Clásico", importance: 5 },
  { teams: ["manchester-united", "liverpool"], name: "North West Derby", importance: 5 },
  { teams: ["manchester-city", "manchester-united"], name: "Manchester Derby", importance: 5 },
  { teams: ["arsenal", "tottenham-hotspur"], name: "North London Derby", importance: 5 },
  { teams: ["liverpool", "everton"], name: "Merseyside Derby", importance: 4 },
  { teams: ["ac-milan", "inter"], name: "Derby della Madonnina", importance: 5 },
  { teams: ["juventus", "inter"], name: "Derby d'Italia", importance: 5 },
  { teams: ["roma", "lazio"], name: "Derby della Capitale", importance: 5 },
  { teams: ["bayern-munich", "borussia-dortmund"], name: "Der Klassiker", importance: 5 },
  { teams: ["borussia-dortmund", "schalke-04"], name: "Revierderby", importance: 4 },
  { teams: ["paris-saint-germain", "marseille"], name: "Le Classique", importance: 5 },
  { teams: ["atletico-madrid", "real-madrid"], name: "Madrid Derby", importance: 5 },
  { teams: ["atletico-madrid", "barcelona"], name: "Barcelona vs Atleti", importance: 4 },
  { teams: ["celtic", "rangers"], name: "Old Firm", importance: 5 },
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
