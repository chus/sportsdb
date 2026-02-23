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
  isUltimate: boolean;
  canAccess: (feature: keyof TierFeatures) => boolean;
  getLimit: (
    feature: "maxFollows" | "comparisonsPerDay" | "apiCallsPerDay"
  ) => number;
  upgrade: (tier: "pro" | "ultimate") => Promise<void>;
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

  const tier: SubscriptionTier = subscription?.tier ?? "free";
  const isPro = tier === "pro" || tier === "ultimate";
  const isUltimate = tier === "ultimate";

  const canAccess = useCallback(
    (feature: keyof TierFeatures): boolean => {
      return canAccessFeature(tier, feature);
    },
    [tier]
  );

  const getLimit = useCallback(
    (
      feature: "maxFollows" | "comparisonsPerDay" | "apiCallsPerDay"
    ): number => {
      return getFeatureLimit(tier, feature);
    },
    [tier]
  );

  const upgrade = useCallback(
    async (newTier: "pro" | "ultimate") => {
      try {
        const res = await fetch("/api/subscriptions/upgrade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier: newTier }),
        });

        if (res.ok) {
          await fetchSubscription();
        } else {
          const data = await res.json();
          throw new Error(data.error || "Failed to upgrade");
        }
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
        isUltimate,
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
