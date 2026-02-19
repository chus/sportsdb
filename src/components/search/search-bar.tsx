"use client";

import { Search, X, Users, Shield, Trophy, MapPin, Loader2 } from "lucide-react";
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
  size?: "default" | "large";
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
  player: "bg-blue-100 text-blue-800",
  team: "bg-green-100 text-green-800",
  competition: "bg-purple-100 text-purple-800",
  venue: "bg-orange-100 text-orange-800",
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  player: Users,
  team: Shield,
  competition: Trophy,
  venue: MapPin,
};

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-200 text-neutral-900 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export function SearchBar({
  autoFocus,
  placeholder = "Search players, teams, competitions...",
  initialQuery = "",
  onSubmit,
  size = "default",
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

  // Show recent searches when focused with empty/short query
  const showRecentSearches =
    isFocused && query.trim().length < 2 && recentSearches.length > 0;
  // Show results dropdown when we have 2+ characters
  const showResults = isFocused && query.trim().length >= 2;

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
        `/api/search?q=${encodeURIComponent(searchQuery)}&limit=8`
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

  // Handle input change with faster debouncing for instant feel
  const handleInputChange = (value: string) => {
    setQuery(value);
    setHighlightedIndex(-1);

    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Only search if at least 2 characters
    if (value.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    // Show loading immediately for better UX
    setIsLoading(true);

    // Faster debounce for instant search feel (100ms)
    debounceRef.current = setTimeout(() => {
      performSearch(value);
    }, 100);
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

  const inputSizeClasses = size === "large"
    ? "pl-14 pr-14 py-4 text-lg"
    : "pl-12 pr-12 py-3 text-base";

  const iconSizeClasses = size === "large" ? "w-6 h-6" : "w-5 h-5";

  return (
    <div className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          {isLoading && query ? (
            <Loader2 className={`absolute left-4 top-1/2 -translate-y-1/2 ${iconSizeClasses} text-blue-500 animate-spin`} />
          ) : (
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${iconSizeClasses} text-neutral-400`} />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onKeyDown={handleKeyDown}
            autoFocus={autoFocus}
            placeholder={placeholder}
            className={`w-full ${inputSizeClasses} border border-neutral-300 rounded-xl bg-white text-neutral-900 font-medium placeholder:text-neutral-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm`}
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <X className={iconSizeClasses} />
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
            className="absolute top-full left-0 right-0 mt-2 bg-white border border-neutral-200 rounded-xl shadow-xl overflow-hidden z-20 max-h-[480px] overflow-y-auto"
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
                {/* Loading skeleton */}
                {isLoading && results.length === 0 && (
                  <div className="p-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-3 animate-pulse">
                        <div className="w-10 h-10 bg-neutral-100 rounded-lg" />
                        <div className="flex-1">
                          <div className="h-4 bg-neutral-100 rounded w-2/3 mb-2" />
                          <div className="h-3 bg-neutral-50 rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!isLoading && results.length === 0 && query.trim().length >= 2 && (
                  <div className="px-4 py-8 text-center">
                    <Search className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-neutral-500 text-sm">
                      No results for "<span className="font-medium text-neutral-700">{query}</span>"
                    </p>
                    <p className="text-neutral-400 text-xs mt-1">
                      Try a different spelling or search term
                    </p>
                  </div>
                )}

                {results.length > 0 && (
                  <div className="p-2">
                    {results.map((result, index) => {
                      const Icon = TYPE_ICONS[result.entityType] || Users;
                      return (
                        <button
                          key={result.id}
                          data-index={index}
                          onClick={() => handleResultClick(result)}
                          className={`w-full px-3 py-2.5 text-left flex items-center gap-3 rounded-lg transition-colors ${
                            highlightedIndex === index
                              ? "bg-blue-50"
                              : "hover:bg-neutral-50"
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            highlightedIndex === index
                              ? "bg-blue-100"
                              : "bg-neutral-100"
                          }`}>
                            <Icon className={`w-5 h-5 ${
                              highlightedIndex === index
                                ? "text-blue-600"
                                : "text-neutral-500"
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`font-semibold truncate ${
                              highlightedIndex === index
                                ? "text-blue-900"
                                : "text-neutral-900"
                            }`}>
                              {highlightMatch(result.name, query)}
                            </div>
                            {result.subtitle && (
                              <div className="text-sm text-neutral-500 truncate">
                                {highlightMatch(result.subtitle, query)}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className={`text-xs px-2 py-1 rounded-md font-medium ${TYPE_COLORS[result.entityType] || "bg-neutral-100 text-neutral-600"}`}
                            >
                              {TYPE_LABELS[result.entityType] || result.entityType}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {results.length > 0 && (
                  <button
                    data-index={results.length}
                    onClick={handleSubmit}
                    className={`w-full px-4 py-3 text-left text-sm font-semibold border-t border-neutral-100 flex items-center justify-between ${
                      highlightedIndex === results.length
                        ? "bg-blue-50 text-blue-700"
                        : "text-blue-600 hover:bg-blue-50"
                    }`}
                  >
                    <span>See all results for "{query}"</span>
                    <span className="text-xs text-neutral-400">↵</span>
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
