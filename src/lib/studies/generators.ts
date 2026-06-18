import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * Data-study generators. Each study is an original ranking built from our own
 * season stats — the kind of "X most Y" data asset journalists cite and that
 * doubles as a stable, freshening SEO page. One aggregate query feeds every
 * study type; the studies themselves are pure transforms over it.
 */

export interface StudyColumn {
  key: string;
  label: string;
}

export interface StudyRow {
  rank: number;
  player: string;
  slug: string;
  team: string | null;
  teamSlug: string | null;
  values: Record<string, number>;
}

export interface StudyData {
  columns: StudyColumn[];
  rows: StudyRow[];
  methodology: string;
  seasonLabel: string;
  generatedAt: string;
}

export interface Study {
  type: string;
  slug: string;
  title: string;
  dek: string;
  data: StudyData;
}

interface SeasonAgg {
  name: string;
  slug: string;
  team_name: string | null;
  team_slug: string | null;
  goals: number;
  assists: number;
  apps: number;
  minutes: number;
  yellows: number;
  reds: number;
}

function slugifySeason(label: string): string {
  return label.replace(/\//g, "-").replace(/[^a-z0-9-]/gi, "").toLowerCase();
}

async function getSeasonLabel(): Promise<string | null> {
  const r = await db.execute(sql`SELECT label FROM seasons WHERE is_current = true ORDER BY label DESC LIMIT 1`);
  const rows = (r as unknown as { rows?: { label: string }[] }).rows ?? (r as unknown as { label: string }[]);
  return rows[0]?.label ?? null;
}

/** Per-player aggregate across all competitions in the current season. */
async function getSeasonAggregates(): Promise<SeasonAgg[]> {
  const r = await db.execute(sql`
    WITH agg AS (
      SELECT pss.player_id,
        SUM(pss.goals)::int AS goals,
        SUM(pss.assists)::int AS assists,
        SUM(pss.appearances)::int AS apps,
        SUM(pss.minutes_played)::int AS minutes,
        SUM(pss.yellow_cards)::int AS yellows,
        SUM(pss.red_cards)::int AS reds
      FROM player_season_stats pss
      JOIN competition_seasons cs ON cs.id = pss.competition_season_id
      JOIN seasons s ON s.id = cs.season_id AND s.is_current = true
      GROUP BY pss.player_id
    ),
    primary_team AS (
      SELECT DISTINCT ON (pss.player_id) pss.player_id, t.name AS team_name, t.slug AS team_slug
      FROM player_season_stats pss
      JOIN competition_seasons cs ON cs.id = pss.competition_season_id
      JOIN seasons s ON s.id = cs.season_id AND s.is_current = true
      JOIN teams t ON t.id = pss.team_id
      ORDER BY pss.player_id, pss.minutes_played DESC
    )
    SELECT p.name, p.slug, pt.team_name, pt.team_slug,
      a.goals, a.assists, a.apps, a.minutes, a.yellows, a.reds
    FROM agg a
    JOIN players p ON p.id = a.player_id AND p.is_indexable = true
    LEFT JOIN primary_team pt ON pt.player_id = a.player_id
    WHERE a.apps > 0
  `);
  return (r as unknown as { rows?: SeasonAgg[] }).rows ?? (r as unknown as SeasonAgg[]);
}

type StudyDef = {
  type: string;
  title: (season: string) => string;
  dek: (top: SeasonAgg) => string;
  columns: StudyColumn[];
  methodology: string;
  /** Filter + sort + map an aggregate row to its metric values. */
  eligible: (a: SeasonAgg) => boolean;
  score: (a: SeasonAgg) => number;
  values: (a: SeasonAgg) => Record<string, number>;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const STUDY_DEFS: StudyDef[] = [
  {
    type: "most-goals",
    title: (s) => `Most Goals in ${s}`,
    dek: (t) => `${t.name} leads the scoring charts this season with ${t.goals} goals.`,
    columns: [{ key: "goals", label: "Goals" }, { key: "assists", label: "Assists" }, { key: "apps", label: "Apps" }],
    methodology: "Total goals across all tracked competitions in the current season, for players with at least one appearance.",
    eligible: (a) => a.goals > 0,
    score: (a) => a.goals,
    values: (a) => ({ goals: a.goals, assists: a.assists, apps: a.apps }),
  },
  {
    type: "most-assists",
    title: (s) => `Most Assists in ${s}`,
    dek: (t) => `${t.name} is the top provider this season with ${t.assists} assists.`,
    columns: [{ key: "assists", label: "Assists" }, { key: "goals", label: "Goals" }, { key: "apps", label: "Apps" }],
    methodology: "Total assists across all tracked competitions in the current season, for players with at least one appearance.",
    eligible: (a) => a.assists > 0,
    score: (a) => a.assists,
    values: (a) => ({ assists: a.assists, goals: a.goals, apps: a.apps }),
  },
  {
    type: "goal-contributions",
    title: (s) => `Most Goal Contributions in ${s}`,
    dek: (t) => `${t.name} tops goals + assists combined with ${t.goals + t.assists} this season.`,
    columns: [{ key: "ga", label: "G+A" }, { key: "goals", label: "Goals" }, { key: "assists", label: "Assists" }, { key: "apps", label: "Apps" }],
    methodology: "Goals plus assists across all tracked competitions in the current season.",
    eligible: (a) => a.goals + a.assists > 0,
    score: (a) => a.goals + a.assists,
    values: (a) => ({ ga: a.goals + a.assists, goals: a.goals, assists: a.assists, apps: a.apps }),
  },
  {
    type: "goals-per-90",
    title: (s) => `Best Goals per 90 in ${s}`,
    dek: (t) => `${t.name} is the most clinical finisher per minute this season.`,
    columns: [{ key: "per90", label: "Goals/90" }, { key: "goals", label: "Goals" }, { key: "minutes", label: "Mins" }],
    methodology: "Goals per 90 minutes, restricted to players with at least 900 minutes (≈10 full matches) to exclude small-sample outliers.",
    eligible: (a) => a.minutes >= 900 && a.goals > 0,
    score: (a) => a.goals / (a.minutes / 90),
    values: (a) => ({ per90: round2(a.goals / (a.minutes / 90)), goals: a.goals, minutes: a.minutes }),
  },
  {
    type: "most-booked",
    title: (s) => `Most-Booked Players in ${s}`,
    dek: (t) => `${t.name} tops the disciplinary charts this season.`,
    columns: [{ key: "cards", label: "Card pts" }, { key: "yellows", label: "Yellow" }, { key: "reds", label: "Red" }, { key: "apps", label: "Apps" }],
    methodology: "Disciplinary points = yellow cards + 2× red cards, across all tracked competitions in the current season.",
    eligible: (a) => a.yellows + a.reds > 0,
    score: (a) => a.yellows + a.reds * 2,
    values: (a) => ({ cards: a.yellows + a.reds * 2, yellows: a.yellows, reds: a.reds, apps: a.apps }),
  },
  {
    type: "iron-men",
    title: (s) => `Most Minutes Played in ${s}`,
    dek: (t) => `${t.name} has been the ultimate ever-present this season.`,
    columns: [{ key: "minutes", label: "Mins" }, { key: "apps", label: "Apps" }],
    methodology: "Total minutes played across all tracked competitions in the current season.",
    eligible: (a) => a.minutes > 0,
    score: (a) => a.minutes,
    values: (a) => ({ minutes: a.minutes, apps: a.apps }),
  },
];

export const STUDY_TYPES = STUDY_DEFS.map((d) => d.type);

function buildStudy(def: StudyDef, aggs: SeasonAgg[], seasonLabel: string, generatedAt: string): Study | null {
  const ranked = aggs
    .filter(def.eligible)
    .sort((a, b) => def.score(b) - def.score(a))
    .slice(0, 20);
  if (ranked.length < 5) return null; // not enough data to be a credible study

  const rows: StudyRow[] = ranked.map((a, i) => ({
    rank: i + 1,
    player: a.name,
    slug: a.slug,
    team: a.team_name,
    teamSlug: a.team_slug,
    values: def.values(a),
  }));

  return {
    type: def.type,
    slug: `${def.type}-${slugifySeason(seasonLabel)}`,
    title: def.title(seasonLabel),
    dek: def.dek(ranked[0]),
    data: { columns: def.columns, rows, methodology: def.methodology, seasonLabel, generatedAt },
  };
}

/** Generate all studies that have enough data. */
export async function generateAllStudies(generatedAt: string): Promise<Study[]> {
  const seasonLabel = await getSeasonLabel();
  if (!seasonLabel) return [];
  const aggs = await getSeasonAggregates();
  return STUDY_DEFS.map((d) => buildStudy(d, aggs, seasonLabel, generatedAt)).filter((s): s is Study => s !== null);
}
