"use client";

import { useState, useEffect, useCallback } from "react";

interface LiveMatch {
  id: string;
  status: "live" | "half_time";
  minute: number | null;
  homeScore: number | null;
  awayScore: number | null;
  scheduledAt: string;
  homeTeam: {
    id: string;
    name: string;
    shortName: string | null;
    slug: string;
    logoUrl: string | null;
  } | null;
  awayTeam: {
    id: string;
    name: string;
    shortName: string | null;
    slug: string;
    logoUrl: string | null;
  } | null;
  venue: {
    name: string;
    slug: string;
  } | null;
  competition: {
    name: string;
    slug: string;
  } | null;
}

interface LiveMatchesResponse {
  matches: LiveMatch[];
  timestamp: string;
  error?: string;
}

interface UseLiveMatchesOptions {
  pollingInterval?: number;
  enabled?: boolean;
}

export function useLiveMatches(options: UseLiveMatchesOptions = {}) {
  const { pollingInterval = 30000, enabled = true } = options;

  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchLiveMatches = useCallback(async () => {
    try {
      const response = await fetch("/api/matches/live", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: LiveMatchesResponse = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setMatches(data.matches);
      setLastUpdated(new Date(data.timestamp));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch live matches");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchLiveMatches();
    }
  }, [enabled, fetchLiveMatches]);

  // Set up polling
  useEffect(() => {
    if (!enabled || pollingInterval <= 0) return;

    const intervalId = setInterval(fetchLiveMatches, pollingInterval);

    return () => clearInterval(intervalId);
  }, [enabled, pollingInterval, fetchLiveMatches]);

  const refetch = useCallback(() => {
    setIsLoading(true);
    return fetchLiveMatches();
  }, [fetchLiveMatches]);

  return {
    matches,
    isLoading,
    error,
    lastUpdated,
    refetch,
    hasLiveMatches: matches.length > 0,
  };
}
