"use client";

import Link from "next/link";
import { Cookie } from "lucide-react";
import { useCookieConsent } from "./cookie-consent-provider";

export function CookieConsentBanner() {
  const { consent, acceptCookies, rejectCookies } = useCookieConsent();

  if (consent !== null) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 animate-in slide-in-from-bottom fade-in duration-300">
      <div className="max-w-3xl mx-auto bg-white rounded-xl border border-neutral-200 shadow-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1">
          <Cookie className="w-5 h-5 text-neutral-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-neutral-600">
            We use cookies for analytics and personalized ads.
            By clicking &ldquo;Accept&rdquo; you consent to our use of cookies.{" "}
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
            onClick={rejectCookies}
            className="px-4 py-2 text-sm font-medium text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            Reject
          </button>
          <button
            onClick={acceptCookies}
            className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:shadow-lg transition-all"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
