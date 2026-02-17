"use client";

import { Search, X } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { SearchResult } from "@/types/entities";
import { useRecentSearches } from "@/hooks/use-recent-searches";
import { RecentSearches } from "./recent-searches";

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
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { recentSearches, addSearch, removeSearch, clearAll } =
    useRecentSearches();

  // Show recent searches when focused with empty query
  const showRecentSearches =
    isFocused && query.length === 0 && recentSearches.length > 0;
  const showResults = isFocused && query.length > 0;

  // Total navigable items count
  const totalItems = showRecentSearches
    ? recentSearches.length
    : results.length + 1; // +1 for "See all results"

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
    setHighlightedIndex(-1);

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

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isFocused) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const max = showRecentSearches
            ? recentSearches.length - 1
            : results.length; // Last index is "See all results"
          return prev < max ? prev + 1 : prev;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0) {
          if (showRecentSearches) {
            // Select recent search
            const selectedQuery = recentSearches[highlightedIndex];
            handleRecentSearchSelect(selectedQuery);
          } else if (highlightedIndex < results.length) {
            // Select search result
            handleResultClick(results[highlightedIndex]);
          } else {
            // "See all results" option
            handleSubmit(e as unknown as React.FormEvent);
          }
        } else {
          handleSubmit(e as unknown as React.FormEvent);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsFocused(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const items = dropdownRef.current.querySelectorAll("[data-index]");
      const highlightedItem = items[highlightedIndex];
      if (highlightedItem) {
        highlightedItem.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      addSearch(query);
      setIsFocused(false);
      setHighlightedIndex(-1);
      if (onSubmit) {
        onSubmit(query);
      } else {
        router.push(`/search?q=${encodeURIComponent(query)}`);
      }
    }
  };

  const handleResultClick = (result: SearchResult) => {
    addSearch(result.name);
    setQuery("");
    setResults([]);
    setIsFocused(false);
    setHighlightedIndex(-1);
    const basePath = ENTITY_ROUTES[result.entityType] || "/search";
    router.push(`${basePath}/${result.slug}`);
  };

  const handleRecentSearchSelect = (selectedQuery: string) => {
    setQuery(selectedQuery);
    setIsFocused(false);
    setHighlightedIndex(-1);
    addSearch(selectedQuery);
    if (onSubmit) {
      onSubmit(selectedQuery);
    } else {
      router.push(`/search?q=${encodeURIComponent(selectedQuery)}`);
    }
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setHighlightedIndex(-1);
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
            onKeyDown={handleKeyDown}
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

      {/* Dropdown */}
      {isFocused && (showRecentSearches || showResults) && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => {
              setIsFocused(false);
              setHighlightedIndex(-1);
            }}
          />
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 mt-2 bg-white border border-neutral-300 rounded-lg shadow-lg overflow-hidden z-20 max-h-[400px] overflow-y-auto"
          >
            {/* Recent Searches */}
            {showRecentSearches && (
              <RecentSearches
                searches={recentSearches}
                onSelect={handleRecentSearchSelect}
                onRemove={removeSearch}
                onClearAll={clearAll}
              />
            )}

            {/* Search Results */}
            {showResults && (
              <>
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
                  results.map((result, index) => (
                    <button
                      key={result.id}
                      data-index={index}
                      onClick={() => handleResultClick(result)}
                      className={`w-full px-4 py-3 text-left border-b border-neutral-100 last:border-b-0 flex items-center gap-3 ${
                        highlightedIndex === index
                          ? "bg-blue-50"
                          : "hover:bg-neutral-50"
                      }`}
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
                    data-index={results.length}
                    onClick={handleSubmit}
                    className={`w-full px-4 py-3 text-left text-sm font-medium border-t border-neutral-200 ${
                      highlightedIndex === results.length
                        ? "bg-blue-50 text-blue-700"
                        : "text-blue-600 hover:bg-blue-50"
                    }`}
                  >
                    See all results for "{query}"
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
