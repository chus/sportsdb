interface MatchStatBarsProps {
  homeTeamName: string;
  awayTeamName: string;
  homeTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  events: Array<{
    type: string;
    teamId: string;
  }>;
  homeTeamId: string;
  awayTeamId: string;
}

function StatBar({
  label,
  homeValue,
  awayValue,
  accentColor = "bg-blue-500",
}: {
  label: string;
  homeValue: number;
  awayValue: number;
  accentColor?: string;
}) {
  const total = homeValue + awayValue;
  const homePercent = total > 0 ? (homeValue / total) * 100 : 50;
  const awayPercent = total > 0 ? (awayValue / total) * 100 : 50;

  return (
    <div className="py-2">
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="font-bold text-neutral-900 w-8 text-center">
          {homeValue}
        </span>
        <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
          {label}
        </span>
        <span className="font-bold text-neutral-900 w-8 text-center">
          {awayValue}
        </span>
      </div>
      <div className="flex gap-1 h-2.5">
        <div className="flex-1 bg-neutral-100 rounded-l-full overflow-hidden flex justify-end">
          <div
            className={`${accentColor} rounded-l-full transition-all duration-500`}
            style={{ width: `${homePercent}%` }}
          />
        </div>
        <div className="flex-1 bg-neutral-100 rounded-r-full overflow-hidden">
          <div
            className={`${accentColor} rounded-r-full transition-all duration-500`}
            style={{ width: `${awayPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function MatchStatBars({
  homeTeamName,
  awayTeamName,
  homeTeamLogo,
  awayTeamLogo,
  events,
  homeTeamId,
  awayTeamId,
}: MatchStatBarsProps) {
  if (events.length === 0) return null;

  // Aggregate stats
  const homeGoals = events.filter(
    (e) =>
      (e.type === "goal" || e.type === "penalty") && e.teamId === homeTeamId
  ).length;
  const awayGoals = events.filter(
    (e) =>
      (e.type === "goal" || e.type === "penalty") && e.teamId === awayTeamId
  ).length;

  const homeYellows = events.filter(
    (e) => e.type === "yellow_card" && e.teamId === homeTeamId
  ).length;
  const awayYellows = events.filter(
    (e) => e.type === "yellow_card" && e.teamId === awayTeamId
  ).length;

  const homeReds = events.filter(
    (e) => e.type === "red_card" && e.teamId === homeTeamId
  ).length;
  const awayReds = events.filter(
    (e) => e.type === "red_card" && e.teamId === awayTeamId
  ).length;

  const homeSubs = events.filter(
    (e) => e.type === "substitution" && e.teamId === homeTeamId
  ).length;
  const awaySubs = events.filter(
    (e) => e.type === "substitution" && e.teamId === awayTeamId
  ).length;

  const totalCards = homeYellows + awayYellows + homeReds + awayReds;

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-200">
        <h2 className="text-lg font-bold text-neutral-900">Match Summary</h2>
      </div>
      <div className="px-6 py-4">
        {/* Team headers */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            {homeTeamLogo && (
              <img
                src={homeTeamLogo}
                alt=""
                className="w-5 h-5 object-contain"
              />
            )}
            <span className="text-sm font-semibold text-neutral-900">
              {homeTeamName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-900">
              {awayTeamName}
            </span>
            {awayTeamLogo && (
              <img
                src={awayTeamLogo}
                alt=""
                className="w-5 h-5 object-contain"
              />
            )}
          </div>
        </div>

        <div className="space-y-1">
          <StatBar
            label="Goals"
            homeValue={homeGoals}
            awayValue={awayGoals}
            accentColor="bg-green-500"
          />
          {totalCards > 0 && (
            <StatBar
              label="Yellow Cards"
              homeValue={homeYellows}
              awayValue={awayYellows}
              accentColor="bg-yellow-400"
            />
          )}
          {(homeReds > 0 || awayReds > 0) && (
            <StatBar
              label="Red Cards"
              homeValue={homeReds}
              awayValue={awayReds}
              accentColor="bg-red-500"
            />
          )}
          {(homeSubs > 0 || awaySubs > 0) && (
            <StatBar
              label="Substitutions"
              homeValue={homeSubs}
              awayValue={awaySubs}
              accentColor="bg-blue-400"
            />
          )}
        </div>
      </div>
    </div>
  );
}
