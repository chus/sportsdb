/**
 * Canonical order for a comparison matchup slug. Always alphabetical so
 * "a-vs-b" and "b-vs-a" resolve to one URL — used by the sitemap, the
 * internal "Compare with" links, and the compare page's canonical tag so
 * Google never sees the same pair as two duplicate pages.
 */
export function compareMatchup(slugA: string, slugB: string): string {
  return [slugA, slugB].sort().join("-vs-");
}
