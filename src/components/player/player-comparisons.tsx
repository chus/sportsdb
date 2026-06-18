import { ArrowLeftRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { compareMatchup } from "@/lib/seo/compare";

/**
 * "Compare with" links on the player page — the internal-link trail into
 * the /compare matrix (the format that ranks page-one in search). Links to
 * head-to-head pages vs similar players, in canonical (alphabetical) order.
 */
export function PlayerComparisons({
  playerSlug,
  playerName,
  rivals,
}: {
  playerSlug: string;
  playerName: string;
  rivals: Array<{ slug: string; name: string }>;
}) {
  if (rivals.length === 0) return null;

  return (
    <section className="bg-surface rounded-xl border border-line overflow-hidden">
      <div className="px-6 py-4 border-b border-line">
        <h2 className="text-lg font-bold text-ink">Compare {playerName}</h2>
        <p className="text-sm text-muted mt-0.5">Head-to-head stats vs similar players</p>
      </div>
      <ul className="divide-y divide-line">
        {rivals.map((r) => (
          <li key={r.slug}>
            <Link
              href={`/compare/${compareMatchup(playerSlug, r.slug)}`}
              className="group flex items-center justify-between px-6 py-3 hover:bg-surface-2 transition-colors"
            >
              <span className="text-sm text-ink">
                {playerName} <span className="text-muted">vs</span>{" "}
                <span className="font-medium group-hover:text-brand">{r.name}</span>
              </span>
              <ArrowLeftRight className="w-4 h-4 text-faint shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
