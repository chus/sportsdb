/**
 * Team Matcher for Career Extraction
 *
 * Multi-strategy matching to find teams in our database:
 * 1. Exact match on normalized name
 * 2. Alias lookup
 * 3. Fuzzy match with Levenshtein distance
 */

// Common aliases for major clubs
// Keys should match database names, values are Wikipedia/common variations
export const TEAM_ALIASES: Record<string, string[]> = {
  // English clubs
  "Manchester United F.C.": ["Manchester United", "Man United", "Man Utd", "MUFC", "Manchester Utd"],
  "Manchester City F.C.": ["Manchester City", "Man City", "MCFC", "City"],
  Liverpool: ["Liverpool FC", "LFC", "The Reds"],
  Chelsea: ["Chelsea FC", "CFC", "The Blues"],
  Arsenal: ["Arsenal FC", "AFC", "The Gunners"],
  "Tottenham Hotspur": [
    "Tottenham",
    "Spurs",
    "THFC",
    "Tottenham Hotspurs",
    "Hotspur",
  ],
  "Newcastle United": ["Newcastle", "NUFC", "Newcastle Utd", "The Magpies"],
  "West Ham United": ["West Ham", "WHUFC", "West Ham Utd", "The Hammers"],
  "Aston Villa": ["Villa", "AVFC"],
  "Brighton & Hove Albion": ["Brighton", "BHAFC", "Brighton and Hove Albion"],
  "Wolverhampton Wanderers": ["Wolves", "Wolverhampton", "Wolves FC"],
  "Leicester City": ["Leicester", "LCFC"],
  "Nottingham Forest": ["Forest", "NFFC", "Notts Forest"],
  Everton: ["Everton FC", "EFC", "The Toffees"],
  "Crystal Palace": ["Palace", "CPFC"],
  Fulham: ["Fulham FC", "FFC"],
  Bournemouth: ["AFC Bournemouth", "AFCB"],
  Brentford: ["Brentford FC", "BFC"],
  "Ipswich Town": ["Ipswich", "ITFC"],

  // Spanish clubs
  "Real Madrid": ["Real Madrid CF", "Real", "Madrid"],
  Barcelona: ["FC Barcelona", "Barca", "FCB"],
  "Atletico Madrid": [
    "Atlético Madrid",
    "Atletico",
    "Atlético",
    "Atletico de Madrid",
  ],
  "Sevilla FC": ["Sevilla"],
  "Real Betis": ["Betis", "Real Betis Balompié"],
  "Real Sociedad": ["Sociedad", "La Real"],
  "Athletic Bilbao": ["Athletic Club", "Athletic", "Bilbao"],
  "Villarreal CF": ["Villarreal", "Yellow Submarine"],
  Valencia: ["Valencia CF"],

  // German clubs
  "Bayern Munich": [
    "FC Bayern Munich",
    "Bayern München",
    "Bayern",
    "FC Bayern",
  ],
  "Borussia Dortmund": ["BVB", "Dortmund"],
  "RB Leipzig": ["Leipzig", "RasenBallsport Leipzig"],
  "Bayer Leverkusen": ["Leverkusen", "Bayer 04"],
  "Eintracht Frankfurt": ["Frankfurt", "SGE"],
  "VfB Stuttgart": ["Stuttgart"],
  "Borussia Mönchengladbach": [
    "Mönchengladbach",
    "Gladbach",
    "Borussia M'gladbach",
  ],
  "VfL Wolfsburg": ["Wolfsburg"],
  "SC Freiburg": ["Freiburg"],
  "TSG Hoffenheim": ["Hoffenheim", "1899 Hoffenheim"],

  // Italian clubs
  Juventus: ["Juventus FC", "Juve", "Juventus Turin"],
  "AC Milan": ["Milan", "A.C. Milan", "AC Milan 1899"],
  "Inter Milan": ["Internazionale", "Inter", "FC Internazionale Milano"],
  "AS Roma": ["Roma", "AS Roma 1927"],
  "S.S. Lazio": ["Lazio", "SS Lazio"],
  Napoli: ["SSC Napoli", "S.S.C. Napoli"],
  "Atalanta BC": ["Atalanta", "Atalanta Bergamo"],
  Fiorentina: ["ACF Fiorentina", "Viola"],
  "Torino FC": ["Torino"],
  Bologna: ["Bologna FC", "BFC"],

  // French clubs
  "Paris Saint-Germain": ["PSG", "Paris SG", "Paris St-Germain"],
  "Olympique de Marseille": ["Marseille", "OM", "Olympique Marseille"],
  "AS Monaco": ["Monaco"],
  "Olympique Lyonnais": ["Lyon", "OL", "Olympique Lyon"],
  "LOSC Lille": ["Lille", "LOSC"],
  Nice: ["OGC Nice", "Nizza"],
  "Stade Rennais": ["Rennes", "Stade Rennais FC"],
  "RC Lens": ["Lens", "Racing Club de Lens"],
  Brest: ["Stade Brestois 29", "Stade Brest"],
  Reims: ["Stade de Reims", "Stade Reims"],

  // Portuguese clubs
  "FC Porto": ["Porto"],
  "SL Benfica": ["Benfica"],
  "Sporting CP": ["Sporting Lisbon", "Sporting", "Sporting Clube de Portugal"],
  "SC Braga": ["Braga", "Sporting Braga"],

  // Dutch clubs
  Ajax: ["AFC Ajax", "Ajax Amsterdam"],
  "PSV Eindhoven": ["PSV"],
  Feyenoord: ["Feyenoord Rotterdam"],
  "AZ Alkmaar": ["AZ"],

  // Belgian clubs
  "Club Brugge": ["Club Brugge KV", "Brugge"],
  Anderlecht: ["RSC Anderlecht", "RSC Anderlecht Brussels"],
};

