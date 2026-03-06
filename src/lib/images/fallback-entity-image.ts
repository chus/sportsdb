export type EntityImageType =
  | "player"
  | "team"
  | "competition"
  | "venue"
  | "article";

const TYPE_LABELS: Record<EntityImageType, string> = {
  player: "Player",
  team: "Team",
  competition: "Competition",
  venue: "Venue",
  article: "Article",
};

const TYPE_THEMES: Record<
  EntityImageType,
  {
    start: string;
    end: string;
    accent: string;
    shape: "circle" | "shield" | "stadium" | "card";
  }
> = {
  player: { start: "#0f172a", end: "#2563eb", accent: "#93c5fd", shape: "circle" },
  team: { start: "#14532d", end: "#16a34a", accent: "#bbf7d0", shape: "shield" },
  competition: { start: "#78350f", end: "#f59e0b", accent: "#fde68a", shape: "shield" },
  venue: { start: "#312e81", end: "#7c3aed", accent: "#c4b5fd", shape: "stadium" },
  article: { start: "#111827", end: "#dc2626", accent: "#fca5a5", shape: "card" },
};

export function getFallbackEntityTheme(type: EntityImageType) {
  return TYPE_THEMES[type];
}

export function getFallbackEntityLabel(type: EntityImageType) {
  return TYPE_LABELS[type];
}

export function getEntityInitials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "SD";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

export function buildFallbackEntityImageUrl({
  baseUrl,
  type,
  name,
  seed,
}: {
  baseUrl: string;
  type: EntityImageType;
  name: string;
  seed?: string;
}) {
  const params = new URLSearchParams({
    type,
    name,
  });

  if (seed) {
    params.set("seed", seed);
  }

  return `${baseUrl}/api/entity-image?${params.toString()}`;
}
