"use client";

import { useState, useEffect } from "react";
import { Mail, X, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useAnalytics } from "@/hooks/use-analytics";

/**
 * Inline email opt-in capture. Shown at high-intent moments (post-challenge,
 * post-prediction, trial landing) to grow the consented audience the digest +
 * reminder crons need. Hits the already-wired /api/auth/marketing-consent
 * endpoint, which flips notification_settings.email_enabled (the cron gate).
 *
 * Self-hiding: renders nothing if the user isn't logged in, already consented,
 * or dismissed this context. Dismissal is per-context (localStorage) so one
 * "no" doesn't kill every prompt.
 */
interface EmailOptInCardProps {
  /** Stable key for analytics + per-context dismissal (e.g. "challenge_complete"). */
  context: string;
  title: string;
  description: string;
  cta?: string;
}

export function EmailOptInCard({ context, title, description, cta = "Email me" }: EmailOptInCardProps) {
  const { user, refreshUser } = useAuth();
  const { track } = useAnalytics();
  const [dismissed, setDismissed] = useState(true); // default hidden to avoid flash before localStorage read
  const [submitting, setSubmitting] = useState(false);
  const [justEnabled, setJustEnabled] = useState(false);

  const storageKey = `optin_dismissed_${context}`;
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(storageKey) === "1");
    } catch {
      setDismissed(false);
    }
  }, [storageKey]);

  if (justEnabled) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        <Check className="h-5 w-5 shrink-0" />
        <span>You&apos;re in — we&apos;ll keep you posted. Manage anytime in your account.</span>
      </div>
    );
  }

  if (!user || user.marketingEmailConsent || dismissed) return null;

  const enable = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/marketing-consent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true }),
      });
      if (res.ok) {
        track({ eventType: "click", metadata: { action: "email_optin", context } });
        setJustEnabled(true);
        await refreshUser();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  return (
    <div className="relative flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100">
        <Mail className="h-4 w-4 text-blue-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
        <button
          onClick={enable}
          disabled={submitting}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {cta}
        </button>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-1 text-faint transition-colors hover:bg-blue-100 hover:text-muted"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
