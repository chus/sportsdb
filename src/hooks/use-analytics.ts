"use client";

import { useCallback, useEffect, useRef } from "react";

type EventType = "page_view" | "search" | "follow" | "click" | "share";
type EntityType = "player" | "team" | "competition" | "match";

interface AnalyticsEvent {
  eventType: EventType;
  entityType?: EntityType;
  entityId?: string;
  searchQuery?: string;
  metadata?: Record<string, unknown>;
  referrer?: string;
}

const BATCH_SIZE = 10;
const FLUSH_INTERVAL = 5000; // 5 seconds

export function useAnalytics() {
  const eventQueue = useRef<AnalyticsEvent[]>([]);
  const sessionId = useRef<string | null>(null);
  const flushTimeout = useRef<NodeJS.Timeout | null>(null);

  // Generate session ID on mount
  useEffect(() => {
    sessionId.current = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return () => {
      // Flush remaining events on unmount
      if (eventQueue.current.length > 0) {
        flush();
      }
      if (flushTimeout.current) {
        clearTimeout(flushTimeout.current);
      }
    };
  }, []);

  const flush = useCallback(async () => {
    if (eventQueue.current.length === 0) return;

    const events = [...eventQueue.current];
    eventQueue.current = [];

    try {
      await fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events,
          sessionId: sessionId.current,
        }),
      });
    } catch (error) {
      // Re-queue events on failure
      eventQueue.current = [...events, ...eventQueue.current];
      console.error("Failed to send analytics:", error);
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimeout.current) {
      clearTimeout(flushTimeout.current);
    }
    flushTimeout.current = setTimeout(flush, FLUSH_INTERVAL);
  }, [flush]);

  const track = useCallback(
    (event: AnalyticsEvent) => {
      eventQueue.current.push({
        ...event,
        referrer: typeof document !== "undefined" ? document.referrer : undefined,
      });

      if (eventQueue.current.length >= BATCH_SIZE) {
        flush();
      } else {
        scheduleFlush();
      }
    },
    [flush, scheduleFlush]
  );

  const trackPageView = useCallback(
    (entityType?: EntityType, entityId?: string) => {
      track({
        eventType: "page_view",
        entityType,
        entityId,
      });
    },
    [track]
  );

  const trackSearch = useCallback(
    (query: string) => {
      track({
        eventType: "search",
        searchQuery: query,
      });
    },
    [track]
  );

  const trackFollow = useCallback(
    (entityType: EntityType, entityId: string) => {
      track({
        eventType: "follow",
        entityType,
        entityId,
      });
    },
    [track]
  );

  const trackClick = useCallback(
    (entityType: EntityType, entityId: string, metadata?: Record<string, unknown>) => {
      track({
        eventType: "click",
        entityType,
        entityId,
        metadata,
      });
    },
    [track]
  );

  const trackShare = useCallback(
    (entityType: EntityType, entityId: string, platform?: string) => {
      track({
        eventType: "share",
        entityType,
        entityId,
        metadata: platform ? { platform } : undefined,
      });
    },
    [track]
  );

  return {
    track,
    trackPageView,
    trackSearch,
    trackFollow,
    trackClick,
    trackShare,
  };
}
