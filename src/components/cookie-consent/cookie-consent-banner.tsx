"use client";

import { useState } from "react";
import Link from "next/link";
import { Cookie, Settings, Shield } from "lucide-react";
import {
  useCookieConsent,
  type CookieConsentPreferences,
} from "./cookie-consent-provider";

export function CookieConsentBanner() {
  const {
    consent,
    acceptAll,
    rejectNonEssential,
    savePreferences,
    showSettings,
    closeSettings,
  } = useCookieConsent();
  const [expanded, setExpanded] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [ads, setAds] = useState(true);

  // Show banner if no consent given yet, or if settings explicitly opened
  const visible = consent === null || showSettings;
  if (!visible) return null;

  const handleSavePreferences = () => {
    const prefs: CookieConsentPreferences = {
      essential: true,
      analytics,
      ads,
    };
    savePreferences(prefs);
    setExpanded(false);
    closeSettings();
  };

  const handleAcceptAll = () => {
    acceptAll();
    setExpanded(false);
    closeSettings();
  };

  const handleRejectNonEssential = () => {
    rejectNonEssential();
    setExpanded(false);
    closeSettings();
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 animate-in slide-in-from-bottom fade-in duration-300">
      <div className="max-w-3xl mx-auto bg-white rounded-xl border border-neutral-200 shadow-2xl overflow-hidden">
        {/* Main banner */}
        <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-start gap-3 flex-1">
            <Cookie className="w-5 h-5 text-neutral-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-neutral-600">
              We use cookies to improve your experience and analyze site
              traffic.{" "}
              <Link
                href="/privacy"
                className="text-blue-600 font-medium hover:underline"
              >
                Privacy Policy
              </Link>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setExpanded(!expanded)}
              className="px-3 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-800 flex items-center gap-1.5 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </button>
            <button
              onClick={handleRejectNonEssential}
              className="px-4 py-2 text-sm font-medium text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              Reject Non-Essential
            </button>
            <button
              onClick={handleAcceptAll}
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:shadow-lg transition-all"
            >
              Accept All
            </button>
          </div>
        </div>

        {/* Expanded settings */}
        {expanded && (
          <div className="border-t border-neutral-200 p-5 bg-neutral-50">
            <div className="space-y-4">
              {/* Essential */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      Essential
                    </p>
                    <p className="text-xs text-neutral-500">
                      Required for the site to function. Cannot be disabled.
                    </p>
                  </div>
                </div>
                <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-green-600 cursor-not-allowed opacity-70">
                  <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-6" />
                </div>
              </div>

              {/* Analytics */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    Analytics
                  </p>
                  <p className="text-xs text-neutral-500">
                    Google Analytics — helps us understand how visitors use the
                    site.
                  </p>
                </div>
                <button
                  onClick={() => setAnalytics(!analytics)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    analytics ? "bg-blue-600" : "bg-neutral-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      analytics ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Advertising */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    Advertising
                  </p>
                  <p className="text-xs text-neutral-500">
                    Google AdSense — used to display relevant advertisements.
                  </p>
                </div>
                <button
                  onClick={() => setAds(!ads)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    ads ? "bg-blue-600" : "bg-neutral-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      ads ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <button
                onClick={handleSavePreferences}
                className="w-full px-4 py-2 text-sm font-semibold text-white bg-neutral-800 rounded-lg hover:bg-neutral-900 transition-colors"
              >
                Save Preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
