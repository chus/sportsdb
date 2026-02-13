import { Clock, Circle } from "lucide-react";

interface LiveMatchCardProps {
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  status: "live" | "upcoming" | "finished";
  time?: string;
  minute?: string;
  competition: string;
  onClick?: () => void;
}

export function LiveMatchCard({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  status,
  time,
  minute,
  competition,
  onClick
}: LiveMatchCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-72 bg-white rounded-xl p-4 border border-neutral-200 hover:shadow-lg hover:border-neutral-300 transition-all duration-200 hover:-translate-y-0.5"
    >
      {/* Status Badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-neutral-500">{competition}</span>
        {status === "live" && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-100 text-red-600 rounded-full">
            <Circle className="w-2 h-2 fill-current animate-pulse" />
            <span className="text-xs font-semibold">LIVE</span>
          </div>
        )}
        {status === "upcoming" && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full">
            <Clock className="w-3 h-3" />
            <span className="text-xs font-semibold">{time}</span>
          </div>
        )}
        {status === "finished" && (
          <span className="text-xs font-medium text-neutral-500">FT</span>
        )}
      </div>

      {/* Teams */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">
              {homeTeam.substring(0, 3).toUpperCase()}
            </div>
            <span className="font-semibold text-neutral-900">{homeTeam}</span>
          </div>
          {homeScore !== undefined && (
            <span className="text-2xl font-bold text-neutral-900 ml-2">{homeScore}</span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">
              {awayTeam.substring(0, 3).toUpperCase()}
            </div>
            <span className="font-semibold text-neutral-900">{awayTeam}</span>
          </div>
          {awayScore !== undefined && (
            <span className="text-2xl font-bold text-neutral-900 ml-2">{awayScore}</span>
          )}
        </div>
      </div>

      {/* Live minute */}
      {status === "live" && minute && (
        <div className="mt-3 text-center text-sm font-medium text-red-600">
          {minute}'
        </div>
      )}
    </button>
  );
}
