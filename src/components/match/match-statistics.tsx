/**
 * Rich per-fixture team statistics (possession, shots, passes, xG …)
 * from API-Football. Renders a comparison bar per stat, home (blue) vs
 * away (neutral). This is the substantive on-page content that turns a
 * thin match page into something Google indexes and AdSense rates as
 * real value. Falls back to nothing when no statistics exist.
 */

interface TeamStats {
  possession: number | null;
  shotsTotal: number | null;
  shotsOnTarget: number | null;
  corners: number | null;
  fouls: number | null;
  offsides: number | null;
  goalkeeperSaves: number | null;
  passesTotal: number | null;
  passAccuracy: number | null;
  expectedGoals: string | null;
}

interface MatchStatisticsProps {
  homeTeamName: string;
  awayTeamName: string;
  homeTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  home: TeamStats;
  away: TeamStats;
}

function ComparisonBar({
  label,
  homeValue,
  awayValue,
  suffix = "",
  display,
}: {
  label: string;
  homeValue: number | null;
  awayValue: number | null;
  suffix?: string;
  display?: (v: number) => string;
}) {
  if (homeValue == null && awayValue == null) return null;
  const h = homeValue ?? 0;
  const a = awayValue ?? 0;
  const total = h + a;
  // Higher value owns the larger share; 50/50 when both are zero.
  const homePercent = total > 0 ? (h / total) * 100 : 50;
  const awayPercent = total > 0 ? (a / total) * 100 : 50;
  const fmt = (v: number | null) =>
    v == null ? "—" : display ? display(v) : `${v}${suffix}`;
  const homeLeads = h > a;
  const awayLeads = a > h;

  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className={`w-12 text-left tabular-nums ${homeLeads ? "font-bold text-neutral-900" : "font-medium text-neutral-500"}`}>
          {fmt(homeValue)}
        </span>
        <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
          {label}
        </span>
        <span className={`w-12 text-right tabular-nums ${awayLeads ? "font-bold text-neutral-900" : "font-medium text-neutral-500"}`}>
          {fmt(awayValue)}
        </span>
      </div>
      <div className="flex gap-1 h-2">
        <div className="flex-1 bg-neutral-100 rounded-l-full overflow-hidden flex justify-end">
          <div
            className="bg-blue-600 rounded-l-full transition-all duration-500"
            style={{ width: `${homePercent}%` }}
          />
        </div>
        <div className="flex-1 bg-neutral-100 rounded-r-full overflow-hidden">
          <div
            className="bg-neutral-400 rounded-r-full transition-all duration-500"
            style={{ width: `${awayPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function MatchStatistics({
  homeTeamName,
  awayTeamName,
  homeTeamLogo,
  awayTeamLogo,
  home,
  away,
}: MatchStatisticsProps) {
  const xg = (v: string | null) => (v == null ? null : parseFloat(v));
  const xgFmt = (v: number) => v.toFixed(1);

  // Only render if at least one meaningful stat exists.
  const hasAny =
    home.possession != null ||
    home.shotsTotal != null ||
    home.passesTotal != null ||
    away.possession != null ||
    away.shotsTotal != null ||
    away.passesTotal != null;
  if (!hasAny) return null;

  return (
    <section className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-200">
        <h2 className="text-lg font-bold text-neutral-900">Match Statistics</h2>
      </div>
      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            {homeTeamLogo && (
              <img src={homeTeamLogo} alt={homeTeamName} className="w-5 h-5 object-contain" />
            )}
            <span className="text-sm font-semibold text-blue-700">{homeTeamName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-600">{awayTeamName}</span>
            {awayTeamLogo && (
              <img src={awayTeamLogo} alt={awayTeamName} className="w-5 h-5 object-contain" />
            )}
          </div>
        </div>

        <div className="divide-y divide-neutral-50">
          <ComparisonBar label="Possession" homeValue={home.possession} awayValue={away.possession} suffix="%" />
          <ComparisonBar label="Total Shots" homeValue={home.shotsTotal} awayValue={away.shotsTotal} />
          <ComparisonBar label="Shots on Target" homeValue={home.shotsOnTarget} awayValue={away.shotsOnTarget} />
          <ComparisonBar
            label="Expected Goals (xG)"
            homeValue={xg(home.expectedGoals)}
            awayValue={xg(away.expectedGoals)}
            display={xgFmt}
          />
          <ComparisonBar label="Passes" homeValue={home.passesTotal} awayValue={away.passesTotal} />
          <ComparisonBar label="Pass Accuracy" homeValue={home.passAccuracy} awayValue={away.passAccuracy} suffix="%" />
          <ComparisonBar label="Corners" homeValue={home.corners} awayValue={away.corners} />
          <ComparisonBar label="Fouls" homeValue={home.fouls} awayValue={away.fouls} />
          <ComparisonBar label="Offsides" homeValue={home.offsides} awayValue={away.offsides} />
          <ComparisonBar label="Goalkeeper Saves" homeValue={home.goalkeeperSaves} awayValue={away.goalkeeperSaves} />
        </div>
      </div>
    </section>
  );
}
