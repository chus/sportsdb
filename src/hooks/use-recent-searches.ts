"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "sportsdb_recent_searches";
const MAX_SEARCHES = 10;

interface RecentSearch {
  query: string;
  timestamp: number;
}

export function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentSearch[];
        setRecentSearches(parsed);
      }
    } catch (error) {
      console.error("Failed to load recent searches:", error);
    }
  }, []);

  // Save to localStorage whenever searches change
  const saveSearches = useCallback((searches: RecentSearch[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
    } catch (error) {
      console.error("Failed to save recent searches:", error);
    }
  }, []);

  const addSearch = useCallback(
    (query: string) => {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) return;

      setRecentSearches((prev) => {
        // Remove duplicate if exists
        const filtered = prev.filter(
          (s) => s.query.toLowerCase() !== trimmedQuery.toLowerCase()
        );

        // Add new search at the beginning
        const updated = [
          { query: trimmedQuery, timestamp: Date.now() },
          ...filtered,
        ].slice(0, MAX_SEARCHES);

        saveSearches(updated);
        return updated;
      });
    },
    [saveSearches]
  );

  const removeSearch = useCallback(
    (query: string) => {
      setRecentSearches((prev) => {
        const updated = prev.filter(
          (s) => s.query.toLowerCase() !== query.toLowerCase()
        );
        saveSearches(updated);
        return updated;
      });
    },
    [saveSearches]
  );

  const clearAll = useCallback(() => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear recent searches:", error);
    }
  }, []);

  return {
    recentSearches: recentSearches.map((s) => s.query),
    addSearch,
    removeSearch,
    clearAll,
  };
}
