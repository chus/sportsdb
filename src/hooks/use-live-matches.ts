"use client";

import { useState, useEffect, useCallback } from "react";

interface LiveMatch {
  id: string;
  slug: string | null;
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
  // 5 minutes. Match minute/score granularity is a nice-to-have, not a
  // real-time product — and every poll is a serverless invocation. The
  // endpoint is also CDN-cached, so most polls never reach the DB.
  const { pollingInterval = 300_000, enabled = true } = options;

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

  // Set up polling — only while the tab is visible. Backgrounded tabs used
  // to poll forever (30s interval, mounted site-wide via ScoreStrip), which
  // kept the DB compute awake 24/7 with zero actual viewers.
  useEffect(() => {
    if (!enabled || pollingInterval <= 0) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (intervalId === null) {
        intervalId = setInterval(fetchLiveMatches, pollingInterval);
      }
    };
    const stop = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        fetchLiveMatches(); // catch up immediately on return
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
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
