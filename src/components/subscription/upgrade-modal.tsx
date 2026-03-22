"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import {
  X,
  Zap,
  TrendingUp,
  Heart,
  Download,
  BarChart3,
  Clock,
  Ban,
  Check,
  Loader2,
} from "lucide-react";
import { useSubscription } from "./subscription-provider";
import { useAnalytics } from "@/hooks/use-analytics";

type UpgradeFeature =
  | "comparison_limit"
  | "follow_limit"
  | "export_data"
  | "advanced_stats"
  | "historical_data"
  | "ad_free";

interface UpgradeModalContextType {
  openUpgradeModal: (feature: UpgradeFeature, context?: string) => void;
}

const UpgradeModalContext = createContext<UpgradeModalContextType | undefined>(
  undefined
);

const FEATURE_CONTENT: Record<
  UpgradeFeature,
  {
    icon: typeof TrendingUp;
    title: string;
    description: string;
    bullets: string[];
  }
> = {
  comparison_limit: {
    icon: TrendingUp,
    title: "Daily Limit Reached",
    description:
      "You've used all 3 free comparisons today. Upgrade for unlimited side-by-side player analysis.",
    bullets: [
      "Unlimited player comparisons",
      "Advanced stat breakdowns",
      "Export comparison data",
    ],
  },
  follow_limit: {
    icon: Heart,
    title: "Follow Limit Reached",
    description:
      "You're following 10 entities — the free tier limit. Upgrade for unlimited follows.",
    bullets: [
      "Unlimited player & team follows",
      "Personalized activity feed",
      "Match & transfer alerts",
    ],
  },
  export_data: {
    icon: Download,
    title: "Export Your Data",
    description:
      "Download all your data in JSON or CSV format. Available exclusively on Pro.",
    bullets: [
      "Export follows, bookmarks & predictions",
      "JSON and CSV formats",
      "Full data portability",
    ],
  },
  advanced_stats: {
    icon: BarChart3,
    title: "Advanced Statistics",
    description:
      "Unlock radar charts, heat maps, xG analytics, passing networks, and more.",
    bullets: [
      "Radar charts & attribute breakdowns",
      "Touch heat maps",
      "xG & expected assists analytics",
    ],
  },
  historical_data: {
    icon: Clock,
    title: "Historical Data",
    description:
      "Access multi-season statistics, historical squads, and career progression tracking.",
    bullets: [
      "Multi-season stat comparisons",
      "Historical squad data",
      "Career progression timelines",
    ],
  },
  ad_free: {
    icon: Ban,
    title: "Ad-Free Experience",
    description:
      "Remove all advertisements for a cleaner, distraction-free browsing experience.",
    bullets: [
      "No banner or sidebar ads",
      "No in-article interruptions",
      "Faster page loads",
    ],
  },
};

export function UpgradeModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [feature, setFeature] = useState<UpgradeFeature>("comparison_limit");
  const [context, setContext] = useState<string | undefined>();

  const openUpgradeModal = useCallback(
    (f: UpgradeFeature, ctx?: string) => {
      setFeature(f);
      setContext(ctx);
      setIsOpen(true);
    },
    []
  );

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <UpgradeModalContext.Provider value={{ openUpgradeModal }}>
      {children}
      {isOpen && (
        <UpgradeModal
          feature={feature}
          context={context}
          onClose={closeModal}
        />
      )}
    </UpgradeModalContext.Provider>
  );
}

export function useUpgradeModal() {
  const ctx = useContext(UpgradeModalContext);
  if (ctx === undefined) {
    throw new Error(
      "useUpgradeModal must be used within an UpgradeModalProvider"
    );
  }
  return ctx;
}

function UpgradeModal({
  feature,
  context,
  onClose,
}: {
  feature: UpgradeFeature;
  context?: string;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const { upgrade } = useSubscription();
  const { track } = useAnalytics();
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const content = FEATURE_CONTENT[feature];
  const Icon = content.icon;

  // Track impression on mount
  useEffect(() => {
    track({
      eventType: "upgrade_impression",
      metadata: { feature, context },
    });
  }, [feature, context, track]);

  // Lock body scroll + handle escape
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleDismiss();
      }
    };
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleDismiss = () => {
    track({
      eventType: "upgrade_dismiss",
      metadata: { feature, context },
    });
    onClose();
  };

  const handleUpgrade = async () => {
    track({
      eventType: "upgrade_click",
      metadata: { feature, context },
    });
    setUpgrading(true);
    setError(null);
    try {
      await upgrade("pro", "annual");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setUpgrading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleDismiss();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-4">
            <Icon className="w-7 h-7" />
          </div>
          <h2 id="upgrade-modal-title" className="text-2xl font-bold mb-1">
            {content.title}
          </h2>
          <p className="text-blue-100 text-sm">{content.description}</p>
        </div>

        {/* Body */}
        <div className="p-6">
          <ul className="space-y-3 mb-6">
            {content.bullets.map((bullet, i) => (
              <li key={i} className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-neutral-700">{bullet}</span>
              </li>
            ))}
          </ul>

          <div className="text-center mb-4">
            <span className="text-3xl font-bold text-neutral-900">&euro;8</span>
            <span className="text-neutral-500 text-sm">/year</span>
            <p className="text-xs text-neutral-400 mt-1">
              Less than a coffee per month
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
              {error}
            </p>
          )}

          <button
            onClick={handleUpgrade}
            disabled={upgrading}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {upgrading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Zap className="w-5 h-5" />
            )}
            {upgrading ? "Redirecting..." : "Upgrade to Pro"}
          </button>

          <button
            onClick={handleDismiss}
            className="w-full mt-3 py-2.5 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
