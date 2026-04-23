/**
 * Page quality scoring for SEO thin page detection.
 *
 * Used by generateMetadata in entity pages to determine
 * whether a page should be noindexed or 404'd.
 *
 * Thresholds:
 *   Score < 30  → 404 (thin / empty — don't waste crawl budget)
 *   Score 30-39 → 200 + noindex
 *   Score >= 40 → 200 + indexed
 */

export type Tier = "A" | "B" | "C" | "D";

export interface QualityResult {
  score: number;
  tier: Tier;
  isThin: boolean; // true for tier C or D (score < 40)
  shouldReturn404: boolean; // true for score < 15
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

  // Hard content gate: a page with only bio metadata (position, nationality,
  // DOB, current team) but zero actual match/stat/article content is a
  // "Crawled - currently not indexed" candidate. Force it into Tier C even if
  // the metadata score is high enough to pass the 40-point threshold.
  const hasRealContent =
    input.statsCount > 0 || input.lineupCount > 0 || input.articleCount > 0;
  if (!hasRealContent) {
    score = Math.min(score, 35);
  }

  const tier: Tier = score >= 60 ? "A" : score >= 40 ? "B" : score >= 20 ? "C" : "D";
  return { score, tier, isThin: tier === "C" || tier === "D", shouldReturn404: score < 30 };
}

/** Whether a player has enough data to warrant an indexable link */
export function isPlayerLinkWorthy(input: PlayerQualityInput): boolean {
  return scorePlayerPage(input).score >= 40;
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

  // Hard content gate: a team page with no squad and no standings is a
  // shell page with only basic metadata. Force it thin (noindex) even if
  // country + city + logo push the score above 40.
  if (input.squadSize === 0 && !input.hasStandings) {
    score = Math.min(score, 35);
  }

  const tier: Tier = score >= 40 ? "A" : score >= 25 ? "B" : score >= 15 ? "C" : "D";
  return { score, tier, isThin: tier === "C" || tier === "D", shouldReturn404: score < 25 };
}
