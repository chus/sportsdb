import {
  getBootstrap,
  getFixtures,
  POSITION,
  type FplElement,
  type FplTeam,
} from "./api";

/**
 * Derived FPL tools from the public bootstrap + fixtures data: value picks,
 * form, price movers, and fixture-difficulty ranking. Pure transforms over the
 * API so the page stays a fast, cacheable server render.
 */
export interface FplPlayer {
  name: string;
  team: string;
  position: string;
  price: number; // £m
  points: number;
  form: number;
  selectedBy: number; // %
  ppm: number; // points per £m
  priceChangeEvent: number; // £m this gameweek
  priceChangeStart: number; // £m since season start
}

export interface FplTeamFixtures {
  team: string;
  shortName: string;
  avgDifficulty: number; // lower = easier
  fixtures: { opponent: string; home: boolean; difficulty: number }[];
}

export interface FplData {
  available: boolean;
  valuePicks: FplPlayer[];
  inForm: FplPlayer[];
  risers: FplPlayer[];
  fallers: FplPlayer[];
  easiestFixtures: FplTeamFixtures[];
  nextGameweek: number | null;
}

function toPlayer(e: FplElement, teamById: Map<number, FplTeam>): FplPlayer {
  const price = e.now_cost / 10;
  return {
    name: e.web_name,
    team: teamById.get(e.team)?.short_name ?? "—",
    position: POSITION[e.element_type] ?? "—",
    price,
    points: e.total_points,
    form: parseFloat(e.form) || 0,
    selectedBy: parseFloat(e.selected_by_percent) || 0,
    ppm: price > 0 ? Math.round((e.total_points / price) * 10) / 10 : 0,
    priceChangeEvent: e.cost_change_event / 10,
    priceChangeStart: e.cost_change_start / 10,
  };
}

export async function getFplData(): Promise<FplData> {
  const [bootstrap, fixtures] = await Promise.all([getBootstrap(), getFixtures()]);
  if (!bootstrap) {
    return {
      available: false,
      valuePicks: [],
      inForm: [],
      risers: [],
      fallers: [],
      easiestFixtures: [],
      nextGameweek: null,
    };
  }

  const teamById = new Map(bootstrap.teams.map((t) => [t.id, t]));
  const teamShortById = new Map(bootstrap.teams.map((t) => [t.id, t.short_name]));
  const available = bootstrap.elements.filter((e) => e.status === "a");

  const players = available.map((e) => toPlayer(e, teamById));

  // Value: points per £m, among players with a meaningful points base.
  const valuePicks = players
    .filter((p) => p.points >= 30)
    .sort((a, b) => b.ppm - a.ppm)
    .slice(0, 20);

  const inForm = players
    .filter((p) => p.form > 0)
    .sort((a, b) => b.form - a.form)
    .slice(0, 20);

  // Price movers use all elements (price changes apply regardless of status).
  const allPlayers = bootstrap.elements.map((e) => toPlayer(e, teamById));
  const risers = allPlayers
    .filter((p) => p.priceChangeEvent > 0)
    .sort((a, b) => b.priceChangeEvent - a.priceChangeEvent)
    .slice(0, 10);
  const fallers = allPlayers
    .filter((p) => p.priceChangeEvent < 0)
    .sort((a, b) => a.priceChangeEvent - b.priceChangeEvent)
    .slice(0, 10);

  // Fixture difficulty over the next 5 gameweeks.
  const nextEvent = bootstrap.events.find((ev) => ev.is_next);
  const nextGameweek = nextEvent?.id ?? null;
  let easiestFixtures: FplTeamFixtures[] = [];
  if (nextGameweek !== null) {
    const horizon = new Set(Array.from({ length: 5 }, (_, i) => nextGameweek + i));
    const upcoming = fixtures.filter((f) => f.event !== null && horizon.has(f.event) && !f.finished);
    const byTeam = new Map<number, { opponent: string; home: boolean; difficulty: number }[]>();
    for (const f of upcoming) {
      const homeList = byTeam.get(f.team_h) ?? byTeam.set(f.team_h, []).get(f.team_h)!;
      homeList.push({ opponent: teamShortById.get(f.team_a) ?? "—", home: true, difficulty: f.team_h_difficulty });
      const awayList = byTeam.get(f.team_a) ?? byTeam.set(f.team_a, []).get(f.team_a)!;
      awayList.push({ opponent: teamShortById.get(f.team_h) ?? "—", home: false, difficulty: f.team_a_difficulty });
    }
    easiestFixtures = [...byTeam.entries()]
      .map(([teamId, fx]) => ({
        team: teamById.get(teamId)?.name ?? "—",
        shortName: teamShortById.get(teamId) ?? "—",
        avgDifficulty: Math.round((fx.reduce((s, x) => s + x.difficulty, 0) / fx.length) * 10) / 10,
        fixtures: fx,
      }))
      .sort((a, b) => a.avgDifficulty - b.avgDifficulty);
  }

  return { available: true, valuePicks, inForm, risers, fallers, easiestFixtures, nextGameweek };
}
