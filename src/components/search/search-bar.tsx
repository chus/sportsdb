"use client";

import { Search, X } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { SearchResult } from "@/types/entities";

interface SearchBarProps {
  autoFocus?: boolean;
  placeholder?: string;
  initialQuery?: string;
  onSubmit?: (query: string) => void;
}

const ENTITY_ROUTES: Record<string, string> = {
  player: "/players",
  team: "/teams",
  competition: "/competitions",
  venue: "/venues",
};

const TYPE_LABELS: Record<string, string> = {
  player: "Player",
  team: "Team",
  competition: "Competition",
  venue: "Venue",
};

const TYPE_COLORS: Record<string, string> = {
  player: "bg-blue-100 text-blue-700",
  team: "bg-green-100 text-green-700",
  competition: "bg-purple-100 text-purple-700",
  venue: "bg-orange-100 text-orange-700",
};

export function SearchBar({
  autoFocus,
  placeholder = "Search players, teams, competitions...",
  initialQuery = "",
  onSubmit,
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [isFocused, setIsFocused] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}&limit=6`
      );
      if (response.ok) {
        const data = await response.json();
        setResults(data.results);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle input change with debouncing
  const handleInputChange = (value: string) => {
    setQuery(value);

    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new debounced search
    debounceRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setIsFocused(false);
      if (onSubmit) {
        onSubmit(query);
      } else {
        router.push(`/search?q=${encodeURIComponent(query)}`);
      }
    }
  };

  const handleResultClick = (result: SearchResult) => {
    setQuery("");
    setResults([]);
    setIsFocused(false);
    const basePath = ENTITY_ROUTES[result.entityType] || "/search";
    router.push(`${basePath}/${result.slug}`);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            autoFocus={autoFocus}
            placeholder={placeholder}
            className="w-full pl-12 pr-12 py-3 border border-neutral-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </form>

      {/* Autocomplete dropdown */}
      {isFocused && (query.length > 0 || results.length > 0) && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsFocused(false)}
          />
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-neutral-300 rounded-lg shadow-lg overflow-hidden z-20 max-h-[400px] overflow-y-auto">
            {isLoading && (
              <div className="px-4 py-3 text-neutral-500 text-sm">
                Searching...
              </div>
            )}

            {!isLoading && results.length === 0 && query.trim() && (
              <div className="px-4 py-3 text-neutral-500 text-sm">
                No results found for "{query}"
              </div>
            )}

            {!isLoading &&
              results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                  className="w-full px-4 py-3 text-left hover:bg-neutral-50 border-b border-neutral-100 last:border-b-0 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-neutral-900 truncate">
                      {result.name}
                    </div>
                    {result.subtitle && (
                      <div className="text-sm text-neutral-600 truncate">
                        {result.subtitle}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {result.meta && (
                      <span className="text-xs text-neutral-500">
                        {result.meta}
                      </span>
                    )}
                    <span
                      className={`text-xs px-2 py-1 rounded ${TYPE_COLORS[result.entityType] || "bg-neutral-100 text-neutral-600"}`}
                    >
                      {TYPE_LABELS[result.entityType] || result.entityType}
                    </span>
                  </div>
                </button>
              ))}

            {!isLoading && results.length > 0 && (
              <button
                onClick={handleSubmit}
                className="w-full px-4 py-3 text-left text-sm text-blue-600 hover:bg-blue-50 border-t border-neutral-200 font-medium"
              >
                See all results for "{query}"
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
