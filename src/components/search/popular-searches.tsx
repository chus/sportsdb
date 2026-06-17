import { TrendingUp } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getPopularSearches } from "@/lib/queries/search";

export async function PopularSearches() {
  const popularSearches = await getPopularSearches(8);

  if (popularSearches.length === 0) {
    return null;
  }

  return (
    <div className="bg-surface rounded-xl border border-line p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-orange-500" />
        <h3 className="font-semibold text-ink">Trending Searches</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {popularSearches.map((item, index) => (
          <Link
            key={item.query}
            href={`/search?q=${encodeURIComponent(item.query)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 hover:bg-surface-2 rounded-full text-sm text-ink hover:text-ink transition-colors"
          >
            <span className="text-xs text-faint font-medium">
              {index + 1}
            </span>
            <span className="capitalize">{item.query}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
