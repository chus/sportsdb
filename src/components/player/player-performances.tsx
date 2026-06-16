import { Link } from "@/i18n/navigation";
import { format } from "date-fns";

/**
 * Recent per-match performances with real stats (rating, goals, shots,
 * passes, dribbles …). The substantive recent-form block that turns a
 * thin player page into a rich, indexable profile. Horizontally scrollable
 * on mobile; rating is colour-coded.
 */

interface Performance {
  matchSlug: string;
  scheduledAt: Date;
  teamId: string;
  homeTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  opponentName: string;
  opponentSlug: string;
  opponentLogo: string | null;
  competitionName: string;
  minutes: number | null;
  rating: string | null;
  goals: number | null;
  assists: number | null;
  shotsTotal: number | null;
  shotsOnTarget: number | null;
  keyPasses: number | null;
  passAccuracy: number | null;
  dribblesSuccess: number | null;
  dribblesAttempts: number | null;
  duelsWon: number | null;
  duelsTotal: number | null;
}

function ratingClasses(rating: number): string {
  if (rating >= 8) return "bg-green-100 text-green-800";
  if (rating >= 7) return "bg-lime-100 text-lime-800";
  if (rating >= 6) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-700";
}

function resultBadge(p: Performance): { label: string; cls: string } {
  if (p.homeScore == null || p.awayScore == null) return { label: "–", cls: "text-neutral-400" };
  const isHome = p.teamId === p.homeTeamId;
  const gf = isHome ? p.homeScore : p.awayScore;
  const ga = isHome ? p.awayScore : p.homeScore;
  if (gf > ga) return { label: "W", cls: "bg-green-500 text-white" };
  if (gf < ga) return { label: "L", cls: "bg-red-500 text-white" };
  return { label: "D", cls: "bg-neutral-400 text-white" };
}

const n = (v: number | null) => (v == null ? "–" : String(v));

export function PlayerPerformances({ performances }: { performances: Performance[] }) {
  if (performances.length === 0) return null;

  return (
    <section className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-200">
        <h2 className="text-lg font-bold text-neutral-900">Recent Performances</h2>
        <p className="text-sm text-neutral-500 mt-0.5">
          Match-by-match ratings and stats from the current season
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-neutral-500 border-b border-neutral-100">
              <th className="text-left font-medium px-4 py-2.5">Opponent</th>
              <th className="text-center font-medium px-2 py-2.5">Rating</th>
              <th className="text-center font-medium px-2 py-2.5">Min</th>
              <th className="text-center font-medium px-2 py-2.5">G</th>
              <th className="text-center font-medium px-2 py-2.5">A</th>
              <th className="text-center font-medium px-2 py-2.5" title="Shots on target / total">Shots</th>
              <th className="text-center font-medium px-2 py-2.5" title="Key passes">KP</th>
              <th className="text-center font-medium px-2 py-2.5" title="Pass accuracy">Pass%</th>
              <th className="text-center font-medium px-2 py-2.5" title="Dribbles completed / attempted">Drb</th>
              <th className="text-center font-medium px-2 py-2.5" title="Duels won / total">Duels</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {performances.map((p, i) => {
              const r = p.rating != null ? parseFloat(p.rating) : null;
              const res = resultBadge(p);
              return (
                <tr key={i} className="hover:bg-neutral-50">
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Link href={`/matches/${p.matchSlug}`} className="flex items-center gap-2 group">
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold shrink-0 ${res.cls}`}>
                        {res.label}
                      </span>
                      {p.opponentLogo && (
                        <img src={p.opponentLogo} alt="" className="w-5 h-5 object-contain shrink-0" />
                      )}
                      <span className="font-medium text-neutral-800 group-hover:text-blue-600">
                        {p.opponentName}
                      </span>
                      <span className="text-xs text-neutral-400 hidden sm:inline">
                        {format(new Date(p.scheduledAt), "d MMM")}
                      </span>
                    </Link>
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    {r != null ? (
                      <span className={`inline-block px-2 py-0.5 rounded font-bold text-xs ${ratingClasses(r)}`}>
                        {r.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-neutral-300">–</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-neutral-600">{n(p.minutes)}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums font-medium text-neutral-900">{n(p.goals)}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums font-medium text-neutral-900">{n(p.assists)}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-neutral-600">
                    {p.shotsTotal == null ? "–" : `${p.shotsOnTarget ?? 0}/${p.shotsTotal}`}
                  </td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-neutral-600">{n(p.keyPasses)}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-neutral-600">
                    {p.passAccuracy == null ? "–" : `${p.passAccuracy}%`}
                  </td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-neutral-600">
                    {p.dribblesAttempts == null ? "–" : `${p.dribblesSuccess ?? 0}/${p.dribblesAttempts}`}
                  </td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-neutral-600">
                    {p.duelsTotal == null ? "–" : `${p.duelsWon ?? 0}/${p.duelsTotal}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
