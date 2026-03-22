import Link from "next/link";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface StandingRow {
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalDifference: number;
  points: number;
}

interface StandingTeam {
  id: string;
  name: string;
  shortName: string | null;
  slug: string;
  logoUrl: string | null;
}

interface StandingsEntry {
  standing: StandingRow;
  team: StandingTeam;
}

type ZoneType = "champion" | "cl" | "europa" | "relegation";

interface StandingsTableProps {
  standings: StandingsEntry[];
  /** Number of CL spots (default 4), includes champion spot */
  clSpots?: number;
  /** Number of Europa/Conference spots (default 2) */
  europaSpots?: number;
  /** Number of relegation spots (default 3) */
  relegationSpots?: number;
  /** Show compact version (fewer columns) */
  compact?: boolean;
  /** Limit rows shown */
  limit?: number;
  /** Highlight a specific team by slug */
  highlightTeam?: string;
}

function getZone(
  position: number,
  total: number,
  clSpots: number,
  europaSpots: number,
  relegationSpots: number
): ZoneType | null {
  if (position === 1) return "champion";
  if (position <= clSpots) return "cl";
  if (position <= clSpots + europaSpots) return "europa";
  if (position > total - relegationSpots) return "relegation";
  return null;
}

const ZONE_COLORS: Record<ZoneType, string> = {
  champion: "border-l-blue-600",
  cl: "border-l-blue-400",
  europa: "border-l-orange-400",
  relegation: "border-l-red-400",
};

export function StandingsTable({
  standings,
  clSpots = 4,
  europaSpots = 2,
  relegationSpots = 3,
  compact = false,
  limit,
  highlightTeam,
}: StandingsTableProps) {
  const rows = limit ? standings.slice(0, limit) : standings;
  const total = standings.length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-neutral-500 uppercase tracking-wide border-b border-neutral-200">
            <th className="text-left py-2 pl-3 pr-1 w-8">#</th>
            <th className="text-left py-2 px-2">Team</th>
            <th className="text-center py-2 px-1.5 w-8">P</th>
            {!compact && (
              <>
                <th className="text-center py-2 px-1.5 w-8">W</th>
                <th className="text-center py-2 px-1.5 w-8">D</th>
                <th className="text-center py-2 px-1.5 w-8">L</th>
              </>
            )}
            <th className="text-center py-2 px-1.5 w-8">GD</th>
            <th className="text-center py-2 px-2 w-10 font-bold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ standing, team }) => {
            const zone = getZone(standing.position, total, clSpots, europaSpots, relegationSpots);
            const isHighlighted = highlightTeam === team.slug;

            return (
              <tr
                key={team.id}
                className={cn(
                  "border-b border-neutral-100 border-l-3 transition-colors",
                  zone ? ZONE_COLORS[zone] : "border-l-transparent",
                  isHighlighted ? "bg-blue-50" : "hover:bg-neutral-50"
                )}
              >
                <td className="py-2 pl-3 pr-1 text-neutral-500 font-medium text-xs">
                  {standing.position}
                </td>
                <td className="py-2 px-2">
                  <Link
                    href={`/teams/${team.slug}`}
                    className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                  >
                    <div className="w-5 h-5 flex-shrink-0">
                      {team.logoUrl ? (
                        <ImageWithFallback
                          src={team.logoUrl}
                          alt={team.name}
                          width={20}
                          height={20}
                          className="w-5 h-5 object-contain"
                        />
                      ) : (
                        <Shield className="w-5 h-5 text-neutral-300" />
                      )}
                    </div>
                    <span className={cn(
                      "font-medium truncate",
                      isHighlighted ? "text-blue-700" : "text-neutral-900"
                    )}>
                      {compact ? (team.shortName || team.name) : team.name}
                    </span>
                  </Link>
                </td>
                <td className="text-center py-2 px-1.5 text-neutral-600">{standing.played}</td>
                {!compact && (
                  <>
                    <td className="text-center py-2 px-1.5 text-neutral-600">{standing.won}</td>
                    <td className="text-center py-2 px-1.5 text-neutral-600">{standing.drawn}</td>
                    <td className="text-center py-2 px-1.5 text-neutral-600">{standing.lost}</td>
                  </>
                )}
                <td className={cn(
                  "text-center py-2 px-1.5 font-medium",
                  standing.goalDifference > 0 ? "text-green-600" : standing.goalDifference < 0 ? "text-red-600" : "text-neutral-500"
                )}>
                  {standing.goalDifference > 0 ? `+${standing.goalDifference}` : standing.goalDifference}
                </td>
                <td className="text-center py-2 px-2 font-bold text-neutral-900">
                  {standing.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Zone legend */}
      {!compact && !limit && (
        <div className="flex items-center gap-4 px-3 py-2 text-xs text-neutral-400">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-600" /> Champions League
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-orange-400" /> Europa League
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-400" /> Relegation
          </span>
        </div>
      )}
    </div>
  );
}
