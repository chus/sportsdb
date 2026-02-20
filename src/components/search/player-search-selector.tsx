"use client";

import { Search, X, Users, Loader2 } from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { SearchResult } from "@/types/entities";

interface PlayerSearchSelectorProps {
  name: string;
  defaultValue?: string;
  otherPlayerSlug?: string;
  placeholder?: string;
  onSelect?: (slug: string) => void;
}

export function PlayerSearchSelector({
  name,
  defaultValue = "",
  otherPlayerSlug = "",
  placeholder = "Search for a player...",
  onSelect,
}: PlayerSearchSelectorProps) {
  const [query, setQuery] = useState("");
  const [selectedSlug, setSelectedSlug] = useState(defaultValue);
  const [selectedName, setSelectedName] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load selected player name on mount if defaultValue exists
  useEffect(() => {
    if (defaultValue && !selectedName) {
      fetch(`/api/search?q=${encodeURIComponent(defaultValue)}&type=player&limit=1`)
        .then(res => res.json())
        .then(data => {
          if (data.results?.length > 0) {
            setSelectedName(data.results[0].name);
          }
        })
        .catch(() => {});
    }
  }, [defaultValue, selectedName]);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}&type=player&limit=6`
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

  const handleInputChange = (value: string) => {
    setQuery(value);
    setHighlightedIndex(-1);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(() => {
      performSearch(value);
    }, 100);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isFocused || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && results[highlightedIndex]) {
          handleSelect(results[highlightedIndex]);
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

  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const items = dropdownRef.current.querySelectorAll("[data-index]");
      const highlightedItem = items[highlightedIndex];
      if (highlightedItem) {
        highlightedItem.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex]);

  const handleSelect = (result: SearchResult) => {
    setSelectedSlug(result.slug);
    setSelectedName(result.name);
    setQuery("");
    setResults([]);
    setIsFocused(false);
    setHighlightedIndex(-1);

    if (onSelect) {
      onSelect(result.slug);
    } else {
      // Navigate to compare page with both players
      const params = new URLSearchParams();
      if (name === "p1") {
        params.set("p1", result.slug);
        if (otherPlayerSlug) params.set("p2", otherPlayerSlug);
      } else {
        if (otherPlayerSlug) params.set("p1", otherPlayerSlug);
        params.set("p2", result.slug);
      }
      router.push(`/compare/players?${params.toString()}`);
    }
  };

  const handleClear = () => {
    setSelectedSlug("");
    setSelectedName("");
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  };

  const showDropdown = isFocused && query.length >= 2;

  return (
    <div className="relative">
      <input type="hidden" name={name} value={selectedSlug} />

      {selectedSlug && selectedName ? (
        // Selected state
        <div className="flex items-center gap-3 px-4 py-3 border-2 border-blue-200 bg-blue-50 rounded-xl">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <span className="flex-1 font-medium text-neutral-900">{selectedName}</span>
          <button
            type="button"
            onClick={handleClear}
            className="p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : (
        // Search state
        <div className="relative">
          {isLoading ? (
            <Loader2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 animate-spin" />
          ) : (
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isFocused ? 'text-blue-500' : 'text-neutral-400'}`} />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full pl-12 pr-4 py-3 border-2 border-neutral-300 rounded-xl bg-white text-neutral-900 font-medium placeholder:text-neutral-500 placeholder:font-normal focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-md hover:shadow-lg hover:border-neutral-400 transition-all"
          />
        </div>
      )}

      {/* Dropdown */}
      {showDropdown && (
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
            className="absolute top-full left-0 right-0 mt-2 bg-white border border-neutral-200 rounded-xl shadow-xl overflow-hidden z-20 max-h-[320px] overflow-y-auto"
          >
            {isLoading && results.length === 0 && (
              <div className="p-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-3 animate-pulse">
                    <div className="w-10 h-10 bg-neutral-100 rounded-full" />
                    <div className="flex-1">
                      <div className="h-4 bg-neutral-100 rounded w-2/3 mb-2" />
                      <div className="h-3 bg-neutral-50 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && results.length === 0 && query.length >= 2 && (
              <div className="px-4 py-6 text-center">
                <Users className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                <p className="text-neutral-500 text-sm">
                  No players found for "{query}"
                </p>
              </div>
            )}

            {results.length > 0 && (
              <div className="p-2">
                {results.map((result, index) => (
                  <button
                    key={result.id}
                    data-index={index}
                    onClick={() => handleSelect(result)}
                    className={`w-full px-3 py-2.5 text-left flex items-center gap-3 rounded-lg transition-colors ${
                      highlightedIndex === index
                        ? "bg-blue-50"
                        : "hover:bg-neutral-50"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ${
                      highlightedIndex === index ? "bg-blue-100" : "bg-neutral-100"
                    }`}>
                      {(result as any).imageUrl ? (
                        <img
                          src={(result as any).imageUrl}
                          alt={result.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Users className={`w-5 h-5 ${
                          highlightedIndex === index ? "text-blue-600" : "text-neutral-500"
                        }`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-semibold truncate ${
                        highlightedIndex === index ? "text-blue-900" : "text-neutral-900"
                      }`}>
                        {result.name}
                      </div>
                      {result.subtitle && (
                        <div className="text-sm text-neutral-500 truncate">
                          {result.subtitle}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
