import { TrendingUp } from "lucide-react";
import Link from "next/link";
import { getPopularSearches } from "@/lib/queries/search";

export async function PopularSearches() {
  const popularSearches = await getPopularSearches(8);

  if (popularSearches.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-orange-500" />
        <h3 className="font-semibold text-neutral-900">Trending Searches</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {popularSearches.map((item, index) => (
          <Link
            key={item.query}
            href={`/search?q=${encodeURIComponent(item.query)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-full text-sm text-neutral-700 hover:text-neutral-900 transition-colors"
          >
            <span className="text-xs text-neutral-400 font-medium">
              {index + 1}
            </span>
            <span className="capitalize">{item.query}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
