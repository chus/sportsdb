/**
 * Page quality scoring for SEO thin page detection.
 *
 * Used by generateMetadata in entity pages to determine
 * whether a page should be noindexed.
 */

export type Tier = "A" | "B" | "C" | "D";

export interface QualityResult {
  score: number;
  tier: Tier;
  isThin: boolean; // true for tier C or D
}

export interface PlayerQualityInput {
  position: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  heightCm: number | null;
  preferredFoot: string | null;
  imageUrl: string | null;
  careerCount: number;
  hasCurrentTeam: boolean;
  statsCount: number;
  lineupCount: number;
  articleCount: number;
}

export function scorePlayerPage(input: PlayerQualityInput): QualityResult {
  let score = 0;

  if (input.position && input.position !== "Unknown") score += 10;
  if (input.nationality) score += 10;
  if (input.dateOfBirth) score += 5;
  if (input.heightCm) score += 3;
  if (input.preferredFoot) score += 2;
  if (input.imageUrl) score += 5;
  if (input.careerCount >= 1) score += 10;
  if (input.careerCount >= 2) score += 5;
  if (input.hasCurrentTeam) score += 10;
  if (input.statsCount > 0) score += 20;
  if (input.lineupCount > 0) score += 10;
  if (input.articleCount > 0) score += 10;

  const tier: Tier = score >= 60 ? "A" : score >= 40 ? "B" : score >= 20 ? "C" : "D";
  return { score, tier, isThin: tier === "C" || tier === "D" };
}

export interface TeamQualityInput {
  country: string | null;
  city: string | null;
  foundedYear: number | null;
  logoUrl: string | null;
  squadSize: number;
  hasStandings: boolean;
  hasMatches: boolean;
}

export function scoreTeamPage(input: TeamQualityInput): QualityResult {
  let score = 0;

  if (input.country) score += 10;
  if (input.city) score += 5;
  if (input.foundedYear) score += 5;
  if (input.logoUrl) score += 5;
  if (input.squadSize > 0) score += 15;
  if (input.hasStandings) score += 10;
  if (input.hasMatches) score += 10;

  const tier: Tier = score >= 40 ? "A" : score >= 25 ? "B" : score >= 15 ? "C" : "D";
  return { score, tier, isThin: tier === "C" || tier === "D" };
}