/**
 * Normalize a team name for comparison.
 */
export function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9\s]/gi, "") // Remove non-alphanumeric (dots, commas, etc.)
    .replace(/\b(fc|cf|afc|sc|fk|as|ss|ssc|rc|ac|bv|sv|vfb|vfl|tsg|rb)\b/gi, "") // Remove common suffixes
    .replace(/\s+/g, "") // Remove spaces
    .trim();
}

/**
 * Calculate Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[a.length][b.length];
}

/**
 * Calculate similarity score (0-1) between two strings.
 */
export function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

interface Team {
  id: string;
  name: string;
}

interface MatchResult {
  teamId: string;
  confidence: number;
  matchType: "exact" | "alias" | "fuzzy" | "partial";
}

/**
 * Find the best matching team from a list of teams.
 */
export function findBestMatch(
  searchName: string,
  teams: Team[],
  threshold = 0.75
): MatchResult | null {
  const normalizedSearch = normalizeTeamName(searchName);

  // Strategy 1: Exact match on normalized name
  for (const team of teams) {
    if (normalizeTeamName(team.name) === normalizedSearch) {
      return { teamId: team.id, confidence: 1.0, matchType: "exact" };
    }
  }

  // Strategy 2: Alias lookup
  for (const [canonicalName, aliases] of Object.entries(TEAM_ALIASES)) {
    const allNames = [canonicalName, ...aliases];
    const isMatch = allNames.some(
      (alias) =>
        normalizeTeamName(alias) === normalizedSearch ||
        searchName.toLowerCase() === alias.toLowerCase()
    );

    if (isMatch) {
      // Find the canonical team in our database
      const team = teams.find(
        (t) => normalizeTeamName(t.name) === normalizeTeamName(canonicalName)
      );
      if (team) {
        return { teamId: team.id, confidence: 0.95, matchType: "alias" };
      }
    }
  }

  // Strategy 3: Partial match (one name contains the other)
  for (const team of teams) {
    const normalizedTeam = normalizeTeamName(team.name);
    if (
      normalizedTeam.includes(normalizedSearch) ||
      normalizedSearch.includes(normalizedTeam)
    ) {
      // Favor longer matches
      const matchRatio =
        Math.min(normalizedSearch.length, normalizedTeam.length) /
        Math.max(normalizedSearch.length, normalizedTeam.length);
      if (matchRatio > 0.5) {
        return {
          teamId: team.id,
          confidence: 0.85 * matchRatio,
          matchType: "partial",
        };
      }
    }
  }

  // Strategy 4: Fuzzy match with Levenshtein
  let bestMatch: MatchResult | null = null;
  let bestSimilarity = 0;

  for (const team of teams) {
    const normalizedTeam = normalizeTeamName(team.name);
    const sim = similarity(normalizedSearch, normalizedTeam);

    if (sim > bestSimilarity && sim >= threshold) {
      bestSimilarity = sim;
      bestMatch = {
        teamId: team.id,
        confidence: sim,
        matchType: "fuzzy",
      };
    }
  }

  return bestMatch;
}

/**
 * Extract the canonical team name from Wikipedia link text.
 * Handles cases like "[[Manchester United F.C.|Manchester United]]"
 * and HTML like <a href="..." title="...">Team Name</a>
 */
export function extractTeamFromWikiLink(text: string): string {
  // Remove HTML anchor tags, keeping just the text content
  let cleaned = text.replace(/<a[^>]*>([^<]*)<\/a>/gi, "$1");

  // Remove wiki link formatting
  cleaned = cleaned.replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (_, link, display) => {
    return display || link;
  });

  // Remove "(loan)" suffix
  cleaned = cleaned.replace(/\s*\(loan\)\s*/gi, "");

  // Remove F.C., FC, etc.
  cleaned = cleaned.replace(/\s*(F\.?C\.?|A\.?F\.?C\.?|S\.?C\.?)\.?$/i, "");

  // Clean up any remaining HTML entities
  cleaned = cleaned.replace(/&amp;/g, "&");
  cleaned = cleaned.replace(/&nbsp;/g, " ");

  return cleaned.trim();
}
