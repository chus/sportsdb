"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  SubscriptionTier,
  TierConfig,
  getTierConfig,
  canAccessFeature,
  getFeatureLimit,
  TierFeatures,
} from "@/lib/subscriptions/tiers";

interface Subscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  status: "active" | "cancelled" | "past_due";
  startDate: Date;
  endDate: Date | null;
  autoRenew: boolean;
  tierConfig: TierConfig;
}

interface SubscriptionContextType {
  subscription: Subscription | null;
  isLoading: boolean;
  tier: SubscriptionTier;
  isPro: boolean;
  canAccess: (feature: keyof TierFeatures) => boolean;
  getLimit: (
    feature: "maxFollows" | "comparisonsPerDay"
  ) => number;
  upgrade: (tier: "pro", period?: "monthly" | "annual") => Promise<void>;
  downgrade: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined
);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/subscriptions");
      if (res.ok) {
        const data = await res.json();
        setSubscription({
          ...data.subscription,
          startDate: new Date(data.subscription.startDate),
          endDate: data.subscription.endDate
            ? new Date(data.subscription.endDate)
            : null,
        });
      }
    } catch (error) {
      console.error("Error fetching subscription:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Re-fetch after returning from Stripe checkout (webhook may need a moment).
  // Read from window.location instead of useSearchParams so this client provider
  // doesn't force every page into a Suspense boundary.
  useEffect(() => {
    if (typeof window === "undefined" || !user) return;
    const upgraded = new URLSearchParams(window.location.search).get("upgraded");
    if (upgraded) {
      const timer = setTimeout(() => fetchSubscription(), 1500);
      return () => clearTimeout(timer);
    }
  }, [user, fetchSubscription]);

  const tier: SubscriptionTier = subscription?.tier === "pro" ? "pro" : "free";
  const isPro = tier === "pro";

  const canAccess = useCallback(
    (feature: keyof TierFeatures): boolean => {
      return canAccessFeature(tier, feature);
    },
    [tier]
  );

  const getLimit = useCallback(
    (
      feature: "maxFollows" | "comparisonsPerDay"
    ): number => {
      return getFeatureLimit(tier, feature);
    },
    [tier]
  );

  const upgrade = useCallback(
    async (newTier: "pro", period: "monthly" | "annual" = "monthly") => {
      try {
        const res = await fetch("/api/subscriptions/upgrade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier: newTier, period }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to upgrade");
        }

        // If Stripe returns a checkout URL, redirect to it
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
          return;
        }

        // Otherwise it was an inline upgrade (existing subscription)
        await fetchSubscription();
      } catch (error) {
        console.error("Error upgrading:", error);
        throw error;
      }
    },
    [fetchSubscription]
  );

  const downgrade = useCallback(async () => {
    try {
      const res = await fetch("/api/subscriptions/downgrade", {
        method: "POST",
      });

      if (res.ok) {
        await fetchSubscription();
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to downgrade");
      }
    } catch (error) {
      console.error("Error downgrading:", error);
      throw error;
    }
  }, [fetchSubscription]);

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        isLoading,
        tier,
        isPro,
        canAccess,
        getLimit,
        upgrade,
        downgrade,
        refresh: fetchSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error(
      "useSubscription must be used within a SubscriptionProvider"
    );
  }
  return context;
}
