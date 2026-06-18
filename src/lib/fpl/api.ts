/**
 * Fantasy Premier League public API client (no auth).
 *
 * FPL is a free, public data source for ~11.5M players who want exactly the
 * data we have a knack for: value, form, price changes, fixture difficulty.
 * Utility tools built on it rank, earn links/shares, and double as data-dense
 * SEO pages — without the scaled-content risk of templated articles.
 */
const BOOTSTRAP_URL = "https://fantasy.premierleague.com/api/bootstrap-static/";
const FIXTURES_URL = "https://fantasy.premierleague.com/api/fixtures/";

export interface FplElement {
  id: number;
  web_name: string;
  team: number;
  element_type: number; // 1 GK, 2 DEF, 3 MID, 4 FWD
  now_cost: number; // tenths of £m (75 = £7.5m)
  total_points: number;
  form: string;
  points_per_game: string;
  selected_by_percent: string;
  cost_change_event: number; // price change this gameweek (tenths)
  cost_change_start: number; // since season start (tenths)
  status: string; // 'a' available, 'i' injured, 'd' doubtful, 's' suspended …
}

export interface FplTeam {
  id: number;
  name: string;
  short_name: string;
}

export interface FplEvent {
  id: number;
  is_next: boolean;
  finished: boolean;
}

export interface FplFixture {
  event: number | null;
  team_h: number;
  team_a: number;
  team_h_difficulty: number;
  team_a_difficulty: number;
  finished: boolean;
}

interface Bootstrap {
  elements: FplElement[];
  teams: FplTeam[];
  events: FplEvent[];
}

export const POSITION: Record<number, string> = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };

/** Cached ~1h — FPL prices/form update at most daily. Returns null on failure. */
export async function getBootstrap(): Promise<Bootstrap | null> {
  try {
    const res = await fetch(BOOTSTRAP_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return (await res.json()) as Bootstrap;
  } catch {
    return null;
  }
}

export async function getFixtures(): Promise<FplFixture[]> {
  try {
    const res = await fetch(FIXTURES_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return (await res.json()) as FplFixture[];
  } catch {
    return [];
  }
}
