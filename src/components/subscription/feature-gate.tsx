"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { Lock, Zap } from "lucide-react";
import { useSubscription } from "./subscription-provider";
import { TierFeatures } from "@/lib/subscriptions/tiers";

interface FeatureGateProps {
  feature: keyof TierFeatures;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
}

export function FeatureGate({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
}: FeatureGateProps) {
  const { canAccess, isLoading } = useSubscription();

  if (isLoading) {
    return (
      <div className="animate-pulse bg-neutral-100 rounded-xl h-32" />
    );
  }

  if (canAccess(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  return <UpgradePrompt feature={feature} />;
}

interface UpgradePromptProps {
  feature: keyof TierFeatures;
  title?: string;
  description?: string;
}

const featureDescriptions: Record<keyof TierFeatures, { title: string; description: string }> = {
  maxFollows: {
    title: "Follow Limit Reached",
    description: "Upgrade to Pro for unlimited follows",
  },
  comparisonsPerDay: {
    title: "Comparison Limit Reached",
    description: "Upgrade to Pro for unlimited comparisons",
  },
  advancedStats: {
    title: "Advanced Stats",
    description: "Access detailed player analytics, radar charts, and more",
  },
  adFree: {
    title: "Ad-Free Experience",
    description: "Remove all ads for a cleaner experience",
  },
  exportData: {
    title: "Export Data",
    description: "Download player and team data in CSV or PDF format",
  },
  fantasyOptimizer: {
    title: "Fantasy Team Optimizer",
    description: "AI-powered team suggestions for fantasy leagues",
  },
  aiAnalytics: {
    title: "AI Predictive Analytics",
    description: "Machine learning insights and predictions",
  },
  apiCallsPerDay: {
    title: "API Access",
    description: "Programmatic access to SportsDB data",
  },
  historicalData: {
    title: "Historical Data",
    description: "Access 20+ years of historical statistics",
  },
  earlyAccess: {
    title: "Early Access",
    description: "Be the first to try new features",
  },
};

export function UpgradePrompt({
  feature,
  title,
  description,
}: UpgradePromptProps) {
  const featureInfo = featureDescriptions[feature];

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-8 text-center">
      <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
        <Lock className="w-8 h-8 text-white" />
      </div>

      <h3 className="text-xl font-bold text-neutral-900 mb-2">
        {title || featureInfo.title}
      </h3>
      <p className="text-neutral-600 mb-6 max-w-md mx-auto">
        {description || featureInfo.description}
      </p>

      <Link
        href="/pricing"
        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold"
      >
        <Zap className="w-5 h-5" />
        Upgrade to Pro
      </Link>
    </div>
  );
}

// Hook for checking access without rendering
export function useFeatureAccess(feature: keyof TierFeatures) {
  const { canAccess, tier } = useSubscription();
  return {
    hasAccess: canAccess(feature),
    tier,
  };
}
