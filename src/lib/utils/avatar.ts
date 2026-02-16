/**
 * Avatar utilities for player, team, and venue images
 * Falls back to UI Avatars service when no image URL is available
 */

const UI_AVATARS_BASE = "https://ui-avatars.com/api";

interface EntityWithImage {
  imageUrl: string | null;
  name: string;
}

/**
 * Get player image URL with fallback to generated avatar
 */
export function getPlayerImage(
  player: EntityWithImage,
  size: number = 200
): string {
  if (player.imageUrl) return player.imageUrl;

  return `${UI_AVATARS_BASE}/?name=${encodeURIComponent(player.name)}&background=2563eb&color=fff&size=${size}&bold=true`;
}

/**
 * Get team logo URL with fallback to generated avatar
 */
export function getTeamImage(
  team: EntityWithImage,
  size: number = 200
): string {
  if (team.imageUrl) return team.imageUrl;

  // Use team's first letter with indigo background for teams
  return `${UI_AVATARS_BASE}/?name=${encodeURIComponent(team.name)}&background=4f46e5&color=fff&size=${size}&bold=true`;
}

/**
 * Get venue image URL with fallback to generated avatar
 */
export function getVenueImage(
  venue: EntityWithImage,
  size: number = 400
): string {
  if (venue.imageUrl) return venue.imageUrl;

  // Use stadium icon style with gray background
  return `${UI_AVATARS_BASE}/?name=${encodeURIComponent(venue.name)}&background=6b7280&color=fff&size=${size}&bold=true`;
}

/**
 * Construct a Wikimedia Commons image URL from a filename
 * @param filename - The image filename from Wikidata P18 property
 * @param width - Desired width in pixels (default 300)
 */
export function getWikimediaUrl(filename: string, width: number = 300): string {
  // Wikimedia Commons uses Special:FilePath for direct image URLs
  const encodedFilename = encodeURIComponent(filename.replace(/ /g, "_"));
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodedFilename}?width=${width}`;
}

/**
 * Get initials from a name for avatar display
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
