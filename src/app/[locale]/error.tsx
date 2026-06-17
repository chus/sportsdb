"use client";

import { Link } from "@/i18n/navigation";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-surface-2 px-4 py-20">
      <div className="mx-auto max-w-2xl rounded-3xl border border-line bg-surface p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-600">
          Something broke
        </p>
        <h1 className="mt-3 text-3xl font-bold text-ink">
          We couldn&apos;t load this page right now.
        </h1>
        <p className="mt-4 text-muted">
          Try again or head back to the homepage. If the problem persists, the route may be missing data or an upstream request may have failed.
        </p>
        {error.digest && (
          <p className="mt-4 text-xs text-faint">Reference: {error.digest}</p>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="rounded-full border border-line px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-blue-300 hover:text-blue-600"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
