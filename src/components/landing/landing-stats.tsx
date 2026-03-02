import { Users, Shield, Trophy, Calendar } from "lucide-react";

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
  const stats = [
    { label: "Players", value: formatStat(players), icon: Users },
    { label: "Teams", value: formatStat(teams), icon: Shield },
    { label: "Competitions", value: formatStat(competitions), icon: Trophy },
    { label: "Matches", value: formatStat(matches), icon: Calendar },
  ];

  return (
    <section className="relative py-20 overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700" />

      {/* Decorative blurred circles */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-white rounded-full opacity-10 blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-400 rounded-full opacity-10 blur-3xl" />

      <div className="relative max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            The World&apos;s Most Comprehensive Sports Database
          </h2>
          <p className="text-lg text-white/70 max-w-2xl mx-auto">
            Explore real-time data across the biggest football leagues and competitions
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="group">
              <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-white/20 transition-colors">
                <Icon className="w-7 h-7 text-white/80" />
              </div>
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">
                {value}
              </div>
              <div className="text-sm text-white/60 font-medium uppercase tracking-wide">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
