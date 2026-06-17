import { Link } from "@/i18n/navigation";
import { Activity } from "lucide-react";

/**
 * Current injuries & suspensions for a team. Rendered on the team page.
 * "Missing Fixture" → Out (red), "Questionable" → Doubtful (amber).
 */
interface Injury {
  playerName: string;
  playerSlug: string;
  playerImage: string | null;
  position: string | null;
  isIndexable: boolean | null;
  type: string | null;
  reason: string | null;
}

function statusBadge(type: string | null): { label: string; cls: string } {
  if (type === "Questionable") return { label: "Doubtful", cls: "bg-amber-100 text-amber-800" };
  return { label: "Out", cls: "bg-red-100 text-red-700" };
}

export function TeamInjuries({ injuries, teamName }: { injuries: Injury[]; teamName: string }) {
  if (injuries.length === 0) return null;

  return (
    <section className="bg-surface rounded-xl border border-line overflow-hidden">
      <div className="px-6 py-4 border-b border-line flex items-center gap-2">
        <Activity className="w-4 h-4 text-red-500" />
        <h2 className="text-lg font-bold text-ink">Injuries &amp; Suspensions</h2>
        <span className="text-xs font-medium text-muted">({injuries.length})</span>
      </div>
      <ul className="divide-y divide-line">
        {injuries.map((inj, i) => {
          const badge = statusBadge(inj.type);
          const name = (
            <span className="font-medium text-ink">{inj.playerName}</span>
          );
          return (
            <li key={i} className="flex items-center gap-3 px-6 py-3">
              {inj.playerImage ? (
                <img src={inj.playerImage} alt="" className="w-8 h-8 rounded-full object-cover bg-surface-2 shrink-0" />
              ) : (
                <span className="w-8 h-8 rounded-full bg-surface-2 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                {inj.isIndexable ? (
                  <Link href={`/players/${inj.playerSlug}`} className="hover:text-brand">
                    {name}
                  </Link>
                ) : (
                  name
                )}
                <div className="text-xs text-muted truncate">
                  {inj.position ?? ""}
                  {inj.reason ? ` · ${inj.reason}` : ""}
                </div>
              </div>
              <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${badge.cls}`}>
                {badge.label}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="px-6 py-2.5 text-[11px] text-faint border-t border-line">
        Current availability for {teamName}, updated from official team news.
      </p>
    </section>
  );
}
