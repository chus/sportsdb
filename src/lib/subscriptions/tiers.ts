export type SubscriptionTier = "free" | "pro" | "ultimate";

export interface TierFeatures {
  maxFollows: number;
  comparisonsPerDay: number;
  advancedStats: boolean;
  adFree: boolean;
  exportData: boolean;
  fantasyOptimizer: boolean;
  aiAnalytics: boolean;
  apiCallsPerDay: number;
  historicalData: boolean;
  earlyAccess: boolean;
}

export interface TierConfig {
  name: string;
  price: number;
  period: "month" | "forever";
  description: string;
  features: TierFeatures;
}

export const SUBSCRIPTION_TIERS: Record<SubscriptionTier, TierConfig> = {
  free: {
    name: "Free",
    price: 0,
    period: "forever",
    description: "Perfect for casual fans",
    features: {
      maxFollows: 10,
      comparisonsPerDay: 3,
      advancedStats: false,
      adFree: false,
      exportData: false,
      fantasyOptimizer: false,
      aiAnalytics: false,
      apiCallsPerDay: 0,
      historicalData: false,
      earlyAccess: false,
    },
  },
  pro: {
    name: "Pro",
    price: 4.99,
    period: "month",
    description: "For serious sports enthusiasts",
    features: {
      maxFollows: Infinity,
      comparisonsPerDay: Infinity,
      advancedStats: true,
      adFree: true,
      exportData: true,
      fantasyOptimizer: false,
      aiAnalytics: false,
      apiCallsPerDay: 100,
      historicalData: true,
      earlyAccess: true,
    },
  },
  ultimate: {
    name: "Ultimate",
    price: 9.99,
    period: "month",
    description: "For data analysts & power users",
    features: {
      maxFollows: Infinity,
      comparisonsPerDay: Infinity,
      advancedStats: true,
      adFree: true,
      exportData: true,
      fantasyOptimizer: true,
      aiAnalytics: true,
      apiCallsPerDay: 1000,
      historicalData: true,
      earlyAccess: true,
    },
  },
} as const;

export function getTierFeatures(tier: SubscriptionTier): TierFeatures {
  return SUBSCRIPTION_TIERS[tier].features;
}

export function getTierConfig(tier: SubscriptionTier): TierConfig {
  return SUBSCRIPTION_TIERS[tier];
}

export function canAccessFeature(
  tier: SubscriptionTier,
  feature: keyof TierFeatures
): boolean {
  const features = getTierFeatures(tier);
  const value = features[feature];

  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value > 0 || value === Infinity;
  }
  return false;
}

export function getFeatureLimit(
  tier: SubscriptionTier,
  feature: "maxFollows" | "comparisonsPerDay" | "apiCallsPerDay"
): number {
  return getTierFeatures(tier)[feature];
}

export function isUnlimited(limit: number): boolean {
  return limit === Infinity;
}
