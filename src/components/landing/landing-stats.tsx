interface LandingStatsProps {
  players: number;
  teams: number;
  competitions: number;
  matches: number;
}

function formatStat(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M+";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(0) + "K+";
  }
  return num.toString() + "+";
}

export function LandingStats({ players, teams, competitions, matches }: LandingStatsProps) {
  return (
    <div className="max-w-6xl mx-auto px-4 -mt-8 relative z-10">
      <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 p-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-4xl font-bold text-blue-600 mb-2">
              {formatStat(players)}
            </div>
            <div className="text-sm text-neutral-600">Players</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-green-600 mb-2">
              {formatStat(teams)}
            </div>
            <div className="text-sm text-neutral-600">Teams</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-orange-600 mb-2">
              {formatStat(competitions)}
            </div>
            <div className="text-sm text-neutral-600">Competitions</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-purple-600 mb-2">
              {formatStat(matches)}
            </div>
            <div className="text-sm text-neutral-600">Matches</div>
          </div>
        </div>
      </div>
    </div>
  );
}
