"use client";

import { Clock, X, Trash2 } from "lucide-react";

interface RecentSearchesProps {
  searches: string[];
  onSelect: (query: string) => void;
  onRemove: (query: string) => void;
  onClearAll: () => void;
}

export function RecentSearches({
  searches,
  onSelect,
  onRemove,
  onClearAll,
}: RecentSearchesProps) {
  if (searches.length === 0) {
    return null;
  }

  return (
    <div className="py-2">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 uppercase tracking-wide">
          <Clock className="w-3.5 h-3.5" />
          Recent Searches
        </div>
        <button
          onClick={onClearAll}
          className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          Clear
        </button>
      </div>
      <div className="space-y-1">
        {searches.map((query) => (
          <div
            key={query}
            className="flex items-center gap-2 px-4 py-2 hover:bg-neutral-50 group"
          >
            <button
              onClick={() => onSelect(query)}
              className="flex-1 text-left text-sm text-neutral-700 truncate"
            >
              {query}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(query);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-neutral-600 transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
