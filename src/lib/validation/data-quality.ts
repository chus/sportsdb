/**
 * Data quality validation utilities
 * Used to filter out bad data from imports and queries
 */

// Patterns that indicate a "player" is actually something else
const BAD_PLAYER_PATTERNS = [
  // Stadiums
  /stadium/i, /arena/i, /park$/i,
  // Sponsors/Companies
  /adidas/i, /nike/i, /allianz/i, /cruises/i, /airlines/i, /emirates/i,
  // Countries (as standalone names)
  /^(albania|andorra|argentina|brazil|germany|spain|france|italy|england|belarus|belgium|portugal|netherlands|sweden|norway|denmark|poland|austria|switzerland|croatia|serbia|greece|turkey|russia|ukraine|czech republic|hungary|romania|bulgaria|scotland|wales|ireland|northern ireland|mexico|usa|canada|japan|south korea|china|australia|colombia|chile|peru|ecuador|venezuela|uruguay|paraguay|bolivia)$/i,
  // Country codes
  /^(ARG|BRA|GER|ESP|FRA|ITA|ENG|POR|NED|SWE|NOR|DEN|POL|AUT|SUI|CRO|SRB|GRE|TUR|RUS|UKR|CZE|HUN|ROU|BUL|SCO|WAL|IRL|NIR|MEX|USA|CAN|JPN|KOR|CHN|AUS|COL|CHI|PER|ECU|VEN|URU|PAR|BOL)$/,
  // Club/Team patterns (when in player table)
  /^.*\s(FC|SC|CF|AC|AS|SS|US|CD|CA|SD|RCD|UD)$/i,
  /^(FC|SC|CF|AC|AS|SS|US|CD|CA|SD|RCD|UD)\s/i,
  /\bFC\b/, /\bSC\b/, /\bBSG\b/, /\bTSC\b/, /\bBTuFC\b/,
  // League/Division names
  /liga/i, /league/i, /division/i, /championship/i, /premier/i, /serie/i,
  /bundesliga/i, /ligue/i, /eredivisie/i, /oberliga/i, /regionalliga/i, /verbandsliga/i,
  // Concatenated names (multiple people listed together)
  /\s{2,}/, // Two or more spaces
  // Season patterns
  /\d{4}[–-]\d{2,4}/,
];

// Patterns that indicate a "team" is actually something else
const BAD_TEAM_PATTERNS = [
  // Season labels
  /\d{4}[–-]\d{2,4}/,
  // League/Division names when not a team
  /^(Ligue|Liga|League|Division|Serie|Championship|Premier)\s/i,
  // Single person names (likely players, not teams)
  /^[A-Z][a-z]+\s[A-Z][a-z]+$/, // "First Last" pattern with no team indicators
];

/**
 * Check if a name looks like a valid player (not a team, stadium, etc.)
 */
export function isValidPlayerName(name: string): boolean {
  if (!name || name.trim().length < 2) return false;

  for (const pattern of BAD_PLAYER_PATTERNS) {
    if (pattern.test(name)) return false;
  }

  return true;
}

/**
 * Check if a name looks like a valid team
 */
export function isValidTeamName(name: string): boolean {
  if (!name || name.trim().length < 2) return false;

  for (const pattern of BAD_TEAM_PATTERNS) {
    if (pattern.test(name)) return false;
  }

  return true;
}

/**
 * Check if a position is valid (not Unknown for display purposes)
 */
export function isValidPosition(position: string | null): boolean {
  if (!position) return false;
  return ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'].includes(position);
}

/**
 * Filter function for player queries - excludes bad data
 */
export function filterValidPlayers<T extends { position?: string | null; name?: string }>(
  players: T[]
): T[] {
  return players.filter(p => {
    // Must have a valid position
    if (!isValidPosition(p.position || null)) return false;
    // Must have a valid name
    if (p.name && !isValidPlayerName(p.name)) return false;
    return true;
  });
}
