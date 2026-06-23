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
  /** Headline aggregates over the ranked set — the "analysis" layer. */
  summary?: { label: string; value: string }[];
  /** Computed, data-true findings (correlations, efficiency, spread). */
  insights?: string[];
  /** Top-10 (label, value) for the inline bar chart. */
  chart?: { label: string; value: number }[];
  /** Short AI analyst intro, grounded in `insights` (generated in the cron). */
  narrative?: string;
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
  dob: string | null;
  // Derived in generateAllStudies:
  age?: number | null;
  teamGoals?: number;
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
    SELECT p.name, p.slug, p.date_of_birth AS dob, pt.team_name, pt.team_slug,
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
  /** Plain-word unit for the metric, used in the analysis copy ("goals"). */
  unit: string;
  /** Whether a per-90 (minutes-adjusted) efficiency angle is meaningful. */
  efficiency: boolean;
  /** True for count metrics (goals, minutes) where a "combined total" makes
   *  sense; false for rates/ratios (per-90, share) where it doesn't. */
  additive: boolean;
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
    unit: "goals",
    efficiency: true,
    additive: true,
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
    unit: "assists",
    efficiency: true,
    additive: true,
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
    unit: "goal contributions",
    efficiency: true,
    additive: true,
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
    unit: "goals per 90",
    efficiency: false,
    additive: false,
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
    unit: "disciplinary points",
    efficiency: false,
    additive: true,
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
    unit: "minutes",
    efficiency: false,
    additive: true,
    eligible: (a) => a.minutes > 0,
    score: (a) => a.minutes,
    values: (a) => ({ minutes: a.minutes, apps: a.apps }),
  },
  {
    type: "youngest-scorers",
    title: (s) => `Best U-23 Goalscorers in ${s}`,
    dek: (t) => `${t.name} leads the under-23 scoring charts with ${t.goals} goals.`,
    columns: [{ key: "goals", label: "Goals" }, { key: "age", label: "Age" }, { key: "apps", label: "Apps" }],
    methodology: "Most goals by players aged 23 or under (at time of generation), across all tracked competitions this season.",
    unit: "goals",
    efficiency: false,
    additive: true,
    eligible: (a) => a.goals > 0 && a.age != null && a.age <= 23,
    score: (a) => a.goals,
    values: (a) => ({ goals: a.goals, age: a.age ?? 0, apps: a.apps }),
  },
  {
    type: "goal-share",
    title: (s) => `Biggest Goal Share in ${s}`,
    dek: (t) => `${t.name} carries the biggest share of their team's goals this season.`,
    columns: [{ key: "share", label: "% of team" }, { key: "goals", label: "Goals" }, { key: "teamGoals", label: "Team total" }],
    methodology: "Share of their team's goals scored by the player, as a percentage (minimum 5 goals; team minimum 10). A measure of attacking reliance on one player.",
    unit: "% of team's goals",
    efficiency: false,
    additive: false,
    eligible: (a) => a.goals >= 5 && (a.teamGoals ?? 0) >= 10,
    score: (a) => ((a.teamGoals ?? 0) > 0 ? Math.round((a.goals / (a.teamGoals as number)) * 100) : 0),
    values: (a) => ({ share: Math.round((a.goals / ((a.teamGoals as number) || 1)) * 100), goals: a.goals, teamGoals: a.teamGoals ?? 0 }),
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

  // --- Analysis layer: deterministic, data-true (no AI). ---
  const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString() : round2(n).toLocaleString());
  const scores = ranked.map(def.score);
  const total = scores.reduce((s, v) => s + v, 0);
  const avg = total / ranked.length;
  const leaderMargin = ranked.length > 1 ? def.score(ranked[0]) - def.score(ranked[1]) : 0;

  const lowest = def.score(ranked[ranked.length - 1]);
  // "Combined" only means something for count metrics; for rates/ratios show
  // the leader + range instead.
  const summary = def.additive
    ? [
        { label: `Top ${ranked.length} combined`, value: fmt(total) },
        { label: "Average", value: fmt(avg) },
        { label: "Leader's margin", value: `+${fmt(leaderMargin)}` },
      ]
    : [
        { label: "Leader", value: fmt(def.score(ranked[0])) },
        { label: "Average", value: fmt(avg) },
        { label: `#${ranked.length}`, value: fmt(lowest) },
      ];

  const insights: string[] = [];
  insights.push(
    `${ranked[0].name} leads the ${def.unit} chart with ${fmt(def.score(ranked[0]))}` +
      (ranked.length > 1
        ? leaderMargin > 0
          ? `, ${fmt(leaderMargin)} clear of ${ranked[1].name}.`
          : `, level with ${ranked[1].name}.`
        : "."),
  );
  insights.push(
    def.additive
      ? `The top ${ranked.length} account for ${fmt(total)} ${def.unit} between them — an average of ${fmt(avg)} each.`
      : `The top ${ranked.length} average ${fmt(avg)} ${def.unit}, ranging from ${fmt(def.score(ranked[0]))} down to ${fmt(lowest)}.`,
  );
  // Minutes-adjusted standout: the volume leader isn't always the most efficient.
  if (def.efficiency) {
    const per90 = (a: SeasonAgg) => (a.minutes >= 90 ? def.score(a) / (a.minutes / 90) : 0);
    const pool = ranked.filter((a) => a.minutes >= 900);
    if (pool.length > 1) {
      const best = [...pool].sort((a, b) => per90(b) - per90(a))[0];
      const leaderRated = ranked[0].minutes >= 900;
      if (best.name === ranked[0].name) {
        insights.push(`${best.name} leads on both raw total and per-90 rate (${round2(per90(best))} ${def.unit} per 90) — dominant on both counts.`);
      } else if (leaderRated) {
        insights.push(
          `Adjusted for minutes, ${best.name} is the most productive at ${round2(per90(best))} ${def.unit} per 90 — ahead of volume leader ${ranked[0].name} (${round2(per90(ranked[0]))}).`,
        );
      } else {
        insights.push(`Adjusted for minutes, ${best.name} tops the per-90 rate at ${round2(per90(best))} ${def.unit} per 90.`);
      }
    }
  }

  const primaryKey = def.columns[0].key;
  const chart = rows.slice(0, 10).map((r) => ({ label: r.player, value: r.values[primaryKey] }));

  return {
    type: def.type,
    slug: `${def.type}-${slugifySeason(seasonLabel)}`,
    title: def.title(seasonLabel),
    dek: def.dek(ranked[0]),
    data: { columns: def.columns, rows, methodology: def.methodology, seasonLabel, generatedAt, summary, insights, chart },
  };
}

/** Generate all studies that have enough data. */
export async function generateAllStudies(generatedAt: string): Promise<Study[]> {
  const seasonLabel = await getSeasonLabel();
  if (!seasonLabel) return [];
  const aggs = await getSeasonAggregates();

  // Derive per-row context the studies need: age (from DOB) and the player's
  // team's total goals (for goal-share). Computed once here so the study
  // transforms stay pure.
  const now = new Date(generatedAt).getTime();
  const YEAR_MS = 365.25 * 86400000;
  const teamGoals = new Map<string, number>();
  for (const a of aggs) {
    if (a.team_slug) teamGoals.set(a.team_slug, (teamGoals.get(a.team_slug) ?? 0) + a.goals);
  }
  for (const a of aggs) {
    a.age = a.dob ? Math.floor((now - new Date(a.dob).getTime()) / YEAR_MS) : null;
    a.teamGoals = a.team_slug ? teamGoals.get(a.team_slug) ?? 0 : 0;
  }

  return STUDY_DEFS.map((d) => buildStudy(d, aggs, seasonLabel, generatedAt)).filter((s): s is Study => s !== null);
}
