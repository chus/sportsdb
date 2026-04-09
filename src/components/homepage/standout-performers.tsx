import Link from "next/link";
import { Star } from "lucide-react";
import type { StandoutPerformer } from "@/lib/queries/homepage";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";

export function StandoutPerformers({ data }: { data: StandoutPerformer[] }) {
  if (!data.length) return null;

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-neutral-100 flex items-center gap-2">
        <Star className="w-4 h-4 text-amber-500" />
        <h3 className="font-bold text-sm text-neutral-900">Standout Performers</h3>
        <span className="text-xs text-neutral-400 ml-auto">Last 24h</span>
      </div>
      <ul className="divide-y divide-neutral-100">
        {data.map((p) => (
          <li key={p.playerId} className="p-4">
            <Link
              href={`/players/${p.slug}`}
              className="flex items-center gap-3 group"
            >
              <div className="w-10 h-10 rounded-full overflow-hidden bg-neutral-100 flex-shrink-0 flex items-center justify-center">
                {p.imageUrl ? (
                  <ImageWithFallback
                    src={p.imageUrl}
                    alt={p.name}
                    width={40}
                    height={40}
                    className="w-10 h-10 object-cover"
                  />
                ) : (
                  <span className="text-xs font-bold text-neutral-500">
                    {p.name.substring(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-neutral-900 truncate group-hover:text-blue-600 transition-colors">
                  {p.name}
                </div>
                <div className="text-xs text-neutral-500 truncate">{p.teamName}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {p.goals > 0 && (
                  <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">
                    {p.goals}G
                  </span>
                )}
                {p.assists > 0 && (
                  <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    {p.assists}A
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
