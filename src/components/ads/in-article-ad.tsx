"use client";

import { useSubscription } from "@/components/subscription/subscription-provider";
import { useUpgradeModal } from "@/components/subscription/upgrade-modal";
import { AdUnit } from "./ad-unit";

export function InArticleAd() {
  const { canAccess, isLoading } = useSubscription();
  const { openUpgradeModal } = useUpgradeModal();

  if (isLoading || canAccess("adFree")) return null;

  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  if (!clientId) return null;

  const slot = process.env.NEXT_PUBLIC_ADSENSE_IN_ARTICLE_SLOT;

  return (
    <div className="flex justify-center my-8">
      <div className="bg-white rounded-xl border border-neutral-200 p-4" style={{ maxWidth: 336 }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-neutral-400">Advertisement</span>
          <button
            onClick={() => openUpgradeModal("ad_free")}
            className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
          >
            Remove ads
          </button>
        </div>
        <div style={{ minHeight: 250 }}>
          <AdUnit slot={slot} format="fluid" layout="in-article" style={{ width: 300, height: 250 }} />
        </div>
      </div>
    </div>
  );
}
